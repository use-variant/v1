"use client";

import { Download, VideoOff } from 'lucide-react';

export function GuestProjectState({ proxyUrl, manifest }: { proxyUrl: string | null, manifest: any }) {
  const handleDownload = () => {
    console.log("Current FCPXML Manifest:", manifest);
    alert("Manifest logged to console. FCPXML export coming soon!");
  };

  return (
    <div className="mb-8 bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
      <div className="p-5 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-widest text-white/40 uppercase">Current Project State</h2>
        <button 
          onClick={handleDownload}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold transition-colors text-white/80"
        >
          <Download className="w-4 h-4" /> Download Current FCPXML
        </button>
      </div>
      
      <div className="p-6">
        <div className="relative w-full aspect-video flex items-center justify-center bg-black rounded-lg overflow-hidden border border-white/10 shadow-inner">
          {proxyUrl ? (
            <video 
              src={proxyUrl} 
              controls
              playsInline
              preload="metadata"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-white/30 gap-3">
              <VideoOff className="w-10 h-10 opacity-50" />
              <p className="text-sm font-mono">No Head Proxy Available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
