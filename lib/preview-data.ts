/**
 * Preview-mode data shim — installs fake responses on the `api` singleton
 * so the dashboard renders fully-populated in design review without a
 * backend. Idempotent — safe to call on every render. Real production code
 * paths are untouched unless `aegis_preview` is on.
 */

import { api } from './api';
import {
  matchesActionDateFilters,
  type ActionDateFilters,
} from './dashboardDateRange';
import type {
  AggregatedSessionAction,
  MCPApproval,
  Memory,
  Metrics,
  PaginatedResponse,
  Repo,
  RoomDetails,
  RoomInvite,
  RoomMember,
  RoomSessionAction,
  RoomSummary,
  Session,
  SessionAction,
  TokenAnalyticsDateRange,
  TokenAnalyticsResponse,
  TokenMeterResponse,
  TokenUsageSessionItem,
} from './types';

// ── deterministic PRNG so render is stable across re-mounts ────────────────
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x4ae9_15);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const pickW = <T,>(arr: readonly { value: T; weight: number }[]): T => {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let r = rand() * total;
  for (const x of arr) {
    if ((r -= x.weight) <= 0) return x.value;
  }
  return arr[arr.length - 1].value;
};
const uuid = (() => {
  let n = 0;
  return () => {
    n += 1;
    const h = (rand() * 0xffffffff).toString(16).padStart(8, '0');
    return `${h.slice(0, 8)}-${h.slice(0, 4)}-4${h.slice(1, 4)}-a${h.slice(0, 3)}-${(Date.now() + n).toString(16).padStart(12, '0').slice(0, 12)}`;
  };
})();

// ── data dictionaries ──────────────────────────────────────────────────────
const AGENTS = [
  'claude-sonnet-4',
  'gpt-4o',
  'cursor-agent',
  'windsurf-cascade',
  'devin',
  'aider',
  'github-copilot',
  'replit-agent',
];

const REPOS = [
  'aegis/dashboard',
  'aegis/mcp-server',
  'aegis/marketing',
  'runaegis/api',
  'runaegis/integrations',
  'jenilparmar/playground',
];

const BRANCHES = [
  'main',
  'develop',
  'feature/auth-flow',
  'feature/rate-limits',
  'fix/approval-race',
  'aegis/sess_8f3a/refactor-policies',
  'aegis/sess_b21c/add-webhooks',
  'chore/dependency-bump',
];

const TOOLS = [
  'create_or_update_file',
  'get_file_contents',
  'list_repository_files',
  'push_files',
  'search_repositories',
  'get_repository',
  'create_issue',
  'get_issue',
  'list_issues',
  'create_pull_request',
  'get_pull_request',
  'search_code',
  'search_issues',
  'get_latest_commit',
  'list_branches',
  'create_branch',
];

const ACTION_PHRASES = [
  'Open a pull request to refactor the approval queue handler',
  'Push a fix for the race condition in policy evaluation',
  'Read the README to understand repository layout',
  'List all open issues tagged `bug` for triage',
  'Create a feature branch from main',
  'Search the codebase for usages of the deprecated `evaluatePolicy` helper',
  'Add a webhook payload signing test',
  'Update README with the new MCP endpoint URL',
  'Comment on PR #142 with review notes',
  'Get the latest commit hash for the release branch',
  'Rename the `aegis_temp` table per migration plan',
  'Bump `motion` from 12.37 to 12.38',
  'Add the JetBrains Mono font import',
  'Remove an unused getInitials call from Topbar',
  'Patch the rate limiter to use Redis instead of in-memory',
  'Pull the latest schema for the audit table',
];

const DECISIONS = [
  { value: 'ALLOW',            weight: 60 },
  { value: 'REWRITE',          weight: 14 },
  { value: 'REQUIRE_APPROVAL', weight: 12 },
  { value: 'DENY',             weight: 14 },
] as const;

// ── Policy + blast-radius pickers ─────────────────────────────────────────
//
// Backend policy values are either `pass` (no policy fired) or the *name*
// of the policy that fired (e.g. `PROTECTED_MERGE`). Demo data correlates
// the policy choice with the decision so prospects see realistic patterns:
// DENY rows always show a named policy, ALLOW rows mostly show `pass`,
// REQUIRE_APPROVAL leans into the gating policies (Protected merge,
// Branch policy, Freeze window).

const HARD_POLICIES = [
  'PROTECTED_MERGE',
  'PROTECTED_BRANCH',
  'SECRET_SCAN',
  'FREEZE_WINDOW',
] as const;

const SOFT_POLICIES = [
  'BRANCH_POLICY',
  'MISSING_FIELDS',
  'LARGE_DIFF',
] as const;

function policyForDecision(decision: string): string {
  const r = rand();
  switch (decision) {
    case 'ALLOW':
      // Mostly pass, occasional informational soft policy that still allowed.
      return r < 0.7 ? 'pass' : pick(SOFT_POLICIES);
    case 'REWRITE':
      // The rewrite is usually triggered by a soft policy (e.g. missing
      // fields auto-filled) or a hard policy that we could rewrite around.
      return r < 0.65 ? pick(SOFT_POLICIES) : pick(HARD_POLICIES);
    case 'REQUIRE_APPROVAL':
      // Approval is almost always gated by a hard policy.
      return r < 0.8 ? pick(HARD_POLICIES) : pick(SOFT_POLICIES);
    case 'DENY':
      // Denied actions almost always tripped a hard policy.
      return r < 0.85 ? pick(HARD_POLICIES) : pick(SOFT_POLICIES);
    default:
      return 'pass';
  }
}

// Blast radius distributions per decision. Indexed-pick using cumulative
// weights so the math stays in one place.
const BLAST_WEIGHTS: Record<string, ReadonlyArray<{ value: string; weight: number }>> = {
  ALLOW:            [{ value: 'Low', weight: 70 }, { value: 'Medium', weight: 25 }, { value: 'High', weight: 5  }],
  REWRITE:          [{ value: 'Low', weight: 50 }, { value: 'Medium', weight: 40 }, { value: 'High', weight: 10 }],
  REQUIRE_APPROVAL: [{ value: 'Low', weight: 5  }, { value: 'Medium', weight: 40 }, { value: 'High', weight: 40 }, { value: 'Critical', weight: 15 }],
  DENY:             [{ value: 'Low', weight: 5  }, { value: 'Medium', weight: 20 }, { value: 'High', weight: 35 }, { value: 'Critical', weight: 40 }],
};

function blastRadiusForDecision(decision: string): string {
  const table = BLAST_WEIGHTS[decision] ?? BLAST_WEIGHTS.ALLOW;
  return pickW(table);
}

const APPROVAL_STATUSES = [
  { value: 'pending',  weight: 6 },
  { value: 'approved', weight: 3 },
  { value: 'rejected', weight: 2 },
] as const;

// ── generators ─────────────────────────────────────────────────────────────
const NOW = Date.now();
const ONE_DAY = 24 * 60 * 60 * 1000;

// Generate session IDs first so we can group runs into sessions of varying length.
const SESSION_IDS = Array.from({ length: 14 }, () => uuid());

function makeRun(seq: number): SessionAction {
  const ageDays = rand() ** 1.7 * 14; // bias toward recent
  const timestamp = new Date(NOW - ageDays * ONE_DAY).toISOString();
  const agent = pick(AGENTS);
  const tool = pick(TOOLS);
  const repo = pick(REPOS);
  const branch = pick(BRANCHES);
  const decision = pickW(DECISIONS);
  const sessionId = pick(SESSION_IDS);
  const args =
    tool === 'create_pull_request'
      ? { repo, title: 'Open PR for fix', base: 'main', head: branch }
      : tool === 'create_or_update_file'
      ? { repo, path: 'src/index.ts', branch, message: 'chore: update' }
      : tool === 'search_code'
      ? { q: 'evaluatePolicy', repo }
      : { repo, branch };

  return {
    id: uuid(),
    session_id: sessionId,
    agent_name: agent,
    tool_name: tool,
    arguments: args,
    action_summary: pick(ACTION_PHRASES),
    result: decision,
    decision,
    target_repo: repo,
    target_branch: branch,
    sequence_order: seq,
    timestamp,
    user_id: 'preview-user',
    execution_time: Math.floor(80 + rand() * rand() * 6500),
    // Risk signal — correlated with decision so demo mode shows the same
    // patterns prospects would see in a real workspace. PolicyChip +
    // BlastRadiusChip read these on the Runs / Sessions / Room Logs pages.
    policy: policyForDecision(decision),
    blast_redius: blastRadiusForDecision(decision),
  };
}

// Generate the GitHub-shaped runs first so the PRNG stream (and every
// downstream slice like TOKEN_METER) stays byte-identical to before.
const GENERATED_RUNS: SessionAction[] = Array.from({ length: 96 }, (_, i) => makeRun(i + 1));

// ── multi-connector showcase rows ──────────────────────────────────────────
// The generated runs above are GitHub-shaped (repo + branch). These
// hand-authored rows prove the Runs feed is connector-agnostic: Postgres,
// Terraform, Slack, Linear, Jira and GitHub Actions actions, each carrying
// connector-appropriate `arguments` so `deriveTarget` renders the right
// resource (database + table, workspace + resource, #channel, project +
// issue, repo + workflow). Recent timestamps so they surface at the top of
// the feed during a demo, and a deliberate spread of decisions per connector
// so the redesign shows ALLOW / DENY / REWRITE / REQUIRE_APPROVAL beyond
// GitHub. `target_repo` is the originating (repo-scoped) Room; it is not what
// the Target column shows for non-GitHub connectors.
let mcSeq = 200;
function mc(p: {
  agent_name: string;
  tool_name: string;
  arguments: Record<string, any>;
  action_summary: string;
  decision: string;
  target_repo: string;
  minutesAgo: number;
  target_branch?: string | null;
  policy?: string;
  blast_redius?: string;
}): SessionAction {
  mcSeq += 1;
  return {
    id: uuid(),
    session_id: SESSION_IDS[mcSeq % SESSION_IDS.length],
    agent_name: p.agent_name,
    tool_name: p.tool_name,
    arguments: p.arguments,
    action_summary: p.action_summary,
    result: p.decision,
    decision: p.decision,
    target_repo: p.target_repo,
    target_branch: p.target_branch ?? null,
    sequence_order: mcSeq,
    timestamp: new Date(NOW - p.minutesAgo * 60 * 1000).toISOString(),
    user_id: 'preview-user',
    execution_time: Math.floor(120 + rand() * 900),
    policy: p.policy ?? policyForDecision(p.decision),
    blast_redius: p.blast_redius ?? blastRadiusForDecision(p.decision),
  };
}

const MULTI_CONNECTOR_RUNS: SessionAction[] = [
  // Terraform — destroy the production database. The canonical incident.
  mc({
    agent_name: 'claude-sonnet-4',
    tool_name: 'terraform_destroy',
    arguments: { workspace: 'prod-us-east-1', resource: 'aws_db_instance.primary' },
    action_summary: 'Destroy the primary production database instance',
    decision: 'DENY',
    target_repo: 'runaegis/infra',
    minutesAgo: 6,
    policy: 'IAC_HARD_LOCK',
    blast_redius: 'Critical',
  }),
  // Postgres — DROP TABLE against prod.
  mc({
    agent_name: 'gpt-4o',
    tool_name: 'query',
    arguments: { database: 'aegis_prod', query: 'DROP TABLE users;' },
    action_summary: 'Drop the users table from the production database',
    decision: 'DENY',
    target_repo: 'runaegis/api',
    minutesAgo: 11,
    policy: 'MIGRATION_GATE',
    blast_redius: 'Critical',
  }),
  // GitHub — push straight to main, rewritten to a PR. The moat.
  mc({
    agent_name: 'cursor-agent',
    tool_name: 'push_files',
    arguments: { repo: 'runaegis/api', branch: 'main' },
    action_summary: 'Push three commits straight to the main branch',
    decision: 'REWRITE',
    target_repo: 'runaegis/api',
    target_branch: 'main',
    minutesAgo: 18,
    policy: 'PROTECTED_BRANCH',
    blast_redius: 'Medium',
  }),
  // Slack — message carrying a credential, redacted on the way out.
  mc({
    agent_name: 'claude-sonnet-4',
    tool_name: 'post_message',
    arguments: { channel: '#incidents' },
    action_summary: 'Post the incident dump that included a database URL',
    decision: 'REWRITE',
    target_repo: 'runaegis/api',
    minutesAgo: 27,
    policy: 'SECRET_SCAN',
    blast_redius: 'Medium',
  }),
  // GitHub Actions — dispatch the production deploy workflow during a freeze.
  mc({
    agent_name: 'devin',
    tool_name: 'workflow_dispatch',
    arguments: { repo: 'runaegis/api', workflow: 'deploy-prod.yml' },
    action_summary: 'Trigger the production deploy workflow',
    decision: 'REQUIRE_APPROVAL',
    target_repo: 'runaegis/api',
    target_branch: 'main',
    minutesAgo: 35,
    policy: 'FREEZE_WINDOW',
    blast_redius: 'High',
  }),
  // Postgres — schema migration on prod, rewritten into a reviewed migration.
  mc({
    agent_name: 'cursor-agent',
    tool_name: 'execute_migration',
    arguments: {
      database: 'aegis_prod',
      table: 'audit_log',
      statement: 'ALTER TABLE audit_log ADD COLUMN trace_id text',
    },
    action_summary: 'Run a schema migration against the audit_log table',
    decision: 'REWRITE',
    target_repo: 'runaegis/api',
    minutesAgo: 52,
    policy: 'MIGRATION_GATE',
    blast_redius: 'Medium',
  }),
  // GitHub Actions — write a cloud secret into CI.
  mc({
    agent_name: 'windsurf-cascade',
    tool_name: 'create_workflow_secret',
    arguments: { repo: 'runaegis/api', workflow: 'ci.yml', secret: 'AWS_SECRET_ACCESS_KEY' },
    action_summary: 'Add an AWS secret to the CI workflow',
    decision: 'DENY',
    target_repo: 'runaegis/api',
    minutesAgo: 68,
    policy: 'SECRET_SCAN',
    blast_redius: 'High',
  }),
  // Linear — file a follow-up issue.
  mc({
    agent_name: 'claude-sonnet-4',
    tool_name: 'linear_create_issue',
    arguments: { project: 'ENG', issue: 'ENG-482' },
    action_summary: 'File a follow-up issue for the rate-limit regression',
    decision: 'ALLOW',
    target_repo: 'runaegis/api',
    minutesAgo: 84,
    policy: 'pass',
    blast_redius: 'Low',
  }),
  // Terraform — apply a network change to staging.
  mc({
    agent_name: 'aider',
    tool_name: 'terraform_apply',
    arguments: { workspace: 'staging-us-east-1', resource: 'module.network' },
    action_summary: 'Apply a network module change to the staging workspace',
    decision: 'REQUIRE_APPROVAL',
    target_repo: 'runaegis/infra',
    minutesAgo: 103,
    policy: 'IAC_CHANGE_GATE',
    blast_redius: 'High',
  }),
  // Postgres — read-only analytics query.
  mc({
    agent_name: 'gpt-4o',
    tool_name: 'query',
    arguments: { database: 'analytics', query: 'SELECT count(*) FROM events WHERE day = current_date' },
    action_summary: 'Count event volume for the daily metrics rollup',
    decision: 'ALLOW',
    target_repo: 'runaegis/api',
    minutesAgo: 126,
    policy: 'pass',
    blast_redius: 'Low',
  }),
  // Slack — routine release note.
  mc({
    agent_name: 'replit-agent',
    tool_name: 'send_message',
    arguments: { channel: 'eng-releases' },
    action_summary: 'Post the release notes to the engineering channel',
    decision: 'ALLOW',
    target_repo: 'runaegis/api',
    minutesAgo: 152,
    policy: 'pass',
    blast_redius: 'Low',
  }),
  // Jira — open an ops ticket.
  mc({
    agent_name: 'devin',
    tool_name: 'jira_create_issue',
    arguments: { project: 'OPS', issue: 'OPS-211' },
    action_summary: 'Open an ops ticket for the failed nightly deploy',
    decision: 'ALLOW',
    target_repo: 'runaegis/infra',
    minutesAgo: 181,
    policy: 'pass',
    blast_redius: 'Low',
  }),
];

const RUNS: SessionAction[] = [...MULTI_CONNECTOR_RUNS, ...GENERATED_RUNS].sort(
  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
);

// Aggregate sessions from runs
function aggregateSessions(runs: SessionAction[]): Session[] {
  const map = new Map<string, Session>();
  for (const r of runs) {
    const sid = r.session_id;
    if (!map.has(sid)) {
      map.set(sid, {
        session_id: sid,
        agent_name: r.agent_name,
        user_id: 'preview-user',
        action_count: 0,
        started_at: r.timestamp,
        last_action_at: r.timestamp,
        repos: [],
        allows: 0,
        denies: 0,
        rewrites: 0,
        approvals: 0,
      });
    }
    const s = map.get(sid)!;
    s.action_count = Number(s.action_count) + 1;
    if (r.timestamp < s.started_at!) s.started_at = r.timestamp;
    if (r.timestamp > s.last_action_at!) s.last_action_at = r.timestamp;
    if (r.target_repo && !(s.repos as string[]).includes(r.target_repo)) {
      (s.repos as string[]).push(r.target_repo);
    }
    const d = r.decision?.toUpperCase() || '';
    if (d === 'ALLOW') s.allows = Number(s.allows) + 1;
    else if (d === 'DENY') s.denies = Number(s.denies) + 1;
    else if (d === 'REWRITE') s.rewrites = Number(s.rewrites) + 1;
    if (d.includes('APPROVAL')) s.approvals = Number(s.approvals) + 1;
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.last_action_at!).getTime() - new Date(a.last_action_at!).getTime(),
  );
}

// Approvals
//
// A few non-GitHub pending approvals so the approvals queue + detail panel
// demonstrate the connector-aware Connector / Target cells (Terraform,
// GitHub Actions, Postgres), not just GitHub repo + branch. Recent
// timestamps so they sort to the top of the pending list.
const MULTI_CONNECTOR_APPROVALS: MCPApproval[] = [
  {
    id: `apv_tf_${uuid()}`,
    user_id: 'preview-user',
    tool_name: 'terraform_apply',
    arguments: { workspace: 'staging-us-east-1', resource: 'module.network' },
    status: 'pending',
    created_at: new Date(NOW - 12 * 60 * 1000).toISOString(),
    approved_at: null,
    result: null,
    context: { user: 'aider', conversation_id: `conv_${uuid().slice(0, 6)}`, model: 'aider' },
    action_summary: 'Apply a network module change to the staging workspace',
  },
  {
    id: `apv_gha_${uuid()}`,
    user_id: 'preview-user',
    tool_name: 'workflow_dispatch',
    arguments: { repo: 'runaegis/api', workflow: 'deploy-prod.yml' },
    status: 'pending',
    created_at: new Date(NOW - 26 * 60 * 1000).toISOString(),
    approved_at: null,
    result: null,
    context: { user: 'devin', conversation_id: `conv_${uuid().slice(0, 6)}`, model: 'devin' },
    action_summary: 'Trigger the production deploy workflow',
  },
  {
    id: `apv_pg_${uuid()}`,
    user_id: 'preview-user',
    tool_name: 'execute_migration',
    arguments: {
      database: 'aegis_prod',
      table: 'audit_log',
      statement: 'ALTER TABLE audit_log ADD COLUMN trace_id text',
    },
    status: 'pending',
    created_at: new Date(NOW - 44 * 60 * 1000).toISOString(),
    approved_at: null,
    result: null,
    context: { user: 'cursor-agent', conversation_id: `conv_${uuid().slice(0, 6)}`, model: 'cursor-agent' },
    action_summary: 'Run a schema migration against the audit_log table',
  },
];

const APPROVALS: MCPApproval[] = [
  ...MULTI_CONNECTOR_APPROVALS,
  ...Array.from({ length: 11 }, (_, i) => {
  const status = pickW(APPROVAL_STATUSES);
  const ageHours = rand() * 72;
  const created_at = new Date(NOW - ageHours * 60 * 60 * 1000).toISOString();
  const approved_at =
    status === 'pending'
      ? null
      : new Date(NOW - ageHours * 60 * 60 * 1000 + rand() * 60 * 60 * 1000).toISOString();
  const agent = pick(AGENTS);
  const repo = pick(REPOS);
  const branch = pick(BRANCHES);
  const tool = pick(TOOLS);
  return {
    id: `apv_${i}_${uuid()}`,
    user_id: 'preview-user',
    tool_name: tool,
    arguments: { repo, branch, base: 'main', title: pick(ACTION_PHRASES) },
    status,
    created_at,
    approved_at,
    result: null,
    context: { user: agent, conversation_id: `conv_${uuid().slice(0, 6)}`, model: agent },
    action_summary: pick(ACTION_PHRASES),
  };
  }),
].sort(
  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
);

function cloneApproval(approval: MCPApproval): MCPApproval {
  return {
    ...approval,
    arguments:
      approval.arguments && typeof approval.arguments === 'object'
        ? { ...approval.arguments }
        : approval.arguments,
    context:
      approval.context && typeof approval.context === 'object'
        ? { ...approval.context }
        : approval.context,
    action_pointers: Array.isArray(approval.action_pointers)
      ? [...approval.action_pointers]
      : approval.action_pointers,
    result: Array.isArray(approval.result)
      ? approval.result.map((entry) =>
          entry && typeof entry === 'object' ? { ...entry } : entry,
        )
      : approval.result,
  };
}

// Repos
const FULL_REPO_NAMES = [
  'aegis/dashboard',
  'aegis/mcp-server',
  'aegis/marketing',
  'aegis/cli',
  'aegis/policies',
  'aegis/sdk-js',
  'aegis/sdk-python',
  'runaegis/api',
  'runaegis/integrations',
  'runaegis/website',
  'jenilparmar/playground',
  'jenilparmar/snippets',
];

const PREVIEW_REPOS: Repo[] = FULL_REPO_NAMES.map((name, i) => ({
  repo_id: `repo_${i}`,
  github_repo_id: 100000 + i,
  full_name: name,
  name,
  is_private: i % 3 === 0,
  can_read: i < 8,                 // first 8 readable
  can_write: i < 5 && i % 2 === 0, // sparse write
  granted_at: new Date(NOW - i * ONE_DAY).toISOString(),
}));

// Token meter usage — one record per run-ish
const TOKEN_METER: TokenMeterResponse[] = RUNS.slice(0, 60).map((r, i) => ({
  id: `tm_${i}`,
  action_id: r.id,
  user_id: 'preview-user',
  input_token: Math.floor(200 + rand() * 4500),
  output_token: Math.floor(100 + rand() * 2500),
  session_id: r.session_id,
  tool_name: r.tool_name,
  timestamp: r.timestamp,
  created_at: r.timestamp,
}));

const CORE_TOKEN_CATEGORIES = ['github', 'postgres', 'mongodb', 'linear', 'terraform', 'jira'];

function previewTokenCategory(toolName: string): string {
  const tool = toolName.trim().toLowerCase();
  if (!tool) return 'meta';
  if (/memory/.test(tool)) return 'memory';
  if (/postgres|psql|sql|query|migration|schema|table/.test(tool)) return 'postgres';
  if (/mongo/.test(tool)) return 'mongodb';
  if (/linear/.test(tool)) return 'linear';
  if (/terraform|(^|_)tf(_|$)/.test(tool)) return 'terraform';
  if (/jira/.test(tool)) return 'jira';
  if (/meta|aegis|policy/.test(tool)) return 'meta';
  return 'github';
}

function matchesPreviewTokenRange(
  row: TokenMeterResponse,
  dateRange: TokenAnalyticsDateRange,
  startDate?: string,
  endDate?: string,
): boolean {
  if (dateRange === 'all') return true;

  const source = row.timestamp ?? row.created_at;
  if (!source) return false;

  const value = new Date(source).getTime();
  if (!Number.isFinite(value)) return false;

  if (dateRange === 'custom') {
    const start = startDate ? new Date(startDate).getTime() : NaN;
    const end = endDate ? new Date(endDate).getTime() : NaN;
    if (Number.isFinite(start) && value < start) return false;
    if (Number.isFinite(end) && value > end) return false;
    return true;
  }

  const now = new Date(NOW);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (dateRange === 'today') {
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return value >= start.getTime() && value <= end.getTime();
  }

  const span = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30;
  start.setDate(start.getDate() - (span - 1));
  return value >= start.getTime() && value <= now.getTime();
}

function buildPreviewTokenAnalytics(
  userId = 'preview-user',
  filters: {
    date_range?: TokenAnalyticsDateRange;
    start_date?: string;
    end_date?: string;
  } = {},
): TokenAnalyticsResponse {
  const dateRange = filters.date_range ?? '30d';
  const categoryMap = new Map<string, TokenAnalyticsResponse['category_chart'][number]>();
  const toolMap = new Map<string, TokenAnalyticsResponse['tool_chart'][number]>();

  for (const category of CORE_TOKEN_CATEGORIES) {
    categoryMap.set(category, {
      name: category,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      tool_call_count: 0,
    });
  }

  const rows = TOKEN_METER.filter((row) => {
    const toolName = row.tool_name?.trim();
    return (
      !!toolName &&
      matchesPreviewTokenRange(row, dateRange, filters.start_date, filters.end_date)
    );
  });

  for (const row of rows) {
    const toolName = row.tool_name?.trim() ?? 'unknown';
    const category = previewTokenCategory(toolName);
    const input = row.input_token;
    const output = row.output_token;

    const update = (item: TokenAnalyticsResponse['tool_chart'][number]) => {
      item.input_tokens += input;
      item.output_tokens += output;
      item.total_tokens += input + output;
      item.tool_call_count += 1;
    };

    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        name: category,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        tool_call_count: 0,
      });
    }
    update(categoryMap.get(category)!);

    if (!toolMap.has(toolName)) {
      toolMap.set(toolName, {
        name: toolName,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        tool_call_count: 0,
      });
    }
    update(toolMap.get(toolName)!);
  }

  const summary = Array.from(toolMap.values()).reduce(
    (acc, item) => ({
      input_tokens: acc.input_tokens + item.input_tokens,
      output_tokens: acc.output_tokens + item.output_tokens,
      total_tokens: acc.total_tokens + item.total_tokens,
      tool_call_count: acc.tool_call_count + item.tool_call_count,
    }),
    { input_tokens: 0, output_tokens: 0, total_tokens: 0, tool_call_count: 0 },
  );

  return {
    user_id: userId,
    date_range: dateRange,
    start_date: filters.start_date ?? null,
    end_date: filters.end_date ?? null,
    allocation: 'both',
    summary,
    category_chart: Array.from(categoryMap.values()),
    tool_chart: Array.from(toolMap.values()).sort((a, b) => b.total_tokens - a.total_tokens),
  };
}

function buildPreviewTokenUsageSessions(
  filters: {
    date_range?: TokenAnalyticsDateRange;
    start_date?: string;
    end_date?: string;
    limit?: number;
  } = {},
): TokenUsageSessionItem[] {
  const dateRange = filters.date_range ?? '30d';
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 500);
  const map = new Map<string, TokenUsageSessionItem>();

  const rows = TOKEN_METER.filter((row) => {
    const toolName = row.tool_name?.trim();
    return (
      !!toolName &&
      matchesPreviewTokenRange(row, dateRange, filters.start_date, filters.end_date)
    );
  });

  for (const row of rows) {
    const sessionId = row.session_id || 'unknown';
    const timestamp = row.timestamp ?? row.created_at ?? null;
    if (!map.has(sessionId)) {
      map.set(sessionId, {
        session_id: sessionId,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        tool_call_count: 0,
        first_seen_at: timestamp,
        last_seen_at: timestamp,
      });
    }

    const item = map.get(sessionId)!;
    item.input_tokens += row.input_token;
    item.output_tokens += row.output_token;
    item.total_tokens += row.input_token + row.output_token;
    item.tool_call_count += 1;

    if (timestamp) {
      if (!item.first_seen_at || new Date(timestamp).getTime() < new Date(item.first_seen_at).getTime()) {
        item.first_seen_at = timestamp;
      }
      if (!item.last_seen_at || new Date(timestamp).getTime() > new Date(item.last_seen_at).getTime()) {
        item.last_seen_at = timestamp;
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
      const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, limit);
}

// Rooms
const PREVIEW_ROOMS: RoomSummary[] = [
  { id: 'room_dash',  room_id: 'room_dash',  repo_name: 'aegis/dashboard',  owner_username: 'preview-user', created_at: new Date(NOW - 12 * ONE_DAY).toISOString() },
  { id: 'room_mcp',   room_id: 'room_mcp',   repo_name: 'aegis/mcp-server', owner_username: 'preview-user', created_at: new Date(NOW - 30 * ONE_DAY).toISOString() },
  { id: 'room_api',   room_id: 'room_api',   repo_name: 'runaegis/api',     owner_username: 'preview-user', created_at: new Date(NOW -  5 * ONE_DAY).toISOString() },
];

const PREVIEW_ROOM_DETAILS: Record<string, RoomDetails> = Object.fromEntries(
  PREVIEW_ROOMS.map((r) => [r.room_id!, { ...r }]),
);

const PREVIEW_MEMBERS: Record<string, RoomMember[]> = {
  room_dash: [
    { id: 'm1', user_id: 'preview-user', username: 'demo',  role: 'OWNER',     joined_at: new Date(NOW - 12 * ONE_DAY).toISOString() },
    { id: 'm2', user_id: 'u_kai',        username: 'kai',      role: 'DEVELOPER', joined_at: new Date(NOW - 10 * ONE_DAY).toISOString() },
    { id: 'm3', user_id: 'u_sora',       username: 'sora',     role: 'REVIEWER',  joined_at: new Date(NOW -  9 * ONE_DAY).toISOString() },
    { id: 'm4', user_id: 'u_lin',        username: 'lin',      role: 'VIEWER',    joined_at: new Date(NOW -  6 * ONE_DAY).toISOString() },
  ],
  room_mcp: [
    { id: 'm5', user_id: 'preview-user', username: 'demo',  role: 'OWNER',     joined_at: new Date(NOW - 30 * ONE_DAY).toISOString() },
    { id: 'm6', user_id: 'u_amir',       username: 'amir',     role: 'DEVELOPER', joined_at: new Date(NOW - 28 * ONE_DAY).toISOString() },
  ],
  room_api: [
    { id: 'm7', user_id: 'preview-user', username: 'demo',  role: 'OWNER',     joined_at: new Date(NOW - 5 * ONE_DAY).toISOString() },
  ],
};

const PREVIEW_INVITES: Record<string, RoomInvite[]> = {
  room_dash: [
    { id: 'inv1', invite_code: 'aeg-dash-fern',  room_id: 'room_dash', created_by: 'preview-user', max_uses: 5,    used_count: 2, expires_at: new Date(NOW + 7 * ONE_DAY).toISOString(),  created_at: new Date(NOW - 2 * ONE_DAY).toISOString() },
    { id: 'inv2', invite_code: 'aeg-dash-moss',  room_id: 'room_dash', created_by: 'preview-user', max_uses: null, used_count: 0, expires_at: null,                                       created_at: new Date(NOW - 1 * ONE_DAY).toISOString() },
  ],
  room_mcp: [
    { id: 'inv3', invite_code: 'aeg-mcp-ridge',  room_id: 'room_mcp',  created_by: 'preview-user', max_uses: 10,   used_count: 1, expires_at: new Date(NOW + 14 * ONE_DAY).toISOString(), created_at: new Date(NOW - 6 * ONE_DAY).toISOString() },
  ],
  room_api: [],
};

// ── Per-room activity (audit log used by the room's Activity tab) ─────────
//
// Each entry is a RoomSessionAction — the same shape as a SessionAction
// but with `room_id` + `username` resolved server-side. We pin the repo
// to the room's repo so it's coherent (a row in `room_dash` always says
// "aegis/dashboard", not a random repo) and pick the user from the room's
// member list so usernames are believable for the team that lives there.
//
// Volume is tuned per room so the demo feels lived-in:
//   room_dash (busiest, 4 members) → ~50 actions
//   room_mcp  (medium, 2 members)  → ~24 actions
//   room_api  (newest, 1 member)   → ~9 actions

function makeRoomAction(
  roomId: string,
  repo: string,
  members: RoomMember[],
  seq: number,
): RoomSessionAction {
  // Re-pick the underlying randoms so each room action gets its own
  // random tool/decision/timing rather than inheriting from RUNS.
  const ageDays = rand() ** 1.6 * 14;
  const timestamp = new Date(NOW - ageDays * ONE_DAY).toISOString();
  const agent = pick(AGENTS);
  const tool = pick(TOOLS);
  const branch = pick(BRANCHES);
  const decision = pickW(DECISIONS);
  const sessionId = pick(SESSION_IDS);
  const member = pick(members);

  const args =
    tool === 'create_pull_request'
      ? { repo, title: 'Open PR for fix', base: 'main', head: branch }
      : tool === 'create_or_update_file'
      ? { repo, path: 'src/index.ts', branch, message: 'chore: update' }
      : tool === 'search_code'
      ? { q: 'evaluatePolicy', repo }
      : { repo, branch };

  return {
    id: uuid(),
    session_id: sessionId,
    agent_name: agent,
    tool_name: tool,
    arguments: args,
    action_summary: pick(ACTION_PHRASES),
    result: decision,
    decision,
    target_repo: repo,
    target_branch: branch,
    sequence_order: seq,
    timestamp,
    user_id: member.user_id ?? member.username ?? 'preview-user',
    execution_time: Math.floor(80 + rand() * rand() * 6500),
    policy: policyForDecision(decision),
    blast_redius: blastRadiusForDecision(decision),
    room_id: roomId,
    username: member.username,
  };
}

// A few non-GitHub actions for room_api (runaegis/api) so a Room's activity
// also shows the connector-aware Target column (Postgres, Slack), not only
// GitHub branches. An agent scoped to a repo's Room still touches that
// service's database, channels, etc. Pinned recent so they head the list.
const ROOM_API_MULTI_CONNECTOR: RoomSessionAction[] = [
  {
    id: uuid(),
    session_id: SESSION_IDS[0],
    agent_name: 'gpt-4o',
    tool_name: 'query',
    arguments: { database: 'aegis_prod', query: 'DROP TABLE users;' },
    action_summary: 'Drop the users table from the production database',
    result: 'DENY',
    decision: 'DENY',
    target_repo: 'runaegis/api',
    target_branch: null,
    sequence_order: 101,
    timestamp: new Date(NOW - 9 * 60 * 1000).toISOString(),
    user_id: 'preview-user',
    execution_time: 95,
    policy: 'MIGRATION_GATE',
    blast_redius: 'Critical',
    room_id: 'room_api',
    username: 'demo',
  },
  {
    id: uuid(),
    session_id: SESSION_IDS[1],
    agent_name: 'cursor-agent',
    tool_name: 'execute_migration',
    arguments: {
      database: 'aegis_prod',
      table: 'audit_log',
      statement: 'ALTER TABLE audit_log ADD COLUMN trace_id text',
    },
    action_summary: 'Run a schema migration against the audit_log table',
    result: 'REWRITE',
    decision: 'REWRITE',
    target_repo: 'runaegis/api',
    target_branch: null,
    sequence_order: 102,
    timestamp: new Date(NOW - 21 * 60 * 1000).toISOString(),
    user_id: 'preview-user',
    execution_time: 420,
    policy: 'MIGRATION_GATE',
    blast_redius: 'Medium',
    room_id: 'room_api',
    username: 'demo',
  },
  {
    id: uuid(),
    session_id: SESSION_IDS[2],
    agent_name: 'claude-sonnet-4',
    tool_name: 'post_message',
    arguments: { channel: '#incidents' },
    action_summary: 'Post the incident dump that included a database URL',
    result: 'REWRITE',
    decision: 'REWRITE',
    target_repo: 'runaegis/api',
    target_branch: null,
    sequence_order: 103,
    timestamp: new Date(NOW - 38 * 60 * 1000).toISOString(),
    user_id: 'preview-user',
    execution_time: 180,
    policy: 'SECRET_SCAN',
    blast_redius: 'Medium',
    room_id: 'room_api',
    username: 'demo',
  },
];

// Build all rooms' activity once at module init so re-renders are stable.
const PREVIEW_ROOM_ACTIONS: Record<string, RoomSessionAction[]> = (() => {
  const out: Record<string, RoomSessionAction[]> = {};
  // Volume tuned per room — busier rooms get richer logs.
  const VOLUMES: Record<string, number> = {
    room_dash: 50,
    room_mcp: 24,
    room_api: 9,
  };
  for (const room of PREVIEW_ROOMS) {
    const id = room.room_id!;
    const repo = room.repo_name;
    const members = PREVIEW_MEMBERS[id] ?? [];
    const count = VOLUMES[id] ?? 12;
    const actions = Array.from({ length: count }, (_, i) =>
      makeRoomAction(id, repo, members, i + 1),
    ).sort(
      // Newest first — matches the order the table renders by default.
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    out[id] =
      id === 'room_api' ? [...ROOM_API_MULTI_CONNECTOR, ...actions] : actions;
  }
  return out;
})();

// Default tool policy per role — mostly true, a few false to add nuance.
const PREVIEW_ROOM_TOOLS: Record<string, Record<string, boolean>> = {
  DEVELOPER: Object.fromEntries(TOOLS.map((t) => [t, !t.includes('search_issues')])),
  REVIEWER:  Object.fromEntries(TOOLS.map((t) => [t, !['push_files', 'create_or_update_file', 'create_branch'].includes(t)])),
  VIEWER:    Object.fromEntries(TOOLS.map((t) => [t, t.startsWith('get_') || t.startsWith('list_') || t.startsWith('search_')])),
  OWNER:     Object.fromEntries(TOOLS.map((t) => [t, true])),
};

// Freeze windows
const PREVIEW_FREEZE_WINDOWS = [
  {
    id: 'fw_1',
    user_id: 'preview-user',
    timezone: 'America/New_York',
    work_days: [0, 1, 2, 3, 4],
    window_start: '17:00:00',
    window_end: '23:59:00',
    created_at: new Date(NOW - 20 * ONE_DAY).toISOString(),
  },
  {
    id: 'fw_2',
    user_id: 'preview-user',
    timezone: 'Asia/Kolkata',
    work_days: [5, 6],
    window_start: '00:00:00',
    window_end: '23:59:00',
    created_at: new Date(NOW - 5 * ONE_DAY).toISOString(),
  },
];

// Memories — seeded to exercise every derived oversight signal: one
// possible secret (credential-shaped text), two stale (untouched > 45d),
// and a duplicate-title pair. The rest are clean and recent.
//
// owner user_id stays 'preview-user' to match the other preview fixtures.
// It intentionally differs from the demo session user (DEMO_USER, id
// 'demo-user'): the getMemories mock ignores the requesting id and returns
// this whole set, same as every other preview endpoint.
const PREVIEW_MEMORIES: Memory[] = [
  {
    id: 'mem_creds',
    user_id: 'preview-user',
    title: 'Deploy service credentials',
    memory:
      'Prod deployer authenticates with AWS key AKIAIOSFODNN7EXAMPLE and connects to the database at postgresql://deployer:changeme-placeholder@prod-db.internal:5432/main. Rotate on the quarterly cadence.',
    created_at: new Date(NOW - 38 * ONE_DAY).toISOString(),
    updated_at: new Date(NOW - 6 * ONE_DAY).toISOString(),
  },
  {
    id: 'mem_rollback',
    user_id: 'preview-user',
    title: 'Release rollback procedure',
    memory:
      'To roll back a bad release, revert the deploy workflow to the previous green tag and re-run the migration checker. Never force-push to main; open an Aegis rollback PR instead.',
    created_at: new Date(NOW - 22 * ONE_DAY).toISOString(),
    updated_at: new Date(NOW - 3 * ONE_DAY).toISOString(),
  },
  {
    id: 'mem_branch',
    user_id: 'preview-user',
    title: 'Branch naming convention',
    memory:
      'Feature branches use feature/<ticket>-<slug>. Hotfixes use hotfix/<slug>. The default branch main is protected; direct writes are rewritten into a PR on an Aegis-managed branch.',
    created_at: new Date(NOW - 16 * ONE_DAY).toISOString(),
    updated_at: new Date(NOW - 1 * ONE_DAY).toISOString(),
  },
  {
    id: 'mem_style',
    user_id: 'preview-user',
    title: 'Team code style preferences',
    memory:
      'TypeScript strict mode everywhere. Prefer named exports. No default-exported React components except pages. Run the formatter before every commit.',
    created_at: new Date(NOW - 12 * ONE_DAY).toISOString(),
    updated_at: new Date(NOW - 5 * ONE_DAY).toISOString(),
  },
  {
    id: 'mem_checklist_a',
    user_id: 'preview-user',
    title: 'Deploy checklist',
    memory:
      'Confirm CI is green, migrations are reversible, and the on-call engineer is aware before triggering a production deploy.',
    created_at: new Date(NOW - 30 * ONE_DAY).toISOString(),
    updated_at: new Date(NOW - 2 * ONE_DAY).toISOString(),
  },
  {
    id: 'mem_checklist_b',
    user_id: 'preview-user',
    title: 'Deploy checklist',
    memory:
      'Older copy: verify the staging smoke test passes and the changelog is updated before shipping.',
    created_at: new Date(NOW - 26 * ONE_DAY).toISOString(),
    updated_at: new Date(NOW - 21 * ONE_DAY).toISOString(),
  },
  {
    id: 'mem_incident',
    user_id: 'preview-user',
    title: 'Prod incident retro',
    memory:
      'The May outage was caused by an unbounded query against the events table. Add a statement timeout and an index on created_at. Owner: platform team.',
    created_at: new Date(NOW - 64 * ONE_DAY).toISOString(),
    updated_at: new Date(NOW - 58 * ONE_DAY).toISOString(),
  },
  {
    id: 'mem_migration',
    user_id: 'preview-user',
    title: 'Old migration notes',
    memory:
      'Legacy notes from the initial Postgres setup. Superseded by the current schema docs; kept for reference only.',
    created_at: new Date(NOW - 55 * ONE_DAY).toISOString(),
    updated_at: new Date(NOW - 50 * ONE_DAY).toISOString(),
  },
];

// Computed metrics
function computeMetrics(runs: SessionAction[]): Metrics {
  return {
    total: runs.length,
    allows:    runs.filter((r) => r.decision === 'ALLOW').length,
    denies:    runs.filter((r) => r.decision === 'DENY').length,
    rewrites:  runs.filter((r) => r.decision === 'REWRITE').length,
    approvals: runs.filter((r) => r.decision === 'REQUIRE_APPROVAL').length,
  };
}

function filterRunsByDate(filters: ActionDateFilters = {}): SessionAction[] {
  return RUNS.filter((run) => matchesActionDateFilters(run.timestamp, filters));
}

function filterAuditRuns(
  filters: {
    startDate?: string;
    endDate?: string;
    agents?: string[];
    decisions?: string[];
    repositories?: string[];
    tools?: string[];
  } = {},
): SessionAction[] {
  return filterRunsByDate({
    startDate: filters.startDate,
    endDate: filters.endDate,
  }).filter((run) => {
    if (filters.agents?.length && !filters.agents.includes(run.agent_name)) {
      return false;
    }
    if (filters.decisions?.length && !filters.decisions.includes(run.decision)) {
      return false;
    }
    if (
      filters.repositories?.length &&
      !filters.repositories.includes(run.target_repo ?? '')
    ) {
      return false;
    }
    if (filters.tools?.length && !filters.tools.includes(run.tool_name)) {
      return false;
    }
    return true;
  });
}

// ── install ────────────────────────────────────────────────────────────────
let installed = false;

export function installPreviewApi() {
  if (installed) return;
  installed = true;

  api.healthCheck = async () => ({ ok: true, mode: 'preview' });

  // Sign-out — real impl swallows network errors but still pings the
  // backend. In preview we skip that ping entirely and just clear the
  // local user cache, matching the real cleanup behavior. The
  // Sidebar / UserMenu / Settings sign-out flows continue to redirect
  // to /auth after this resolves.
  api.logOut = async () => {
    try {
      localStorage.removeItem('aegis_user');
      localStorage.removeItem('aegis_onboarding_step');
    } catch {
      // ignore — localStorage may be unavailable in embedded contexts
    }
  };

  api.getRuns           = async (_userId, filters = {}) => filterRunsByDate(filters);
  api.getSessions       = async (_userId, filters = {}) => aggregateSessions(filterRunsByDate(filters));
  api.getMetrics        = async (_userId, filters = {}) => computeMetrics(filterRunsByDate(filters));

  // Paginated variants — these are what `DashboardDataProvider` calls
  // on mount for every dashboard route. Without these mocks, the
  // provider's `sessionActions` stays empty across navigations and
  // every page downstream (/runs, /sessions, /audit, etc.) renders
  // empty even though preview mode is on. The Dashboard home page is
  // the one exception because it reads from `api.getRuns` directly,
  // bypassing the paginated context — that's why ONLY Dashboard
  // appeared populated before this fix.
  api.getSessionActionsPage = async (_userId, page = 1, page_size = 20, filters = {}) => {
    const filteredRuns = filterRunsByDate(filters);
    const start = (page - 1) * page_size;
    const items = filteredRuns.slice(start, start + page_size);
    return {
      items,
      total: filteredRuns.length,
      page,
      page_size,
      pages: Math.max(1, Math.ceil(filteredRuns.length / page_size)),
    };
  };

  // Aggregated sessions — same paginated shape but with the session-level
  // aggregate plus the constituent runs inlined (`sessions` array). The
  // Sessions page renders the parent row from the aggregate and the
  // expanded child rows from `sessions[]`.
  api.getAggregatedSessions = async (_userId, page = 1, page_size = 20, filters = {}) => {
    const filteredRuns = filterRunsByDate(filters);
    const filteredSessions = aggregateSessions(filteredRuns);
    const aggregated: AggregatedSessionAction[] = filteredSessions.map((s) => {
      const sessionRuns = filteredRuns.filter((r) => r.session_id === s.session_id);
      const execTimes = sessionRuns.map((r) => r.execution_time ?? 0);
      const tools = Array.from(new Set(sessionRuns.map((r) => r.tool_name)));
      return {
        session_id: s.session_id,
        user_id: 'preview-user',
        action_count: sessionRuns.length,
        started_at: s.started_at ?? sessionRuns[sessionRuns.length - 1]?.timestamp ?? new Date().toISOString(),
        ended_at: s.last_action_at ?? sessionRuns[0]?.timestamp ?? new Date().toISOString(),
        total_execution_time: execTimes.reduce((a, b) => a + b, 0),
        tools_used: tools,
        sessions: sessionRuns,
      };
    });
    const start = (page - 1) * page_size;
    const items = aggregated.slice(start, start + page_size);
    return {
      items,
      total: aggregated.length,
      page,
      page_size,
      pages: Math.max(1, Math.ceil(aggregated.length / page_size)),
    };
  };
  api.getSessionActions = async (sessionId: string) =>
    RUNS.filter((r) => r.session_id === sessionId).sort(
      (a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0),
    );
  api.getApprovals      = async () => RUNS.filter((r) => r.decision.includes('APPROVAL'));
  api.getMcpApprovals   = async () => APPROVALS.map(cloneApproval);
  api.executeMcpApproval = async (id: string, reject: boolean) => {
    const a = APPROVALS.find((x) => x.id === id);
    if (a) {
      a.status = reject ? 'denied' : 'executed';
      a.approved_at = new Date().toISOString();
    }
    return { success: true };
  };
  api.getAuditTrail = async (_uid?: string, limit = 50, offset = 0) =>
    RUNS.slice(offset, offset + limit);
  api.getAuditTrailByDateRange = async (
    _uid: string,
    startDate: string,
    endDate: string,
  ) => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return RUNS.filter((r) => {
      const t = new Date(r.timestamp).getTime();
      return t >= start && t <= end;
    });
  };
  api.getAuditSessionsPage = async (filters = {}) => {
    const page = filters.page ?? 1;
    const page_size = filters.page_size ?? 20;
    const items = filterAuditRuns(filters);
    const start = (page - 1) * page_size;
    return {
      items: items.slice(start, start + page_size),
      total: items.length,
      page,
      page_size,
      pages: Math.max(1, Math.ceil(items.length / page_size)),
    };
  };
  api.getRecentActionCount = async () => [{ count: RUNS.slice(0, 3).length }];

  api.getUserTokenUsage = async () => ({
    items: TOKEN_METER,
    total: TOKEN_METER.length,
    page: 1,
    page_size: TOKEN_METER.length,
    pages: 1,
  });

  api.getUserTokenUsageAll = async () => [...TOKEN_METER];

  api.getTokenUsageAnalytics = async (userId, filters = {}) =>
    buildPreviewTokenAnalytics(userId, filters);

  api.getTokenUsageSessions = async (_userId, filters = {}) =>
    buildPreviewTokenUsageSessions(filters);

  api.getRepos = async () => ({ repos: PREVIEW_REPOS });
  api.getSlackBotStatus = async () => ({ connected: false });
  api.disconnectSlackBot = async () => ({
    success: true,
    message: "Slack disconnected successfully",
  });
  api.syncRepos = async () => ({ success: true, synced: PREVIEW_REPOS.length });
  api.setPermission = async () => ({ success: true });
  api.setPermissions = async () => ({ success: true });

  api.getUserPolicy = async () => '111111110111'; // 11 of 12 armed (secret_detection off); new connector policies armed
  api.upsertUserPolicy = async () => undefined;

  api.getMyRooms = async () => PREVIEW_ROOMS;
  api.getRoomDetails = async (roomId: string) =>
    PREVIEW_ROOM_DETAILS[roomId] ?? PREVIEW_ROOMS[0];
  api.getRoomMembers = async (roomId: string) => PREVIEW_MEMBERS[roomId] ?? [];
  api.getRoomInvites = async (roomId: string) => PREVIEW_INVITES[roomId] ?? [];
  // Activity tab inside a room. Returns paginated `RoomSessionAction[]`
  // pinned to that room — same shape as the real endpoint
  // `GET /sessions_by_room_id/{room_id}` Jenil shipped.
  api.getSessionsByRoomId = async (
    roomId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedResponse<RoomSessionAction>> => {
    const all = PREVIEW_ROOM_ACTIONS[roomId] ?? [];
    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), pages);
    const start = (safePage - 1) * pageSize;
    const items = all.slice(start, start + pageSize);
    return { items, total, page: safePage, page_size: pageSize, pages };
  };
  api.getRoomTools = async (_roomId: string, role: string) =>
    PREVIEW_ROOM_TOOLS[role] ?? PREVIEW_ROOM_TOOLS.DEVELOPER;
  api.updateRoomTools = async () => ({ success: true });
  // Room MCP integration URL — rendered into the copyable Integration
  // field on the rooms page. Without this mock the Promise.all on
  // /dashboard/rooms rejects and the whole detail panel goes empty.
  // Format mirrors the real shape: a stable per-room slug + opaque token.
  api.getRoomIntegrationConfig = async (roomId: string) => {
    const details = PREVIEW_ROOM_DETAILS[roomId] ?? PREVIEW_ROOMS[0];
    return {
      ...details,
      url: `https://mcp.runaegis.co/r/${roomId}/aeg_${roomId.replace('room_', '')}_preview_token`,
    };
  };
  // Create a room AND seed it correctly into the in-memory mock store
  // so the user-just-created flow works end-to-end:
  //   • getMyRooms() returns the new room (so the RoomSwitcher + index
  //     show it immediately)
  //   • getRoomDetails(newId) returns the right repo (not PREVIEW_ROOMS[0]
  //     fallback)
  //   • getRoomMembers(newId) returns the creator as OWNER (so the demo
  //     user shows as OWNER in the room header, NOT the DEVELOPER fallback
  //     RoomContext was resolving to)
  //   • role: 'OWNER' on the returned summary so RoomContext picks it up
  //     immediately without a refetch race
  // Net effect: creating a new room surfaces all OWNER-only affordances
  // (Generate invite, etc.) the same way the seeded demo rooms do.
  api.createRoom = async (repoId: string) => {
    const newId = `room_${Date.now()}`;
    const createdAt = new Date().toISOString();
    const newRoom: RoomSummary = {
      id: newId,
      room_id: newId,
      repo_name: repoId,
      owner_username: 'demo',
      role: 'OWNER',
      created_at: createdAt,
    };
    PREVIEW_ROOMS.push(newRoom);
    PREVIEW_ROOM_DETAILS[newId] = { ...newRoom };
    PREVIEW_MEMBERS[newId] = [
      {
        id: `m_${Date.now()}`,
        user_id: 'preview-user',
        username: 'demo',
        role: 'OWNER',
        joined_at: createdAt,
      },
    ];
    PREVIEW_INVITES[newId] = [];
    PREVIEW_ROOM_ACTIONS[newId] = [];
    return newRoom;
  };
  // Create an invite AND persist it into PREVIEW_INVITES so a refetch
  // of getRoomInvites(roomId) actually returns the new row. Without
  // the push, the Members tab's "Active invites" list stayed empty
  // after Generate, even though the toast claimed success.
  api.createRoomInvite = async (_roomId, payload) => {
    const newInvite: RoomInvite = {
      id: `inv_${Date.now()}`,
      invite_code: `aeg-${Math.random().toString(36).slice(2, 8)}`,
      room_id: _roomId,
      max_uses: payload.max_uses ?? null,
      used_count: 0,
      expires_at: payload.expires_at ?? null,
      created_at: new Date().toISOString(),
    };
    if (!PREVIEW_INVITES[_roomId]) PREVIEW_INVITES[_roomId] = [];
    PREVIEW_INVITES[_roomId].unshift(newInvite);
    return newInvite;
  };
  api.joinRoom = async () => ({ success: true });

  api.getFreezeWindows = async () => PREVIEW_FREEZE_WINDOWS;
  api.createFreezeWindow = async (payload: any) => {
    const fw = { id: `fw_${Date.now()}`, user_id: 'preview-user', created_at: new Date().toISOString(), ...payload };
    PREVIEW_FREEZE_WINDOWS.push(fw);
    return fw;
  };
  api.updateFreezeWindow = async (id: string, payload: any) => {
    const idx = PREVIEW_FREEZE_WINDOWS.findIndex((w) => w.id === id);
    if (idx >= 0) Object.assign(PREVIEW_FREEZE_WINDOWS[idx], payload);
    return PREVIEW_FREEZE_WINDOWS[idx];
  };
  api.deleteFreezeWindow = async (id: string) => {
    const idx = PREVIEW_FREEZE_WINDOWS.findIndex((w) => w.id === id);
    if (idx >= 0) PREVIEW_FREEZE_WINDOWS.splice(idx, 1);
    return { success: true };
  };

  // These ignore the requesting user id, like every other preview mock:
  // getMemories returns the full sample set regardless of who asks, so the
  // fixtures' 'preview-user' owner and the demo session user 'demo-user'
  // intentionally do not need to match (the `_userId` param is unused).
  api.getMemories = async () => PREVIEW_MEMORIES;
  api.updateMemory = async (id, _userId, payload) => {
    const idx = PREVIEW_MEMORIES.findIndex((m) => m.id === id);
    if (idx < 0) throw new Error('Memory not found');
    PREVIEW_MEMORIES[idx] = {
      ...PREVIEW_MEMORIES[idx],
      ...payload,
      updated_at: new Date().toISOString(),
    };
    return PREVIEW_MEMORIES[idx];
  };
  api.deleteMemory = async (id) => {
    const idx = PREVIEW_MEMORIES.findIndex((m) => m.id === id);
    if (idx >= 0) PREVIEW_MEMORIES.splice(idx, 1);
  };

  api.saveUser = async (u) => ({
    ...u,
    id: 'preview-user',
    username: 'demo',
    email: 'preview@runaegis.co',
    github_user_id: 0,
    created_at: new Date().toISOString(),
    postgres_connection_string: null,
    jira_url: null,
    jira_username: null,
    jira_api_token: null,
    mongodb_connection_string: null,
    linear_api_key: null,
    terraform_api_token: null,
    terraform_url: null,
  });
  api.getUserDetails = async () => ({
    id: 'preview-user',
    username: 'demo',
    email: 'preview@runaegis.co',
    github_user_id: 0,
    access_token: null,
    github_pat: null,
    postgres_connection_string: null,
    jira_url: null,
    jira_username: null,
    jira_api_token: null,
    mongodb_connection_string: null,
    linear_api_key: null,
    terraform_api_token: null,
    terraform_url: null,
  });
  // Preview onboarding when the user is actually ON /onboarding (so
  // designers can review the flow). Anywhere else, claim "complete" so
  // they don't get pulled back into the wizard mid-session. The numeric
  // value matters: > 4 redirects to /dashboard, 1..4 renders that step.
  api.getOnboardingStep = async () => {
    const onOnboarding =
      typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/onboarding');
    return { onboarding_step: onOnboarding ? 1 : 6 };
  };
  api.updateOnboardingStep = async () => ({ success: true });
}
