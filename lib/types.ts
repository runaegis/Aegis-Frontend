export interface SessionAction {
  id: string;
  session_id: string;
  agent_name: string;
  tool_name: string;
  arguments: Record<string, any>;
  action_summary: string;
  result: string;
  decision: 'ALLOW' | 'DENY' | 'REWRITE' | 'REQUIRE_APPROVAL' | string;
  target_repo: string;
  target_branch: string;
  sequence_order: number;
  timestamp: string;
}

export interface Session {
  session_id: string;
  agent_name: string;
  action_count: number;
  started_at: string;
  last_action_at: string;
  repos: string[];
  allows: number;
  denies: number;
  rewrites: number;
  approvals: number;
}

export interface User {
  github_user_id: string;
  username: string;
  email: string;
  access_token: string;
}

export interface RepoPermission {
  repo_name: string;
  owner: string;
  permission: 'allow' | 'deny' | 'require_approval';
}

export interface Repo {
  repo_name: string;
  owner: string;
  permission: 'allow' | 'deny' | 'require_approval';
}

export interface Metrics {
  total: number;
  allows: number;
  denies: number;
  rewrites: number;
  approvals: number;
}
