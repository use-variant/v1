import Link from 'next/link';
import { Folder, Settings, User } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-background text-white/90 font-sans">
      {/* Global Sidebar */}
      <aside className="w-16 flex flex-col items-center py-6 border-r border-white/10 bg-surface shrink-0 z-50 shadow-2xl">
        <div className="flex flex-col gap-6 flex-1 w-full items-center">
          <Link href="/" className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors border border-white/10 text-maas-focus shadow-sm hover:scale-105">
            <Folder className="w-5 h-5" />
          </Link>
          <Link href="#" className="p-3 text-white/40 hover:text-white/90 transition-colors hover:scale-105">
            <Settings className="w-5 h-5" />
          </Link>
        </div>
        <div className="mt-auto">
          <button className="w-10 h-10 bg-black rounded-full border border-white/20 flex items-center justify-center hover:scale-105 transition-transform overflow-hidden shadow-inner">
            <User className="w-5 h-5 text-white/40" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
