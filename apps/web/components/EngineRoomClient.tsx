"use client";

import React, { useState, useEffect } from 'react';
import { TimelineState, SpatialComment, ChangelogEntry } from '../types/timeline';
import { VideoDiffEngine } from './VideoDiffEngine';
import { GhostTimeline } from './GhostTimeline';
import { SpatialCommentOverlay } from './SpatialCommentOverlay';
import { PRSidebar } from './PRSidebar';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { GitPullRequest, ShieldCheck, ArrowLeft } from 'lucide-react';
import { mergePullRequest } from '../actions/pull-request';
import { deleteTemporalComment, addTemporalComment } from '../actions/collaboration';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface EngineRoomClientProps {
  pullRequest: any;
  isInitialPR: boolean;
  baseManifest: any;
  incomingManifest: any;
  baseProxyUrl: string | null;
  incomingProxyUrl: string | null;
  diffAnalysis: any;
  initialComments?: SpatialComment[];
  masterDiffDuration: number;
}

export const EngineRoomClient: React.FC<EngineRoomClientProps> = ({
  pullRequest, isInitialPR, baseManifest, incomingManifest, baseProxyUrl, incomingProxyUrl, diffAnalysis, initialComments, masterDiffDuration
}) => {
  const hydrate = usePlaybackStore(state => state.hydrate);
  const isHydrated = usePlaybackStore(state => state.hydrated);
  const setDuration = usePlaybackStore(state => state.setDuration);
  const setCurrentTimeStore = usePlaybackStore(state => state.setCurrentTime);

  const [comments, setComments] = useState<SpatialComment[]>(initialComments || []);
  const [currentTime, setCurrentTime] = useState(0);

  const isPlaying = usePlaybackStore(state => state.isPlaying);
  const setIsPlaying = usePlaybackStore(state => state.setIsPlaying);
  const activeTool = usePlaybackStore(state => state.activeTool);

  const togglePlay = () => {
    if (activeTool === 'comment') return;
    setIsPlaying(!isPlaying);
  };

  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [isAllResolved, setIsAllResolved] = useState(false);

  useEffect(() => {
    hydrate(baseManifest, incomingManifest, incomingProxyUrl || '');
    setDuration(masterDiffDuration || 30);
  }, [baseManifest, incomingManifest, incomingProxyUrl, hydrate, setDuration, masterDiffDuration]);

  useEffect(() => {
    return usePlaybackStore.subscribe((state) => {
      setCurrentTime(state.currentTime);
    });
  }, []);

  const conflicts = diffAnalysis?.conflicts || [];

  const handleAddComment = async (xPct: number, yPct: number, text: string) => {
    const time = usePlaybackStore.getState().currentTime;
    const tempId = Math.random().toString();
    setComments(prev => [...prev, { id: tempId, time, timestamp: time, xPct, yPct, text }]);
    const res = await addTemporalComment(pullRequest.id, text, time, xPct, yPct);
    if (res.success && res.data) {
      setComments(prev => prev.map(c => c.id === tempId ? { ...c, id: res.data.id } : c));
    } else {
      toast.error(`Database Error: ${res.error}`);
      setComments(prev => prev.filter(c => c.id !== tempId));
    }
  };

  const handleDeleteComment = async (id: string) => {
    setComments(prev => prev.filter(c => c.id !== id));
    await deleteTemporalComment(id);
  };

  const seekToComment = (time: number) => {
    setIsPlaying(false);
    setCurrentTimeStore(time);
  };

  if (!isHydrated) return <div className="h-full w-full bg-background flex items-center justify-center text-white/40">Loading workspace...</div>;

  const activeComments = comments.filter(c => Math.abs((c.timestamp ?? c.time) - currentTime) < 0.25);

  const changelog: ChangelogEntry[] = diffAnalysis?.semanticChangelog?.map((msg: string, idx: number) => ({
    id: `change-${idx}`,
    description: msg,
    timestamp: 0
  })) || [];

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-black flex flex-col text-white/90 font-sans">
      <header className="h-auto min-h-[4rem] py-4 xl:py-0 border-b border-white/10 bg-[#0A0A0A] flex flex-col lg:flex-row items-center justify-between px-6 shrink-0 z-10 backdrop-blur-md gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full lg:w-auto">
          <Link href={`/${pullRequest.project_id}/pulls`} className="p-2 bg-black border border-white/10 rounded-md shadow-sm hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white/60" />
          </Link>
          <div className="p-2 bg-maas-focus/10 border border-maas-focus/20 rounded-md shadow-sm">
            <GitPullRequest className="w-5 h-5 text-maas-focus" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base tracking-tight">{pullRequest.title}</h1>
            <p className="text-xs text-white/40 mt-0.5">
              Comparing
              <span className="mx-1.5 text-white/60 font-mono bg-elevated px-1.5 py-0.5 rounded border border-white/10">main</span>
              ←
              <span className="mx-1 text-maas-add font-mono bg-maas-add/10 px-1.5 py-0.5 rounded border border-maas-add/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">freelancer</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start lg:justify-end gap-3 w-full lg:w-auto">
          {conflicts.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-maas-add/10 border border-maas-add/20 text-maas-add text-xs font-bold rounded-full shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <ShieldCheck className="w-4 h-4" /> Safe to merge securely
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-maas-delete/10 border border-maas-delete/20 text-maas-delete text-sm font-bold rounded-full animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.15)]">
              <div className="w-2 h-2 rounded-full bg-maas-delete" />
              {conflicts.length} Conflicts Remaining
            </div>
          )}
          <button
            className="px-6 py-2 bg-maas-focus hover:bg-indigo-500 disabled:bg-elevated disabled:text-white/40 disabled:border-white/10 border border-maas-focus text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-maas-focus/20 flex items-center justify-center gap-2"
            disabled={conflicts.length > 0 || pullRequest.status == "merged"}
            onClick={async (e) => {
              const btn = e.currentTarget;
              btn.disabled = true;
              btn.innerHTML = '<svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Merging...';
              const res = await mergePullRequest(pullRequest.id);
              if (res.success) {
                toast.success("Merged successfully!");
                btn.innerHTML = 'Merged';
              } else {
                toast.error(res.error || "Failed to merge");
                btn.disabled = false;
                btn.innerHTML = 'Merge Pull Request';
              }
            }}
          >
            {pullRequest.status == 'merged' ? "Merged" : "Merge Pull Request"}
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        {/* Main Editor Panel */}
        <div className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden bg-[#050505] rounded-xl border border-white/5 relative">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-maas-focus/10 rounded-full blur-[120px] pointer-events-none hidden md:block" />

          <div className="flex-1 min-h-0 relative p-4 flex flex-col" onClick={togglePlay}>
            <VideoDiffEngine
              proxyUrlBase={baseProxyUrl}
              proxyUrlIncoming={incomingProxyUrl}
              baseManifest={baseManifest}
              incomingManifest={incomingManifest}
              resolutions={resolutions}
              isAllResolved={isAllResolved}
            >
              {activeTool === 'comment' && (
                <SpatialCommentOverlay
                  comments={activeComments}
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                  onSeek={seekToComment}
                />
              )}
            </VideoDiffEngine>
          </div>

          <div className="shrink-0 w-full bg-[#0A0A0A] border-t border-white/10">
            <GhostTimeline
              targetTimeline={baseManifest}
              incomingTimeline={incomingManifest}
              comments={comments}
              onResolutionChange={(res, isAll) => {
                setResolutions(res);
                setIsAllResolved(isAll);
              }}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-[360px] xl:w-[400px] flex-shrink-0 flex flex-col h-full bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20 relative">
          <PRSidebar
            comments={comments}
            changelog={changelog}
            pullRequest={pullRequest}
            onSeek={seekToComment}
            onDeleteComment={handleDeleteComment}
          />
        </div>
      </div>
    </div>
  );
};
