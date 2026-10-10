"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { EngineRoomHUD, TelemetryState } from './EngineRoomHUD';
import { resolveMediaTime } from '../lib/otio-time-mapper';
import { generateJugglerChunks } from '../lib/juggler-compiler';
import { VideoJuggler } from '../../../packages/react/src/VideoJuggler';

interface VideoDiffEngineProps {
  proxyUrlBase: string | null;
  proxyUrlIncoming: string | null;
  baseManifest: any;
  incomingManifest: any;
  incomingChunks?: any[];
  jugglerRef?: React.RefObject<any>;
  children?: React.ReactNode; 
  resolutions?: Record<string, string>;
  isAllResolved?: boolean;
  masterDiffDuration?: number;
}

export const VideoDiffEngine: React.FC<VideoDiffEngineProps> = ({ proxyUrlBase, proxyUrlIncoming, baseManifest, incomingManifest, incomingChunks, jugglerRef, children, resolutions, isAllResolved, masterDiffDuration }) => {
  const videoBaseRef = useRef<HTMLVideoElement>(null);
  const videoIncomingRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  
  const [wipePosition, setWipePosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const [telemetry, setTelemetry] = useState<TelemetryState>({
    base: { status: proxyUrlBase ? 'loading' : 'null', url: proxyUrlBase },
    incoming: { status: proxyUrlIncoming ? 'loading' : 'null', url: proxyUrlIncoming },
    currentTime: 0
  });

  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const activeDiffMode = usePlaybackStore((state) => state.activeDiffMode);
  const activeTool = usePlaybackStore((state) => state.activeTool);

  const [previewChunks, setPreviewChunks] = useState<any[] | null>(null);

  const handlePreviewMerge = () => {
    if (!resolutions || !proxyUrlBase || !proxyUrlIncoming) return;
    const { chunks } = generateJugglerChunks(baseManifest, incomingManifest, resolutions, proxyUrlBase, proxyUrlIncoming);
    setPreviewChunks(chunks);
  };

  const handleExitPreview = () => {
    setPreviewChunks(null);
  };
  
  const getErrorCode = (code?: number) => {
    switch (code) {
      case 1: return 'MEDIA_ERR_ABORTED';
      case 2: return 'MEDIA_ERR_NETWORK';
      case 3: return 'MEDIA_ERR_DECODE';
      case 4: return 'MEDIA_ERR_SRC_NOT_SUPPORTED';
      default: return 'UNKNOWN_ERROR';
    }
  };

  const handleVideoEvent = (target: 'base' | 'incoming', eventType: 'ready' | 'loading' | 'error', e?: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    setTelemetry(prev => {
      let errorMsg;
      if (eventType === 'error' && e) {
        const error = (e.target as HTMLVideoElement).error;
        errorMsg = `${getErrorCode(error?.code)}: ${error?.message || 'Failed to load video'}`;
      }
      return {
        ...prev,
        [target]: {
          ...prev[target],
          status: eventType,
          error: errorMsg
        }
      };
    });
  };

  useEffect(() => {
    return usePlaybackStore.subscribe((state, prevState) => {
      if (!isPlaying && Math.abs(state.currentTime - prevState.currentTime) > 0) {
        if (videoBaseRef.current) videoBaseRef.current.currentTime = state.currentTime;
        if (videoIncomingRef.current) videoIncomingRef.current.currentTime = state.currentTime;
      }
    });
  }, [isPlaying]);

  const lastUpdateRef = useRef<number>(0);

  const syncVideos = useCallback((sysTime: number) => {
    if (!lastUpdateRef.current) lastUpdateRef.current = sysTime;
    const delta = (sysTime - lastUpdateRef.current) / 1000;
    lastUpdateRef.current = sysTime;

    let time = usePlaybackStore.getState().currentTime;
    
    if (jugglerRef?.current && jugglerRef.current.getCurrentTime) {
       time = jugglerRef.current.getCurrentTime();
    } else {
       if (isPlaying) {
         time += delta;
       }
    }

    if (isPlaying) {
      const duration = usePlaybackStore.getState().duration;
      if (time >= duration) {
        time = duration;
        usePlaybackStore.getState().setIsPlaying(false);
      }
      usePlaybackStore.setState({ currentTime: time });
    } else if (jugglerRef?.current) {
      // If paused but juggler is active, still sync time in case of seeking
      usePlaybackStore.setState({ currentTime: time });
    }
    
    setTelemetry(prev => ({ ...prev, currentTime: time }));

    if (videoBaseRef.current) {
      if (!baseManifest || baseManifest.length === 0) {
        videoBaseRef.current.style.opacity = '1';
        if (videoBaseRef.current.paused && isPlaying) {
          videoBaseRef.current.play().catch(()=>{});
        }
        if (Math.abs(videoBaseRef.current.currentTime - time) > 0.1) {
          videoBaseRef.current.currentTime = time;
        }
      } else {
        const baseState = resolveMediaTime(time, baseManifest);
        if (baseState.type === 'gap') {
          videoBaseRef.current.style.opacity = '0';
          if (!videoBaseRef.current.paused) {
            videoBaseRef.current.pause();
          }
        } else {
          videoBaseRef.current.style.opacity = '1';
          if (videoBaseRef.current.paused && isPlaying) {
            videoBaseRef.current.play().catch(()=>{});
          }
          if (Math.abs(videoBaseRef.current.currentTime - baseState.sourceTime!) > 0.1) {
            videoBaseRef.current.currentTime = baseState.sourceTime!;
          }
        }
      }
    }

    if (videoIncomingRef.current && (!incomingChunks || incomingChunks.length === 0)) {
      if (!incomingManifest || incomingManifest.length === 0) {
        videoIncomingRef.current.style.opacity = '1';
        if (videoIncomingRef.current.paused && isPlaying) {
          videoIncomingRef.current.play().catch(()=>{});
        }
        if (Math.abs(videoIncomingRef.current.currentTime - time) > 0.1) {
          videoIncomingRef.current.currentTime = time;
        }
      } else {
        const incomingState = resolveMediaTime(time, incomingManifest);
        if (incomingState.type === 'gap') {
          videoIncomingRef.current.style.opacity = '0';
          if (!videoIncomingRef.current.paused) {
            videoIncomingRef.current.pause();
          }
        } else {
          videoIncomingRef.current.style.opacity = '1';
          if (videoIncomingRef.current.paused && isPlaying) {
            videoIncomingRef.current.play().catch(()=>{});
          }
          if (Math.abs(videoIncomingRef.current.currentTime - incomingState.sourceTime!) > 0.1) {
            videoIncomingRef.current.currentTime = incomingState.sourceTime!;
          }
        }
      }
    }

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(syncVideos);
    }
  }, [isPlaying, jugglerRef, baseManifest, incomingManifest, incomingChunks]);

  useEffect(() => {
    if (isPlaying) {
      lastUpdateRef.current = performance.now();
      // Do not unconditionally play videos here.
      // The syncVideos loop will independently start playback for clips, or keep them paused for gaps.
      requestRef.current = requestAnimationFrame(syncVideos);
    } else {
      videoBaseRef.current?.pause();
      videoIncomingRef.current?.pause();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastUpdateRef.current = 0;
      requestRef.current = requestAnimationFrame(syncVideos);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, syncVideos]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setWipePosition((x / rect.width) * 100);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handlePlayerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'comment') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // 🚀 WIPE GUARDRAIL: In wipe mode, the Incoming video is full-width but clipped.
    // If they click to the left of the wipe line (the Base video side), ignore it!
    if (activeDiffMode === 'wipe' && x < wipePosition) {
      e.stopPropagation();
    }
  };

  const renderBaseFallback = () => (
    <div className="absolute inset-0 w-full h-full bg-neutral-950 flex flex-col items-center justify-center border border-white/5 opacity-80"
         style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      <div className="p-3 bg-black border border-white/10 rounded-lg text-white/40 font-mono text-sm shadow-xl backdrop-blur-sm pointer-events-none">
        Initial Commit — No Base Video
      </div>
    </div>
  );

  const renderVideo = (url: string | null, ref: React.RefObject<HTMLVideoElement>, target: 'base'|'incoming', containerClassName: string) => {
    if (!url && target === 'base') return renderBaseFallback();
    
    if (target === 'incoming' && incomingChunks && incomingChunks.length > 0) {
      return (
        <div className={`${containerClassName} flex items-center justify-center bg-black overflow-hidden`}>
          <VideoJuggler 
             ref={jugglerRef} 
             chunks={incomingChunks} 
             isPlaying={isPlaying} 
             onTimeUpdate={(t) => {}}
          />
        </div>
      );
    }

    if (!url) return <div className="absolute inset-0 bg-black" />;

    return (
      <div 
        className={`${containerClassName} flex items-center justify-center bg-black overflow-hidden relative ${activeTool === 'comment' && target === 'incoming' ? 'cursor-crosshair' : ''}`}
        onClickCapture={target === 'incoming' ? handlePlayerClick : undefined}
      >
        <video 
          ref={ref} 
          src={url} 
          className="w-full h-full object-contain max-w-full max-h-full"
          muted 
          playsInline 
          preload="metadata"
          onLoadedMetadata={(e) => handleVideoEvent(target, 'ready', e)}
          onCanPlay={(e) => handleVideoEvent(target, 'ready', e)}
          onWaiting={(e) => handleVideoEvent(target, 'loading', e)}
          onError={(e) => handleVideoEvent(target, 'error', e)}
        />
        {target === 'incoming' && children}
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full flex-1 min-h-0 bg-black overflow-hidden rounded-xl border border-neutral-800 shadow-2xl flex max-h-[50vh] xl:max-h-[55vh] select-none"
    >
      <EngineRoomHUD 
        telemetry={telemetry} 
        manifests={{ base: baseManifest, incoming: incomingManifest }} 
        isAllResolved={isAllResolved}
        isPreviewing={!!previewChunks}
        onPreviewMerge={handlePreviewMerge}
        onExitPreview={handleExitPreview}
      />

      {previewChunks ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
          <VideoJuggler 
            ref={jugglerRef} 
            chunks={previewChunks} 
            isPlaying={isPlaying} 
            onTimeUpdate={(t) => {}}
          />
        </div>
      ) : (
        <>
          {activeDiffMode === 'split' ? (
            <>
              <div className="w-1/2 relative h-full border-r border-white/10 bg-black">
                 {renderVideo(proxyUrlBase, videoBaseRef, 'base', "absolute inset-0 w-full h-full")}
                 <div className="absolute top-2 left-2 md:top-4 md:left-4 px-2 py-1 md:px-3 md:py-1.5 bg-black/60 backdrop-blur-md rounded text-[10px] md:text-xs font-medium text-white/60 z-10 border border-white/10 shadow-lg pointer-events-none">Base Branch</div>
              </div>
              <div className="w-1/2 relative h-full bg-black">
                 {renderVideo(proxyUrlIncoming, videoIncomingRef, 'incoming', "absolute inset-0 w-full h-full")}
                 <div className="absolute top-2 left-2 md:top-4 md:left-4 px-2 py-1 md:px-3 md:py-1.5 bg-maas-add/20 text-maas-add border border-maas-add/30 backdrop-blur-xl rounded text-[10px] md:text-xs font-medium z-10 shadow-[0_0_15px_rgba(16,185,129,0.2)] pointer-events-none">Incoming AI</div>
              </div>
            </>
          ) : (
            <>
              {renderVideo(proxyUrlBase, videoBaseRef, 'base', "absolute inset-0 w-full h-full")}
              
              <div 
                className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none bg-black"
                style={{
                  clipPath: activeDiffMode === 'wipe' ? `inset(0 0 0 ${wipePosition}%)` : 'none',
                  opacity: activeDiffMode === 'onion' ? 0.5 : 1
                }}
              >
                {renderVideo(proxyUrlIncoming, videoIncomingRef, 'incoming', "absolute inset-0 w-full h-full")}
              </div>
              
              {activeDiffMode === 'wipe' && (
                <div 
                  className={`absolute top-0 bottom-0 w-1 bg-maas-focus z-20 flex items-center justify-center transition-all hover:w-1.5 hover:bg-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.5)] pointer-events-auto ${activeTool === 'comment' ? 'cursor-crosshair' : 'cursor-ew-resize'}`}
                  style={{ left: `${wipePosition}%`, transform: 'translateX(-50%)' }}
                  onMouseDown={(e) => { 
                    if (activeTool === 'comment') return;
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    setIsDragging(true); 
                  }}
                >
                  <div className="w-6 h-12 bg-maas-focus rounded-full flex items-center justify-center border-2 border-white/20 absolute pointer-events-none shadow-lg">
                    <div className="w-0.5 h-4 bg-white/60 mx-0.5 rounded-full" />
                    <div className="w-0.5 h-4 bg-white/60 mx-0.5 rounded-full" />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
