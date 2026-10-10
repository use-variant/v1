"use client";

import React from 'react';
import { ChangelogEntry } from '../types/timeline';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { History, Clock, Wand2, Scissors, ArrowRightLeft } from 'lucide-react';

interface SemanticChangelogProps {
  entries: ChangelogEntry[];
}

export const SemanticChangelog: React.FC<SemanticChangelogProps> = ({ entries }) => {
  const setCurrentTime = usePlaybackStore(state => state.setCurrentTime);

  const getIcon = (desc: string) => {
    if (desc.includes('Trimmed') || desc.includes('Cut') || desc.includes('Removed')) return <Scissors className="w-4 h-4 text-maas-delete" />;
    if (desc.includes('Added') || desc.includes('Generated')) return <Wand2 className="w-4 h-4 text-maas-add" />;
    return <ArrowRightLeft className="w-4 h-4 text-maas-focus" />;
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden select-none">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {entries.map(entry => (
          <div 
            key={entry.id} 
            className="group flex flex-col p-3 rounded-xl border border-white/5 bg-elevated/50 hover:bg-elevated hover:border-white/10 transition-all cursor-pointer shadow-sm"
            onClick={() => setCurrentTime(entry.timestamp)}
          >
            <div className="flex items-start gap-3 mb-2">
              <div className="mt-0.5 p-1.5 rounded-md bg-black border border-white/5 shadow-inner">
                {getIcon(entry.description)}
              </div>
              <p className="text-sm font-medium text-white/80 leading-snug flex-1 group-hover:text-white transition-colors">
                {entry.description}
              </p>
            </div>
            <div className="flex justify-end">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black text-white/40 group-hover:bg-maas-focus/10 group-hover:text-maas-focus transition-colors border border-white/5 group-hover:border-maas-focus/30">
                <Clock className="w-3 h-3" /> {formatTime(entry.timestamp)}
              </span>
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-white/20 gap-2">
            <History className="w-8 h-8 opacity-50" />
            <p className="text-sm font-medium">No changes detected</p>
          </div>
        )}
      </div>
    </div>
  );
};
