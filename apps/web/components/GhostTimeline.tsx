"use client";

import React, { useRef, useEffect, useState } from 'react';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { Play, Pause, SplitSquareHorizontal, Layers, Columns, Plus, Trash2, Scissors, Check, X, ZoomIn, Hand, MessageSquarePlus } from 'lucide-react';
import { TVMTrack, TVMBlock } from '../lib/otio-compiler';
import { SpatialComment } from '../types/timeline';

interface GhostTimelineProps {
  targetTimeline: TVMTrack[];
  incomingTimeline: TVMTrack[];
  comments?: SpatialComment[];
  onResolutionChange?: (resolutions: Record<string, string>, isAllResolved: boolean) => void;
  readOnly?: boolean;
}

const formatTimecode = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const GhostTimeline: React.FC<GhostTimelineProps> = ({ targetTimeline, incomingTimeline, comments = [], onResolutionChange, readOnly = false }) => {
  const isPlaying = usePlaybackStore(state => state.isPlaying);
  const setIsPlaying = usePlaybackStore(state => state.setIsPlaying);
  const activeDiffMode = usePlaybackStore(state => state.activeDiffMode);
  const setActiveDiffMode = usePlaybackStore(state => state.setActiveDiffMode);
  const activeTool = usePlaybackStore(state => state.activeTool);
  const setActiveTool = usePlaybackStore(state => state.setActiveTool);
  const duration = usePlaybackStore(state => state.duration);
  const setCurrentTime = usePlaybackStore(state => state.setCurrentTime);
  const playheadRef = useRef<HTMLDivElement>(null);

  const [resolutions, setResolutions] = useState<Record<string, 'accepted' | 'rejected' | 'pending'>>({});
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    return usePlaybackStore.subscribe((state) => {
      if (playheadRef.current && state.duration > 0) {
        const percent = (state.currentTime / state.duration) * 100;
        playheadRef.current.style.left = `${percent}%`;
      }
    });
  }, []);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    setCurrentTime(percent * duration);
    setActivePopover(null);
  };

  const allChanges = incomingTimeline ? incomingTimeline.flatMap(t => t.blocks).filter(b => b.status !== 'unmodified') : [];
  const totalChanges = allChanges.length;
  const resolvedCount = Object.values(resolutions).filter(r => r !== 'pending').length;
  const isAllResolved = totalChanges > 0 && resolvedCount === totalChanges;

  const ticks = Array.from({ length: 11 }, (_, i) => (duration * i) / 10);

  useEffect(() => {
    if (onResolutionChange) {
      onResolutionChange(resolutions, isAllResolved);
    }
  }, [resolutions, isAllResolved, onResolutionChange]);

  const handleResolve = (e: React.MouseEvent, blockId: string, resolution: 'accepted' | 'rejected') => {
    e.stopPropagation();
    setResolutions(prev => ({ ...prev, [blockId]: resolution }));
    setActivePopover(null);
  };

  const getIncomingBlock = (baseBlock: TVMBlock) => {
    const incomingTrack = incomingTimeline?.[0];
    if (!incomingTrack) return undefined;
    
    let match = incomingTrack.blocks.find(b => b.id === baseBlock.id || b.name === baseBlock.name);
    if (!match) {
      match = incomingTrack.blocks.find(b => b.id === baseBlock.name + '_ghost');
    }
    return match;
  };

  const getBlockStyle = (block: TVMBlock, isBaseTrack: boolean) => {
    if (isBaseTrack) {
      const incomingBlock = getIncomingBlock(block);
      if (!incomingBlock) return 'bg-neutral-800 border-neutral-700/50 text-neutral-400';
      
      const res = resolutions[incomingBlock.id];
      if (incomingBlock.type === 'ghost') {
        if (res === 'rejected') return 'bg-emerald-500/20 border-emerald-500 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
        if (res === 'accepted') return 'bg-neutral-800/20 border-neutral-700 text-white/20 opacity-30';
        return 'bg-neutral-800 border-neutral-700/50 text-neutral-400 opacity-60';
      }
      if (incomingBlock.status === 'trimmed') {
        if (res === 'rejected') return 'bg-emerald-500/20 border-emerald-500 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
        if (res === 'accepted') return 'bg-neutral-800/20 border-neutral-700 text-white/20 opacity-30';
        return 'bg-neutral-800 border-neutral-700/50 text-neutral-400 opacity-60';
      }
      return 'bg-neutral-800 border-neutral-700/50 text-neutral-400 opacity-60';
    }

    const res = resolutions[block.id];
    
    if (res === 'rejected') {
      return 'bg-neutral-800/20 border-neutral-700 text-white/20 line-through opacity-30';
    }

    if (res === 'accepted') {
      return 'bg-indigo-900/80 border-indigo-500 text-indigo-100 shadow-[0_0_10px_rgba(99,102,241,0.2)]';
    }

    if (block.type === 'ghost') {
      return 'bg-rose-500/10 border-dashed border-rose-500/50 text-rose-400 opacity-80';
    }
    
    switch (block.status) {
      case 'added':
        return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
      case 'trimmed':
        return 'bg-amber-500/20 border-amber-500/50 text-amber-400';
      default:
        return 'bg-neutral-800 border-neutral-700/50 text-neutral-400';
    }
  };

  const getBlockIcon = (block: TVMBlock, isBaseTrack: boolean) => {
    if (isBaseTrack) return null; // Base track doesn't need icons

    const res = resolutions[block.id];
    if (res === 'rejected') return null;
    if (res === 'accepted') return <Check className="w-3 h-3 mr-1" />;

    if (block.type === 'ghost') return <Trash2 className="w-3 h-3 mr-1 shrink-0" />;
    switch (block.status) {
      case 'added': return <Plus className="w-3 h-3 mr-1 shrink-0" />;
      case 'trimmed': return <Scissors className="w-3 h-3 mr-1 shrink-0" />;
      default: return null;
    }
  };

  const renderLane = (timeline: TVMTrack[], isBaseTrack: boolean) => {
    if (!timeline || timeline.length === 0) return null;
    
    return timeline.map((track, trackIdx) => (
      <div key={`track-${isBaseTrack ? 'base' : 'inc'}-${trackIdx}`} className="flex relative h-12 w-full bg-[#111]/50 border-b border-white/5 items-center my-0.5 rounded-lg backdrop-blur-md">
        <div className="absolute left-2 top-1 text-[8px] text-white/30 uppercase tracking-widest font-bold z-10 bg-black/50 px-1 rounded">
          {isBaseTrack ? 'BASE' : 'INCOMING'}
        </div>
        <div className="w-full relative h-full flex items-center">
          {track.blocks.map((block, clipIdx) => {
            const isModified = block.status !== 'unmodified' || block.type === 'ghost';
            const incomingBlock = isBaseTrack ? getIncomingBlock(block) : block;
            const isInteractive = !isBaseTrack && isModified && incomingBlock?.status !== 'unmodified';
            const widthPct = duration > 0 ? ((block.duration || 0) / duration) * 100 : 0;
            
            return (
              <div 
                key={`block-${clipIdx}`}
                className="relative h-9 flex-shrink-0"
                style={{ width: `${widthPct}%` }}
              >
                <div
                  onClick={(e) => {
                    if (isInteractive && incomingBlock) {
                      e.stopPropagation();
                      setActivePopover(activePopover === incomingBlock.id ? null : incomingBlock.id);
                    }
                  }}
                  className={`absolute inset-0 border flex items-center px-2 text-[10px] transition-all overflow-hidden ${isInteractive ? 'cursor-pointer hover:brightness-125' : ''} ${getBlockStyle(block, isBaseTrack)}`}
                >
                  <div className="flex items-center w-full min-w-0">
                    {getBlockIcon(block, isBaseTrack)}
                    <span className="truncate font-medium min-w-0">{block.name}</span>
                  </div>
                </div>

                {/* Popover */}
                {!isBaseTrack && activePopover === block.id && isModified && !readOnly && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-48 bg-neutral-900 border border-white/10 rounded-lg p-2 shadow-2xl z-50 flex flex-col gap-1 backdrop-blur-xl">
                    <button 
                      onClick={(e) => handleResolve(e, block.id, 'accepted')}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold transition-colors border border-emerald-500/20"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept Edit
                    </button>
                    <button 
                      onClick={(e) => handleResolve(e, block.id, 'rejected')}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white/60 hover:text-white/90 text-xs font-bold transition-colors border border-white/5"
                    >
                      <X className="w-3.5 h-3.5" /> Keep Original
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    ));
  };

  return (
    <div className={`w-full flex-shrink-0 bg-[#0A0A0A] border rounded-xl p-4 flex flex-col gap-3 h-fit max-h-[30vh] lg:max-h-[35vh] overflow-hidden shadow-2xl select-none relative transition-colors duration-500 ${isAllResolved ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'border-white/10'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-indigo-500 hover:bg-indigo-400 text-white rounded-full transition-colors shadow-[0_0_15px_rgba(99,102,241,0.4)] shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4 md:w-5 md:h-5 fill-current" /> : <Play className="w-4 h-4 md:w-5 md:h-5 fill-current ml-1" />}
          </button>
          
          {!readOnly && (
            <div className="flex bg-neutral-950/80 border border-white/10 rounded-lg p-1 backdrop-blur-md shadow-inner gap-1">
              <button 
                onClick={() => setActiveTool('hand')}
                className={`p-1.5 md:p-2 rounded-md transition-all ${activeTool === 'hand' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                title="Hand Tool (Pan/Wipe)"
              >
                <Hand className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
              <button 
                onClick={() => setActiveTool('comment')}
                className={`p-1.5 md:p-2 rounded-md transition-all ${activeTool === 'comment' ? 'bg-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]' : 'text-white/40 hover:text-white/80'}`}
                title="Comment Tool"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            </div>
          )}

          <div className="flex bg-neutral-950/80 border border-white/10 rounded-lg p-1 backdrop-blur-md shadow-inner">
            <button 
              onClick={() => setActiveDiffMode('wipe')}
              className={`p-1.5 md:p-2 rounded-md transition-all ${activeDiffMode === 'wipe' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-white/40 hover:text-white/80'}`}
              title="Wipe Tool"
            >
              <SplitSquareHorizontal className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
            <button 
              onClick={() => setActiveDiffMode('onion')}
              className={`p-1.5 md:p-2 rounded-md transition-all ${activeDiffMode === 'onion' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-white/40 hover:text-white/80'}`}
              title="Onion Skin"
            >
              <Layers className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
            <button 
              onClick={() => setActiveDiffMode('split')}
              className={`p-1.5 md:p-2 rounded-md transition-all ${activeDiffMode === 'split' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-white/40 hover:text-white/80'}`}
              title="Side by Side"
            >
              <Columns className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          </div>
          
          <div className="hidden sm:flex items-center gap-2 bg-neutral-950/80 border border-white/10 rounded-lg px-3 h-8 md:h-10 backdrop-blur-md shadow-inner">
            <ZoomIn className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/40" />
            <input 
              type="range" 
              min="1" max="10" step="0.1" 
              value={zoomLevel} 
              onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
              className="w-24 accent-indigo-500 cursor-pointer"
              title={`Zoom: ${zoomLevel}x`}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
          <div className="text-[10px] md:text-xs font-medium text-white/40">
            <span className={isAllResolved ? "text-emerald-400" : "text-white/80"}>{resolvedCount}</span> of {totalChanges} Changes Resolved
          </div>
          {isAllResolved && totalChanges > 0 && (
            <div className="px-2 py-0.5 md:px-3 md:py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              Merge Ready
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 w-full bg-[#050505]/90 border border-white/5 rounded-b-xl shadow-inner flex flex-col relative overflow-hidden min-h-0">
      
        <div className="flex-1 w-full overflow-x-auto overflow-y-auto max-h-[140px] md:max-h-[220px] relative custom-scrollbar">
          
          <div 
            className="relative min-h-[200px] cursor-pointer py-4"
            onClick={handleTimelineClick}
            style={{ width: `${zoomLevel * 100}%` }}
          >
            {/* RULER WRAPPER */}
            <div className="w-full h-6 border-b border-white/10 relative mb-2 opacity-50 select-none">
              {ticks.map((tick, idx) => (
                <React.Fragment key={idx}>
                  <div className="absolute top-0 bottom-0 border-l border-white/20 flex flex-col" style={{ left: `${(tick / duration) * 100}%` }}>
                    <span className="text-[8px] text-white/40 ml-1 mt-0.5 font-mono">{formatTimecode(tick)}</span>
                  </div>
                  <div className="absolute top-6 w-px h-[500px] bg-white/5 pointer-events-none" style={{ left: `${(tick / duration) * 100}%` }} />
                </React.Fragment>
              ))}
            </div>

            {/* Glowing Playhead */}
            <div 
              ref={playheadRef}
              className="absolute top-0 bottom-0 w-[2px] bg-indigo-500 z-50 pointer-events-none shadow-[0_0_15px_rgba(99,102,241,1)]"
              style={{ left: '0%' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 text-indigo-500 drop-shadow-[0_0_5px_rgba(99,102,241,1)]">
                <svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  <path d="M8 14L1 2H15L8 14Z" />
                </svg>
              </div>
            </div>

            {/* Ghost Pips */}
            {comments.map(c => {
              if (c.resolved) return null;
              const isHistorical = c.isHistorical;
              const percent = ((c.timestamp ?? c.time) / (duration || 1)) * 100;
              return (
                <div 
                  key={c.id}
                  className={`absolute top-0 w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1 z-40 ${isHistorical ? 'bg-transparent border border-amber-500 border-dashed animate-pulse' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]'}`}
                  style={{ left: `${percent}%` }}
                  title={c.text}
                />
              );
            })}
            
            <div className="flex flex-col w-full relative z-10">
              {renderLane(targetTimeline, true)}
              {renderLane(incomingTimeline, false)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
