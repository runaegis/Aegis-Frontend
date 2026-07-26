import { get } from "http";
import {
  SessionAction,
  AggregatedSessionAction,
  Session,
  User,
  RepoPermission,
  Metrics,
  MCPApproval,
  TokenMeterResponse,
  RoomSummary,
  RoomDetails,
  RoomMember,
  RoomInvite,
  RoomSessionAction,
  PaginatedResponse,
  Memory,
  SlackIntegrationStatus,
  UserPrompt,
  UserPromptListResponse,
  UserPromptPayload,
  TokenAnalyticsAllocation,
  TokenAnalyticsDateRange,
  TokenAnalyticsResponse,
  TokenUsageSessionItem,
  ApiTokenPrefix,
  ApiKeySummary,
  CreatedApiKey,
} from "./types";
import { LogOut } from "lucide-react";
import {
  matchesActionDateFilters,
  type ActionDateFilters,
} from "./dashboardDateRange";
import { normalizeApiTimestamp, normalizeDecision } from "./utils";

type SaveUserPayload = Pick<User, "github_pat">;

type UpdateUserDetailsPayload = {
  username?: string;
  email?: string;
  github_pat?: string;
  github_user_id?: number | string;
  postgres_connection_string?: string;
  jira_url?: string;
  jira_username?: string;
  jira_api_token?: string;
  mongodb_connection_string?: string;
  linear_api_key?: string;
  terraform_api_token?: string;
  terraform_url?: string;
};

type TokenAnalyticsFilters = {
  date_range?: TokenAnalyticsDateRange;
  start_date?: string;
  end_date?: string;
  allocation?: TokenAnalyticsAllocation;
  categories?: string | string[];
  tool_names?: string | string[];
};

type TokenUsageSessionFilters = {
  date_range?: TokenAnalyticsDateRange;
  start_date?: string;
  end_date?: string;
  limit?: number;
};

export type WorkspaceAgentStatus = "active" | "removed";

export type WorkspaceFileRef = {
  file_id?: string;
  url: string;
  filename: string;
  content_type?: string | null;
  size: number;
  uploader_member_id?: string | null;
};

export type WorkspaceAgent = {
  id: string;
  workspace_id: string;
  user_id: string;
  handle: string;
  role_label: string | null;
  status: WorkspaceAgentStatus;
  created_at: string;
};

export type WorkspaceMessage = {
  id: string;
  workspace_id: string;
  sender_member_id: string;
  message_text: string | null;
  mentioned_member_ids: string[];
  file_refs: WorkspaceFileRef[];
  created_at: string;
};

export type WorkspacePointerStatus = "pending" | "review" | "done";

export type WorkspaceTaskPointer = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: WorkspacePointerStatus;
  sort_order: number;
  created_by_member_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceRecord = {
  id: string;
  owner_user_id: string;
  title: string;
  task: string | null;
  created_at: string;
};

export type WorkspaceSummary = WorkspaceRecord & {
  agent_count: number;
  message_count: number;
  pointer_count?: number;
};

export type WorkspaceDetail = {
  workspace: WorkspaceRecord;
  agents: WorkspaceAgent[];
  messages: WorkspaceMessage[];
  pointers?: WorkspaceTaskPointer[];
};

export type WorkspaceAgentKeyResponse = {
  agent: WorkspaceAgent;
  agent_key: string;
  mcp_config_snippet: {
    aegis: {
      url: string;
      headers: {
        Authorization: string;
        "X-Agent-Key": string;
      };
    };
  };
};

function getAPIBase(): string {
  let url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url;
}

const API_BASE = getAPIBase();

export function getWorkspaceMessageStreamUrl(workspaceId: string): string {
  return `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}/stream`;
}

if (typeof window !== "undefined") {
  console.log("[Aegis API] Using endpoint:", API_BASE);
}

let refreshSessionPromise: Promise<boolean> | null = null;

function clearStoredAuthState(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem("aegis_user");
  localStorage.removeItem("aegis_onboarding_step");
}

async function refreshSession(): Promise<boolean> {
  if (!refreshSessionPromise) {
    refreshSessionPromise = (async () => {
      try {
        const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });

        return refreshResponse.ok;
      } catch {
        return false;
      } finally {
        refreshSessionPromise = null;
      }
    })();
  }

  return refreshSessionPromise;
}

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

export async function apiFetch(
  input: RequestInfo,
  init: RequestInit = {},
  retry = true,
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  // Access token expired
  if (response.status === 401 && retry) {
    const didRefresh = await refreshSession();

    if (didRefresh) {
      return apiFetch(input, init, false);
    }

    clearStoredAuthState();

    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }

    throw new AuthError();
  }

  return response;
}

function parseDatetime(value: any): string | any {
  if (typeof value !== "string") return value;
  const datetimeMatch = value.match(
    /datetime\.datetime\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)/,
  );
  if (datetimeMatch) {
    const [, year, month, day, hour, minute, second, microsecond = "0"] =
      datetimeMatch;
    return new Date(
      Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second),
        parseInt(microsecond) / 1000,
      ),
    ).toISOString();
  }
  return normalizeApiTimestamp(value);
}

function parseRow(row: unknown, columns?: string[]): unknown {
  let obj: any = row;
  if (Array.isArray(row) && columns) {
    obj = Object.fromEntries(
      columns.map((col: string, i: number) => [col, row[i]]),
    );
  }
  const datetimeFields = [
    "timestamp",
    "started_at",
    "last_action_at",
    "created_at",
    "room_created_at",
    "joined_at",
    "approved_at",
    "expires_at",
    "first_seen_at",
    "last_seen_at",
    "last_used_at",
  ];
  for (const field of datetimeFields) {
    if (obj[field]) obj[field] = parseDatetime(String(obj[field]));
  }
  if (typeof obj.decision === "string") {
    obj.decision = normalizeDecision(obj.decision);
  }
  return obj;
}

function getJsonHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  return headers;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();

    if (body?.detail?.error?.message) {
      return body.detail.error.message;
    }

    if (body?.error?.message) {
      return body.error.message;
    }

    if (typeof body?.detail === 'string') {
      return body.detail;
    }

    return 'Request failed';
  } catch {
    return 'Network error';
  }
}

async function fetchAuthenticatedUserDetails(
  fallback: UpdateUserDetailsPayload = {},
): Promise<User> {
  const endpoints = [`${API_BASE}/user`, `${API_BASE}/auth/user`];
  let lastError: string | null = null;

  for (const endpoint of endpoints) {
    const res = await apiFetch(endpoint);

    if (!res.ok) {
      lastError = await readErrorMessage(res);
      continue;
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      lastError = "Server returned an invalid user payload.";
      continue;
    }

    const raw = extractUserPayload(data);
    if (!raw) {
      lastError = "Server returned an incomplete user payload.";
      continue;
    }

    return normalizeUserPayload(raw, fallback);
  }

  throw new Error(lastError || "Failed to load user details.");
}

function normalizeUserPayload(
  raw: Partial<User> & Record<string, unknown>,
  fallback: UpdateUserDetailsPayload = {},
): User {
  const githubUserId =
    typeof raw.github_user_id === "number"
      ? raw.github_user_id
      : typeof raw.github_user_id === "string"
        ? Number(raw.github_user_id)
        : typeof fallback.github_user_id === "number"
          ? fallback.github_user_id
          : typeof fallback.github_user_id === "string"
            ? Number(fallback.github_user_id)
            : 0;

  const accessToken =
    typeof raw.access_token === "string"
      ? raw.access_token
      : typeof raw.github_pat === "string"
        ? raw.github_pat
        : fallback.github_pat;

  return {
    id: typeof raw.id === "string" ? raw.id : undefined,
    github_user_id: Number.isFinite(githubUserId) ? githubUserId : 0,
    username:
      typeof raw.username === "string"
        ? raw.username
        : fallback.username ?? "",
    email:
      typeof raw.email === "string"
        ? raw.email
        : fallback.email ?? "",
    created_at:
      typeof raw.created_at === "string" ? raw.created_at : undefined,
    access_token: accessToken,
    github_pat: accessToken,
    postgres_connection_string:
      typeof raw.postgres_connection_string === "string"
        ? raw.postgres_connection_string
        : fallback.postgres_connection_string,
    jira_url:
      typeof raw.jira_url === "string"
        ? raw.jira_url
        : fallback.jira_url,
    jira_username:
      typeof raw.jira_username === "string"
        ? raw.jira_username
        : fallback.jira_username,
    jira_api_token:
      typeof raw.jira_api_token === "string"
        ? raw.jira_api_token
        : fallback.jira_api_token,
    mongodb_connection_string:
      typeof raw.mongodb_connection_string === "string"
        ? raw.mongodb_connection_string
        : fallback.mongodb_connection_string,
    linear_api_key:
      typeof raw.linear_api_key === "string"
        ? raw.linear_api_key
        : fallback.linear_api_key,
    terraform_api_token:
      typeof raw.terraform_api_token === "string"
        ? raw.terraform_api_token
        : fallback.terraform_api_token,
    terraform_url:
      typeof raw.terraform_url === "string"
        ? raw.terraform_url
        : fallback.terraform_url,
  };
}

function hasUserPayloadShape(raw: Record<string, unknown>): boolean {
  return [
    "id",
    "github_user_id",
    "username",
    "email",
    "access_token",
    "github_pat",
    "created_at",
    "postgres_connection_string",
    "jira_url",
    "jira_username",
    "jira_api_token",
    "mongodb_connection_string",
    "linear_api_key",
    "terraform_api_token",
    "terraform_url",
  ].some((key) => key in raw);
}

function extractUserPayload(data: unknown): (Partial<User> & Record<string, unknown>) | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const raw = data as Record<string, unknown>;

  if (hasUserPayloadShape(raw)) {
    return raw as Partial<User> & Record<string, unknown>;
  }

  if (raw.user && typeof raw.user === "object") {
    const nestedUser = raw.user as Record<string, unknown>;
    if (hasUserPayloadShape(nestedUser)) {
      return nestedUser as Partial<User> & Record<string, unknown>;
    }
  }

  if (raw.data && typeof raw.data === "object") {
    const nestedData = raw.data as Record<string, unknown>;
    if (hasUserPayloadShape(nestedData)) {
      return nestedData as Partial<User> & Record<string, unknown>;
    }
  }

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (first && typeof first === "object" && hasUserPayloadShape(first as Record<string, unknown>)) {
      return first as Partial<User> & Record<string, unknown>;
    }
  }

  return null;
}

function parseFilenameFromContentDisposition(
  contentDisposition: string | null,
  fallback: string,
): string {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];

  const bareMatch = contentDisposition.match(/filename=([^;]+)/i);
  if (bareMatch?.[1]) return bareMatch[1].trim();

  return fallback;
}

type AuditExportFilters = {
  startDate?: string;
  endDate?: string;
  agents?: string[];
  decisions?: string[];
  repositories?: string[];
  tools?: string[];
};

type AuditSessionsFilters = AuditExportFilters & {
  page?: number;
  page_size?: number;
};

function buildAuditExportUrl(
  endpoint: "json" | "pdf",
  filters: AuditExportFilters = {},
): URL {
  const url = new URL(`${API_BASE}/audit/export/${endpoint}`);

  if (filters.startDate) url.searchParams.set("start_date", filters.startDate);
  if (filters.endDate) url.searchParams.set("end_date", filters.endDate);
  if (filters.agents?.length) url.searchParams.set("agents", filters.agents.join(","));
  if (filters.decisions?.length)
    url.searchParams.set("decisions", filters.decisions.join(","));
  if (filters.repositories?.length)
    url.searchParams.set("repositories", filters.repositories.join(","));
  if (filters.tools?.length) url.searchParams.set("tools", filters.tools.join(","));

  return url;
}

function buildAuditSessionsUrl(
  filters: AuditSessionsFilters = {},
): URL {
  const url = new URL(`${API_BASE}/audit/sessions`);

  if (filters.page) url.searchParams.set("page", String(filters.page));
  if (filters.page_size) {
    url.searchParams.set("page_size", String(filters.page_size));
  }
  if (filters.startDate) url.searchParams.set("start_date", filters.startDate);
  if (filters.endDate) url.searchParams.set("end_date", filters.endDate);
  if (filters.agents?.length) url.searchParams.set("agents", filters.agents.join(","));
  if (filters.decisions?.length) {
    url.searchParams.set("decisions", filters.decisions.join(","));
  }
  if (filters.repositories?.length) {
    url.searchParams.set("repositories", filters.repositories.join(","));
  }
  if (filters.tools?.length) url.searchParams.set("tools", filters.tools.join(","));

  return url;
}

function appendActionDateFilters(
  url: URL,
  filters: ActionDateFilters = {},
): void {
  if (filters.startDate) url.searchParams.set("start_date", filters.startDate);
  if (filters.endDate) url.searchParams.set("end_date", filters.endDate);
}

function hasActionDateFilters(filters: ActionDateFilters = {}): boolean {
  return Boolean(filters.startDate || filters.endDate);
}

function buildAllActionsCacheKey(
  userId: string,
  filters: ActionDateFilters = {},
): string {
  return [
    "all",
    userId,
    filters.startDate ?? "",
    filters.endDate ?? "",
  ].join(":");
}

// ── Cache keyed by "userId:page:page_size" so switching pages/accounts works ──
const _cache = new Map<
  string,
  { data: PaginatedResponse<SessionAction>; time: number }
>();
const _allActionsCache = new Map<string, { data: SessionAction[]; time: number }>();
const CACHE_TTL = 30_000;

function sortActions(items: SessionAction[]): SessionAction[] {
  return [...items].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

async function getUserActions(
  userId: string,
  {
    page = 1,
    page_size = 20,
    filters = {},
  }: {
    page?: number;
    page_size?: number;
    filters?: ActionDateFilters;
  } = {},
): Promise<PaginatedResponse<SessionAction>> {
  const cacheKey = [
    userId,
    page,
    page_size,
    filters.startDate ?? "",
    filters.endDate ?? "",
  ].join(":");
  const now = Date.now();
  const cached = _cache.get(cacheKey);
  if (cached && now - cached.time < CACHE_TTL) return cached.data;

  const url = new URL(`${API_BASE}/sessions`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(page_size));
  appendActionDateFilters(url, filters);

  const res = await apiFetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.statusText}`);

  const payload = await res.json();

  const data: PaginatedResponse<SessionAction> = {
    items: (payload.items ?? []).map(
      (r: unknown) => parseRow(r) as SessionAction,
    ),
    total: payload.total ?? 0,
    page: payload.page ?? page,
    page_size: payload.page_size ?? page_size,
    pages: payload.pages ?? 1,
  };

  _cache.set(cacheKey, { data, time: now });
  return data;
}

async function getAggregatedUserActions(
  userId: string,
  {
    page = 1,
    page_size = 20,
    filters = {},
  }: {
    page?: number;
    page_size?: number;
    filters?: ActionDateFilters;
  } = {},
): Promise<PaginatedResponse<AggregatedSessionAction>> {
  const url = new URL(`${API_BASE}/sessions/aggregate`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(page_size));
  appendActionDateFilters(url, filters);

  const res = await apiFetch(url.toString());
  if (!res.ok)
    throw new Error(`Failed to fetch aggregated sessions: ${res.statusText}`);

  const payload = await res.json();

  return {
    items: payload.items ?? [],
    total: payload.total ?? 0,
    page: payload.page ?? page,
    page_size: payload.page_size ?? page_size,
    pages: payload.pages ?? 1,
  };
}

export function invalidateCache(userId?: string) {
  if (userId) {
    for (const key of [..._cache.keys()]) {
      if (key.startsWith(`${userId}:`)) _cache.delete(key);
    }
    for (const key of [..._allActionsCache.keys()]) {
      if (key.includes(`:${userId}:`)) _allActionsCache.delete(key);
    }
  } else {
    _cache.clear();
    _allActionsCache.clear();
  }
}

async function getAllUserActions(
  userId: string,
  filters: ActionDateFilters = {},
): Promise<SessionAction[]> {
  const cacheKey = buildAllActionsCacheKey(userId, filters);
  const now = Date.now();
  const cached = _allActionsCache.get(cacheKey);
  if (cached && now - cached.time < CACHE_TTL) return cached.data;

  const page_size = 100;
  let page = 1;
  let pages = 1;
  const rows: SessionAction[] = [];

  while (page <= pages) {
    const batch = await getUserActions(userId, {
      page,
      page_size,
      filters,
    });
    rows.push(...batch.items);

    const pagesFromApi =
      typeof batch.pages === "number" && batch.pages >= 1 ? batch.pages : null;
    const pagesFromTotal =
      batch.total > 0 ? Math.max(1, Math.ceil(batch.total / page_size)) : 1;
    pages = pagesFromApi ?? pagesFromTotal;

    if (batch.items.length < page_size || page >= pages) break;
    page += 1;
    if (page > 5000) break;
  }

  const filtered = hasActionDateFilters(filters)
    ? rows.filter((row) => matchesActionDateFilters(row.timestamp, filters))
    : rows;

  const deduped = sortActions(
    Array.from(new Map(filtered.map((row) => [row.id, row])).values()),
  );
  _allActionsCache.set(cacheKey, { data: deduped, time: now });
  return deduped;
}

// ── Session aggregation helper ────────────────────────────────────────────────
function aggregateSessions(actions: SessionAction[]): Session[] {
  const map = new Map<string, Session>();

  for (const row of actions) {
    const sid = row.session_id;
    if (!sid) continue;

    if (!map.has(sid)) {
      map.set(sid, {
        session_id: sid,
        agent_name: row.agent_name,
        user_id: row.user_id,
        action_count: 0,
        started_at: row.timestamp,
        last_action_at: row.timestamp,
        repos: [],
        allows: 0,
        denies: 0,
        rewrites: 0,
        approvals: 0,
      });
    }

    const s = map.get(sid)!;
    s.action_count = (Number(s.action_count) || 0) + 1;
    if (row.timestamp && row.timestamp < s.started_at!)
      s.started_at = row.timestamp;
    if (row.timestamp && row.timestamp > s.last_action_at!)
      s.last_action_at = row.timestamp;
    if (row.target_repo && !(s.repos as string[]).includes(row.target_repo)) {
      (s.repos as string[]).push(row.target_repo);
    }
    const d = normalizeDecision(row.decision);
    if (d === "ALLOW") s.allows = (Number(s.allows) || 0) + 1;
    else if (d === "DENY") s.denies = (Number(s.denies) || 0) + 1;
    else if (d === "REWRITE") s.rewrites = (Number(s.rewrites) || 0) + 1;
    if (d === "REQUIRE_APPROVAL") s.approvals = (Number(s.approvals) || 0) + 1;
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.last_action_at!).getTime() -
      new Date(a.last_action_at!).getTime(),
  );
}

function computeMetricsFromActions(actions: SessionAction[]): Metrics {
  return {
    total: actions.length,
    allows: actions.filter((row) => normalizeDecision(row.decision) === "ALLOW").length,
    denies: actions.filter((row) => normalizeDecision(row.decision) === "DENY").length,
    rewrites: actions.filter((row) => normalizeDecision(row.decision) === "REWRITE").length,
    approvals: actions.filter((row) =>
      normalizeDecision(row.decision) === "REQUIRE_APPROVAL",
    ).length,
  };
}

function aggregateSessionActions(
  actions: SessionAction[],
): AggregatedSessionAction[] {
  return aggregateSessions(actions).map((session) => {
    const sessionRuns = actions
      .filter((row) => row.session_id === session.session_id)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    const executionTimes = sessionRuns.map((row) => row.execution_time ?? 0);

    return {
      session_id: session.session_id,
      user_id: session.user_id,
      action_count: sessionRuns.length,
      started_at: session.started_at,
      ended_at: session.last_action_at,
      total_execution_time: executionTimes.reduce((sum, value) => sum + value, 0),
      tools_used: Array.from(new Set(sessionRuns.map((row) => row.tool_name))),
      sessions: sessionRuns,
    };
  });
}

/** Token meter pagination rejects large page_size (422). Use modest pages and merge client-side. */
async function fetchUserTokenMeterPage(
  userId: string,
  page: number,
  page_size: number,
): Promise<PaginatedResponse<TokenMeterResponse>> {
  const url = new URL(
    `${API_BASE}/token-meter/user/${encodeURIComponent(userId)}`,
  );
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(page_size));
  const res = await apiFetch(url.toString());
  if (!res.ok)
    throw new Error(`Failed to fetch token usage: ${res.statusText}`);
  const payload = await res.json();
  return {
    items: (payload.items ?? []).map(
      (row: unknown) => parseRow(row) as TokenMeterResponse,
    ),
    total: payload.total ?? 0,
    page: payload.page ?? page,
    page_size: payload.page_size ?? page_size,
    pages: payload.pages ?? 1,
  };
}

function appendTokenAnalyticsFilters(
  url: URL,
  filters: TokenAnalyticsFilters = {},
): void {
  url.searchParams.set("date_range", filters.date_range ?? "30d");
  url.searchParams.set("allocation", filters.allocation ?? "both");

  if (filters.start_date) url.searchParams.set("start_date", filters.start_date);
  if (filters.end_date) url.searchParams.set("end_date", filters.end_date);

  const appendMany = (key: "categories" | "tool_names", value?: string | string[]) => {
    if (!value) return;
    const items = Array.isArray(value) ? value : value.split(",");
    for (const item of items) {
      const trimmed = item.trim();
      if (trimmed) url.searchParams.append(key, trimmed);
    }
  };

  appendMany("categories", filters.categories);
  appendMany("tool_names", filters.tool_names);
}

function emptyTokenAnalyticsResponse(
  userId = "",
  filters: TokenAnalyticsFilters = {},
): TokenAnalyticsResponse {
  return {
    user_id: userId,
    date_range: filters.date_range ?? "30d",
    start_date: filters.start_date ?? null,
    end_date: filters.end_date ?? null,
    allocation: filters.allocation ?? "both",
    summary: {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      tool_call_count: 0,
    },
    category_chart: [],
    tool_chart: [],
  };
}

function appendTokenUsageSessionFilters(
  url: URL,
  filters: TokenUsageSessionFilters = {},
): void {
  url.searchParams.set("date_range", filters.date_range ?? "30d");
  if (filters.start_date) url.searchParams.set("start_date", filters.start_date);
  if (filters.end_date) url.searchParams.set("end_date", filters.end_date);
  if (typeof filters.limit === "number") {
    const limit = Math.min(Math.max(Math.trunc(filters.limit), 1), 500);
    url.searchParams.set("limit", String(limit));
  }
}

function normalizeTokenUsageSessionItem(row: unknown): TokenUsageSessionItem {
  const item = parseRow(row) as Partial<TokenUsageSessionItem>;
  return {
    session_id: String(item.session_id ?? "unknown"),
    input_tokens: Number(item.input_tokens ?? 0),
    output_tokens: Number(item.output_tokens ?? 0),
    total_tokens: Number(item.total_tokens ?? 0),
    tool_call_count: Number(item.tool_call_count ?? 0),
    first_seen_at: item.first_seen_at ?? null,
    last_seen_at: item.last_seen_at ?? null,
  };
}

export const api = {
  healthCheck: () => apiFetch(`${API_BASE}/health`).then((r) => r.json()),

  logOut: async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore logout network failures
    } finally {
      clearStoredAuthState();
    }
  },

  getRuns: async (
    userId?: string,
    filters: ActionDateFilters = {},
  ): Promise<SessionAction[]> => {
    if (!userId) return [];
    if (hasActionDateFilters(filters)) {
      return getAllUserActions(userId, filters);
    }
    const { items } = await getUserActions(userId, { filters });
    return [...items].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  },

  /** One page of session actions (runs). Default matches server pagination (20). */
  getSessionActionsPage: async (
    userId: string,
    page = 1,
    page_size = 20,
    filters: ActionDateFilters = {},
  ): Promise<PaginatedResponse<SessionAction>> => {
    if (hasActionDateFilters(filters)) {
      const items = await getAllUserActions(userId, filters);
      const start = (page - 1) * page_size;
      return {
        items: items.slice(start, start + page_size),
        total: items.length,
        page,
        page_size,
        pages: Math.max(1, Math.ceil(items.length / page_size)),
      };
    }
    const data = await getUserActions(userId, { page, page_size, filters });
    return {
      ...data,
      items: [...data.items].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    };
  },

  getSessions: async (
    userId?: string,
    filters: ActionDateFilters = {},
  ): Promise<Session[]> => {
    if (!userId) return [];
    return aggregateSessions(await getAllUserActions(userId, filters));
  },

  getAggregatedSessions: async (
    userId?: string,
    page = 1,
    page_size = 20,
    filters: ActionDateFilters = {},
  ): Promise<PaginatedResponse<AggregatedSessionAction>> => {
    if (!userId)
      return { items: [], total: 0, page: 1, page_size: 20, pages: 0 };
    const items = aggregateSessionActions(await getAllUserActions(userId, filters));
    const start = (page - 1) * page_size;
    return {
      items: items.slice(start, start + page_size),
      total: items.length,
      page,
      page_size,
      pages: Math.max(1, Math.ceil(items.length / page_size)),
    };
  },

  getRoomTools: (roomId: string, role: string) =>
    apiFetch(`${API_BASE}/room/${roomId}/tools/${role}`, {
      // credentials: 'include',
    }).then((res) => res.json()),

  updateRoomTools: (
    roomId: string,
    role: string,
    data: Record<string, boolean>,
  ) =>
    apiFetch(`${API_BASE}/room/${roomId}/tools/${role}`, {
      method: "PATCH",
      // credentials: 'include',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tools: data }), // ← IMPORTANT: Wrap in { tools: ... }
    }).then(async (res) => {
      const json = await res.json();
      if (!res.ok) {
        const message =
          typeof json.detail === "string"
            ? json.detail
            : JSON.stringify(json.detail);

        throw new Error(message || `HTTP ${res.status}`);
      }
      return json;
    }),

  updateOnboardingStep: (onboardingStep: number) =>
    apiFetch(`${API_BASE}/auth/onboarding-step`, {
      method: "POST",
      // credentials: 'include',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        onboarding_step: onboardingStep,
      }),
    }).then(async (res) => {
      const json = await res.json();

      if (!res.ok) {
        const message =
          typeof json.detail === "string"
            ? json.detail
            : JSON.stringify(json.detail);

        throw new Error(message || `HTTP ${res.status}`);
      }

      return json;
    }),

  getOnboardingStep: () =>
    apiFetch(`${API_BASE}/auth/onboarding-step`, {
      // credentials: 'include',
    }).then((res) => res.json()),

  getUserDetails: async (): Promise<User> => fetchAuthenticatedUserDetails(),

  getSessionActions: async (
    sessionId: string,
    userId?: string,
  ): Promise<SessionAction[]> => {
    // If we have userId, pull from cache to avoid an extra fetch
    if (userId) {
      const { items: rows } = await getUserActions(userId);
      return rows
        .filter((r) => r.session_id === sessionId)
        .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
    }
    // Fallback: fetch all and filter (no userId known)
    const res = await apiFetch(`${API_BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `SELECT * FROM session_actions WHERE session_id = %s ORDER BY sequence_order ASC`,
        params: [sessionId],
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Query failed");
    return data.rows.map((row: any) =>
      parseRow(row, data.columns),
    ) as SessionAction[];
  },

  getMetrics: async (
    userId: string,
    filters: ActionDateFilters = {},
  ): Promise<Metrics> => {
    if (hasActionDateFilters(filters)) {
      return computeMetricsFromActions(await getAllUserActions(userId, filters));
    }
    const url = new URL(`${API_BASE}/metrics`);
    appendActionDateFilters(url, filters);

    const res = await apiFetch(url.toString());

    if (!res.ok) {
      throw new Error(`Failed to fetch metrics`);
    }

    return res.json();
  },
  getApprovals: async (userId?: string): Promise<SessionAction[]> => {
    if (!userId) return [];
    const { items: rows } = await getUserActions(userId);
    return rows.filter((r) => normalizeDecision(r.decision) === "REQUIRE_APPROVAL");
  },

  getMcpApprovals: async (): Promise<MCPApproval[]> => {
    const res = await apiFetch(`${API_BASE}/get_mcp_approvals`, {
      cache: "no-store",
    });
    if (!res.ok)
      throw new Error(`Failed to fetch MCP approvals: ${res.statusText}`);

    const payload = await res.json();
    const body = Array.isArray(payload) ? payload[0] : payload;

    if (!body?.success) {
      throw new Error(body?.error || "Failed to fetch MCP approvals");
    }

    const rows = Array.isArray(body.rows) ? body.rows : [];
    return rows
      .map((row: any) => parseRow(row, body.columns))
      .sort(
        (a: MCPApproval, b: MCPApproval) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  },

  executeMcpApproval: async (recordId: string, reject: boolean) => {
    const params = new URLSearchParams({
      record_uuid_mcp_approval: recordId,
      reject: String(reject),
    });

    const res = await apiFetch(
      `${API_BASE}/execute_tool_call?${params.toString()}`,
      { cache: "no-store" },
    );
    if (!res.ok)
      throw new Error(`Failed to update approval: ${res.statusText}`);

    const payload = await res.json();
    const body = Array.isArray(payload) ? payload[0] : payload;

    if (body?.failure) {
      throw new Error(body.failure);
    }
    if (body?.success === false) {
      throw new Error(body?.error || "Failed to update approval");
    }
    if (body?.error) {
      throw new Error(body.error);
    }

    return body;
  },

  getAuditTrail: async (
    userId?: string,
    limit = 20,
    offset = 0,
  ): Promise<SessionAction[]> => {
    if (!userId) return [];

    const page = Math.floor(offset / limit) + 1;

    const { items } = await getUserActions(userId, {
      page,
      page_size: limit,
    });

    return items;
  },

  getAuditTrailByDateRange: async (
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<SessionAction[]> => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    let page = 1;
    const pageSize = 100;

    let allRows: SessionAction[] = [];
    let hasMore = true;

    while (hasMore) {
      const { items } = await getUserActions(userId, {
        page,
        page_size: pageSize,
      });

      allRows = [...allRows, ...items];

      hasMore = items.length === pageSize;
      page += 1;
    }

    return allRows.filter((r) => {
      const t = new Date(r.timestamp).getTime();
      return t >= start && t <= end;
    });
  },

  exportAuditJson: async (
    filters: AuditExportFilters = {},
  ): Promise<{ blob: Blob; filename: string }> => {
    const url = buildAuditExportUrl("json", filters);
    const res = await apiFetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to export audit JSON: ${await readErrorMessage(res)}`);
    }

    const blob = await res.blob();
    const fallback = `aegis-audit-${new Date().toISOString().split("T")[0]}.json`;
    const filename = parseFilenameFromContentDisposition(
      res.headers.get("content-disposition"),
      fallback,
    );
    return { blob, filename };
  },

  exportAuditPdf: async (
    filters: AuditExportFilters = {},
  ): Promise<{ blob: Blob; filename: string }> => {
    const url = buildAuditExportUrl("pdf", filters);
    const res = await apiFetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to export audit PDF: ${await readErrorMessage(res)}`);
    }

    const blob = await res.blob();
    const fallback = `aegis-audit-${new Date().toISOString().split("T")[0]}.pdf`;
    const filename = parseFilenameFromContentDisposition(
      res.headers.get("content-disposition"),
      fallback,
    );
    return { blob, filename };
  },

  getAuditSessionsPage: async (
    filters: AuditSessionsFilters = {},
  ): Promise<PaginatedResponse<SessionAction>> => {
    const url = buildAuditSessionsUrl(filters);
    const res = await apiFetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to fetch audit trail: ${await readErrorMessage(res)}`);
    }

    const payload = await res.json();
    return {
      items: Array.isArray(payload?.items)
        ? payload.items.map((row: unknown) => parseRow(row) as SessionAction)
        : [],
      total: Number(payload?.total ?? 0),
      page: Number(payload?.page ?? filters.page ?? 1),
      page_size: Number(payload?.page_size ?? filters.page_size ?? 20),
      pages: Number(payload?.pages ?? 0),
    };
  },

  getRecentActionCount: async (
    userId: string,
    username: string,
  ): Promise<{ count: number }[]> => {
    const { items: rows } = await getUserActions(userId);
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const count = rows.filter(
      (r) =>
        r.agent_name?.toLowerCase().includes(username.toLowerCase()) &&
        new Date(r.timestamp).getTime() > fiveMinutesAgo,
    ).length;
    return [{ count }];
  },

  getUserTokenUsage: async (
    userId?: string,
    page = 1,
    page_size = 20,
  ): Promise<PaginatedResponse<TokenMeterResponse>> => {
    if (!userId)
      return { items: [], total: 0, page: 1, page_size: 20, pages: 0 };
    return fetchUserTokenMeterPage(userId, page, page_size);
  },

  /** Loads every page (page_size 20) for dashboards that need full history. */
  getUserTokenUsageAll: async (userId?: string): Promise<TokenMeterResponse[]> => {
    if (!userId) return [];
    const page_size = 20;
    const out: TokenMeterResponse[] = [];
    let page = 1;
    for (;;) {
      const batch = await fetchUserTokenMeterPage(userId, page, page_size);
      out.push(...batch.items);
      const pagesFromApi =
        typeof batch.pages === "number" && batch.pages >= 1 ? batch.pages : null;
      const pagesFromTotal =
        batch.total > 0
          ? Math.max(1, Math.ceil(batch.total / page_size))
          : null;
      const totalPages = pagesFromApi ?? pagesFromTotal ?? page;
      if (page >= totalPages || batch.items.length < page_size) break;
      page += 1;
      if (page > 5000) break;
    }
    return out;
  },

  getTokenUsageAnalytics: async (
    userId?: string,
    filters: TokenAnalyticsFilters = {},
  ): Promise<TokenAnalyticsResponse> => {
    if (!userId) return emptyTokenAnalyticsResponse("", filters);

    const url = new URL(
      `${API_BASE}/analytics/token-usage/${encodeURIComponent(userId)}`,
    );
    appendTokenAnalyticsFilters(url, filters);

    const res = await apiFetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to fetch token analytics: ${await readErrorMessage(res)}`);
    }

    const payload = await res.json();
    return {
      ...emptyTokenAnalyticsResponse(userId, filters),
      ...payload,
      summary: {
        ...emptyTokenAnalyticsResponse(userId, filters).summary,
        ...(payload?.summary ?? {}),
      },
      category_chart: Array.isArray(payload?.category_chart)
        ? payload.category_chart
        : [],
      tool_chart: Array.isArray(payload?.tool_chart) ? payload.tool_chart : [],
    };
  },

  getTokenUsageSessions: async (
    userId?: string,
    filters: TokenUsageSessionFilters = {},
  ): Promise<TokenUsageSessionItem[]> => {
    if (!userId) return [];

    const url = new URL(
      `${API_BASE}/analytics/token-usage/${encodeURIComponent(userId)}/sessions`,
    );
    appendTokenUsageSessionFilters(url, filters);

    const res = await apiFetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to fetch token usage sessions: ${await readErrorMessage(res)}`);
    }

    const payload = await res.json();
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.sessions)
        ? payload.sessions
        : Array.isArray(payload?.items)
          ? payload.items
          : [];

    return rows.map(normalizeTokenUsageSessionItem);
  },

  saveUser: async (user: SaveUserPayload) => {
    const createResponse = await apiFetch(`${API_BASE}/user`, {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify({
        github_pat: user.github_pat,
      }),
    });

    if (!createResponse.ok) {
      throw new Error(await readErrorMessage(createResponse));
    }

    let data: unknown = null;
    try {
      data = await createResponse.json();
    } catch {
      data = null;
    }

    const raw = extractUserPayload(data);
    if (raw) {
      return normalizeUserPayload(raw, {
        github_pat: user.github_pat ?? undefined,
      });
    }

    if (
      data &&
      typeof data === "object" &&
      "success" in data &&
      data.success === false
    ) {
      const message =
        "message" in data && typeof data.message === "string"
          ? data.message
          : "Failed to create user";
      throw new Error(message);
    }

    return fetchAuthenticatedUserDetails({
      github_pat: user.github_pat ?? undefined,
    });
  },

  updateUserDetails: async (
    payload: UpdateUserDetailsPayload,
  ): Promise<User> => {
    const body: Record<string, string | number> = {};

    if (typeof payload.username === "string" && payload.username.trim()) {
      body.username = payload.username.trim();
    }
    if (typeof payload.email === "string" && payload.email.trim()) {
      body.email = payload.email.trim();
    }
    if (typeof payload.github_pat === "string" && payload.github_pat.trim()) {
      body.github_pat = payload.github_pat.trim();
    }
    if (
      typeof payload.postgres_connection_string === "string" &&
      payload.postgres_connection_string.trim()
    ) {
      body.postgres_connection_string =
        payload.postgres_connection_string.trim();
    }
    if (typeof payload.jira_url === "string" && payload.jira_url.trim()) {
      body.jira_url = payload.jira_url.trim();
    }
    if (
      typeof payload.jira_username === "string" &&
      payload.jira_username.trim()
    ) {
      body.jira_username = payload.jira_username.trim();
    }
    if (
      typeof payload.jira_api_token === "string" &&
      payload.jira_api_token.trim()
    ) {
      body.jira_api_token = payload.jira_api_token.trim();
    }
    if (
      typeof payload.mongodb_connection_string === "string" &&
      payload.mongodb_connection_string.trim()
    ) {
      body.mongodb_connection_string =
        payload.mongodb_connection_string.trim();
    }
    if (
      typeof payload.linear_api_key === "string" &&
      payload.linear_api_key.trim()
    ) {
      body.linear_api_key = payload.linear_api_key.trim();
    }
    if (
      typeof payload.terraform_api_token === "string" &&
      payload.terraform_api_token.trim()
    ) {
      body.terraform_api_token = payload.terraform_api_token.trim();
    }
    if (
      typeof payload.terraform_url === "string" &&
      payload.terraform_url.trim()
    ) {
      body.terraform_url = payload.terraform_url.trim();
    }
    if (
      payload.github_user_id !== undefined &&
      payload.github_user_id !== null &&
      String(payload.github_user_id).trim()
    ) {
      body.github_user_id = String(payload.github_user_id).trim();
    }

    if (!Object.keys(body).length) {
      throw new Error("Nothing to update.");
    }

    const res = await apiFetch(`${API_BASE}/auth/user/update`, {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const message = await readErrorMessage(res);
      throw new Error(message || "Failed to update user details.");
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new Error("Server returned an invalid response.");
    }

    if (!data || typeof data !== "object") {
      throw new Error("Server returned an invalid user payload.");
    }

    return normalizeUserPayload(
      data as Partial<User> & Record<string, unknown>,
      payload,
    );
  },

  syncRepos: () =>
    apiFetch(`${API_BASE}/sync`, {
      method: "POST",
    }).then((r) => r.json()),

  getRepos: () => apiFetch(`${API_BASE}/repos`).then((r) => r.json()),

  getSlackBotConnectUrl: () => `${API_BASE}/slack/bot/connect`,

  getSlackBotStatus: async (): Promise<SlackIntegrationStatus> => {
    const res = await apiFetch(`${API_BASE}/slack/bot/status`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(
        `Failed to load Slack status: ${await readErrorMessage(res)}`,
      );
    }

    const data = await res.json();
    if (!data || typeof data !== "object") {
      throw new Error("Server returned an invalid Slack status payload.");
    }

    return data as SlackIntegrationStatus;
  },

  disconnectSlackBot: async (): Promise<{ success: boolean; message?: string }> => {
    const res = await apiFetch(`${API_BASE}/slack/bot/disconnect`, {
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error(
        `Failed to disconnect Slack: ${await readErrorMessage(res)}`,
      );
    }

    const data = await res.json();
    if (!data || typeof data !== "object") {
      throw new Error("Server returned an invalid Slack disconnect payload.");
    }

    return data as { success: boolean; message?: string };
  },

  setPermission: (
    github_repo_id: number,
    can_read: boolean,
    can_write: boolean,
  ) =>
    apiFetch(`${API_BASE}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ github_repo_id, can_read, can_write }),
    }).then((r) => r.json()),

  setPermissions: (permissions: RepoPermission[]) =>
    apiFetch(`${API_BASE}/permissions/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permissions: permissions.map((p) => ({
          github_repo_id: p.github_repo_id,
          can_read: p.can_read || false,
          can_write: p.can_write || false,
        })),
      }),
    }).then((r) => r.json()),
  // POST /policy -> returns existing row or creates a new one with defaults
  getUserPolicy: async (): Promise<string | null> => {
    const res = await apiFetch(`${API_BASE}/policy`, {
      method: "POST",
    });

    if (!res.ok) throw new Error(`Failed to fetch policy: ${res.statusText}`);

    const data = await res.json();
    const body = Array.isArray(data) ? data[0] : data;
    if (!body?.success || body.rowcount === 0) return null;

    const row = Array.isArray(body.rows) ? body.rows[0] : undefined;
    if (!row) return null;

    const parsed = parseRow(row, body.columns) as Record<string, unknown>;
    return typeof parsed.policy_string === "string"
      ? parsed.policy_string
      : null;
  },

  upsertUserPolicy: async (policyString: string): Promise<void> => {
    const params = new URLSearchParams({ policy_string: policyString });
    const res = await apiFetch(`${API_BASE}/policy?${params.toString()}`, {
      method: "PUT",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Failed to save policy: ${res.status} ${text || res.statusText}`,
      );
    }
  },

  getMyRoomMembership(roomId: string): Promise<{ role: string } | null> {
    return apiFetch(`${API_BASE}/room/${encodeURIComponent(roomId)}/me`, {
      // credentials: 'include',
    })
      .then((res) => {
        if (res.status === 404) return null; // Not a member
        if (!res.ok) throw new Error(`Failed to fetch room membership: ${res.statusText}`);
        return res.json();
      }
      ).then((data) => {
        if (data?.detail) throw new Error(data.detail);
        return data;
      });
  },

  async getRoomIntegrationConfig(roomId: string) {
    const res = await apiFetch(`${API_BASE}/room/${roomId}/integration-url`);

    if (!res.ok) {
      throw new Error(await readErrorMessage(res));
    }

    return parseRow(await res.json()) as RoomDetails;
  },

  getApiTokenPrefix: async (): Promise<ApiTokenPrefix> => {
    const res = await apiFetch(`${API_BASE}/api-token/prefix`);

    if (!res.ok) {
      throw new Error(`Failed to load API token prefix: ${await readErrorMessage(res)}`);
    }

    return res.json();
  },

  getApiKeys: async (roomId?: string): Promise<ApiKeySummary[]> => {
    const url = new URL(`${API_BASE}/api-token/api-keys`);
    if (roomId) url.searchParams.set("room_id", roomId);

    const res = await apiFetch(url.toString());

    if (!res.ok) {
      throw new Error(`Failed to load API keys: ${await readErrorMessage(res)}`);
    }

    const data = await res.json();
    return Array.isArray(data)
      ? data.map((row: unknown) => parseRow(row) as ApiKeySummary)
      : [];
  },

  createApiKey: async (
    payload: { room_id: string; name: string },
  ): Promise<CreatedApiKey> => {
    const res = await apiFetch(`${API_BASE}/api-token/api-key`, {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Failed to create API key: ${await readErrorMessage(res)}`);
    }

    return parseRow(await res.json()) as CreatedApiKey;
  },

  deleteApiKey: async (
    keyId: string,
  ): Promise<{ success: boolean; message: string }> => {
    const res = await apiFetch(
      `${API_BASE}/api-token/api-key/${encodeURIComponent(keyId)}`,
      {
        method: "DELETE",
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to delete API key: ${await readErrorMessage(res)}`);
    }

    return res.json();
  },
  createRoom: async (repoName: string): Promise<RoomDetails> => {
    const res = await apiFetch(`${API_BASE}/room/`, {
      method: "POST",
      // credentials: 'include',
      headers: getJsonHeaders(),
      body: JSON.stringify({ repo_name: repoName }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create room: ${await readErrorMessage(res)}`);
    }

    return parseRow(await res.json()) as RoomDetails;
  },

  getMyRooms: async (): Promise<RoomSummary[]> => {
    const res = await apiFetch(`${API_BASE}/room/`, {
      // credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Failed to load rooms: ${await readErrorMessage(res)}`);
    }

    const data = await res.json();
    const rooms = Array.isArray(data) ? data : [];
    const normalized = rooms.map((room) => parseRow(room) as RoomSummary);

    if (typeof window !== "undefined") {
      console.log(
        "[Aegis Rooms] created_at from DB",
        rooms.map((room: Record<string, unknown>, index: number) => ({
          repo: room.repo_name,
          id: room.id ?? room.room_id,
          created_at_raw: room.created_at,
          created_at_normalized: (normalized[index] as RoomSummary).created_at,
          room_created_at: room.room_created_at,
          joined_at: room.joined_at,
        })),
      );
    }

    return normalized;
  },

  getRoomDetails: async (roomId: string): Promise<RoomDetails> => {
    const res = await apiFetch(
      `${API_BASE}/room/${encodeURIComponent(roomId)}`,
      {
        // credentials: 'include',
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to load room: ${await readErrorMessage(res)}`);
    }

    return parseRow(await res.json()) as RoomDetails;
  },

  getRoomMembers: async (roomId: string): Promise<RoomMember[]> => {
    const res = await apiFetch(
      `${API_BASE}/room/${encodeURIComponent(roomId)}/members`,
      {
        // credentials: 'include',
      },
    );

    if (!res.ok) {
      throw new Error(
        `Failed to load room members: ${await readErrorMessage(res)}`,
      );
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  getRoomInvites: async (roomId: string): Promise<RoomInvite[]> => {
    const res = await apiFetch(
      `${API_BASE}/room/${encodeURIComponent(roomId)}/invites`,
      {
        // credentials: 'include',
      },
    );

    if (!res.ok) {
      throw new Error(
        `Failed to load room invites: ${await readErrorMessage(res)}`,
      );
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * Paginated audit log for a single room. Mirrors the FastAPI endpoint
   * `GET /sessions_by_room_id/{room_id}` which returns one `RoomSessionAction`
   * per row (SessionAction + `room_id` + resolved `username`).
   */
  getSessionsByRoomId: async (
    roomId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedResponse<RoomSessionAction>> => {
    const url = new URL(
      `${API_BASE}/sessions_by_room_id/${encodeURIComponent(roomId)}`,
    );
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));

    const res = await apiFetch(url.toString());
    if (!res.ok) {
      throw new Error(
        `Failed to load room activity: ${await readErrorMessage(res)}`,
      );
    }

    const data = await res.json();
    return {
      items: Array.isArray(data?.items)
        ? data.items.map((row: unknown) => parseRow(row) as RoomSessionAction)
        : [],
      total: Number(data?.total ?? 0),
      page: Number(data?.page ?? page),
      page_size: Number(data?.page_size ?? pageSize),
      pages: Number(data?.pages ?? 0),
    };
  },

  createRoomInvite: async (
    roomId: string,
    payload: { max_uses?: number; expires_at?: string },
  ): Promise<RoomInvite> => {
    const res = await apiFetch(
      `${API_BASE}/room/${encodeURIComponent(roomId)}/invite`,
      {
        method: "POST",
        // credentials: 'include',
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      throw new Error(
        `Failed to create invite: ${await readErrorMessage(res)}`,
      );
    }

    return res.json();
  },

  joinRoom: async (inviteCode: string): Promise<any> => {
    const res = await apiFetch(
      `${API_BASE}/room/join/${encodeURIComponent(inviteCode)}`,
      {
        method: "POST",
        // credentials: 'include',
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to join room: ${await readErrorMessage(res)}`);
    }
    return res.json();
  },

  createFreezeWindow: async (payload: any): Promise<any> => {
    const res = await apiFetch(`${API_BASE}/freeze_window/create`, {
      method: "POST",
      // credentials: 'include',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(
        `Failed to create freeze window: ${await readErrorMessage(res)}`,
      );
    }

    return res.json();
  },

  getFreezeWindows: async (): Promise<any[]> => {
    const res = await apiFetch(`${API_BASE}/freeze_window/get`, {
      // credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(
        `Failed to fetch freeze windows: ${await readErrorMessage(res)}`,
      );
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  updateFreezeWindow: async (windowId: string, payload: any): Promise<any> => {
    const res = await apiFetch(
      `${API_BASE}/freeze_window/update/${encodeURIComponent(windowId)}`,
      {
        method: "PUT",
        // credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      throw new Error(
        `Failed to update freeze window: ${await readErrorMessage(res)}`,
      );
    }
    return res.json();
  },

  deleteFreezeWindow: async (windowId: string): Promise<any> => {
    const res = await apiFetch(
      `${API_BASE}/freeze_window/delete/${encodeURIComponent(windowId)}`,
      {
        method: "DELETE",
        // credentials: 'include',
      },
    );

    if (!res.ok) {
      throw new Error(
        `Failed to delete freeze window: ${await readErrorMessage(res)}`,
      );
    }
    return res.json();
  },

  getMemories: async (userId: string): Promise<Memory[]> => {
    const res = await apiFetch(
      `${API_BASE}/memory/user/${encodeURIComponent(userId)}`,
    );
    if (!res.ok) {
      throw new Error(`Failed to load memories: ${await readErrorMessage(res)}`);
    }
    const data = await res.json();
    // Response may be a wrapper { memories: [...] } or a plain array
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.memories)) return data.memories;
    return [];
  },

  updateMemory: async (
    memoryId: string,
    userId: string,
    payload: Partial<Pick<Memory, 'title' | 'memory' | 'is_pinned'>>,
  ): Promise<Memory> => {
    const res = await apiFetch(
      `${API_BASE}/memory/${encodeURIComponent(memoryId)}`,
      {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify({ user_id: userId, ...payload }),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to update memory: ${await readErrorMessage(res)}`);
    }
    return res.json();
  },

  deleteMemory: async (memoryId: string, userId: string): Promise<void> => {
    const res = await apiFetch(
      `${API_BASE}/memory/${encodeURIComponent(memoryId)}?user_id=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      throw new Error(`Failed to delete memory: ${await readErrorMessage(res)}`);
    }
  },

  getUserPrompts: async (): Promise<UserPrompt[]> => {
    const res = await apiFetch(`${API_BASE}/user-prompts`);
    if (!res.ok) {
      throw new Error(`Failed to load prompts: ${await readErrorMessage(res)}`);
    }
    const data = (await res.json()) as UserPromptListResponse;
    return Array.isArray(data?.prompts) ? data.prompts : [];
  },

  createUserPrompt: async (payload: UserPromptPayload): Promise<UserPrompt> => {
    const res = await apiFetch(`${API_BASE}/user-prompts`, {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to create prompt: ${await readErrorMessage(res)}`);
    }
    return res.json();
  },

  updateUserPrompt: async (
    promptId: string,
    payload: UserPromptPayload,
  ): Promise<UserPrompt> => {
    const res = await apiFetch(
      `${API_BASE}/user-prompts/${encodeURIComponent(promptId)}`,
      {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to update prompt: ${await readErrorMessage(res)}`);
    }
    return res.json();
  },

  getWorkspaces: async (): Promise<WorkspaceSummary[]> => {
    const res = await apiFetch(`${API_BASE}/api/workspaces`);
    if (!res.ok) {
      throw new Error(`Failed to load workspaces: ${await readErrorMessage(res)}`);
    }
    const data = await res.json();
    return Array.isArray(data)
      ? data.map((row: unknown) => parseRow(row) as WorkspaceSummary)
      : [];
  },

  createWorkspace: async (payload: {
    title: string;
    task?: string | null;
  }): Promise<WorkspaceDetail> => {
    const res = await apiFetch(`${API_BASE}/api/workspaces`, {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to create workspace: ${await readErrorMessage(res)}`);
    }
    return res.json();
  },

  getWorkspace: async (workspaceId: string): Promise<WorkspaceDetail> => {
    const res = await apiFetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}`,
    );
    if (!res.ok) {
      throw new Error(`Failed to load workspace: ${await readErrorMessage(res)}`);
    }
    return res.json();
  },

  updateWorkspace: async (
    workspaceId: string,
    payload: { title?: string; task?: string | null },
  ): Promise<WorkspaceRecord> => {
    const res = await apiFetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}`,
      {
        method: "PATCH",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to update workspace: ${await readErrorMessage(res)}`);
    }
    return parseRow(await res.json()) as WorkspaceRecord;
  },

  createWorkspaceAgent: async (
    workspaceId: string,
    payload: { handle: string; role_label?: string | null },
  ): Promise<WorkspaceAgentKeyResponse> => {
    const res = await apiFetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}/agents`,
      {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to create agent: ${await readErrorMessage(res)}`);
    }
    return res.json();
  },

  updateWorkspaceAgent: async (
    workspaceId: string,
    agentId: string,
    payload: {
      handle?: string;
      role_label?: string | null;
      status?: WorkspaceAgentStatus;
    },
  ): Promise<WorkspaceAgent> => {
    const res = await apiFetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}/agents/${encodeURIComponent(agentId)}`,
      {
        method: "PATCH",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to update agent: ${await readErrorMessage(res)}`);
    }
    return parseRow(await res.json()) as WorkspaceAgent;
  },

  rotateWorkspaceAgentKey: async (
    workspaceId: string,
    agentId: string,
  ): Promise<WorkspaceAgentKeyResponse> => {
    const res = await apiFetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}/agents/${encodeURIComponent(agentId)}/key`,
      {
        method: "POST",
        headers: getJsonHeaders(),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to generate agent key: ${await readErrorMessage(res)}`);
    }
    return res.json();
  },

  revokeWorkspaceAgent: async (
    workspaceId: string,
    agentId: string,
  ): Promise<WorkspaceAgent> => {
    const res = await apiFetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}/agents/${encodeURIComponent(agentId)}/revoke`,
      {
        method: "POST",
        headers: getJsonHeaders(),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to remove agent: ${await readErrorMessage(res)}`);
    }
    return parseRow(await res.json()) as WorkspaceAgent;
  },

  revokeWorkspaceAgentKey: async (
    workspaceId: string,
    agentId: string,
  ): Promise<{ detail: string; agent: WorkspaceAgent }> => {
    const res = await apiFetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}/agents/${encodeURIComponent(agentId)}/key`,
      {
        method: "DELETE",
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to revoke agent key: ${await readErrorMessage(res)}`);
    }
    return res.json();
  },

  createWorkspaceMessage: async (
    workspaceId: string,
    payload: {
      sender_member_id: string;
      message_text?: string | null;
      file_refs?: WorkspaceFileRef[];
    },
  ): Promise<WorkspaceMessage> => {
    const res = await apiFetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}/messages`,
      {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to post message: ${await readErrorMessage(res)}`);
    }
    return parseRow(await res.json()) as WorkspaceMessage;
  },

  getWorkspacePointers: async (
    workspaceId: string,
    status?: WorkspacePointerStatus,
  ): Promise<WorkspaceTaskPointer[]> => {
    const url = new URL(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}/pointers`,
    );
    if (status) url.searchParams.set("status", status);
    const res = await apiFetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to load task pointers: ${await readErrorMessage(res)}`);
    }
    const data = await res.json();
    return Array.isArray(data)
      ? data.map((row: unknown) => parseRow(row) as WorkspaceTaskPointer)
      : [];
  },

  createWorkspacePointer: async (
    workspaceId: string,
    payload: {
      title: string;
      description?: string | null;
      status?: WorkspacePointerStatus;
      sort_order?: number;
      created_by_member_id?: string | null;
    },
  ): Promise<WorkspaceTaskPointer> => {
    const res = await apiFetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}/pointers`,
      {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to create task pointer: ${await readErrorMessage(res)}`);
    }
    return parseRow(await res.json()) as WorkspaceTaskPointer;
  },

  updateWorkspacePointer: async (
    workspaceId: string,
    pointerId: string,
    payload: {
      title?: string;
      description?: string | null;
      status?: WorkspacePointerStatus;
      sort_order?: number;
    },
  ): Promise<WorkspaceTaskPointer> => {
    const res = await apiFetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}/pointers/${encodeURIComponent(pointerId)}`,
      {
        method: "PATCH",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to update task pointer: ${await readErrorMessage(res)}`);
    }
    return parseRow(await res.json()) as WorkspaceTaskPointer;
  },

  deleteWorkspacePointer: async (
    workspaceId: string,
    pointerId: string,
  ): Promise<{ detail: string; pointer_id: string }> => {
    const res = await apiFetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}/pointers/${encodeURIComponent(pointerId)}`,
      {
        method: "DELETE",
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to delete task pointer: ${await readErrorMessage(res)}`);
    }
    return res.json();
  },
};
