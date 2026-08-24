export interface Memory {
  id: string;
  user_id: string;
  title: string;
  memory: string;
  is_pinned?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export type MemoryShareStatus = "pending" | "revoked" | "expired" | "exhausted";

export interface MemoryShare {
  id: string;
  memory_id: string;
  share_code: string;
  share_url: string;
  status?: MemoryShareStatus;
  expires_at?: string | null;
  max_uses?: number | null;
  used_count?: number;
  created_at?: string | null;
}

export interface MemoryShareCreatePayload {
  expires_in_hours?: number;
  max_uses?: number | null;
}

export interface MemorySharePreview {
  title: string;
  status: MemoryShareStatus;
  already_owned: boolean;
  already_redeemed: boolean;
  redeemed_memory_id?: string | null;
}

export interface MemoryShareRedeemResponse {
  already_redeemed: boolean;
  share_id?: string;
  memory?: Memory | null;
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

export type NotificationType = "ALLOW" | "DENY" | "APPROVAL" | "REWRITE";

export interface NotificationPreferences {
  notify_allow: boolean;
  notify_deny: boolean;
  notify_approval: boolean;
  notify_rewrite: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UserNotification {
  id: string;
  notification_type: NotificationType | string;
  connector_key?: string | null;
  tool_name: string;
  target_descriptor?: string | null;
  room_id?: string | null;
  room_name?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface UserNotificationsResponse {
  items: UserNotification[];
  total: number;
  unread_count: number;
  limit: number;
  offset: number;
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
  connector_key?: string | null;
  arguments: Record<string, any>;
  /** Human-readable bullet points; preferred over raw `arguments` in the UI when present. */
  action_pointers?: string[];
  action_summary: string;
  result: string;
  decision: "ALLOW" | "DENY" | "cd" | "REQUIRE_APPROVAL" | string;
  target_type?: string | null;
  target_ref?: string | null;
  target_display?: string | null;
  target_metadata?: Record<string, unknown> | null;
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
  room_id?: string | null;
  connector_key?: string | null;
  target_type?: string | null;
  target_ref?: string | null;
  target_display?: string | null;
  target_metadata?: Record<string, unknown> | null;
  target_descriptor?: string | null;
  minimum_role_rank_required?: number | null;
  resolved_by?: string | null;
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
  id?: string;
  name?: string | null;
  username: string;
  email: string;
  avatar_url?: string | null;
  email_verified_at?: string | null;
  is_active?: boolean;
  primary_auth_method?: string | null;
  onboarding_status?: boolean | null;
  created_at?: string | null;
}

export interface OnboardingStatusResponse {
  onboarding_status: boolean;
}

export interface ConnectorCatalogItem {
  connector_key: string;
  display_name: string;
  description?: string | null;
  private_config_schema?: Record<string, unknown> | null;
  public_config_schema?: Record<string, unknown> | null;
  policy_catalog?: Record<string, unknown> | null;
  is_active?: boolean;
}

export interface PrivateConnectorCredentialStatus {
  connector_key: string;
  configured: boolean;
  is_enabled?: boolean;
  configured_keys: string[];
  credential_metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  revoked_at?: string | null;
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
  run_id: string;
  session_id: string;
  workspace_id: string | null;
  workspace_name: string | null;
  workspace_title: string | null;
  agent_name: string | null;
  tool_name: string | null;
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

  name?: string | null;
  description?: string | null;
  room_type?: string | null;
  repo_name?: string | null;
  owner_username?: string;
  role_rank?: number | null;

  role?: string;
  is_active?: boolean;

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
  id?: string;
  user_id?: string;
  username: string;
  role?: string;
  role_rank?: number | null;
  email?: string | null;
  joined_at?: string;

  [key: string]: any;
}

export interface RoomMembership {
  room_id: string;
  user_id?: string | null;
  role?: string | null;
  role_rank?: number | null;
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

export interface RoomRolesResponse {
  room_id: string;
  roles: Record<string, string>;
}

export interface RoomToolGroup {
  key: string;
  label: string;
  tools: string[];
}

export interface RoomToolConnector {
  connector_key: string;
  display_name: string;
  description?: string | null;
  configured: boolean;
  private_credentials_configured: boolean;
  can_configure_connector: boolean;
  tool_groups: RoomToolGroup[];
}

export interface RoomToolMatrixResponse {
  room_id: string;
  role_rank?: number | null;
  connectors: RoomToolConnector[];
}

export interface RoomConnectorConfig {
  room_id: string;
  connector_key: string;
  display_name?: string | null;
  public_config?: Record<string, unknown> | null;
  configured?: boolean;
  is_enabled?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RoomConnectorPolicyRule {
  policy_key: string;
  display_name?: string | null;
  description?: string | null;
  effect?: "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | string | null;
  minimum_role_rank_required?: number | null;
  is_enabled?: boolean;
  config?: Record<string, unknown> | null;
}

export interface RoomConnectorPoliciesResponse {
  room_id: string;
  connector_key: string;
  can_manage: boolean;
  policies: RoomConnectorPolicyRule[];
}

export interface ApiTokenPrefix {
  api_key_prefix: string;
  mcp_url_prefix: string;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  room_id: string;
  user_id: string;
  key_prefix: string;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface CreatedApiKey extends ApiKeySummary {
  api_key: string;
}
