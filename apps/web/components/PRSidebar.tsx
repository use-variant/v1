"use client";

import React, { useState } from 'react';
import { ChangelogEntry, SpatialComment } from '../types/timeline';
import { SemanticChangelog } from './SemanticChangelog';
import { MessageCircle, History, GitCommit, Clock, Trash2 } from 'lucide-react';

interface PRSidebarProps {
  comments: SpatialComment[];
  changelog: ChangelogEntry[];
  pullRequest: any;
  onSeek: (time: number) => void;
  onDeleteComment: (id: string) => void;
}

const formatSeconds = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}s`;
};

export const PRSidebar: React.FC<PRSidebarProps> = ({ comments, changelog, pullRequest, onSeek, onDeleteComment }) => {
  const [activeTab, setActiveTab] = useState<'diff' | 'discuss'>('discuss');

  return (
    <div className="w-full xl:w-[400px] flex flex-col h-[600px] xl:h-full bg-[#0A0A0A] xl:border-l border-t xl:border-t-0 border-white/10 overflow-hidden shadow-2xl shrink-0">
      <div className="flex items-center border-b border-white/10 p-2 gap-2 bg-black/40">
        <button 
          onClick={() => setActiveTab('discuss')}
          className={`flex-1 py-2 px-3 flex items-center justify-center gap-2 text-xs font-bold rounded-md transition-colors ${activeTab === 'discuss' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-white/40 hover:bg-white/5'}`}
        >
          <MessageCircle className="w-4 h-4" /> Discussions
        </button>
        <button 
          onClick={() => setActiveTab('diff')}
          className={`flex-1 py-2 px-3 flex items-center justify-center gap-2 text-xs font-bold rounded-md transition-colors ${activeTab === 'diff' ? 'bg-maas-focus/20 text-maas-focus border border-maas-focus/30' : 'text-white/40 hover:bg-white/5'}`}
        >
          <History className="w-4 h-4" /> Reviews & Diff
        </button>
      </div>

      {activeTab === 'diff' ? (
        <SemanticChangelog entries={changelog} />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* PR Creation Thread Starter */}
            <div className="flex flex-col gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="flex items-center gap-2 text-white/40 text-[10px] font-bold uppercase tracking-wider">
                <GitCommit className="w-3 h-3" /> Commit Update Thread
                <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white/60 ml-auto">
                  {pullRequest?.incoming_commit_id?.substring(0, 8) || '455bd830'}
                </span>
              </div>
              <p className="text-sm text-white/80">{pullRequest.title || 'Freelancer submitted a new revision.'}</p>
            </div>

            {/* Render comments */}
            {comments.map(c => (
              <div key={c.id} className="flex flex-col gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl transition-all hover:bg-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                    <Clock className="w-3 h-3" /> Timestamp Marker
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onSeek(c.timestamp ?? c.time)}
                      className="text-[10px] font-mono bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 transition-colors cursor-pointer"
                    >
                      Go to {formatSeconds(c.timestamp ?? c.time)}
                    </button>
                    <button
                      onClick={() => onDeleteComment(c.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Delete Comment"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-white/80">{c.text}</p>
              </div>
            ))}

            {comments.length === 0 && (
              <div className="text-center text-white/40 text-sm py-10 flex flex-col items-center gap-2">
                <MessageCircle className="w-8 h-8 opacity-20" />
                No comments yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
