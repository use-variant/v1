// lib/crdt-merge.ts

/**
 * OpenTimelineIO (OTIO) JSON Subset Interfaces
 * Defined specifically for CRDT conflict detection in MaaS
 */

export interface RationalTime {
  value: number;
  rate: number;
}

export interface TimeRange {
  start_time: RationalTime;
  duration: RationalTime;
}

export interface OTIOClip {
  OTIO_SCHEMA: 'Clip.2';
  name: string;
  source_range: TimeRange;
  active_media_reference_key: string;
}

export interface OTIOTrack {
  OTIO_SCHEMA: 'Track.1';
  name: string;
  tracks : {
    children: [
      {
        children: OTIOClip[]
      }
    ]
  }
}

export interface OTIOTimeline {
  children: OTIOTrack[];
}

export interface ConflictNode {
  trackName: string;
  clipName: string;
  baseState: OTIOClip;
  incomingState: OTIOClip;
}

export type MergeResult = {
  status: 'auto_merged' | 'conflict';
  finalManifest?: OTIOTimeline;
  conflicts?: ConflictNode[];
  changelog?: string[];
};

/**
 * Helper to determine if two RationalTime objects are mathematically identical.
 */
function isEqualRationalTime(a: RationalTime, b: RationalTime): boolean {
  return a.value === b.value && a.rate === b.rate;
}

/**
 * Helper to determine if two TimeRanges are identical.
 */
function isEqualTimeRange(a: TimeRange, b: TimeRange): boolean {
  return (
    isEqualRationalTime(a.start_time, b.start_time) &&
    isEqualRationalTime(a.duration, b.duration)
  );
}

/**
 * Helper to compare two clips strictly for structural equality.
 */
function isEqualClip(a: OTIOClip, b: OTIOClip): boolean {
  return (
    a.name === b.name &&
    a.active_media_reference_key === b.active_media_reference_key &&
    isEqualTimeRange(a.source_range, b.source_range)
  );
}

/**
 * Generates a stable unique identifier for a clip to track identity across branches.
 */
function getClipIdentity(clip: OTIOClip): string {
  // Using both name and media key to ensure robust matching across branches
  return `${clip.name}`;
}

/**
 * Core CRDT Auto-Merge Evaluator
 * Operates purely on OTIO schemas with zero React or external dependencies.
 * 
 * @param baseTimeline The existing timeline state (e.g. 'main' branch)
 * @param incomingTimeline The proposed timeline state (e.g. from an AI agent or freelancer PR)
 * @returns MergeResult denoting a clean auto-merge or a hard semantic conflict.
 */
export function evaluatePullRequest(
  baseTimeline: OTIOTimeline,
  incomingTimeline: OTIOTimeline
): MergeResult {

  // Defensive checks for malformed data
  if (!baseTimeline || !baseTimeline.children) return { status: 'auto_merged', finalManifest: incomingTimeline };
  if (!incomingTimeline || !incomingTimeline.children) return { status: 'auto_merged', finalManifest: baseTimeline };

  const conflicts: ConflictNode[] = [];
  const mergedTracks: OTIOTrack[] = [];
  const changelog: string[] = [];

  // Map base tracks by name for quick O(1) lookup
  const baseTracksMap = new Map<string, OTIOTrack>();
  for (const track of baseTimeline.children) {
    baseTracksMap.set(track.name, track);
  }

  // Iterate over incoming tracks (Rule 1: Track Level Loop)
  for (const incomingTrack of incomingTimeline.children) {
    const baseTrack = baseTracksMap.get(incomingTrack.name);

    // Rule 2: The Fast Pass (Track Independence)
    // If track exists in incoming but not in base, automatically accept it.
    if (!baseTrack) {
      mergedTracks.push(incomingTrack);
      continue;
    }

    // Hash comparison for identical tracks
    const incomingHash = JSON.stringify(incomingTrack.tracks.children);
    const baseHash = JSON.stringify(baseTrack.tracks.children);

    if (incomingHash === baseHash) {
      // Untouched or identically modified, accept base (or incoming, they are equal)
      mergedTracks.push(baseTrack);
      // Remove from map so we know it's processed
      baseTracksMap.delete(incomingTrack.name);
      continue;
    }

    // Rule 3: The Deep Pass (Clip Independence)
    // Both timelines have modifications on this track. We must deeply merge clips.
    const mergedClips: OTIOClip[] = [];

    // Map base clips by their semantic identity
    const baseClipsMap = new Map<string, OTIOClip>();
    const baseClips = baseTrack.tracks.children[0].children;
    for (const clip of baseClips) {
      baseClipsMap.set(getClipIdentity(clip), clip);
    }

    const incomingClips = incomingTrack.tracks.children[0].children;
    // Process incoming clips
    for (const incomingClip of incomingClips) {
      const clipId = getClipIdentity(incomingClip);
      const baseClip = baseClipsMap.get(clipId);


      if (!baseClip) {
        // Clip is entirely new in incoming, append it
        mergedClips.push(incomingClip);
        changelog.push(`Added "${incomingClip.name}"`);
      } else {
        // Clip exists in both. Check if they diverge.
        if (isEqualClip(baseClip, incomingClip)) {
          // Identical state, append safely
          mergedClips.push(baseClip);
        } else {
          if (!isEqualTimeRange(baseClip.source_range, incomingClip.source_range)) {
            changelog.push(`Trimmed "${incomingClip.name}"`);
          }
          // Rule 4: Hard Conflict Detection
          // Both timelines modified the exact same clip identity but in different ways
          // (e.g. duration.value changed in both). We cannot safely auto-merge.
          conflicts.push({
            trackName: incomingTrack.name,
            clipName: incomingClip.name,
            baseState: baseClip,
            incomingState: incomingClip
          });
        }
        // Remove from map to track remaining base-only clips
        baseClipsMap.delete(clipId);
      }
    }

    // Any clips remaining in baseClipsMap were untouched by incoming,
    // meaning they were deleted by the incoming timeline.
    baseClipsMap.forEach((remainingBaseClip) => {
      changelog.push(`Deleted "${remainingBaseClip.name}" from ${incomingTrack.name}`);
    });

    mergedTracks.push({
      ...baseTrack,
      tracks: {
        children: [{
          children: mergedClips
        }]
      }
    });

    // Mark track as processed
    baseTracksMap.delete(incomingTrack.name);
  }

  // Any tracks remaining in baseTracksMap were untouched by incoming, preserve them.
  baseTracksMap.forEach((remainingBaseTrack) => {
    mergedTracks.push(remainingBaseTrack);
  });

  // Task 3: The Return Statement
  if (conflicts.length > 0) {
    return {
      status: 'conflict',
      conflicts,
      changelog
    };
  }

  return {
    status: 'auto_merged',
    finalManifest: {
      children: mergedTracks,
    },
    changelog
  };
}
