import { PlaybackChunk } from '../../../packages/react/src/VideoJuggler';
import { TVMTrack } from './otio-compiler';

export function generateJugglerChunks(
  baseTVM: TVMTrack[], 
  incomingTVM: TVMTrack[], 
  resolutions: Record<string, string>, 
  baseProxyUrl: string, 
  incomingProxyUrl: string
): { chunks: PlaybackChunk[], totalDuration: number } {
  const chunks: PlaybackChunk[] = [];
  
  // For now, we only handle the first video track (V1)
  const baseTrack = baseTVM[0]?.blocks || [];
  const incomingTrack = incomingTVM[0]?.blocks || [];

  let globalTime = 0;
  let baseProxyTime = 0;
  let incomingProxyTime = 0;

  for (const block of incomingTrack) {
    const res = resolutions[block.id] || 'pending';
    const incomingDuration = block.duration || 0;
    
    // Find matching original block if needed
    const originalBlock = baseTrack.find((b: any) => b.id === block.id || b.name === block.name);
    const baseDuration = originalBlock?.duration || 0;
    
    // Unmodified -> Play from Base
    if (block.status === 'unmodified') {
      chunks.push({
        id: block.id,
        proxyUrl: baseProxyUrl,
        timelineStart: globalTime,
        timelineEnd: globalTime + incomingDuration,
        sourceStart: originalBlock?.nativeProxyStart !== undefined ? originalBlock.nativeProxyStart : baseProxyTime
      });
      baseProxyTime += baseDuration;
      incomingProxyTime += incomingDuration;
    } 
    // Added -> If accepted, play from Incoming. If rejected, skip.
    else if (block.status === 'added') {
      if (res === 'accepted') {
        chunks.push({
          id: block.id,
          proxyUrl: incomingProxyUrl,
          timelineStart: globalTime,
          timelineEnd: globalTime + incomingDuration,
          sourceStart: block.nativeProxyStart !== undefined ? block.nativeProxyStart : incomingProxyTime
        });
      }
      incomingProxyTime += incomingDuration;
    }
    // Ghost (deleted) -> If accepted, it's deleted (skip). If rejected, keep original from Base.
    else if (block.status === 'deleted' || block.type === 'ghost') {
      if (res === 'rejected') {
        chunks.push({
          id: block.id,
          proxyUrl: baseProxyUrl,
          timelineStart: globalTime,
          timelineEnd: globalTime + incomingDuration,
          sourceStart: originalBlock?.nativeProxyStart !== undefined ? originalBlock.nativeProxyStart : baseProxyTime
        });
      }
      baseProxyTime += baseDuration;
    }
    else if (block.status === 'trimmed') {
      if (res === 'accepted') {
        chunks.push({
          id: block.id,
          proxyUrl: incomingProxyUrl,
          timelineStart: globalTime,
          timelineEnd: globalTime + incomingDuration,
          sourceStart: block.nativeProxyStart !== undefined ? block.nativeProxyStart : incomingProxyTime
        });
      } else if (res === 'rejected') {
        if (originalBlock) {
          chunks.push({
            id: originalBlock.id,
            proxyUrl: baseProxyUrl,
            timelineStart: globalTime,
            timelineEnd: globalTime + incomingDuration,
            sourceStart: originalBlock.nativeProxyStart !== undefined ? originalBlock.nativeProxyStart : baseProxyTime
          });
        }
      }
      baseProxyTime += baseDuration;
      incomingProxyTime += incomingDuration;
    }

    // Unconditionally advance the global master clock by the exact physical width of the block
    globalTime += incomingDuration;
  }

  // Merge contiguous chunks with the same URL and continuous source time
  const merged: PlaybackChunk[] = [];
  for (const chunk of chunks) {
    if (merged.length === 0) {
      merged.push({ ...chunk });
      continue;
    }
    
    const last = merged[merged.length - 1];
    const isSameUrl = last.proxyUrl === chunk.proxyUrl;
    const isContiguousSource = Math.abs((last.sourceStart + (last.timelineEnd - last.timelineStart)) - chunk.sourceStart) < 0.1;
    
    if (isSameUrl && isContiguousSource) {
      last.timelineEnd = chunk.timelineEnd;
    } else {
      merged.push({ ...chunk });
    }
  }

  return { chunks: merged, totalDuration: globalTime };
}
