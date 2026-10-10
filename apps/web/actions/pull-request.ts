"use server";

import { supabase } from '../lib/supabase';
import { PullRequest, Commit, Project, EngineRoomPayload } from '../types/database';
import { evaluatePullRequest } from '../lib/crdt-merge';
import { compileTimelineViewModel } from '../lib/otio-compiler';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';

export async function getPullRequestData(prId: string): Promise<{ success: boolean; data?: EngineRoomPayload; error?: string }> {
  noStore();
  try {
    // 1. Fetch Pull Request
    const { data: pr, error: prError } = await supabase
      .from('pull_requests')
      .select('*')
      .eq('id', prId)
      .single();

    if (prError || !pr) {
      throw new Error(`Failed to fetch Pull Request: ${prError?.message || 'Not found'}`);
    }

    const pullRequest = pr as PullRequest;

    // Fetch the main branch to dynamically get its head commit
    const { data: mainBranch } = await supabase
      .from('branches')
      .select('head_commit_id')
      .eq('name', 'main')
      .eq('project_id', pullRequest.project_id)
      .single();

    const targetCommitId = mainBranch?.head_commit_id || pullRequest.base_commit_id;

    const commitIdsToFetch = Array.from(new Set([
      pullRequest.base_commit_id,
      targetCommitId,
      pullRequest.incoming_commit_id
    ].filter(Boolean) as string[]));

    const { data: commitsRes, error: commitsErr } = await supabase
      .from('commits')
      .select('*')
      .in('id', commitIdsToFetch);

    if (commitsErr || !commitsRes) throw new Error("Failed to fetch triad commits");

    const ancestor = commitsRes.find(c => c.id === pullRequest.base_commit_id);
    const target = commitsRes.find(c => c.id === targetCommitId);
    const incoming = commitsRes.find(c => c.id === pullRequest.incoming_commit_id);

    if (!ancestor || !target || !incoming) throw new Error("Missing 3-Way Triad commits");

    // Fetch Project
    const { data: project } = await supabase.from('projects').select('*').eq('id', pullRequest.project_id).single();
    if (!project) throw new Error(`Failed to fetch Project context`);

    // Pre-Flight Evaluation
    const diffAnalysis = evaluatePullRequest(target.otio_manifest, incoming.otio_manifest);
    const targetTimelineResult = compileTimelineViewModel(target.otio_manifest);
    const incomingTimelineResult = compileTimelineViewModel(incoming.otio_manifest, target.otio_manifest);
    const targetTimeline = targetTimelineResult.tracks;
    const incomingTimeline = incomingTimelineResult.tracks;
    const masterDiffDuration = Math.max(targetTimelineResult.totalDuration, incomingTimelineResult.totalDuration);

    // Fetch temporal comments
    const { data: rawComments, error } = await supabase.from('temporal_comments').select('*').eq('pr_id', prId);

    const comments = (rawComments || []).map(c => ({
      id: c.id,
      text: c.body,
      time: c.time_stamp?.time ?? 0,
      timestamp: c.time_stamp?.time ?? 0,
      xPct: c.spatial_x,
      yPct: c.spatial_y,
      isHistorical: false
    }));

    const targetProxyUrl = target.otio_manifest?._proxy_url || target.proxy_url;
    const isInitialPR = 
      target.id === incoming.id ||
      (!target.otio_manifest?.tracks?.children?.length && !targetProxyUrl);

    return {
      success: true,
      data: {
        pullRequest,
        isInitialPR,
        commits: {
          ancestor: {
            proxyUrl: ancestor.otio_manifest?._proxy_url || ancestor.proxy_url || null
          },
          target: {
            tvm: targetTimeline,
            proxyUrl: target.otio_manifest?._proxy_url || target.proxy_url || null
          },
          incoming: {
            tvm: incomingTimeline,
            proxyUrl: incoming.otio_manifest?._proxy_url || incoming.proxy_url || null
          }
        },
        diffAnalysis: {
          canAutoMerge: diffAnalysis.status === 'auto_merged',
          conflicts: diffAnalysis.conflicts || [],
          semanticChangelog: (diffAnalysis as any).changelog || []
        },
        comments: comments || [],
        project: { ...project, asset_ledger: project.asset_ledger || {} },
        masterDiffDuration
      }
    };
  } catch (error: any) {
    console.error("Server Action Error [getPullRequestData]:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred"
    };
  }
}



export async function getOpenPullRequests() {
  try {
    const { data, error } = await supabase
      .from('pull_requests')
      .select('id, title, status, project_id, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error || !data) {
      throw new Error(`Failed to fetch PRs: ${error?.message}`);
    }
    
    return { success: true, data: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error" };
  }
}

export async function getProjectPullRequests(projectId: string) {
  try {
    const { data, error } = await supabase
      .from('pull_requests')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function mergePullRequest(prId: string) {
  try {
    const { data: pr, error: prErr } = await supabase.from('pull_requests').select('*').eq('id', prId).single();
    if (prErr || !pr) throw new Error("PR not found");

    const { data: baseCommit } = await supabase.from('commits').select('otio_manifest').eq('id', pr.base_commit_id).single();
    const { data: incomingCommit } = await supabase.from('commits').select('otio_manifest').eq('id', pr.incoming_commit_id).single();

    if (!baseCommit || !incomingCommit) throw new Error("Missing commits");

    const result = evaluatePullRequest(baseCommit.otio_manifest as any, incomingCommit.otio_manifest as any);

    if (result.status === 'conflict') {
      await supabase.from('pull_requests').update({ status: 'conflict' }).eq('id', prId);
      return { success: false, status: 'conflict', conflicts: result.conflicts };
    }

    const { data: mergeCommit, error: mErr } = await supabase.from('commits').insert({
      project_id: pr.project_id,
      message: `Merge pull request #${pr.id.split('-')[0]}`,
      otio_manifest: result.finalManifest,
      parent_ids: [pr.base_commit_id, pr.incoming_commit_id]
    }).select('id').single();

    if (mErr || !mergeCommit) throw new Error("Failed to create merge commit");

    const { data: updatedBranch, error: branchErr } = await supabase.from('branches')
      .update({ head_commit_id: mergeCommit.id })
      .eq('name', 'main')
      .eq('project_id', pr.project_id)
      .select()
      .single();

    if (branchErr || !updatedBranch) throw new Error("Failed to update main branch. Transaction aborted.");

    await supabase.from('pull_requests').update({ status: 'merged' }).eq('id', prId);
    
    revalidatePath('/', 'layout');
    return { success: true, status: 'merged', finalManifest: result.finalManifest };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}


