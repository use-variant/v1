import { getPullRequestData } from '@/actions/pull-request';
import { EngineRoomClient } from '@/components/EngineRoomClient';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EngineRoom({ params }: { params: { projectId: string, prId: string } }) {
  const res = await getPullRequestData(params.prId);

  if (!res.success || !res.data) {
    return (
      <div className="flex items-center justify-center h-screen bg-background font-sans">
        <div className="p-8 bg-amber-950/20 border border-amber-500/20 rounded-xl max-w-md flex flex-col items-center text-center gap-4 shadow-2xl">
          <div className="p-3 bg-amber-500/10 rounded-full shadow-inner border border-amber-500/20">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold text-amber-500 tracking-tight">Failed to load Engine Room</h1>
          <p className="text-white/60 text-sm">{res.error || "An unknown error occurred while establishing the pipeline."}</p>
          <Link href={`/${params.projectId}/pulls`} className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-lg transition-colors shadow-lg shadow-amber-500/20">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { pullRequest, isInitialPR, commits, diffAnalysis, comments, masterDiffDuration } = res.data;

  // console.log("Result", res.data);

  return (
    <EngineRoomClient 
      pullRequest={pullRequest}
      isInitialPR={isInitialPR}
      baseManifest={commits.target.tvm}
      incomingManifest={commits.incoming.tvm}
      baseProxyUrl={commits.target.proxyUrl}
      incomingProxyUrl={commits.incoming.proxyUrl}
      diffAnalysis={diffAnalysis}
      initialComments={comments}
      masterDiffDuration={masterDiffDuration}
    />
  );
}


