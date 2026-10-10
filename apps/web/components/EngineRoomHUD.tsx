"use client";

import React, { useState } from 'react';
import { Activity, Copy, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

export interface TelemetryState {
  base: {
    status: 'idle' | 'loading' | 'ready' | 'error' | 'null';
    error?: string;
    url: string | null;
  };
  incoming: {
    status: 'idle' | 'loading' | 'ready' | 'error' | 'null';
    error?: string;
    url: string | null;
  };
  currentTime: number;
}

interface HUDProps {
  telemetry: TelemetryState;
  manifests: { base: any; incoming: any };
  isAllResolved?: boolean;
  isPreviewing?: boolean;
  onPreviewMerge?: () => void;
  onExitPreview?: () => void;
}

export const EngineRoomHUD: React.FC<HUDProps> = ({ telemetry, manifests, isAllResolved, isPreviewing, onPreviewMerge, onExitPreview }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleCopy = () => {
    const payload = JSON.stringify({ telemetry, manifests }, null, 2);
    navigator.clipboard.writeText(payload);
    toast.success("Diagnostic data copied");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
      case 'error': return <XCircle className="w-3 h-3 text-rose-500" />;
      case 'loading': return <Activity className="w-3 h-3 text-amber-500 animate-pulse" />;
      default: return <div className="w-3 h-3 rounded-full bg-neutral-600" />;
    }
  };

  return (
    <div className="absolute bottom-4 right-4 z-50 flex flex-col items-end pointer-events-auto">
      <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl w-72 text-xs font-mono">
        <div 
          className="p-2 border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
        >
          <div className="flex items-center gap-2 font-bold text-white/80 tracking-widest">
            <Activity className="w-4 h-4 text-maas-focus" />
            DIAGNOSTIC HUD
          </div>
          <div className="flex items-center gap-2">
            {!isPreviewing ? (
              <button
                onClick={(e) => { e.stopPropagation(); if (isAllResolved && onPreviewMerge) onPreviewMerge(); }}
                disabled={!isAllResolved}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isAllResolved ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-white/5 text-white/30 cursor-not-allowed'}`}
              >
                Preview Merge
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); if (onExitPreview) onExitPreview(); }}
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
              >
                Exit Preview
              </button>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          </div>
        </div>
        
        {isExpanded && (
          <div className="p-3 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-2">
              <div className="text-white/40 font-semibold mb-1 tracking-wider text-[10px]">CONNECTIONS</div>
              
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between bg-neutral-900/50 p-1.5 rounded border border-white/5">
                  <span className="text-white/60">Base Proxy</span>
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[100px] opacity-50">{telemetry.base.url ? telemetry.base.url.split('/').pop() : 'null'}</span>
                    {getStatusIcon(telemetry.base.status)}
                  </div>
                </div>
                {telemetry.base.error && <div className="text-rose-400 text-[10px] break-words pl-1">{telemetry.base.error}</div>}

                <div className="flex items-center justify-between bg-neutral-900/50 p-1.5 rounded border border-white/5 mt-1">
                  <span className="text-white/60">Incoming Proxy</span>
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[100px] opacity-50">{telemetry.incoming.url ? telemetry.incoming.url.split('/').pop() : 'null'}</span>
                    {getStatusIcon(telemetry.incoming.status)}
                  </div>
                </div>
                {telemetry.incoming.error && <div className="text-rose-400 text-[10px] break-words pl-1">{telemetry.incoming.error}</div>}
              </div>
            </div>

            <div className="space-y-1">
               <div className="text-white/40 font-semibold tracking-wider text-[10px]">SYNC STATE</div>
               <div className="flex justify-between text-white/60">
                 <span>Time:</span>
                 <span className="font-bold text-white/80">{telemetry.currentTime.toFixed(3)}s</span>
               </div>
            </div>

            <button 
              onClick={handleCopy}
              className="w-full py-1.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded flex items-center justify-center gap-2 transition-colors mt-2"
            >
              <Copy className="w-3 h-3" /> Copy Payload
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
