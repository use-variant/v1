"use client";

import React, { useState } from 'react';
import { createProject } from '../actions/collaboration';
import { Plus, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export const CreateProjectButton = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    const res = await createProject(name);
    setIsCreating(false);

    if (res.success && res.data) {
      const fullLink = `${window.location.origin}${res.data.inviteUrl}`;
      navigator.clipboard.writeText(fullLink);
      toast.success(
        <div>
          <p className="font-bold">Project Created!</p>
          <p className="text-xs">Invite link copied to clipboard.</p>
        </div>,
        { duration: 5000, style: { minWidth: '300px' } }
      );
      setShowModal(false);
      setName('');
      router.refresh();
    } else {
      toast.error(res.error || "Failed to create project");
    }
  };

  return (
    <>
    <button 
      onClick={() => setShowModal(true)}
      disabled={isCreating}
      className="px-5 py-2.5 bg-maas-focus hover:bg-indigo-500 text-white font-extrabold text-sm rounded-lg shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:scale-100"
    >
      {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      New Project
    </button>

    {showModal && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
          <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-white mb-4">Create New Project</h2>
          <input 
            type="text" 
            placeholder="e.g. Apple Commercial" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-black border border-white/10 rounded-xl p-3.5 text-white focus:border-maas-focus outline-none mb-6 shadow-inner"
            autoFocus
          />
          <button 
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
            className="w-full py-3.5 bg-maas-focus hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Create & Generate Invite
          </button>
        </div>
      </div>
    )}
    </>
  );
};
