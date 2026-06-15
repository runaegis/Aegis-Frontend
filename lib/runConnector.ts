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
 *      Jira). The backend only persists `target_repo`/`target_branch` today,
 *      so for non-GitHub connectors we read the tool's `arguments` (the only
 *      place the resource currently lives) and degrade to null — the UI
 *      renders a muted dash rather than a wrong GitHub value. When the
 *      backend adds a generic `target` field this is the one place to wire it.
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
  // Everything else defaults to GitHub (the original connector).
};

export function connectorForTool(toolName?: string | null): ConnectorId {
  const t = (toolName ?? '').trim().toLowerCase();
  if (!t) return 'github';
  if (TOOL_CONNECTOR[t]) return TOOL_CONNECTOR[t];
  // Keyword fallback so unfamiliar tool names still classify sensibly.
  if (/terraform|(^|_)tf(_|$)/.test(t)) return 'terraform';
  if (/jira/.test(t)) return 'jira';
  if (/linear/.test(t)) return 'linear';
  if (/slack|message|channel|notify/.test(t)) return 'slack';
  if (/sql|query|migration|psql|postgres|truncate|(^|_)drop_|(^|_)table(_|$)|schema/.test(t)) return 'postgres';
  if (/workflow|secret|dispatch/.test(t)) return 'github-actions';
  return 'github';
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
  arguments?: Record<string, any> | null;
  target_repo?: string | null;
  target_branch?: string | null;
}

export function deriveTarget(action: TargetSource): RunTarget {
  const connector = connectorForTool(action.tool_name);
  const args = (action.arguments ?? {}) as Record<string, unknown>;

  switch (connector) {
    case 'postgres': {
      const sql = str(args.query) ?? str(args.sql) ?? str(args.statement);
      return {
        kind: 'DATABASE',
        primary: str(args.database) ?? str(args.db) ?? str(action.target_repo),
        secondary: str(args.table) ?? tableFromSql(sql),
      };
    }
    case 'terraform':
      return {
        kind: 'WORKSPACE',
        primary: str(args.workspace) ?? str(args.dir) ?? str(args.path),
        secondary: str(args.resource) ?? str(args.target) ?? str(args.address),
      };
    case 'slack': {
      const ch = str(args.channel) ?? str(args.channel_id);
      return {
        kind: 'CHANNEL',
        primary: ch ? (ch.startsWith('#') ? ch : `#${ch}`) : null,
        secondary: null,
      };
    }
    case 'linear':
    case 'jira':
      return {
        kind: 'PROJECT',
        primary: str(args.project) ?? str(args.team) ?? str(args.repo),
        secondary: str(args.issue) ?? str(args.key) ?? str(args.id),
      };
    case 'github-actions':
      // Same repo-shaped target as GitHub, but the workflow file is the more
      // meaningful scope than a branch for a dispatch / secret operation.
      return {
        kind: 'REPO',
        primary: str(action.target_repo) ?? str(args.repo) ?? str(args.owner_repo),
        secondary:
          str(args.workflow) ?? str(args.workflow_id) ?? str(action.target_branch) ?? str(args.branch),
      };
    case 'github':
    default:
      return {
        kind: 'REPO',
        primary: str(action.target_repo) ?? str(args.repo) ?? str(args.owner_repo),
        secondary: str(action.target_branch) ?? str(args.branch),
      };
  }
}

// Connectors that can show up in the Runs feed — drives the connector filter
// dropdown. Order matches the connector catalog's rollout priority.
export const RUN_CONNECTOR_FILTERS: ConnectorId[] = [
  'github',
  'github-actions',
  'postgres',
  'terraform',
  'slack',
  'linear',
  'jira',
];
