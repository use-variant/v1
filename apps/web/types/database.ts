export interface Project {
  id: string;
  name: string;
  asset_ledger: { proxy_url: string } & Record<string, string>;
}

export interface Commit {
  id: string;
  otio_manifest: any;
  parent_ids: string[];
}

export interface PullRequest {
  id: string;
  project_id: string;
  title: string;
  base_commit_id: string;
  incoming_commit_id: string;
  status: 'open' | 'merged' | 'closed';
  created_at?: string;
}

export interface EngineRoomPayload {
  pullRequest: PullRequest;
  isInitialPR: boolean;
  commits: {
    ancestor: { proxyUrl: string | null };
    target: { tvm: any; proxyUrl: string | null };
    incoming: { tvm: any; proxyUrl: string | null };
  };
  diffAnalysis: {
    canAutoMerge: boolean;
    conflicts: any[];
    semanticChangelog: any[];
  };
  comments: any[];
  project: Project;
  masterDiffDuration: number;
}
