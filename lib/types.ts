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
  id?: string; // UUID primary key from database
  github_user_id: number;
  username: string;
  email: string;
  access_token: string;
  created_at?: string;
}

export interface RepoPermission {
  github_repo_id: number;
  can_read?: boolean;
  can_write?: boolean;
}

export interface Repo {
  repo_id: string;
  github_repo_id: number;
  full_name: string;
  name: string;
  is_private: boolean;
  can_read: boolean;
  can_write: boolean;
  granted_at?: string;
}

export interface Metrics {
  total: number;
  allows: number;
  denies: number;
  rewrites: number;
  approvals: number;
}
