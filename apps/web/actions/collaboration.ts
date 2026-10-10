"use server";

import { supabase } from '../lib/supabase';
import { revalidatePath } from 'next/cache';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function uploadProxyFile(prId: string, formData: FormData): Promise<ActionResponse<string>> {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file provided");

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${prId}/${fileName}`;
    
    console.log(`[SERVER AUDIT] Attempting to upload proxy of size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);

    const uploadStart = performance.now();
    const { error: uploadError } = await supabase.storage
      .from('proxies')
      .upload(filePath, file);
    console.log(`[SERVER AUDIT] Supabase Storage Upload took: ${((performance.now() - uploadStart) / 1000).toFixed(2)}s`);

    if (uploadError) throw new Error(`Proxy upload failed: ${uploadError.message}`);

    const { data: publicUrlData } = supabase.storage
      .from('proxies')
      .getPublicUrl(filePath);
      
    return { success: true, data: publicUrlData.publicUrl };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createProject(name: string): Promise<ActionResponse<{ projectId: string, inviteUrl: string }>> {
  try {
    const { data: project, error: pError } = await supabase
      .from('projects')
      .insert({ name, asset_ledger: {} })
      .select('id')
      .single();

    if (pError || !project) throw new Error(pError?.message || "Failed to create project");

    // Create root commit 0
    const { data: commit, error: cErr } = await supabase
      .from('commits')
      .insert({
        project_id: project.id,
        message: 'Initial Commit',
        otio_manifest: { tracks: [] },
        parent_ids: []
      })
      .select('id')
      .single();

    if (cErr || !commit) throw new Error(cErr?.message || "Failed to create root commit");

    // Initialize main branch
    const { error: bErr } = await supabase
      .from('branches')
      .insert({
        name: 'main',
        project_id: project.id,
        head_commit_id: commit.id
      });
      
    if (bErr) throw new Error(bErr.message || "Failed to initialize main branch");

    // Generate secure random string for invite token
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const { error: tError } = await supabase
      .from('project_invites')
      .insert({ project_id: project.id, token, is_active: true });
      
    if (tError) throw new Error(tError.message);

    revalidatePath('/');
    
    return { 
      success: true, 
      data: { 
        projectId: project.id, 
        inviteUrl: `/invite/${token}` 
      } 
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getGuestDashboard(token: string): Promise<ActionResponse<{ project: any, pullRequests: any[], currentProxyUrl: string | null, currentManifest: any }>> {
  try {
    const { data: invite, error: iError } = await supabase
      .from('project_invites')
      .select('project_id, is_active')
      .eq('token', token)
      .single();

    if (iError || !invite) throw new Error("Invalid or expired invite token");
    if (!invite.is_active) throw new Error("This invite link is no longer active");

    const { data: project, error: pError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', invite.project_id)
      .single();

    const { data: pullRequests, error: prError } = await supabase
      .from('pull_requests')
      .select('*')
      .eq('project_id', invite.project_id)
      .order('created_at', { ascending: false });

    if (pError || prError) throw new Error("Failed to load project data");

    const { data: branch, error: bErr } = await supabase
      .from('branches')
      .select('head_commit_id')
      .eq('project_id', invite.project_id)
      .eq('name', 'main')
      .single();

    let currentProxyUrl = null;
    let currentManifest = null;

    if (!bErr && branch) {
      const { data: headCommit } = await supabase
        .from('commits')
        .select('otio_manifest, proxy_url')
        .eq('id', branch.head_commit_id)
        .single();
        
      if (headCommit) {
        currentManifest = headCommit.otio_manifest;
        currentProxyUrl = headCommit.otio_manifest?._proxy_url || headCommit.proxy_url || null;
      }
    }

    const prsWithSyncStatus = await Promise.all(
      (pullRequests || []).map(async (pr: any) => {
         if (pr.status === 'open' || pr.status === 'draft' || pr.status === 'conflict') {
            const sync = await checkBranchSyncStatus(pr.id);
            if (sync.success && sync.data) {
               return { ...pr, syncStatus: sync.data };
            }
         }
         return pr;
      })
    );

    return {
      success: true,
      data: { project, pullRequests: prsWithSyncStatus, currentProxyUrl, currentManifest }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function submitRevisionToPR(
  prId: string, 
  otioManifest: string, 
  proxyUrl: string, 
  commitMessage: string,
  token: string
): Promise<ActionResponse<boolean>> {
  try {
    const prFetchStart = performance.now();
    // 1. Fetch PR to get the associated project
    const { data: pr, error: prErr } = await supabase
      .from('pull_requests')
      .select('project_id')
      .eq('id', prId)
      .single();
    console.log(`[SERVER AUDIT] Fetch PR took: ${((performance.now() - prFetchStart) / 1000).toFixed(2)}s`);

    if (prErr || !pr) throw new Error("Pull Request not found");

    // 2. Insert new commit
    const otio = JSON.parse(otioManifest);
    otio._proxy_url = proxyUrl; // Embed the proxy URL directly into the manifest payload

    const commitInsertStart = performance.now();
    const { data: commit, error: cErr } = await supabase
      .from('commits')
      .insert({
        project_id: pr.project_id,
        message: commitMessage,
        otio_manifest: otio
      })
      .select('id')
      .single();
    console.log(`[SERVER AUDIT] Insert commit took: ${((performance.now() - commitInsertStart) / 1000).toFixed(2)}s`);

    if (cErr || !commit) throw new Error(cErr?.message || "Failed to create commit");

    // 3. Update the PR's incoming commit, title, and reset status to open
    const prUpdateStart = performance.now();
    const { error: upErr } = await supabase
      .from('pull_requests')
      .update({
        incoming_commit_id: commit.id,
        title: commitMessage,
        status: 'open'
      })
      .eq('id', prId);
    console.log(`[SERVER AUDIT] Update PR head took: ${((performance.now() - prUpdateStart) / 1000).toFixed(2)}s`);

    if (upErr) throw new Error(upErr.message);

    // 4. Shadow Branching
    const shadowBranchStart = performance.now();
    const branchName = `guest/${token}`;
    const { data: existingBranch } = await supabase.from('branches').select('id').eq('name', branchName).eq('project_id', pr.project_id).single();

    if (!existingBranch) {
      const { error: insErr } = await supabase.from('branches').insert({
        name: branchName,
        project_id: pr.project_id,
        head_commit_id: commit.id
      });
      if (insErr) throw new Error("Failed to create shadow branch");
    } else {
      const { error: updErr } = await supabase.from('branches').update({ head_commit_id: commit.id }).eq('id', existingBranch.id);
      if (updErr) throw new Error("Failed to update shadow branch");
    }
    console.log(`[SERVER AUDIT] Shadow branching took: ${((performance.now() - shadowBranchStart) / 1000).toFixed(2)}s`);

    revalidatePath('/', 'layout');
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createEmptyPR(token: string): Promise<ActionResponse<string>> {
  try {
    const { data: invite, error: iError } = await supabase.from('project_invites').select('project_id').eq('token', token).single();
    if (iError || !invite) throw new Error("Invalid token");
    
    // 1. Fetch current head commit of the main branch
    const { data: branch, error: branchErr } = await supabase
      .from('branches')
      .select('head_commit_id')
      .eq('project_id', invite.project_id)
      .eq('name', 'main')
      .single();

    if (branchErr || !branch) throw new Error("Could not find main branch for this project");

    // 2. Create a distinct incoming commit linked to the base
    const { data: incomingCommit, error: iErr } = await supabase.from('commits').insert({
      project_id: invite.project_id,
      message: 'New Freelancer Submission',
      otio_manifest: { tracks: [], _proxy_url: null },
      parent_ids: [branch.head_commit_id]
    }).select('id').single();
    
    if (iErr || !incomingCommit) throw new Error("Failed to create incoming commit");

    // 3. Create the Draft PR
    const { data: pr, error: prErr } = await supabase.from('pull_requests').insert({
      project_id: invite.project_id,
      title: 'New Freelancer Submission',
      base_commit_id: branch.head_commit_id,
      incoming_commit_id: incomingCommit.id,
      status: 'open'
    }).select('id').single();
    
    if (prErr || !pr) throw new Error("Failed to create PR");
    
    revalidatePath('/', 'layout');
    return { success: true, data: pr.id };
  } catch (err: any) {
    console.log("Error",err);
    return { success: false, error: err.message };
  }
}

export async function deletePullRequest(prId: string, token: string): Promise<ActionResponse<boolean>> {
  try {
    // 1. Verify token
    const { data: invite, error: iError } = await supabase.from('project_invites').select('project_id').eq('token', token).single();
    if (iError || !invite) throw new Error("Invalid token");

    // 2. Verify PR belongs to project
    const { data: pr, error: prErr } = await supabase.from('pull_requests')
      .select('project_id, base_commit_id, incoming_commit_id')
      .eq('id', prId)
      .single();
    if (prErr || !pr) throw new Error("PR not found");
    if (pr.project_id !== invite.project_id) throw new Error("Unauthorized");

    // 3. Delete PR with select().single() to enforce RLS failure if it silently fails
    const { error: delErr } = await supabase.from('pull_requests').delete().eq('id', prId).select().single();
    if (delErr) throw new Error(delErr.message || "Failed to delete PR due to database constraints");

    // 4. Cascade delete the orphaned commits
    if (pr.base_commit_id) {
      await supabase.from('commits').delete().eq('id', pr.base_commit_id);
    }
    if (pr.incoming_commit_id && pr.incoming_commit_id !== pr.base_commit_id) {
      await supabase.from('commits').delete().eq('id', pr.incoming_commit_id);
    }

    revalidatePath('/', 'layout');
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function checkBranchSyncStatus(prId: string): Promise<ActionResponse<{ isBehind: boolean, mainHead?: string }>> {
  try {
    const { data: pr, error: prErr } = await supabase.from('pull_requests').select('base_commit_id, project_id').eq('id', prId).single();
    if (prErr || !pr) throw new Error("PR not found");

    const { data: main, error: mErr } = await supabase.from('branches').select('head_commit_id').eq('name', 'main').eq('project_id', pr.project_id).single();
    if (mErr || !main) throw new Error("Main branch not found");

    if (pr.base_commit_id !== main.head_commit_id) {
      return { success: true, data: { isBehind: true, mainHead: main.head_commit_id } };
    }
    return { success: true, data: { isBehind: false } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteTemporalComment(commentId: string): Promise<ActionResponse<boolean>> {
  try {
    const { error } = await supabase.from('temporal_comments').delete().eq('id', commentId);
    if (error) throw new Error(error.message);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addTemporalComment(
  prId: string, 
  text: string, 
  timestamp: number, 
  xPct: number, 
  yPct: number
): Promise<ActionResponse<any>> {
  try {
    const payload = {
      pr_id: prId,
      author: 'Lead Editor',
      body: text,
      time_stamp: { time: timestamp },
      spatial_x: xPct,
      spatial_y: yPct
    };
    
    const { data, error } = await supabase.from('temporal_comments').insert(payload).select().single();
    
    if (error) {
      throw new Error(error.message);
    }
    
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
