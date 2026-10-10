"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GitPullRequest, GitBranch, TerminalSquare, Video } from 'lucide-react';

export default function ProjectLayout({ children, params }: { children: React.ReactNode, params: { projectId: string } }) {
  const pathname = usePathname();
  // Check if we are on a specific pull request page (e.g., /projectId/pulls/prId)
  const isPRPage = pathname.includes('/pulls/') && pathname.split('/').pop() !== 'pulls';

  return (
    <div className="flex flex-col h-full w-full">
      {/* Project Sub-navigation Header */}
      {!isPRPage && (
      <header className="h-14 border-b border-white/10 bg-surface flex items-center px-8 shrink-0 z-40 gap-8">
        <div className="flex items-center gap-2 font-bold tracking-tight text-white/90">
          <div className="p-1.5 bg-black border border-white/10 rounded-md">
            <TerminalSquare className="w-4 h-4 text-maas-focus" />
          </div>
          {params.projectId}
        </div>
        
        <nav className="flex items-center gap-2 h-full pt-1 text-sm font-medium ml-4">
          <Link href={`/${params.projectId}`} className="h-full flex items-center gap-2 px-4 border-b-2 border-transparent hover:border-white/20 text-white/50 hover:text-white transition-all">
            <Video className="w-4 h-4" /> Timeline
          </Link>
          <Link href={`/${params.projectId}/pulls`} className="h-full flex items-center gap-2 px-4 border-b-2 border-transparent hover:border-white/20 text-white/50 hover:text-white transition-all">
            <GitPullRequest className="w-4 h-4" /> Pull Requests
            <span className="px-1.5 py-0.5 bg-maas-focus/20 border border-maas-focus/30 text-maas-focus text-[10px] font-bold rounded-full">3</span>
          </Link>
          <Link href={`/${params.projectId}/branches`} className="h-full flex items-center gap-2 px-4 border-b-2 border-transparent hover:border-white/20 text-white/50 hover:text-white transition-all">
            <GitBranch className="w-4 h-4" /> Branches
          </Link>
        </nav>
      </header>
      )}

      {/* Project Content Area */}
      <div className="flex-1 w-full relative overflow-hidden bg-background">
        {children}
      </div>
    </div>
  );
}
