import { PlayCircle, Clock, Link as LinkIcon } from 'lucide-react';
import { getProjectInvite } from '../../../actions/projects';
import { CopyInviteButton } from '../../../components/CopyInviteButton';

export const dynamic = 'force-dynamic';

export default async function ProjectTimelineHome({ params }: { params: { projectId: string } }) {
  const res = await getProjectInvite(params.projectId);
  const invite = res.success ? res.data : null;

  const commits = [
    { id: 'c-890a', msg: 'Color pass and final audio mix', time: '1 hr ago', user: 'Editor A' },
    { id: 'c-341f', msg: 'Merged PR #42 (AI B-Roll)', time: '4 hrs ago', user: 'Bot' },
    { id: 'c-112b', msg: 'Initial rough cut ingest', time: 'Yesterday', user: 'Director' },
  ];

  return (
    <div className="p-10 max-w-6xl mx-auto w-full h-full overflow-y-auto">
      <div className="grid grid-cols-3 gap-8">
        
        {/* Main Video View */}
        <div className="col-span-2 space-y-6">
          
          {invite && (
            <div className="p-4 bg-maas-focus/10 border border-maas-focus/20 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LinkIcon className="w-5 h-5 text-maas-focus" />
                <div>
                  <h3 className="text-sm font-bold text-white">Freelancer Invite Link</h3>
                  <p className="text-xs text-white/50">Send this to guests to allow them to submit PRs.</p>
                </div>
              </div>
              <CopyInviteButton token={invite.token} />
            </div>
          )}

          <h2 className="text-lg font-bold text-white tracking-tight">Main Branch Head</h2>
          <div className="w-full aspect-video bg-surface border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl relative overflow-hidden group cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
            <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform z-20 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <PlayCircle className="w-10 h-10 text-white/90" />
            </div>
            <p className="absolute bottom-4 left-5 z-20 text-xs font-mono text-white/60 font-bold tracking-widest uppercase">proxy_final_v4.mp4</p>
          </div>
        </div>

        {/* Commit History */}
        <div className="col-span-1 space-y-4">
          <h2 className="text-lg font-bold text-white tracking-tight">Commit History</h2>
          <div className="bg-surface border border-white/10 rounded-xl overflow-hidden shadow-lg">
            {commits.map((c, i) => (
              <div key={c.id} className={`p-5 ${i !== commits.length - 1 ? 'border-b border-white/5' : ''} hover:bg-elevated transition-colors cursor-pointer group`}>
                <p className="text-sm font-bold text-white/90 mb-1 leading-snug group-hover:text-maas-focus transition-colors">{c.msg}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-black border border-white/10 rounded text-white/50 group-hover:border-white/20 transition-colors">{c.id}</span>
                  <span className="text-[10px] text-white/40 flex items-center gap-1 font-bold uppercase tracking-wider"><Clock className="w-3 h-3" /> {c.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
      </div>
    </div>
  );
}
