"use client";

import React, { useState, useEffect } from 'react';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { VideoDiffEngine } from '@/components/VideoDiffEngine';
import { GhostTimeline } from '@/components/GhostTimeline';
import { SpatialCommentOverlay } from '@/components/SpatialCommentOverlay';
import { UploadCloud, FileVideo, FileCode, ArrowRight, Loader2, MessageCircle, Clock, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { submitRevisionToPR, deleteTemporalComment } from '@/actions/collaboration';
import { SpatialComment } from '@/types/timeline';
import { supabase } from '@/lib/supabase';

interface GuestRoomClientProps {
  pullRequest: any;
  commits: any;
  diffAnalysis: any;
  comments: SpatialComment[];
  token: string;
  masterDiffDuration: number;
}

const formatSeconds = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}s`;
};

export const GuestRoomClient: React.FC<GuestRoomClientProps> = ({ pullRequest, commits, diffAnalysis, comments: initialComments, token, masterDiffDuration }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [proxyFile, setProxyFile] = useState<File | null>(null);
  const [fcpxmlFile, setFcpxmlFile] = useState<File | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [comments, setComments] = useState<SpatialComment[]>(initialComments);
  const currentTime = usePlaybackStore(state => state.currentTime);
  const setCurrentTimeStore = usePlaybackStore(state => state.setCurrentTime);
  const setIsPlaying = usePlaybackStore(state => state.setIsPlaying);

  const activeComments = comments.filter(c => Math.abs((c.timestamp ?? c.time) - currentTime) < 0.25);

  const [isHydrated, setIsHydrated] = useState(false);
  const setDuration = usePlaybackStore(state => state.setDuration);

  const baseManifest = commits.target.tvm;
  const incomingManifest = commits.incoming.tvm;
  const baseProxyUrl = commits.target.proxyUrl;
  const incomingProxyUrl = commits.incoming.proxyUrl;

  useEffect(() => {
    setIsHydrated(true);
    setDuration(masterDiffDuration || 30);
  }, [masterDiffDuration, setDuration]);

  const seekToComment = (time: number) => {
    setIsPlaying(false);
    setCurrentTimeStore(time);
  };

  const handleVerifyFix = async (id: string) => {
    // In a full implementation, this might mark as "resolved" or delete it.
    // Given the previous instructions, let's allow them to just delete/resolve it locally for now.
    setComments(prev => prev.filter(c => c.id !== id));
    await deleteTemporalComment(id);
    toast.success("Marked as verified & removed");
  };

  const handleSubmitRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proxyFile || !fcpxmlFile || !commitMessage) {
      toast.error('Please attach both files and a message.');
      return;
    }

    setIsSubmitting(true);
    const startTime = performance.now();
    try {
      const fileExt = proxyFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${pullRequest.id}/${fileName}`;
      
      const proxyUploadStart = performance.now();
      
      const { error: uploadError } = await supabase.storage
        .from('proxies')
        .upload(filePath, proxyFile);
        
      console.log(`[AUDIT] Direct Client Proxy Upload finished in ${((performance.now() - proxyUploadStart) / 1000).toFixed(2)}s`);
      
      if (uploadError) throw new Error(uploadError.message || "Failed to upload proxy file");
      
      const { data: publicUrlData } = supabase.storage
        .from('proxies')
        .getPublicUrl(filePath);
        
      const proxyUrl = publicUrlData.publicUrl;

      const formData = new FormData();
      formData.append('file', fcpxmlFile);
      const apiUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';
      
      const pythonApiStart = performance.now();
      const apiRes = await fetch(`${apiUrl}/convert/fcpxml-to-json`, {
        method: 'POST',
        body: formData,
      });
      console.log(`[AUDIT] Python API finished in ${((performance.now() - pythonApiStart) / 1000).toFixed(2)}s`);

      if (!apiRes.ok) throw new Error(`Python API failed to convert FCPXML: ${apiRes.statusText}`);
      const otioJson = await apiRes.json();

      const dbTransactionStart = performance.now();
      const res = await submitRevisionToPR(pullRequest.id, JSON.stringify(otioJson), proxyUrl, commitMessage, token);
      console.log(`[AUDIT] submitRevisionToPR Server Action finished in ${((performance.now() - dbTransactionStart) / 1000).toFixed(2)}s`);
      
      if (!res.success) throw new Error(res.error || 'Failed to submit revision');

      toast.success('Revision successfully submitted!');
      setIsDrawerOpen(false);
      setProxyFile(null);
      setFcpxmlFile(null);
      setCommitMessage('');
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during submission');
    } finally {
      console.log(`[AUDIT] Total Transaction Time: ${((performance.now() - startTime) / 1000).toFixed(2)}s`);
      setIsSubmitting(false);
    }
  };

  if (!isHydrated) return <div className="h-full w-full bg-black flex items-center justify-center text-white/40">Loading workspace...</div>;

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-black flex flex-col text-white font-sans relative">
      {/* Header */}
      <header className="h-auto min-h-[4rem] border-b border-white/10 flex flex-col sm:flex-row items-center justify-between px-6 py-4 sm:py-0 shrink-0 bg-[#0A0A0A] gap-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Read-Only Revision Studio
            </h1>
            <p className="text-[10px] text-white/40 font-mono">PR: {pullRequest.id.substring(0, 8)}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsDrawerOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-md shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all cursor-pointer flex items-center gap-2"
        >
          <UploadCloud className="w-4 h-4" /> Submit Revision
        </button>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        
        {/* Left Sidebar (Task / Feedback List) */}
        <div className="w-full lg:w-[360px] xl:w-[400px] flex-shrink-0 flex flex-col h-full bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20">
          <div className="p-4 border-b border-white/10 shrink-0">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-indigo-400" />
              Lead Editor Feedback
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {comments.map(c => (
              <div key={c.id} className="flex flex-col gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl transition-all hover:bg-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                    <Clock className="w-3 h-3" /> Timestamp Marker
                  </div>
                </div>
                <p className="text-sm text-white/80">{c.text}</p>
                <div className="mt-2 flex justify-end">
                  <button 
                    onClick={() => seekToComment(c.timestamp ?? c.time)}
                    className="text-[10px] font-mono bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 transition-colors cursor-pointer"
                  >
                    Go to {formatSeconds(c.timestamp ?? c.time)}
                  </button>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <div className="text-center text-white/40 text-sm py-10 flex flex-col items-center gap-2">
                <CheckSquare className="w-8 h-8 opacity-20" />
                No pending feedback.
              </div>
            )}
          </div>
        </div>

        {/* Right Main Area: Video Engine & Timeline */}
        <div className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden bg-[#050505] rounded-xl border border-white/5 relative">
          <div className="flex-1 min-h-0 relative p-4 flex flex-col">
            <VideoDiffEngine 
              proxyUrlBase={baseProxyUrl}
              proxyUrlIncoming={incomingProxyUrl}
              baseManifest={baseManifest}
              incomingManifest={incomingManifest}
            >
              <SpatialCommentOverlay 
                comments={activeComments} 
                onAddComment={() => {}} // Guest cannot add comments
                onSeek={seekToComment}
              />
            </VideoDiffEngine>
          </div>
          <div className="shrink-0 w-full bg-[#0A0A0A] p-4 border-t border-white/10">
            <GhostTimeline 
              targetTimeline={baseManifest?.tracks?.children || []}
              incomingTimeline={incomingManifest?.tracks?.children || []}
              comments={comments}
              readOnly={true}
            />
          </div>
        </div>
      </div>

      {/* Glassmorphic Sliding Drawer for Uploads */}
      <div 
        className={`absolute top-0 right-0 h-full w-[450px] bg-black/60 backdrop-blur-3xl border-l border-white/10 shadow-2xl transition-transform duration-500 z-50 flex flex-col ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-400" /> Submit Revision
            </h2>
            <button onClick={() => setIsDrawerOpen(false)} className="text-white/40 hover:text-white transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmitRevision} className="space-y-6 flex-1 flex flex-col">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">Revision Notes</label>
              <textarea 
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="What did you fix?" 
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3.5 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none placeholder:text-white/20 h-28 shadow-inner"
              />
            </div>

            <div className="flex flex-col gap-4">
              <div className="relative group h-32">
                <input type="file" accept=".mp4,.mov" onChange={(e) => setProxyFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all ${proxyFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 bg-black/40 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5'}`}>
                  <FileVideo className={`w-6 h-6 mb-2 ${proxyFile ? 'text-emerald-400' : 'text-white/20 group-hover:text-indigo-400'} transition-colors`} />
                  <p className="text-xs font-bold text-white/80 line-clamp-1 px-4 text-center">{proxyFile ? proxyFile.name : 'Updated Proxy (.mp4, .mov)'}</p>
                </div>
              </div>

              <div className="relative group h-32">
                <input type="file" accept=".fcpxml" onChange={(e) => setFcpxmlFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all ${fcpxmlFile ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/10 bg-black/40 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5'}`}>
                  <FileCode className={`w-6 h-6 mb-2 ${fcpxmlFile ? 'text-amber-400' : 'text-white/20 group-hover:text-indigo-400'} transition-colors`} />
                  <p className="text-xs font-bold text-white/80 line-clamp-1 px-4">{fcpxmlFile ? fcpxmlFile.name : 'Updated FCPXML'}</p>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.4)] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Pushing...</>
                ) : (
                  <>Push Revision <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Drawer Overlay (dim background when drawer is open) */}
      {isDrawerOpen && (
        <div 
          className="absolute inset-0 bg-black/40 z-40" 
          onClick={() => setIsDrawerOpen(false)}
        />
      )}
    </div>
  );
}
