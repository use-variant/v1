// apps/web/lib/otio-compiler.ts

export interface TVMBlock {
  id: string;
  name: string;
  type: 'clip' | 'gap' | 'ghost'; // 'ghost' is used for deleted clips
  widthPercentage: number;
  status: 'added' | 'deleted' | 'trimmed' | 'unmodified';

  // We keep duration and sourceStart to avoid breaking the temporal playback mapper.
  duration?: number;
  sourceStart?: number;
  nativeProxyStart?: number;
}

export interface TVMTrack {
  trackName: string;
  blocks: TVMBlock[];
}

const isBroadcastGap = (clip: any) => {
  const durVal = clip.source_range?.duration?.value;
  const durRate = clip.source_range?.duration?.rate;
  if (durVal && durRate) {
    const durSeconds = durVal / durRate;
    // DaVinci Resolve defaults to 01:00:00:00 start (3600 seconds)
    return clip.OTIO_SCHEMA?.startsWith('Gap') && Math.abs(durSeconds - 3600) < 0.1;
  }
  return false;
};

export function compileTimelineViewModel(manifest: any, targetManifest?: any): { tracks: TVMTrack[], totalDuration: number } {
  if (!manifest || !manifest.children) return { tracks: [], totalDuration: 0 };

  const buildNativeMap = (m: any) => {
    const map: Record<string, number> = {};
    if (!m || !m.children) return map;
    for (const track of m.children[0].tracks.children) {
      if (track.kind !== 'Video' || !track.children) continue;
      let currentProxyTime = 0;
      for (const clip of track.children) {
        if (isBroadcastGap(clip)) continue;
        const key = clip.name + '-' + clip.active_media_reference_key;
        map[key] = currentProxyTime;
        const durVal = clip.source_range?.duration?.value;
        const durRate = clip.source_range?.duration?.rate;
        if (durVal && durRate) currentProxyTime += durVal / durRate;
      }
    }
    return map;
  };

  const nativeMap = buildNativeMap(manifest);

  const tvmTracks: TVMTrack[] = [];
  let maxDuration = 0;

  for (const track of manifest.children[0].tracks.children) {
    if (track.kind !== 'Video' || !track.children) continue;

    const blocks: TVMBlock[] = [];
    const targetTrack = targetManifest?.children[0].tracks.children?.find((t: any) => t.name === track.name);

    if (targetManifest && targetTrack) {
      // We are compiling the INCOMING TVM
      for (const targetClip of targetTrack.children) {
        if (isBroadcastGap(targetClip)) continue;
        
        const targetDur = targetClip.source_range?.duration?.value / targetClip.source_range?.duration?.rate;
        const existsInIncoming = track.children.find((ic: any) => ic.name === targetClip.name && ic.active_media_reference_key === targetClip.active_media_reference_key);

        if (!existsInIncoming) {
          // It's a Ghost!
          blocks.push({
            id: targetClip.name + '_ghost',
            name: targetClip.name,
            type: 'ghost',
            widthPercentage: 0, // Assigned later
            status: 'deleted',
            duration: targetDur,
            sourceStart: targetClip.source_range?.start_time?.value / targetClip.source_range?.start_time?.rate
          });
        } else {
          // We found a match. That means the incoming clip comes here.
          const incomingClip = existsInIncoming;
          const incDur = incomingClip.source_range?.duration?.value / incomingClip.source_range?.duration?.rate;
          const incStart = incomingClip.source_range?.start_time?.value / incomingClip.source_range?.start_time?.rate;

          let status: TVMBlock['status'] = 'unmodified';
          if (incDur !== targetDur || incStart !== (targetClip.source_range?.start_time?.value / targetClip.source_range?.start_time?.rate)) {
            status = 'trimmed';
          }

          blocks.push({
            id: incomingClip.name || `gap-${incomingClip.source_range?.start_time?.value}`,
            name: incomingClip.name,
            type: incomingClip.OTIO_SCHEMA?.startsWith('Gap') ? 'gap' : 'clip',
            widthPercentage: 0,
            status,
            duration: incDur,
            sourceStart: incStart,
            nativeProxyStart: nativeMap[incomingClip.name + '-' + incomingClip.active_media_reference_key]
          });
        }
      }

      // Handle Added clips (clips in incoming but not in target)
      for (const incomingClip of track.children) {
        if (isBroadcastGap(incomingClip)) continue;
        
        const existsInTarget = targetTrack.children.find((tc: any) => tc.name === incomingClip.name && tc.active_media_reference_key === incomingClip.active_media_reference_key);
        if (!existsInTarget) {
          const incDur = incomingClip.source_range?.duration?.value / incomingClip.source_range?.duration?.rate;
          const incStart = incomingClip.source_range?.start_time?.value / incomingClip.source_range?.start_time?.rate;
          blocks.push({
            id: incomingClip.name || `gap-${incomingClip.source_range?.start_time?.value}`,
            name: incomingClip.name,
            type: incomingClip.OTIO_SCHEMA?.startsWith('Gap') ? 'gap' : 'clip',
            widthPercentage: 0,
            status: 'added',
            duration: incDur,
            sourceStart: incStart,
            nativeProxyStart: nativeMap[incomingClip.name + '-' + incomingClip.active_media_reference_key]
          });
        }
      }

    } else {
      // We are compiling the TARGET TVM
      for (const clip of track.children) {
        if (isBroadcastGap(clip)) continue;
        
        const durVal = clip.source_range?.duration?.value;
        const durRate = clip.source_range?.duration?.rate;
        if (durVal && durRate) {
          const duration = durVal / durRate;
          const startVal = clip.source_range?.start_time?.value;
          const startRate = clip.source_range?.start_time?.rate;
          const sourceStart = (startVal && startRate) ? (startVal / startRate) : 0;

          blocks.push({
            id: clip.name || `gap-${clip.source_range?.start_time?.value}`,
            name: clip.name,
            type: clip.OTIO_SCHEMA?.startsWith('Gap') ? 'gap' : 'clip',
            widthPercentage: 0,
            status: 'unmodified',
            duration,
            sourceStart,
            nativeProxyStart: nativeMap[clip.name + '-' + clip.active_media_reference_key]
          });
        }
      }
    }

    const trackDuration = blocks.reduce((acc, b) => acc + (b.duration || 0), 0);
    if (trackDuration > maxDuration) {
      maxDuration = trackDuration;
    }

    tvmTracks.push({
      trackName: track.name,
      blocks
    });
  }

  // Second pass: Calculate proper percentages based on the compiled duration
  for (const track of tvmTracks) {
    for (const block of track.blocks) {
      block.widthPercentage = maxDuration > 0 ? ((block.duration || 0) / maxDuration) * 100 : 0;
    }
  }

  return { tracks: tvmTracks, totalDuration: maxDuration };
}
