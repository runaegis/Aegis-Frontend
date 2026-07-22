export interface Memory {
  id: string;
  user_id: string;
  title: string;
  memory: string;
  is_pinned?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UserPrompt {
  id: string;
  user_id: string;
  prompt: string;
  name: string;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UserPromptPayload {
  prompt: string;
  name?: string;
  description?: string;
}

export interface UserPromptListResponse {
  user_id: string;
  count: number;
  prompts: UserPrompt[];
}

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
  /**
   * Policy verdict for this action. `"pass"` when every policy check passed,
   * otherwise an enforced state (`"enforced"` / `"policy_enforced"` / etc.).
   * Stored as a free-form string so backend can evolve labels.
   */
  policy?: string | null;
  /**
   * Severity of the action if it were to take effect. Backend currently emits
   * `"Low" | "Medium" | "High" | "Critical"`. Field name preserves the
   * backend's spelling (`blast_redius`); also reads `blast_radius` for
   * forward-compat once the typo is corrected upstream.
   */
  blast_redius?: string | null;
  blast_radius?: string | null;
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

/**
 * One action in a room's audit log. Same shape as `SessionAction` plus the
 * room scope and the resolved `username` of the user that triggered the run.
 * Returned by `GET /sessions_by_room_id/{room_id}` (paginated).
 */
export interface RoomSessionAction extends SessionAction {
  room_id: string;
  /** Resolved display name of the user that initiated this action. */
  username?: string | null;
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
  github_pat?: string | null;
  access_token?: string | null;
  postgres_connection_string?: string | null;
  jira_url?: string | null;
  jira_username?: string | null;
  jira_api_token?: string | null;
  mongodb_connection_string?: string | null;
  linear_api_key?: string | null;
  terraform_api_token?: string | null;
  terraform_url?: string | null;
}

export interface SlackIntegrationStatus {
  connected: boolean;
  /**
   * Optional backend field for whether the live connector path is healthy.
   * When absent, the UI falls back to `connected`.
   */
  connector?: boolean | null;
  team_id?: string | null;
  team_name?: string | null;
  approval_channel_id?: string | null;
  approval_channel_name?: string | null;
  is_private_channel?: boolean | null;
  bot_user_id?: string | null;
  installed_for_slack_user_id?: string | null;
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
  tool_name?: string | null;
  timestamp?: string;
  created_at?: string;
}

export type TokenAnalyticsDateRange =
  | 'today'
  | '7d'
  | '30d'
  | '90d'
  | 'all'
  | 'custom';

export type TokenAnalyticsAllocation = 'category' | 'tool' | 'both';

export interface TokenUsageSummary {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  tool_call_count: number;
}

export interface TokenUsageChartItem {
  name: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  tool_call_count: number;
}

export interface TokenAnalyticsResponse {
  user_id: string;
  date_range: TokenAnalyticsDateRange;
  start_date: string | null;
  end_date: string | null;
  allocation: TokenAnalyticsAllocation;
  summary: TokenUsageSummary;
  category_chart: TokenUsageChartItem[];
  tool_chart: TokenUsageChartItem[];
}

export interface TokenUsageSessionItem {
  session_id: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  tool_call_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
}

export interface RoomSummary {
  id?: string;
  room_id?: string;

  repo_name: string;
  owner_username?: string;

  role?: string;
  is_active?: boolean;

  /**
   * Enforcement posture for this room. New rooms default to `observe`
   * (Shadow Mode): Aegis classifies and records every action but never
   * blocks, rewrites, or pauses. `warn` surfaces would-be decisions to the
   * agent without stopping it; `enforce` applies decisions for real. Absent
   * is treated as `observe` in the UI so onboarding is safe by default.
   */
  enforcement_mode?: EnforcementMode;

  /** Room creation time (UTC). Prefer over membership join time when present. */
  room_created_at?: string;
  /** Membership join time — only used when room_created_at is absent. */
  joined_at?: string;
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

// ─── Shadow Mode ──────────────────────────────────────────────────────
/**
 * A room's enforcement posture. The observe → warn → enforce ramp is the
 * onboarding path: a new customer runs in `observe` (nothing is ever
 * blocked), reviews the Shadow Report, then turns enforcement on.
 */
export type EnforcementMode = 'observe' | 'warn' | 'enforce';

/**
 * One high-signal action Aegis would have acted on, surfaced in the Shadow
 * Report's "Moments that mattered". Derived from a recorded `SessionAction`
 * whose would-be decision was DENY / REWRITE / REQUIRE_APPROVAL — the ones a
 * prospect cares about ("here's what we'd have caught"). No new backend
 * field: built from data the audit log already stores.
 */
export interface ShadowMoment {
  action: RoomSessionAction;
  /** The would-be decision (normalized): DENY | REWRITE | REQUIRE_APPROVAL. */
  wouldDecision: string;
  /** Plain-English one-liner of what the agent tried and why it mattered. */
  headline: string;
}

/**
 * Aggregated observe-mode result over a window, rendered as the Shadow
 * Report. Every field is computed from recorded `session_actions`, so the
 * report is real the moment an observed room has traffic — the only new
 * backend piece is the observe branch that records decisions without
 * enforcing them.
 */
export interface ShadowReport {
  roomId: string;
  repoName: string;
  /** Window the report covers, e.g. '24h' | '7d' | '30d'. */
  window: string;
  generatedAt: string;
  /** Total actions observed in the window. */
  totalObserved: number;
  /** Would-be decision counts (what Aegis *would* have done in enforce mode). */
  counts: {
    allow: number;
    deny: number;
    rewrite: number;
    approval: number;
  };
  /** Breakdown by tool / policy for the distribution strip. */
  distribution: Array<{ label: string; count: number }>;
  /** The ranked "moments that mattered" (highest blast radius first). */
  moments: ShadowMoment[];
}
