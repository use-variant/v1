"use client";

import { Plus, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { createEmptyPR } from '../actions/collaboration';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export const CreatePRButton = ({ token }: { token: string }) => {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    setLoading(true);
    const res = await createEmptyPR(token);
    if (res.success && res.data) {
      toast.success("Pull Request started!");
      router.push(`/invite/${token}/pr/${res.data}`);
    } else {
      toast.error(res.error || "Failed to create PR");
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleCreate}
      disabled={loading}
      className="px-5 py-2.5 bg-white text-black font-extrabold text-sm rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:scale-100"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      New Pull Request
    </button>
  );
};
