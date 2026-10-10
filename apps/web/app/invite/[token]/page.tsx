import Link from 'next/link';
import { getGuestDashboard } from '../../../actions/collaboration';
import { ShieldAlert, GitPullRequest, SearchX, CheckCircle, Clock } from 'lucide-react';
import { CreatePRButton } from '../../../components/CreatePRButton';
import { DeletePRButton } from '../../../components/DeletePRButton';
import { GuestProjectState } from '../../../components/GuestProjectState';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function GuestDashboard({ params }: { params: { token: string } }) {
  const res = await getGuestDashboard(params.token);

  if (!res.success || !res.data) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#000000] text-maas-delete font-sans">
        <div className="p-10 bg-[#0A0A0A] border border-white/10 rounded-2xl max-w-md text-center shadow-2xl">
          <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-80" />
          <h1 className="text-xl font-bold mb-2 text-white">Access Denied</h1>
          <p className="text-white/40 text-sm leading-relaxed">{res.error || "Invalid Token"}</p>
        </div>
      </div>
    );
  }

  const { project, pullRequests, currentProxyUrl, currentManifest } = res.data;

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'changes_requested': return <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider">Changes Requested</span>;
      case 'conflict': return <span className="px-2 py-0.5 bg-maas-delete/10 text-maas-delete border border-maas-delete/20 rounded-full text-[10px] font-bold uppercase tracking-wider">Conflict</span>;
      case 'merged': return <span className="px-2 py-0.5 bg-maas-add/10 text-maas-add border border-maas-add/20 rounded-full text-[10px] font-bold uppercase tracking-wider"><CheckCircle className="w-3 h-3 inline mr-1" />Merged</span>;
      default: return <span className="px-2 py-0.5 bg-white/5 text-white/50 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider">Open</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white/90 font-sans p-10 flex flex-col items-center relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-maas-focus/5 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="w-full max-w-4xl z-10">
        <header className="mb-12 flex items-end justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-white">Freelancer Portal</h1>
            <p className="text-white/40 text-sm">Review feedback and submit revisions for <span className="text-white/80 font-medium">{project.name}</span>.</p>
          </div>
          <CreatePRButton token={params.token} />
        </header>

        <GuestProjectState proxyUrl={currentProxyUrl} manifest={currentManifest} />

        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl mt-8">
          <div className="p-5 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-widest text-white/40 uppercase">Your Pull Requests</h2>
          </div>
          
          <div className="divide-y divide-white/5">
            {pullRequests.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-white/30 gap-4">
                <SearchX className="w-10 h-10 opacity-50" />
                <p>No pull requests found. Ready to submit your first pass?</p>
              </div>
            ) : (
              pullRequests.map((pr: any) => (
                <Link key={pr.id} href={`/invite/${params.token}/pr/${pr.id}`}>
                  <div className="p-6 flex items-center justify-between hover:bg-white/5 transition-all cursor-pointer group">
                    <div className="flex items-start gap-5">
                      <div className="mt-1 p-2 bg-black border border-white/10 rounded-lg group-hover:border-white/30 transition-colors shadow-inner">
                        <GitPullRequest className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
                      </div>
                      <div className="w-full">
                        <h2 className="text-lg font-bold text-white/90 group-hover:text-white transition-colors mb-1">{pr.title === 'New Freelancer Submission' ? 'Draft PR (Action Required)' : pr.title}</h2>
                        
                        {pr.syncStatus?.isBehind && (
                          <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md flex items-center gap-2">
                             <ShieldAlert className="w-4 h-4 text-yellow-500" />
                             <span className="text-xs font-bold text-yellow-500 uppercase tracking-widest">Main has been updated. Sync required.</span>
                          </div>
                        )}

                        <p className="text-sm text-white/40 mb-3 line-clamp-1">{pr.title === 'New Freelancer Submission' ? 'Click here to upload your new proxy video and FCPXML.' : 'Revision successfully submitted. Waiting for Lead Editor review.'}</p>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(pr.status)}
                          <span className="text-xs text-white/30 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" /> {new Date(pr.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <DeletePRButton prId={pr.id} token={params.token} />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
