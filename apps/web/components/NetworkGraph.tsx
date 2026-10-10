"use client";

import React, { useMemo } from 'react';

interface CommitNode {
  commit: any;
  row: number;
  lane: number;
}

interface NetworkGraphProps {
  commits: any[];
  branches: any[];
}

const ROW_HEIGHT = 64;
const COL_WIDTH = 28;
const NODE_RADIUS = 6;

const laneColors = [
  '#10b981', // emerald-500 (Main)
  '#6366f1', // indigo-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
  '#84cc16', // lime-500
];

export const NetworkGraph: React.FC<NetworkGraphProps> = ({ commits, branches }) => {
  const { commitMap, maxLanes } = useMemo(() => {
    const map = new Map<string, CommitNode>();
    const activeLanes: (string | null)[] = [];
    let max = 0;

    commits.forEach((c, index) => {
      let laneIndex = activeLanes.indexOf(c.id);
      if (laneIndex === -1) {
        laneIndex = activeLanes.indexOf(null);
        if (laneIndex === -1) {
          laneIndex = activeLanes.length;
          activeLanes.push(c.id);
        } else {
          activeLanes[laneIndex] = c.id;
        }
      }

      if (laneIndex > max) max = laneIndex;

      map.set(c.id, { commit: c, row: index, lane: laneIndex });

      // Clear c.id from all lanes, as it has been consumed
      for(let i=0; i<activeLanes.length; i++) {
        if (activeLanes[i] === c.id) activeLanes[i] = null;
      }

      // Process parents
      if (c.parent_ids && c.parent_ids.length > 0) {
        activeLanes[laneIndex] = c.parent_ids[0];
        
        if (c.parent_ids.length > 1) {
           for (let i = 1; i < c.parent_ids.length; i++) {
             const pId = c.parent_ids[i];
             if (!activeLanes.includes(pId)) {
               const emptyIdx = activeLanes.indexOf(null);
               if (emptyIdx === -1) {
                 activeLanes.push(pId);
               } else {
                 activeLanes[emptyIdx] = pId;
               }
             }
           }
        }
      }
    });

    return { commitMap: map, maxLanes: max };
  }, [commits]);

  const svgWidth = (maxLanes + 1) * COL_WIDTH + 40;
  const svgHeight = commits.length * ROW_HEIGHT;

  if (commits.length === 0) {
    return <div className="text-white/40 text-sm text-center py-10">No commits found in this project.</div>;
  }

  return (
    <div className="relative w-full overflow-x-auto custom-scrollbar">
      <div className="relative" style={{ height: svgHeight, minWidth: svgWidth + 400 }}>
        {/* SVG Lines Layer */}
        <svg className="absolute inset-0 pointer-events-none z-0" width="100%" height={svgHeight}>
          {commits.map(c => {
            const node = commitMap.get(c.id);
            if (!node || !c.parent_ids) return null;
            
            const x1 = node.lane * COL_WIDTH + 30;
            const y1 = node.row * ROW_HEIGHT + ROW_HEIGHT / 2;

            return c.parent_ids.map((pId: string) => {
              const pNode = commitMap.get(pId);
              if (!pNode) return null;
              
              const x2 = pNode.lane * COL_WIDTH + 30;
              const y2 = pNode.row * ROW_HEIGHT + ROW_HEIGHT / 2;

              const color = laneColors[pNode.lane % laneColors.length];
              const strokeWidth = node.lane === 0 && pNode.lane === 0 ? 3 : 2;

              // Bezier S-curve for smooth lane transitions
              const d = `M ${x1} ${y1} C ${x1} ${(y1+y2)/2}, ${x2} ${(y1+y2)/2}, ${x2} ${y2}`;

              return (
                <path 
                  key={`${c.id}-${pId}`}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  opacity={node.lane === 0 && pNode.lane === 0 ? 0.9 : 0.5}
                  className="transition-all duration-300"
                />
              );
            });
          })}
        </svg>

        {/* HTML Nodes & Content Layer */}
        {commits.map(c => {
           const node = commitMap.get(c.id);
           if (!node) return null;
           
           const x = node.lane * COL_WIDTH + 30;
           const color = laneColors[node.lane % laneColors.length];
           const isMerge = c.parent_ids && c.parent_ids.length > 1;

           const branchHeads = branches.filter(b => b.head_commit_id === c.id);
           const isMainHead = branchHeads.some(b => b.name === 'main');

           return (
             <div 
               key={c.id} 
               className="absolute w-full flex items-center hover:bg-white/5 transition-colors rounded-xl group cursor-crosshair z-10"
               style={{ top: node.row * ROW_HEIGHT, height: ROW_HEIGHT }}
             >
               {/* Commit Dot */}
               <div 
                 className="absolute z-10 rounded-full border-[3px] border-[#0A0A0A] box-content transition-transform group-hover:scale-125 shadow-xl"
                 style={{ 
                   left: x - NODE_RADIUS, 
                   top: ROW_HEIGHT / 2 - NODE_RADIUS,
                   width: NODE_RADIUS * 2,
                   height: NODE_RADIUS * 2,
                   backgroundColor: color,
                   boxShadow: isMerge ? `0 0 15px 2px ${color}80` : 'none',
                 }}
               />

               {/* Commit Info */}
               <div 
                 className="ml-auto pr-6 flex items-center justify-between w-full"
                 style={{ paddingLeft: svgWidth }}
               >
                 <div className="flex flex-col truncate pr-4">
                   <div className="flex items-center gap-3">
                     <span className={`font-bold text-sm tracking-tight truncate ${isMainHead ? 'text-white' : 'text-white/80'}`}>
                       {c.message || 'Untitled Commit'}
                     </span>
                     {branchHeads.map(b => (
                       <span 
                         key={b.id} 
                         className={`px-2 py-0.5 border text-[10px] font-bold rounded-full uppercase tracking-widest shadow-inner ${
                           b.name === 'main' 
                             ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                             : 'bg-white/10 border-white/20 text-white/80'
                         }`}
                       >
                         {b.name}
                       </span>
                     ))}
                   </div>
                   <span className="text-white/30 text-xs mt-0.5 font-medium">
                     {new Date(c.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                   </span>
                 </div>

                 <div className="flex items-center gap-4 shrink-0">
                   <span className="font-mono text-white/40 text-xs uppercase bg-white/5 hover:bg-white/10 transition-colors px-2 py-1 rounded border border-white/10">
                     {c.id.substring(0, 7)}
                   </span>
                 </div>
               </div>
             </div>
           );
        })}
      </div>
    </div>
  );
};
