"use client";

import React, { useState } from 'react';
import { SpatialComment } from '../types/timeline';
import { MessageSquare, Clock, Trash2 } from 'lucide-react';
import { usePlaybackStore } from '../store/usePlaybackStore';

interface SpatialCommentOverlayProps {
  comments: SpatialComment[];
  onAddComment: (xPct: number, yPct: number, text: string) => void;
  onDeleteComment?: (id: string) => void;
  onSeek?: (time: number) => void;
}

export const SpatialCommentOverlay: React.FC<SpatialCommentOverlayProps> = ({ comments, onAddComment, onDeleteComment, onSeek }) => {
  const [draftPos, setDraftPos] = useState<{x: number, y: number} | null>(null);
  const [text, setText] = useState('');

  const activeTool = usePlaybackStore(state => state.activeTool);
  const currentTime = usePlaybackStore(state => state.currentTime);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only capture clicks directly on the wrapper overlay
    if (e.target !== e.currentTarget) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    
    setDraftPos({ x: xPct, y: yPct });
  };

  const submitComment = () => {
    if (draftPos && text.trim()) {
      onAddComment(draftPos.x, draftPos.y, text);
    }
    setDraftPos(null);
    setText('');
  };

  return (
    <div 
      className={`absolute inset-0 z-30 ${activeTool === 'comment' ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
      onClick={handleClick}
    >
      {comments.map(c => {
        // Sync pin visibility strictly to the video player’s playhead
        if (Math.abs((c.timestamp ?? c.time) - currentTime) > 0.25) return null;
        return (
          <div 
            key={c.id} 
            className="absolute group z-40 pointer-events-auto"
            style={{ left: `${c.xPct}%`, top: `${c.yPct}%`, transform: 'translate(-50%, -50%)' }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (onSeek) onSeek(c.timestamp ?? c.time);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (onSeek) onSeek(c.timestamp ?? c.time);
            }}
          >
            <div className="relative flex items-center justify-center">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.8)] border-2 animate-pulse group-hover:scale-125 transition-transform bg-indigo-500 border-white" />
            </div>
            
            <div className="absolute left-8 top-0 opacity-0 group-hover:opacity-100 pointer-events-auto transition-opacity w-56 bg-black/60 backdrop-blur-xl border border-neutral-700 p-3 rounded-xl shadow-2xl flex flex-col gap-2">
              <p className="text-sm text-neutral-200">{c.text}</p>
              {onDeleteComment && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteComment(c.id); }}
                  className="mt-1 flex items-center justify-center gap-1 w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs py-1 rounded transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              )}
            </div>
          </div>
        );
      })}

      {draftPos && (
        <div 
          className="absolute z-50 bg-black/60 backdrop-blur-xl border border-neutral-700 p-3 rounded-xl shadow-2xl w-56 flex flex-col gap-2"
          style={{ left: `${draftPos.x}%`, top: `${draftPos.y}%`, transform: 'translate(10px, 10px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold mb-1">
            <MessageSquare className="w-3 h-3" /> New Feedback
          </div>
          <textarea 
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="bg-neutral-900 border border-neutral-700 rounded-md p-2 text-sm text-white resize-none outline-none focus:border-indigo-500/50 transition-colors"
            placeholder="What needs changing?"
            rows={2}
          />
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={() => setDraftPos(null)} className="text-xs text-neutral-400 hover:text-white px-2 py-1 transition-colors">Cancel</button>
            <button onClick={submitComment} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md transition-colors shadow-lg">Post</button>
          </div>
        </div>
      )}
    </div>
  );
};
