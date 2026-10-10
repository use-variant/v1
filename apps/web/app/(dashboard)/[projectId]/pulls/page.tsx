import Link from 'next/link';
import { GitPullRequest, ArrowRight, SearchX } from 'lucide-react';
import { getProjectPullRequests } from '../../../../actions/pull-request';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PullRequestsList({ params }: { params: { projectId: string } }) {
  const res = await getProjectPullRequests(params.projectId);
  const prs = res.success ? res.data : [];

  return (
    <div className="p-10 max-w-5xl mx-auto w-full h-full overflow-y-auto">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-white">Pull Requests</h1>
          <p className="text-white/40 text-sm">Review semantic timeline changes and resolve conflicts.</p>
        </div>
        <button className="px-5 py-2.5 bg-maas-add hover:bg-emerald-400 text-black font-extrabold text-sm rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-105 active:scale-95">
          New Pull Request
        </button>
      </header>

      <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
        <div className="divide-y divide-white/5">
          {(!prs || prs.length === 0) ? (
            <div className="p-16 flex flex-col items-center justify-center text-white/30 gap-4 border-2 border-dashed border-white/5 m-4 rounded-xl">
               <SearchX className="w-10 h-10 opacity-50" />
               <p>No Pull Requests found.</p>
            </div>
          ) : (
            prs.map((pr: any) => (
              <Link key={pr.id} href={`/${params.projectId}/pulls/${pr.id}`}>
                <div className="p-6 flex items-center justify-between hover:bg-white/5 transition-all cursor-pointer group">
                  <div className="flex items-start gap-5">
                    <div className="mt-1 p-2 bg-black border border-white/10 rounded-lg group-hover:border-maas-add/50 transition-colors">
                      <GitPullRequest className="w-5 h-5 text-maas-add" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white/90 group-hover:text-maas-add transition-colors mb-1">{pr.title}</h2>
                      <p className="text-xs text-white/40 font-medium">
                        <span className="text-maas-focus font-mono bg-maas-focus/10 px-1.5 py-0.5 rounded border border-maas-focus/20 shadow-inner">freelancer</span> wants to merge into <span className="text-white/60 font-mono bg-elevated px-1.5 py-0.5 rounded border border-white/10 shadow-inner">main</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {pr.status === 'conflict' ? (
                      <span className="px-4 py-1.5 bg-maas-delete/10 text-maas-delete border border-maas-delete/20 rounded-full text-xs font-bold animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.1)]">
                        Conflicts Detected
                      </span>
                    ) : pr.status === 'merged' ? (
                      <span className="px-4 py-1.5 bg-maas-add/10 text-maas-add border border-maas-add/20 rounded-full text-xs font-bold shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                        Merged
                      </span>
                    ) : pr.title === 'New Freelancer Submission' ? (
                      <span className="px-4 py-1.5 bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded-full text-xs font-bold uppercase">
                        Draft
                      </span>
                    ) : (
                      <span className="px-4 py-1.5 bg-maas-focus/10 text-maas-focus border border-maas-focus/20 rounded-full text-xs font-bold shadow-[0_0_10px_rgba(99,102,241,0.1)] uppercase">
                        {pr.status}
                      </span>
                    )}
                    <div className="w-10 h-10 rounded-full bg-black border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                      <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-white transition-colors group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
