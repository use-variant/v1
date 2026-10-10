"use client";

import React, { useState, useEffect, useRef } from 'react';
import { TimelineState, SpatialComment, ChangelogEntry } from '../types/timeline';
import { VideoDiffEngine } from './VideoDiffEngine';
import { GhostTimeline } from './GhostTimeline';
import { SpatialCommentOverlay } from './SpatialCommentOverlay';
import { SemanticChangelog } from './SemanticChangelog';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { GitPullRequest, ShieldCheck, Loader2, ArrowLeft } from 'lucide-react';
import { VideoJuggler } from '../../../packages/react/src/VideoJuggler';
import { mergePullRequest } from '../actions/pull-request';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface VideoPullRequestProps {
  prData: any;
}

export const VideoPullRequest: React.FC<VideoPullRequestProps> = ({ prData }) => {
  const hydrate = usePlaybackStore(state => state.hydrate);
  const isHydrated = usePlaybackStore(state => state.hydrated);
  const setDuration = usePlaybackStore(state => state.setDuration);
  const proxyUrl = usePlaybackStore(state => state.proxyUrl);

  const [comments, setComments] = useState<SpatialComment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  // In production, parse OTIO JSON (baseManifest, incomingManifest) into TimelineState
  const [timelineState, setTimelineState] = useState<TimelineState>({ tracks: [], conflicts: [] });
  const [playbackChunks, setPlaybackChunks] = useState<any[]>([]);
  const isPlaying = usePlaybackStore(state => state.isPlaying);
  const setIsPlaying = usePlaybackStore(state => state.setIsPlaying);
  const togglePlay = () => setIsPlaying(!isPlaying);

  useEffect(() => {
    if (prData) {
      hydrate(prData.baseManifest, prData.incomingManifest, prData.proxyUrl);
      
      // Parse OTIO into chunks for VideoJuggler
      const chunks: any[] = [];
      let globalTime = 0;
      
      if (prData.incomingManifest?.tracks) {
         prData.incomingManifest.tracks.forEach((track: any) => {
           if (track.kind === 'Video' && track.children) {
             track.children.forEach((clip: any) => {
                const durVal = clip.source_range?.duration?.value;
                const durRate = clip.source_range?.duration?.rate;
                const startVal = clip.source_range?.start_time?.value;
                const startRate = clip.source_range?.start_time?.rate;

                if (durVal && durRate && startVal && startRate) {
                  const duration = durVal / durRate;
                  const sourceStart = startVal / startRate;
                  chunks.push({
                    id: clip.name || Math.random().toString(),
                    proxyUrl: prData.proxyUrl, // Assuming proxy comes from PR project
                    timelineStart: globalTime,
                    timelineEnd: globalTime + duration,
                    sourceStart: sourceStart
                  });
                  globalTime += duration;
                }
             });
           }
         });
      }
      
      setPlaybackChunks(chunks);

      const isInitialPR = !prData.baseManifest || !prData.baseManifest.tracks || prData.baseManifest.tracks.length === 0;

      let baseTracks: any[] = [];
      let conflicts: any[] = [];

      if (isInitialPR) {
        baseTracks = [{ id: 'V1', clips: [] }];
        chunks.forEach((chunk, idx) => {
           conflicts.push({
             id: `conf-${idx}`,
             trackId: 'V1',
             baseClip: null,
             incomingClip: { id: chunk.id, name: chunk.id, start: chunk.timelineStart, duration: chunk.timelineEnd - chunk.timelineStart, type: 'video' },
             status: 'pending'
           });
        });
      } else {
        baseTracks = [
          { id: 'V1', clips: chunks.map(c => ({ id: c.id, name: c.id, start: c.timelineStart, duration: c.timelineEnd - c.timelineStart, type: 'video' })) }
        ];
      }

      setTimelineState({
        tracks: baseTracks,
        conflicts: conflicts
      });
    }
  }, [prData, hydrate]);

  useEffect(() => {
    let maxTime = 10;
    timelineState.tracks.forEach(t => {
      t.clips.forEach(c => {
        if (c.start + c.duration > maxTime) maxTime = c.start + c.duration;
      });
    });
    timelineState.conflicts.forEach(c => {
      if (c.incomingClip && c.incomingClip.start + c.incomingClip.duration > maxTime) {
        maxTime = c.incomingClip.start + c.incomingClip.duration;
      }
    });
    setDuration(maxTime + 5);
  }, [timelineState, setDuration]);

  const jugglerRef = useRef<any>(null);

  useEffect(() => {
    return usePlaybackStore.subscribe((state) => {
      setCurrentTime(state.currentTime);
      if (jugglerRef.current) {
        const jt = jugglerRef.current.getCurrentTime();
        if (Math.abs(state.currentTime - jt) > 0.5) {
          jugglerRef.current.seek(state.currentTime);
        }
      }
    });
  }, []);

  const handleTimeUpdate = (time: number) => {
    usePlaybackStore.getState().setCurrentTime(time);
  };

  const handleResolveConflict = (conflictId: string, choice: 'base' | 'incoming') => {
    setTimelineState(prev => {
      const conflict = prev.conflicts.find(c => c.id === conflictId);
      if (!conflict) return prev;

      let newTracks = [...prev.tracks];
      if (choice === 'incoming' && conflict.incomingClip) {
         newTracks = newTracks.map(t => {
           if (t.id === conflict.trackId) {
             return { ...t, clips: [...t.clips, conflict.incomingClip!] };
           }
           return t;
         });
      }

      return {
        tracks: newTracks,
        conflicts: prev.conflicts.filter(c => c.id !== conflictId)
      };
    });
  };

  const handleAddComment = (xPct: number, yPct: number, text: string) => {
    const time = usePlaybackStore.getState().currentTime;
    setComments(prev => [...prev, { id: Math.random().toString(), time, xPct, yPct, text }]);
  };

  if (!isHydrated) return <div className="h-full w-full bg-background flex items-center justify-center text-white/40">Loading workspace...</div>;

  const activeComments = comments.filter(c => Math.abs(c.time - currentTime) <= 2);

  const isInitialPR = !prData?.baseManifest || !prData?.baseManifest?.tracks || prData?.baseManifest?.tracks?.length === 0;
  
  const changelog: ChangelogEntry[] = [];
  if (isInitialPR) {
    playbackChunks.forEach((chunk, index) => {
      changelog.push({
        id: `change-${index}`,
        description: `Added "${chunk.id}"`,
        timestamp: chunk.timelineStart,
      });
    });
  } else {
    timelineState.conflicts.forEach((conflict, index) => {
      changelog.push({
         id: conflict.id,
         description: conflict.incomingClip ? `Added "${conflict.incomingClip.name}"` : `Removed clip`,
         timestamp: conflict.incomingClip?.start || 0
      });
    });
  }

  return (
    <div className="flex flex-col xl:flex-row h-full w-full bg-background text-white/90 font-sans overflow-hidden">
      
      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-auto min-h-[4rem] py-4 xl:py-0 border-b border-white/10 bg-surface flex flex-col lg:flex-row items-center justify-between px-6 shrink-0 z-10 backdrop-blur-md gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full lg:w-auto">
            <Link href={`/${prData.pullRequest.project_id}/pulls`} className="p-2 bg-black border border-white/10 rounded-md shadow-sm hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-white/60" />
            </Link>
            <div className="p-2 bg-maas-focus/10 border border-maas-focus/20 rounded-md shadow-sm">
              <GitPullRequest className="w-5 h-5 text-maas-focus" />
            </div>
            <div>
              <h1 className="font-bold text-white text-base tracking-tight">{prData.pullRequest.title}</h1>
              <p className="text-xs text-white/40 mt-0.5">
                Comparing 
                <span className="mx-1.5 text-white/60 font-mono bg-elevated px-1.5 py-0.5 rounded border border-white/10">main</span> 
                ← 
                <span className="mx-1 text-maas-add font-mono bg-maas-add/10 px-1.5 py-0.5 rounded border border-maas-add/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">freelancer</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start lg:justify-end gap-3 w-full lg:w-auto">
             {timelineState.conflicts.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-maas-add/10 border border-maas-add/20 text-maas-add text-xs font-bold rounded-full shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  <ShieldCheck className="w-4 h-4" /> Safe to merge securely
                </div>
             ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-maas-delete/10 border border-maas-delete/20 text-maas-delete text-sm font-bold rounded-full animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                  <div className="w-2 h-2 rounded-full bg-maas-delete" />
                  {timelineState.conflicts.length} Conflicts Remaining
                </div>
             )}
             <button 
               className="px-6 py-2 bg-maas-focus hover:bg-indigo-500 disabled:bg-elevated disabled:text-white/40 disabled:border-white/10 border border-maas-focus text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-maas-focus/20 flex items-center justify-center gap-2"
               disabled={timelineState.conflicts.length > 0}
               onClick={async (e) => {
                 const btn = e.currentTarget;
                 btn.disabled = true;
                 btn.innerHTML = '<svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Merging...';
                 const res = await mergePullRequest(prData.pullRequest.id);
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
               Merge Pull Request
             </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col p-4 md:p-6 gap-4 md:gap-6 overflow-y-auto overflow-x-hidden relative">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-maas-focus/10 rounded-full blur-[120px] pointer-events-none hidden md:block" />
          <div className="w-full max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[250px] md:min-h-[300px] z-10 shrink-0 relative cursor-pointer group" onClick={togglePlay}>
             <div className="absolute inset-0 bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
               <VideoDiffEngine 
                 proxyUrlBase={prData.baseProxyUrl} 
                 proxyUrlIncoming={prData.incomingProxyUrl} 
                 baseManifest={prData.baseManifest} 
                 incomingManifest={prData.incomingManifest}
                 incomingChunks={playbackChunks}
                 jugglerRef={jugglerRef}
               >
                 <SpatialCommentOverlay comments={activeComments} onAddComment={handleAddComment} />
               </VideoDiffEngine>
             </div>
          </div>
          <div className="shrink-0 w-full max-w-5xl mx-auto z-10">
             <GhostTimeline targetTimeline={[]} incomingTimeline={[]} />
          </div>
        </div>
      </div>

      <SemanticChangelog entries={changelog} />
      
    </div>
  );
};
