/**
 * Connector + target derivation for agent actions.
 *
 * The Runs / Sessions / Audit surfaces were originally GitHub-shaped: every
 * row assumed a `target_repo` + `target_branch`. Now that actions span
 * GitHub, GitHub Actions, Postgres, Terraform, Slack, Linear and Jira, two
 * things have to generalize:
 *
 *   1. `connectorForTool` — which connector surface a tool call belongs to,
 *      so the row can show the right brand mark and be filtered by source.
 *   2. `deriveTarget` — the connector-appropriate "target" of the action
 *      (repo+branch for GitHub, database+table for Postgres, channel for
 *      Slack, workspace+resource for Terraform, project+issue for Linear/
 *      Jira). New rows can provide `connector_key`, `target_type`,
 *      `target_display`, and `target_metadata`; older rows still fall back to
 *      `target_repo` / `target_branch` plus the tool arguments. Keeping the
 *      logic here means every dashboard surface stays consistent as the
 *      backend rollout mixes old and new shapes.
 */

import type { ConnectorId } from '@/components/ui/ConnectorMark';

// Exact tool-name → connector. Keep this list small and obvious; anything
// not here falls through to the keyword heuristic below.
const TOOL_CONNECTOR: Record<string, ConnectorId> = {
  // GitHub Actions (workflow + secret surface)
  workflow_dispatch: 'github-actions',
  rerun_workflow: 'github-actions',
  cancel_workflow_run: 'github-actions',
  create_workflow_secret: 'github-actions',
  update_workflow_secret: 'github-actions',
  delete_workflow_secret: 'github-actions',
  // Postgres (the live backend tool is `query`; migrations + schema reads too)
  query: 'postgres',
  execute_query: 'postgres',
  execute_migration: 'postgres',
  run_migration: 'postgres',
  list_tables: 'postgres',
  describe_table: 'postgres',
  // MongoDB (tool names vary; keep explicit mappings for the common ones)
  mongo_find: 'mongodb',
  mongo_aggregate: 'mongodb',
  mongo_insert: 'mongodb',
  mongo_update: 'mongodb',
  mongo_delete: 'mongodb',
  mongodb_find: 'mongodb',
  mongodb_aggregate: 'mongodb',
  mongodb_insert: 'mongodb',
  mongodb_update: 'mongodb',
  mongodb_delete: 'mongodb',
  // Terraform
  terraform_plan: 'terraform',
  terraform_apply: 'terraform',
  terraform_destroy: 'terraform',
  // Slack
  send_message: 'slack',
  post_message: 'slack',
  // Linear / Jira issue trackers. Namespaced so they don't collide with
  // GitHub's own `create_issue` (which stays GitHub) — the keyword fallback
  // below also catches any other linear_*/jira_* tool name.
  linear_create_issue: 'linear',
  linear_update_issue: 'linear',
  jira_create_issue: 'jira',
  jira_update_issue: 'jira',
  // Aegis memory tools — must be explicit so they don't fall through to
  // the 'github' default (these tools run inside a GitHub-authenticated
  // MCP session but are not GitHub operations).
  set_memory: 'memory',
  update_memory: 'memory',
  list_memory: 'memory',
  get_memory_from_name: 'memory',
  // Agent Workspace tools — Aegis-owned multi-agent room surface.
  workspace_list_handles: 'workspace',
  workspace_get_context: 'workspace',
  workspace_check_mentions: 'workspace',
  workspace_list_pointers: 'workspace',
  workspace_post: 'workspace',
  workspace_add_pointer: 'workspace',
  workspace_update_pointer: 'workspace',
  workspace_get_messages: 'workspace',
  workspace_delete_pointer: 'workspace',
  // Everything else defaults to GitHub (the original connector).
};

export function connectorForTool(toolName?: string | null): ConnectorId {
  const t = (toolName ?? '').trim().toLowerCase();
  if (!t) return 'github';
  if (TOOL_CONNECTOR[t]) return TOOL_CONNECTOR[t];
  // Aegis Agent Workspace family (workspace_*). Checked before the Slack
  // keyword heuristic so names like workspace_get_messages / workspace_post
  // don't get misclassified.
  if (t.startsWith('workspace_')) return 'workspace';
  // Keyword fallback so unfamiliar tool names still classify sensibly.
  if (/terraform|(^|_)tf(_|$)/.test(t)) return 'terraform';
  if (/jira/.test(t)) return 'jira';
  if (/linear/.test(t)) return 'linear';
  if (/slack|message|channel|notify/.test(t)) return 'slack';
  if (/sql|query|migration|psql|postgres|truncate|(^|_)drop_|(^|_)table(_|$)|schema/.test(t)) return 'postgres';
  if (/mongo|mongodb/.test(t)) return 'mongodb';
  if (/workflow|secret|dispatch/.test(t)) return 'github-actions';
  if (/memory/.test(t)) return 'memory';
  return 'github';
}

const CONNECTOR_KEY_ALIASES: Record<string, ConnectorId> = {
  github: 'github',
  github_actions: 'github-actions',
  'github-actions': 'github-actions',
  postgres: 'postgres',
  postgresql: 'postgres',
  mongodb: 'mongodb',
  mongo: 'mongodb',
  terraform: 'terraform',
  linear: 'linear',
  jira: 'jira',
  slack: 'slack',
  memory: 'memory',
};

function connectorIdFromKey(connectorKey?: string | null): ConnectorId | null {
  const normalized = (connectorKey ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return CONNECTOR_KEY_ALIASES[normalized] ?? null;
}

export interface RunTarget {
  /** Primary resource: repo, database, channel, workspace, project. */
  primary: string | null;
  /** Optional secondary scope rendered as a code chip: branch, table,
   *  resource, issue. */
  secondary: string | null;
  /** Short uppercase label for the kind of primary (REPO, DATABASE, …) —
   *  shown as a muted prefix so a generic column still reads precisely. */
  kind: string;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

// Best-effort table name from a raw SQL string (FROM / INTO / UPDATE /
// DROP TABLE / JOIN). Used only as a fallback when args has no explicit
// `table`.
function tableFromSql(sql: string | null): string | null {
  if (!sql) return null;
  const m = sql.match(/\b(?:from|into|update|join|table)\s+["'`]?([a-zA-Z_][\w.]*)/i);
  return m ? m[1] : null;
}

/**
 * Minimal action shape `deriveTarget` reads — satisfied structurally by
 * `SessionAction`, `RoomSessionAction` (extends it), and `MCPApproval`
 * (which carries `tool_name` + `arguments` and derives repo/branch from
 * args). Keeping the param loose lets every action surface reuse the same
 * target derivation.
 */
export interface TargetSource {
  tool_name?: string | null;
  connector_key?: string | null;
  arguments?: Record<string, unknown> | null;
  target_type?: string | null;
  target_ref?: string | null;
  target_display?: string | null;
  target_metadata?: Record<string, unknown> | null;
  target_descriptor?: string | null;
  target_repo?: string | null;
  target_branch?: string | null;
}

export function connectorForAction(action: TargetSource): ConnectorId {
  return connectorIdFromKey(action.connector_key) ?? connectorForTool(action.tool_name);
}

function readTargetMetadata(
  action: TargetSource,
): Record<string, unknown> | null {
  if (!action.target_metadata || typeof action.target_metadata !== 'object') {
    return null;
  }
  return action.target_metadata as Record<string, unknown>;
}

function kindFromTargetType(
  targetType: string | null | undefined,
  connector: ConnectorId,
): string {
  const raw = (targetType ?? '').trim();
  if (raw) {
    const tail = raw.split('.').pop()?.split('_').filter(Boolean) ?? [];
    if (tail.length > 0) {
      return tail
        .join(' ')
        .toUpperCase();
    }
  }

  switch (connector) {
    case 'postgres':
    case 'mongodb':
      return 'DATABASE';
    case 'terraform':
      return 'WORKSPACE';
    case 'linear':
    case 'jira':
      return 'PROJECT';
    case 'slack':
      return 'CHANNEL';
    case 'memory':
      return 'MEMORY';
    default:
      return 'REPO';
  }
}

function targetFromNewFields(
  action: TargetSource,
  connector: ConnectorId,
): RunTarget | null {
  const metadata = readTargetMetadata(action);
  const primary =
    str(metadata?.primary) ??
    str(metadata?.label) ??
    str(metadata?.display) ??
    str(metadata?.name) ??
    str(action.target_display) ??
    str(action.target_descriptor);
  const secondary =
    str(metadata?.secondary) ??
    str(metadata?.branch) ??
    str(metadata?.table) ??
    str(metadata?.collection) ??
    str(metadata?.resource) ??
    str(metadata?.workflow) ??
    str(metadata?.issue) ??
    str(metadata?.key);

  if (!primary && !secondary) return null;

  return {
    kind: kindFromTargetType(action.target_type, connector),
    primary,
    secondary,
  };
}

export function deriveTarget(action: TargetSource): RunTarget {
  const connector = connectorForAction(action);
  const args = (action.arguments ?? {}) as Record<string, unknown>;
  const explicitTarget = targetFromNewFields(action, connector);

  if (explicitTarget && connector === 'memory') {
    return explicitTarget;
  }

  switch (connector) {
    case 'postgres': {
      const sql = str(args.query) ?? str(args.sql) ?? str(args.statement);
      const derived = {
        kind: 'DATABASE',
        primary: str(args.database) ?? str(args.db) ?? str(action.target_repo),
        secondary: str(args.table) ?? tableFromSql(sql),
      };
      return derived.primary || derived.secondary ? derived : (explicitTarget ?? derived);
    }
    case 'mongodb': {
      const derived = {
        kind: 'DATABASE',
        primary: str(args.database) ?? str(args.db) ?? str(action.target_repo),
        secondary: str(args.collection) ?? str(args.coll) ?? str(args.table),
      };
      return derived.primary || derived.secondary ? derived : (explicitTarget ?? derived);
    }
    case 'terraform': {
      const derived = {
        kind: 'WORKSPACE',
        primary: str(args.workspace) ?? str(args.dir) ?? str(args.path),
        secondary: str(args.resource) ?? str(args.target) ?? str(args.address),
      };
      return derived.primary || derived.secondary ? derived : (explicitTarget ?? derived);
    }
    case 'slack': {
      const ch = str(args.channel) ?? str(args.channel_id);
      const derived = {
        kind: 'CHANNEL',
        primary: ch ? (ch.startsWith('#') ? ch : `#${ch}`) : null,
        secondary: null,
      };
      return derived.primary || derived.secondary ? derived : (explicitTarget ?? derived);
    }
    case 'linear':
    case 'jira': {
      const derived = {
        kind: 'PROJECT',
        primary: str(args.project) ?? str(args.team) ?? str(args.repo),
        secondary: str(args.issue) ?? str(args.key) ?? str(args.id),
      };
      return derived.primary || derived.secondary ? derived : (explicitTarget ?? derived);
    }
    case 'github-actions':
      // Same repo-shaped target as GitHub, but the workflow file is the more
      // meaningful scope than a branch for a dispatch / secret operation.
      return {
        kind: 'REPO',
        primary: str(action.target_repo) ?? str(args.repo) ?? str(args.owner_repo),
        secondary:
          str(args.workflow) ??
          str(args.workflow_id) ??
          str(action.target_branch) ??
          str(args.branch) ??
          explicitTarget?.secondary ??
          null,
      };
    case 'memory':
      return {
        kind: 'MEMORY',
        primary:
          explicitTarget?.primary ??
          str(args.title) ??
          str(args.id) ??
          null,
        secondary: null,
      };
    case 'workspace':
      return {
        kind: 'ROOM',
        primary:
          str(args.title) ??
          str(args.content) ??
          str(args.pointer_id) ??
          str(args.handle) ??
          null,
        secondary: null,
      };
    case 'github':
    default:
      return {
        kind: 'REPO',
        primary:
          str(action.target_repo) ??
          str(args.repo) ??
          str(args.owner_repo) ??
          explicitTarget?.primary ??
          null,
        secondary:
          str(action.target_branch) ??
          str(args.branch) ??
          explicitTarget?.secondary ??
          null,
      };
  }
}

export function formatRunTargetLabel(
  target: RunTarget,
  fallback = 'this target',
): string {
  if (target.primary && target.secondary) {
    return `${target.primary} · ${target.secondary}`;
  }
  return target.primary ?? target.secondary ?? fallback;
}

// Connectors that can show up in the Runs feed — drives the connector filter
// dropdown. Order matches the connector catalog's rollout priority.
export const RUN_CONNECTOR_FILTERS: ConnectorId[] = [
  'github',
  'github-actions',
  'postgres',
  'mongodb',
  'terraform',
  'slack',
  'linear',
  'jira',
  'memory',
  'workspace',
];
