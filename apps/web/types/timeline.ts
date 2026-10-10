export interface Clip {
  id: string;
  name: string;
  start: number;
  duration: number;
  type: 'video' | 'audio';
}

export interface Track {
  id: string;
  clips: Clip[];
}

export interface Conflict {
  id: string;
  trackId: string;
  baseClip: Clip | null;
  incomingClip: Clip | null;
  status: 'pending' | 'resolved_base' | 'resolved_incoming';
}

export interface TimelineState {
  tracks: Track[];
  conflicts: Conflict[];
}

export interface SpatialComment {
  id: string;
  time: number;
  timestamp?: number;
  xPct: number;
  yPct: number;
  text: string;
  isHistorical?: boolean;
  resolved?: boolean;
  isGeneral?: boolean;
  commit_id?: string;
  pr_id?: string;
}

export interface ChangelogEntry {
  id: string;
  description: string;
  timestamp: number;
}
