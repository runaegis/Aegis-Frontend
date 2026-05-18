export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SessionAction {
  id: string;
  session_id: string;
  agent_name: string;
  tool_name: string;
  arguments: Record<string, any>;
  /** Human-readable bullet points; preferred over raw `arguments` in the UI when present. */
  action_pointers?: string[];
  action_summary: string;
  result: string;
  decision: "ALLOW" | "DENY" | "cd" | "REQUIRE_APPROVAL" | string;
  target_repo: string;
  target_branch: string | null;
  sequence_order: number;
  timestamp: string;
  user_id: string;
  execution_time: number;
}

export interface AggregatedSessionAction {
  session_id: string;
  user_id: string;
  action_count: number;
  started_at: string;
  ended_at: string;
  total_execution_time: number;
  tools_used: string[];
  sessions: Array<SessionAction>;
}

export type MCPApprovalStatus = "pending" | "approved" | "rejected" | string;

export interface MCPApproval {
  id: string;
  user_id: string;
  tool_name: string;
  arguments: Record<string, any>;
  status: MCPApprovalStatus;
  created_at: string;
  approved_at: string | null;
  result: any;
  context: Record<string, any>;
  action_summary: string;
  /**
   * Backend-supplied human-readable bullet points. For PR-related tools the
   * last entry typically contains the GitHub PR URL so reviewers can jump to
   * the PR before approving / denying.
   */
  action_pointers?: string[];
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
  user_id: string;
}

export interface User {
  id?: string; // UUID primary key from database
  github_user_id: number;
  username: string;
  email: string;
  created_at?: string;
  github_pat?: string;
  access_token?: string;
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

export interface TokenMeterResponse {
  id: string;
  action_id: string;
  user_id: string;
  input_token: number;
  output_token: number;
  session_id: string;
  timestamp?: string;
  created_at?: string;
}

export interface RoomSummary {
  id?: string;
  room_id?: string;

  repo_name: string;
  owner_username?: string;

  role?: string;
  is_active?: boolean;

  created_at?: string;
}
export interface RoomDetails extends RoomSummary {
  [key: string]: any;
}

export interface RoomMember {
  username: string;
  role?: string;
  joined_at?: string;

  [key: string]: any;
}

export interface RoomInvite {
  id?: string;
  invite_code?: string;
  code?: string;
  room_id?: string;
  created_by_username?: string;
  max_uses?: number | null;
  used_count?: number;
  expires_at?: string | null;
  created_at?: string;
  [key: string]: any;
}