import Link from 'next/link';
import { GitBranch, Video, SearchX } from 'lucide-react';
import { CreateProjectButton } from '../../components/CreateProjectButton';
import { getProjects } from '../../actions/projects';

export const dynamic = 'force-dynamic';

export default async function ProjectIndex() {
  const res = await getProjects();
  const projects = res.success ? res.data : [];

  return (
    <div className="p-10 max-w-5xl mx-auto w-full h-full overflow-y-auto">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-white">Projects</h1>
          <p className="text-white/40 text-sm">Select a video repository to manage branches and timelines.</p>
        </div>
        <CreateProjectButton />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(!projects || projects.length === 0) && (
          <div className="col-span-full p-16 flex flex-col items-center justify-center text-white/30 border border-white/5 border-dashed rounded-2xl">
            <SearchX className="w-10 h-10 mb-4 opacity-50" />
            <p>No projects found. Create one to get started.</p>
          </div>
        )}
        {projects?.map((p: any) => (
          <Link key={p.id} href={`/${p.id}`}>
            <div className="group bg-surface border border-white/10 rounded-2xl p-6 hover:border-maas-focus/50 hover:bg-elevated transition-all cursor-pointer shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-maas-focus/5 rounded-bl-full group-hover:bg-maas-focus/10 transition-colors" />
              
              <h2 className="text-xl font-bold text-white mb-4 group-hover:text-maas-focus transition-colors relative z-10">{p.name}</h2>
              
              <div className="flex items-center gap-4 text-xs font-medium text-white/40 relative z-10">
                <span className="flex items-center gap-1.5"><GitBranch className="w-4 h-4" /> main</span>
                <span className="flex items-center gap-1.5"><Video className="w-4 h-4" /> proxy.mp4</span>
              </div>
              <p className="text-[10px] text-white/30 mt-4 uppercase tracking-wider relative z-10 font-bold">Created {new Date(p.created_at).toLocaleDateString()}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
