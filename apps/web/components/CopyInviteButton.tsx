"use client";

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export const CopyInviteButton = ({ token }: { token: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Invite Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
      onClick={handleCopy}
      className="px-4 py-2 bg-black hover:bg-white/5 border border-white/10 hover:border-white/30 text-xs font-bold text-white rounded-lg flex items-center gap-2 transition-all shadow-inner"
    >
      {copied ? <Check className="w-4 h-4 text-maas-add" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied!' : 'Copy Link'}
    </button>
  );
};
