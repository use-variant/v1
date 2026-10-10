import { create } from 'zustand';

export type DiffMode = 'split' | 'wipe' | 'onion';

interface TimelineStoreState {
  // Data State
  baseManifest: any | null;
  incomingManifest: any | null;
  proxyUrl: string;
  hydrated: boolean;
  
  // Playback State
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  activeDiffMode: DiffMode;
  activeTool: 'hand' | 'comment';
  
  // Actions
  hydrate: (base: any, incoming: any, url: string) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setActiveDiffMode: (mode: DiffMode) => void;
  setActiveTool: (tool: 'hand' | 'comment') => void;
}

export const usePlaybackStore = create<TimelineStoreState>((set) => ({
  baseManifest: null,
  incomingManifest: null,
  proxyUrl: '',
  hydrated: false,
  
  isPlaying: false,
  currentTime: 0,
  duration: 60,
  activeDiffMode: 'wipe',
  activeTool: 'hand',
  
  hydrate: (base, incoming, url) => set({ baseManifest: base, incomingManifest: incoming, proxyUrl: url, hydrated: true }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setActiveDiffMode: (mode) => set({ activeDiffMode: mode }),
  setActiveTool: (tool) => set({ activeTool: tool }),
}));
