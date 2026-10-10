// apps/web/lib/otio-time-mapper.ts
import { TVMTrack } from './otio-compiler';

export interface TimeMapResult {
  type: 'clip' | 'gap';
  sourceTime?: number;
}

export function resolveMediaTime(masterTime: number, tvm: TVMTrack[]): TimeMapResult {
  if (!tvm || tvm.length === 0) return { type: 'gap' };

  for (const track of tvm) {
    let currentGlobalTime = 0;

    for (const block of track.blocks) {
      const duration = block.duration || 0;
      const clipEndGlobal = currentGlobalTime + duration;

      if (masterTime >= currentGlobalTime && masterTime < clipEndGlobal) {
        if (block.type === 'ghost') {
          return { type: 'gap' };
        }

        const offsetIntoClip = masterTime - currentGlobalTime;
        const proxyStart = block.nativeProxyStart !== undefined ? block.nativeProxyStart : 0; // Fallback to 0 if ghost or somehow missing

        return {
          type: 'clip',
          sourceTime: proxyStart + offsetIntoClip
        };
      }

      currentGlobalTime += duration;
    }
    
    // Only check the primary Video track.
    break; 
  }

  return { type: 'gap' };
}
