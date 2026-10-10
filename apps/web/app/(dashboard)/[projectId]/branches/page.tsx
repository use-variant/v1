import React from 'react';
import { getProjectDAG } from '../../../../actions/dag';
import { GitBranch, ShieldAlert } from 'lucide-react';
import { NetworkGraph } from '@/components/NetworkGraph';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BranchesPage({ params }: { params: { projectId: string } }) {
  const res = await getProjectDAG(params.projectId);

  if (!res.success || !res.data) {
    return (
      <div className="p-10 max-w-5xl mx-auto w-full h-full flex flex-col items-center justify-center bg-[#0A0A0A]">
         <ShieldAlert className="w-12 h-12 text-rose-500 mb-4" />
         <h1 className="text-xl font-bold text-white mb-2">Failed to load DAG</h1>
         <p className="text-white/40">{res.error}</p>
      </div>
    );
  }

  const { branches, commits } = res.data;

  return (
    <div className="p-10 max-w-5xl mx-auto w-full h-full overflow-y-auto bg-[#0A0A0A]">
      <header className="mb-10 flex items-center justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-white flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-maas-focus" /> 
            Branch Network
          </h1>
          <p className="text-white/40 text-sm">Visualize the project's commit history and Git DAG.</p>
        </div>
        <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg flex items-center gap-3 shadow-inner">
           <span className="text-white/60 text-xs font-bold uppercase tracking-widest">Active Branches</span>
           <span className="text-maas-focus font-mono font-bold text-lg">{branches.length}</span>
        </div>
      </header>

      <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl p-6 relative overflow-hidden backdrop-blur-xl">
        <NetworkGraph branches={branches} commits={commits} />
      </div>
    </div>
  );
}
