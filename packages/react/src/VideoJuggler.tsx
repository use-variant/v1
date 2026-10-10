import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface PlaybackChunk {
  id: string;
  proxyUrl: string;       // The S3 URL of the proxy chunk
  timelineStart: number;  // When this clip starts on the global timeline (seconds)
  timelineEnd: number;    // When this clip ends on the global timeline (seconds)
  sourceStart: number;    // The offset to start playing from within the proxy file (seconds)
}

interface VideoJugglerProps {
  chunks: PlaybackChunk[];
  isPlaying: boolean;
  onTimeUpdate?: (time: number) => void;
}

export interface VideoJugglerRef {
  seek: (time: number) => void;
  getCurrentTime: () => number;
}

/**
 * VideoJuggler
 * 
 * A high-performance, Just-In-Time (JIT) sequence player utilizing a 3-Player Object Pool.
 * It strictly bounds DOM <video> elements to exactly 3 to prevent browser OOM crashes 
 * when playing timelines composed of 50+ fragmented media chunks.
 */
export const VideoJuggler = forwardRef<VideoJugglerRef, VideoJugglerProps>(({ chunks, isPlaying, onTimeUpdate }, ref) => {
  // DOM References for the Object Pool
  const playerA = useRef<HTMLVideoElement>(null);
  const playerB = useRef<HTMLVideoElement>(null);
  const playerC = useRef<HTMLVideoElement>(null);

  // Object Pool Role Indices: 0=A, 1=B, 2=C
  const roles = useRef({ active: 0, preloader: 1, garbage: 2 });
  
  // State tracking (Refs only, ZERO React state re-renders during playback)
  const masterTime = useRef<number>(0);
  const currentChunkIndex = useRef<number>(0);
  const lastSysTime = useRef<number>(0);
  const requestRef = useRef<number>();

  // Expose imperative methods (e.g. for a progress bar to call seek())
  useImperativeHandle(ref, () => ({
    getCurrentTime: () => masterTime.current,
    seek: (time: number) => {
      masterTime.current = time;
      
      const newIndex = chunks.findIndex(c => time >= c.timelineStart && time < c.timelineEnd);
      if (newIndex === -1) return; // Out of bounds

      currentChunkIndex.current = newIndex;
      const targetChunk = chunks[newIndex];
      const players = [playerA.current, playerB.current, playerC.current];
      const activeVid = players[roles.current.active];
      const preloaderVid = players[roles.current.preloader];

      if (!activeVid || !preloaderVid) return;

      const offset = time - targetChunk.timelineStart;
      const targetSourceTime = targetChunk.sourceStart + offset;

      // Ensure active video is pointing to the correct source
      if (activeVid.getAttribute('src') !== targetChunk.proxyUrl) {
        activeVid.src = targetChunk.proxyUrl;
      }
      activeVid.currentTime = targetSourceTime;

      // Edge Case: Hard seek means the preloader's current buffer is likely wrong. 
      // Instantly dump it to prevent VRAM bloat, it will be re-assigned automatically in the rAF loop if needed.
      if (preloaderVid.hasAttribute('src')) {
        preloaderVid.removeAttribute('src');
        preloaderVid.load(); // Force dump
      }
    }
  }), [chunks]);

  // Main JIT Sync Engine
  useEffect(() => {
    const players = [playerA.current, playerB.current, playerC.current];
    if (!players[0] || !players[1] || !players[2]) return;

    // Initialization: Boot up the first chunk if nothing is playing
    const activeVid = players[roles.current.active]!;
    if (chunks.length > 0 && !activeVid.getAttribute('src')) {
      activeVid.src = chunks[0].proxyUrl;
      activeVid.currentTime = chunks[0].sourceStart;
      activeVid.classList.remove('hidden');
    }

    const loop = (sysTime: number) => {
      if (!lastSysTime.current) lastSysTime.current = sysTime;
      const delta = (sysTime - lastSysTime.current) / 1000;
      lastSysTime.current = sysTime;

      const activeVideo = players[roles.current.active]!;
      const preloaderVideo = players[roles.current.preloader]!;

      // Determine if current master time falls inside any chunk
      let activeChunk = null;
      let newChunkIndex = -1;
      for (let i = 0; i < chunks.length; i++) {
        if (masterTime.current >= chunks[i].timelineStart && masterTime.current < chunks[i].timelineEnd) {
          activeChunk = chunks[i];
          newChunkIndex = i;
          break;
        }
      }

      // If we are playing, advance the master clock
      if (isPlaying) {
        masterTime.current += delta;
        if (onTimeUpdate) onTimeUpdate(masterTime.current);
      }

      if (!activeChunk) {
        // GAP STATE
        players.forEach(p => p?.classList.add('hidden'));
        if (!activeVideo.paused) activeVideo.pause();
      } else {
        // CLIP STATE
        if (newChunkIndex !== currentChunkIndex.current) {
           currentChunkIndex.current = newChunkIndex;
           
           // If the video URL changed, load the new source.
           if (activeVideo.getAttribute('src') !== activeChunk.proxyUrl) {
             activeVideo.src = activeChunk.proxyUrl;
           }

           // Check if we need to hard seek.
           // We hard seek if the video's actual time is desynced from the chunk's expected source time.
           // This handles jumps within the same proxy file (e.g. skipping over a deleted clip).
           const expectedSourceTime = activeChunk.sourceStart + (masterTime.current - activeChunk.timelineStart);
           if (Math.abs(activeVideo.currentTime - expectedSourceTime) > 0.1) {
             activeVideo.currentTime = expectedSourceTime;
             if (isPlaying) {
               activeVideo.play().catch(()=>{});
             }
           }
        }

        activeVideo.classList.remove('hidden');

        // 1. Playback Enforcement
        if (isPlaying && activeVideo.paused && activeVideo.readyState >= 2) {
          activeVideo.play().catch(() => {});
        } else if (!isPlaying && !activeVideo.paused) {
          activeVideo.pause();
        }

        // 3. JIT Pre-loading Logic
        const nextChunkIndex = currentChunkIndex.current + 1;
        const nextChunk = nextChunkIndex < chunks.length ? chunks[nextChunkIndex] : null;

        if (nextChunk) {
          const timeToNext = nextChunk.timelineStart - masterTime.current;

          if (timeToNext <= 2.0 && timeToNext > 0) {
            if (preloaderVideo.getAttribute('src') !== nextChunk.proxyUrl) {
              preloaderVideo.src = nextChunk.proxyUrl;
              preloaderVideo.currentTime = nextChunk.sourceStart;
              preloaderVideo.load();
            }
          }

          // 4. The Swap (Millisecond precision crossing)
          if (masterTime.current >= nextChunk.timelineStart) {
            if (preloaderVideo.getAttribute('src') === nextChunk.proxyUrl) {
              preloaderVideo.classList.remove('hidden');
              activeVideo.classList.add('hidden');
              
              activeVideo.pause();
              if (isPlaying) {
                preloaderVideo.play().catch(() => {});
              }

              activeVideo.removeAttribute('src');
              activeVideo.load();

              const oldActive = roles.current.active;
              const oldPreloader = roles.current.preloader;
              const oldGarbage = roles.current.garbage;

              roles.current.active = oldPreloader;
              roles.current.garbage = oldActive;
              roles.current.preloader = oldGarbage;

              currentChunkIndex.current = nextChunkIndex;
            }
          }
        }
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    lastSysTime.current = performance.now();
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [chunks, isPlaying]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-black z-0" />
      {/* 
        The 3-Player Object Pool. 
        Hidden by default, manipulated purely via DOM API in the rAF loop to avoid React renders.
      */}
      <video ref={playerA} preload="metadata" playsInline muted className="absolute inset-0 w-full h-full object-contain hidden z-10" />
      <video ref={playerB} preload="metadata" playsInline muted className="absolute inset-0 w-full h-full object-contain hidden z-10" />
      <video ref={playerC} preload="metadata" playsInline muted className="absolute inset-0 w-full h-full object-contain hidden z-10" />
    </div>
  );
});

VideoJuggler.displayName = 'VideoJuggler';
