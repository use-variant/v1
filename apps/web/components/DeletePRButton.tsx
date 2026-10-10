"use client";

import { Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { deletePullRequest } from '../actions/collaboration';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export function DeletePRButton({ prId, token }: { prId: string, token: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this revision?')) return;
    
    setIsDeleting(true);
    const res = await deletePullRequest(prId, token);
    setIsDeleting(false);
    
    if (res.success) {
      toast.success('Pull request deleted');
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to delete');
    }
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-2.5 text-white/30 hover:text-maas-delete hover:bg-maas-delete/10 rounded-lg transition-colors border border-transparent hover:border-maas-delete/20 shadow-sm"
      title="Delete Revision"
    >
      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
