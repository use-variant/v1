import { getPullRequestData } from '@/actions/pull-request';
import { GuestRoomClient } from './GuestRoomClient';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function GuestFeedbackRoom({ params }: { params: { token: string, prId: string } }) {
  const res = await getPullRequestData(params.prId);

  if (!res.success || !res.data) {
    return (
      <div className="flex items-center justify-center h-screen bg-background font-sans">
        <div className="p-8 bg-rose-950/20 border border-rose-500/20 rounded-xl max-w-md flex flex-col items-center text-center gap-4 shadow-2xl">
          <div className="p-3 bg-rose-500/10 rounded-full shadow-inner border border-rose-500/20">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-xl font-bold text-rose-500 tracking-tight">Invalid Session</h1>
          <p className="text-white/60 text-sm">{res.error || "This guest token or PR is invalid or has expired."}</p>
        </div>
      </div>
    );
  }

  const { pullRequest, commits, diffAnalysis, comments, masterDiffDuration } = res.data;
  
  return (
    <GuestRoomClient 
      pullRequest={pullRequest}
      commits={commits}
      diffAnalysis={diffAnalysis}
      comments={comments}
      token={params.token}
      masterDiffDuration={masterDiffDuration}
    />
  );
}
