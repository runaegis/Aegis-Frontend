/**
 * Parse API timestamps. The backend stores UTC but often serializes
 * without a timezone suffix (e.g. "2026-06-11 09:00:00"). Browsers
 * treat those as local time, which skews relative labels.
 */
export function parseApiUtcTimestamp(value: string): Date {
  const s = value.trim();
  if (!s) return new Date(NaN);
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  // Date-only values from the DB (e.g. "2026-05-22") → UTC midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00Z`);
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  return new Date(`${normalized}Z`);
}

/** Normalize a UTC API timestamp to an ISO-8601 string with `Z`. */
export function normalizeApiTimestamp(value: string): string {
  const s = value.trim();
  if (!s) return value;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00Z`;
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  return `${normalized}Z`;
}

/** Prefer the room's own creation time over membership join time. */
export function getRoomCreatedAt(room: {
  created_at?: string | null;
  room_created_at?: string | null;
}): string | undefined {
  const roomCreated =
    typeof room.room_created_at === 'string' ? room.room_created_at.trim() : '';
  const created =
    typeof room.created_at === 'string' ? room.created_at.trim() : '';
  return roomCreated || created || undefined;
}

export function getRoomDisplayName(room: {
  name?: string | null;
  repo_name?: string | null;
  room_id?: string | null;
  id?: string | null;
} | null | undefined): string {
  const name = typeof room?.name === 'string' ? room.name.trim() : '';
  if (name) return name;

  const repo = typeof room?.repo_name === 'string' ? room.repo_name.trim() : '';
  if (repo) return repo;

  const roomId = typeof room?.room_id === 'string' ? room.room_id.trim() : '';
  if (roomId) return roomId;

  const id = typeof room?.id === 'string' ? room.id.trim() : '';
  return id || 'Room';
}

export function formatRelativeTime(timestamp: string): string {
  const parsed = parseApiUtcTimestamp(timestamp);
  const then = parsed.getTime();
  if (Number.isNaN(then)) return '—';

  const now = Date.now();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return parsed.toLocaleDateString();
}

export function formatFullTimestamp(timestamp: string): string {
  return parseApiUtcTimestamp(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return '?';

  const parts = name.split(/[_\-\s]+/).filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function truncate(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '…';
}

export function formatDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const diffMs = end - start;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}m ${diffSec % 60}s`;
  return `${diffHr}h ${diffMin % 60}m`;
}

export function formatExecutionTimeMs(
  value: number | string | bigint | null | undefined
): string {
  if (value === null || value === undefined) return '';
  const ms = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) {
    const seconds = ms / 1000;
    const decimals = ms < 10000 ? 2 : 1;
    return `${seconds.toFixed(decimals)}s`;
  }

  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;

  const hours = Math.floor(minutes / 60);
  const minutesRemainder = minutes % 60;
  return `${hours}h ${minutesRemainder}m`;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

const MCP_AEGIS_TOOL_PREFIX = 'mcp_aegis_';

/** Strip `mcp_aegis_` for UI labels while keeping raw `tool_name` for API/color stability. */
export function formatMcpAegisToolDisplayName(toolName: string): string {
  if (!toolName) return '';
  return toolName.startsWith(MCP_AEGIS_TOOL_PREFIX)
    ? toolName.slice(MCP_AEGIS_TOOL_PREFIX.length)
    : toolName;
}

/** Stable category for MCP Aegis GitHub tools — color = category, not random. */
export type AegisToolCategory =
  | 'files_content'
  | 'pull_request'
  | 'repos_branches'
  | 'issues_comments'
  | 'search_read'
  | 'actions_workflows'
  | 'fallback';

const CATEGORY_HUE: Record<AegisToolCategory, number | null> = {
  files_content: 152,
  pull_request: 268,
  repos_branches: 184,
  issues_comments: 38,
  search_read: 212,
  actions_workflows: 16,
  fallback: null,
};

/** Soft pill fill + readable label on the same hue ramp (no bright border / glow). */
const CATEGORY_CHIP: Record<
  AegisToolCategory,
  { fill: [h: number, s: number, l: number, a: number]; text: [h: number, s: number, l: number] }
> = {
  files_content: { fill: [152, 36, 30, 0.22], text: [152, 22, 76] },
  pull_request: { fill: [268, 38, 32, 0.22], text: [268, 24, 78] },
  repos_branches: { fill: [184, 32, 28, 0.22], text: [184, 22, 77] },
  issues_comments: { fill: [38, 42, 30, 0.22], text: [38, 26, 78] },
  search_read: { fill: [212, 36, 30, 0.22], text: [212, 22, 78] },
  actions_workflows: { fill: [16, 44, 32, 0.22], text: [16, 28, 76] },
  fallback: { fill: [220, 10, 26, 0.32], text: [220, 6, 70] },
};

/**
 * Classify tool by name (with or without `mcp_aegis_` prefix).
 * Order matters: PR and issues before generic `get_` / `list_` / `search_`.
 */
export function getAegisToolCategory(toolName: string): AegisToolCategory {
  const raw = (toolName || '').toLowerCase();
  const n = raw.startsWith(MCP_AEGIS_TOOL_PREFIX) ? raw.slice(MCP_AEGIS_TOOL_PREFIX.length) : raw;

  if (n.includes('pull_request')) return 'pull_request';
  if (n.includes('issue')) return 'issues_comments';

  if (n.includes('create_or_update_file') || n.includes('push_files')) return 'files_content';

  if (n.startsWith('search_') || n.startsWith('get_') || n.startsWith('list_')) return 'search_read';

  if (n.includes('workflow') || n.includes('dispatch') || n.includes('runner')) {
    return 'actions_workflows';
  }

  if (n.includes('branch') || n.includes('repository') || n.includes('fork')) {
    return 'repos_branches';
  }

  if (n.includes('comment')) return 'issues_comments';

  return 'fallback';
}

export type ToolChipStyle = {
  backgroundColor: string;
  color: string;
};

/** Hue for subtle accents (dots, bars). `null` = use neutral gray. */
export function getToolAccentHue(toolName: string): number | null {
  return CATEGORY_HUE[getAegisToolCategory(toolName)];
}

export function getToolChipStyle(toolName: string): ToolChipStyle {
  const cat = getAegisToolCategory(toolName);
  const { fill, text } = CATEGORY_CHIP[cat];
  const [fh, fs, fl, fa] = fill;
  const [th, ts, tl] = text;
  return {
    backgroundColor: `hsla(${fh}, ${fs}%, ${fl}%, ${fa})`,
    color: `hsl(${th}, ${ts}%, ${tl}%)`,
  };
}

/**
 * Tools whose execution targets a specific pull request. When one of these
 * runs, the backend appends a GitHub PR link (typically as the last entry of
 * `action_pointers`) so the reviewer can jump straight to the PR before
 * acting on the approval / inspecting the run.
 */
export const PR_RELATED_TOOLS: ReadonlySet<string> = new Set([
  'create_pull_request',
  'merge_pull_request',
  'update_pull_request',
  'update_pull_request_branch',
  'add_pull_request_review_comment',
  'request_copilot_review',
  'create_pull_request_review',
  'get_pull_request',
  'get_pull_request_files',
  'get_pull_request_diff',
  'get_pull_request_status',
  'get_pull_request_reviews',
  'get_pull_request_comments',
]);

/** True when the tool name (with or without the `mcp_aegis_` prefix) acts on a PR. */
export function isPullRequestTool(toolName?: string | null): boolean {
  if (!toolName) return false;
  const raw = toolName.toLowerCase();
  const stripped = raw.startsWith(MCP_AEGIS_TOOL_PREFIX)
    ? raw.slice(MCP_AEGIS_TOOL_PREFIX.length)
    : raw;
  return PR_RELATED_TOOLS.has(stripped);
}

const PR_URL_RE = /https?:\/\/[^\s"'<>)\]]+\/pull\/\d+(?:\/[^\s"'<>)\]]*)?/i;

/**
 * Default host used ONLY when we have to synthesize a PR URL from arguments
 * (i.e. `action_pointers` / `result` carry no URL of their own). For any
 * URL discovered in backend payloads we preserve its host verbatim — that
 * way enterprise GitHub instances (e.g. `github.company.com`) keep working
 * without needing per-tenant config in the frontend.
 */
const GITHUB_HOST_FALLBACK = 'github.com';

// ── Decision verdict ────────────────────────────────────────────────────────

export type CanonicalDecision =
  | 'ALLOW'
  | 'DENY'
  | 'REWRITE'
  | 'REQUIRE_APPROVAL'
  | 'ERROR'
  | 'UNKNOWN';

export type CanonicalApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'unknown';

/**
 * Normalize free-form backend `decision` strings to a canonical bucket.
 *
 * The backend may emit title-case or past-tense variants (`"Denied"`,
 * `"Allowed"`) rather than the enum-style labels the UI expects (`"DENY"`,
 * `"ALLOW"`). Lowercase first, then map — same pattern as {@link normalizePolicy}.
 */
export function normalizeDecision(value?: string | null): CanonicalDecision {
  if (!value) return 'UNKNOWN';
  const v = value.toLowerCase().trim();
  if (!v) return 'UNKNOWN';

  if (v === 'allow' || v === 'allowed' || v === 'approved' || v === 'pass' || v === 'passed' || v === 'ok') {
    return 'ALLOW';
  }
  if (v === 'deny' || v === 'denied' || v === 'rejected' || v === 'reject') {
    return 'DENY';
  }
  if (v === 'rewrite' || v === 'rewritten') {
    return 'REWRITE';
  }
  if (v.includes('approval') || v === 'pending' || v === 'require_approval') {
    return 'REQUIRE_APPROVAL';
  }
  if (v === 'error') {
    return 'ERROR';
  }

  const upper = value.toUpperCase().trim();
  if (upper === 'ALLOW' || upper === 'DENY' || upper === 'REWRITE' || upper === 'REQUIRE_APPROVAL' || upper === 'ERROR') {
    return upper;
  }
  if (upper === 'DENIED' || upper === 'REJECTED') return 'DENY';
  if (upper === 'ALLOWED' || upper === 'APPROVED') return 'ALLOW';
  if (upper.includes('APPROVAL') || upper === 'PENDING') return 'REQUIRE_APPROVAL';

  return 'UNKNOWN';
}

/**
 * Normalize backend MCP approval statuses into a stable set the UI can
 * reason about. The backend currently emits `pending`, `approved`,
 * `denied`, and `executed`; older / adjacent flows may still surface
 * decision-like labels such as `ALLOW`, `DENY`, or `REQUIRE_APPROVAL`.
 */
export function normalizeApprovalStatus(
  value?: string | null,
  approvedAt?: string | null,
): CanonicalApprovalStatus {
  if (!value) {
    return approvedAt ? 'executed' : 'unknown';
  }

  const v = value.toLowerCase().trim();
  if (!v) {
    return approvedAt ? 'executed' : 'unknown';
  }

  if (v === 'pending' || v === 'require_approval' || v.includes('approval')) {
    return 'pending';
  }
  if (v === 'approved' || v === 'approve') {
    return 'approved';
  }
  if (v === 'denied' || v === 'deny' || v === 'rejected' || v === 'reject') {
    return 'rejected';
  }
  if (v === 'executed' || v === 'completed' || v === 'complete' || v === 'done') {
    return 'executed';
  }

  const decision = normalizeDecision(value);
  if (decision === 'REQUIRE_APPROVAL') return 'pending';
  if (decision === 'ALLOW') return 'approved';
  if (decision === 'DENY') return 'rejected';

  return approvedAt ? 'executed' : 'unknown';
}

// ── Policy verdict ─────────────────────────────────────────────────────────

export type PolicyStatus = 'pass' | 'enforced' | 'unknown';

/**
 * Normalize free-form backend `policy` strings to a known status.
 *
 * The backend emits either `"pass"` (no policy triggered) or the *name* of
 * the policy that triggered (e.g. `"PROTECTED_MERGE"`, `"BRANCH_POLICY"`,
 * `"MISSING_FIELDS"`). Any non-pass / non-empty value means a policy fired,
 * which is `enforced`.
 */
export function normalizePolicy(policy?: string | null): PolicyStatus {
  if (!policy) return 'unknown';
  const v = policy.toLowerCase().trim();
  if (!v) return 'unknown';
  if (v === 'pass' || v === 'passed' || v === 'ok' || v === 'allow' || v === 'allowed') {
    return 'pass';
  }
  // Any other non-empty value = a named policy fired = enforced.
  return 'enforced';
}

/**
 * Humanize backend policy identifiers. `PROTECTED_MERGE` → `Protected merge`.
 * Single-word lowercase values get title-cased (`pass` → `Pass`).
 */
function humanizePolicyLabel(raw: string): string {
  const cleaned = raw.trim().replace(/[_-]+/g, ' ').toLowerCase();
  if (!cleaned) return raw;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export type PolicyDisplay = {
  status: PolicyStatus;
  label: string;
  tone: 'success' | 'warning' | 'neutral';
};

export function formatPolicy(policy?: string | null): PolicyDisplay {
  const status = normalizePolicy(policy);
  if (status === 'pass') return { status, label: 'Pass', tone: 'success' };
  if (status === 'enforced') {
    // Use the actual policy name (humanized) so reviewers can see WHICH
    // policy fired — not just that something did.
    return { status, label: humanizePolicyLabel(policy ?? 'Enforced'), tone: 'warning' };
  }
  return { status, label: 'Unknown', tone: 'neutral' };
}

// ── Blast radius ──────────────────────────────────────────────────────────

export type BlastRadius = 'low' | 'medium' | 'high' | 'critical' | 'unknown';

/** Normalize free-form backend severity strings to a known blast-radius bucket. */
export function normalizeBlastRadius(value?: string | null): BlastRadius {
  if (!value) return 'unknown';
  const v = value.toLowerCase().trim();
  if (!v) return 'unknown';
  if (v === 'low' || v === 'lo' || v === 'minor') return 'low';
  if (v === 'medium' || v === 'med' || v === 'moderate') return 'medium';
  if (v === 'high' || v === 'major') return 'high';
  if (v === 'critical' || v === 'crit' || v === 'severe') return 'critical';
  return 'unknown';
}

export type BlastRadiusDisplay = {
  level: BlastRadius;
  label: string;
  tone: 'success' | 'warning' | 'primary' | 'error' | 'neutral';
};

/** Stable rank for sorting by severity. */
export function blastRadiusRank(value?: string | null): number {
  switch (normalizeBlastRadius(value)) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
    case 'critical':
      return 4;
    default:
      return 0;
  }
}

export function formatBlastRadius(value?: string | null): BlastRadiusDisplay {
  const level = normalizeBlastRadius(value);
  switch (level) {
    case 'low':
      return { level, label: 'Low', tone: 'success' };
    case 'medium':
      return { level, label: 'Medium', tone: 'warning' };
    case 'high':
      return { level, label: 'High', tone: 'primary' };
    case 'critical':
      return { level, label: 'Critical', tone: 'error' };
    default:
      return { level, label: value?.trim() || 'Unknown', tone: 'neutral' };
  }
}

/** Human-readable room slug: `{repo_name}_{first 5 uuid chars}`. */
export function getRoomSlug(
  roomName: string | undefined | null,
  roomId: string,
): string {
  const name = roomName?.trim() || 'room';
  const idPrefix = roomId.replace(/-/g, '').slice(0, 5).toLowerCase();
  return idPrefix ? `${name}_${idPrefix}` : name;
}

// ── Room roles ────────────────────────────────────────────────────────────

/**
 * Tone for a room-role Badge. OWNER gets the brand primary (orange) to
 * signal highest authority + reinforce the Aegis identity wherever an
 * OWNER badge appears. ADMIN sits between (warning amber). DEVELOPER is
 * the baseline (info blue). Anything unknown falls back to neutral gray.
 *
 * Returns a string instead of `BadgeTone` so `utils.ts` stays free of
 * component imports — callers cast/use it directly with `tone={...}`.
 */
export type RoomRoleBadgeTone = 'primary' | 'warning' | 'info' | 'neutral';

export function getRoomRoleBadgeTone(role?: string | null): RoomRoleBadgeTone {
  const r = role?.toUpperCase().trim();
  if (r === 'OWNER') return 'primary';
  if (r === 'ADMIN' || r === 'TECH LEAD' || r === 'TECH_LEAD') return 'warning';
  if (r === 'DEVELOPER') return 'info';
  return 'neutral';
}

/** Read blast radius from a `SessionAction`-shaped object, tolerant of typo & corrected key. */
export function readBlastRadius(input: {
  blast_redius?: string | null;
  blast_radius?: string | null;
}): string | null | undefined {
  return input.blast_redius ?? input.blast_radius;
}

/** Parse a PR URL into `{ owner, repo, number }` (host preserved). Returns `null` if not parseable. */
export function parsePullRequestUrl(
  url: string,
): { owner: string; repo: string; number: number } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const match = u.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\b/);
    if (!match) return null;
    const number = Number(match[3]);
    if (!Number.isFinite(number)) return null;
    return { owner: match[1], repo: match[2], number };
  } catch {
    return null;
  }
}

/**
 * Best-effort extraction of a GitHub Pull Request URL associated with a tool
 * call / approval / session action. Scans, in order of preference:
 *
 *  1. `action_pointers` (backend convention — the URL is normally appended as
 *     the last bullet for PR-related tools, so we walk from the end).
 *  2. The stringified `result` payload returned by the tool.
 *  3. The stringified `context` blob (MCP approvals carry the bound context).
 *  4. `arguments.{owner, repo, pull_number}` — synthetic fallback so the link
 *     appears even when the backend hasn't appended one yet.
 *
 * URLs discovered in backend payloads are returned VERBATIM (host preserved)
 * so enterprise GitHub hosts like `github.company.com` keep working. Only the
 * synthesized fallback (#4) defaults to public `github.com`, because we have
 * no host hint when only `owner`/`repo`/`pull_number` are available.
 */
export function extractPullRequestUrl(input: {
  action_pointers?: readonly string[] | null;
  result?: unknown;
  context?: Record<string, unknown> | null;
  arguments?: Record<string, unknown> | null;
}): string | null {
  let found: string | null = null;

  const pointers = input.action_pointers;
  if (Array.isArray(pointers)) {
    for (let i = pointers.length - 1; i >= 0; i--) {
      const entry = pointers[i];
      if (typeof entry !== 'string') continue;
      const m = entry.match(PR_URL_RE);
      if (m) {
        found = m[0];
        break;
      }
    }
  }

  if (!found) {
    const haystacks: unknown[] = [input.result, input.context];
    for (const h of haystacks) {
      if (h === null || h === undefined) continue;
      let text: string | null = null;
      if (typeof h === 'string') text = h;
      else if (typeof h === 'object') {
        try {
          text = JSON.stringify(h);
        } catch {
          text = null;
        }
      }
      if (!text) continue;
      const m = text.match(PR_URL_RE);
      if (m) {
        found = m[0];
        break;
      }
    }
  }

  if (found) {
    return found;
  }

  const args = input.arguments;
  if (args && typeof args === 'object') {
    const owner = typeof args.owner === 'string' ? args.owner.trim() : '';
    const repo = typeof args.repo === 'string' ? args.repo.trim() : '';
    const raw = args.pull_number;
    let num: number | null = null;
    if (typeof raw === 'number' && Number.isFinite(raw)) num = raw;
    else if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) num = Number(raw.trim());
    if (owner && repo && num !== null) {
      return `https://${GITHUB_HOST_FALLBACK}/${owner}/${repo}/pull/${num}`;
    }
  }

  return null;
}
