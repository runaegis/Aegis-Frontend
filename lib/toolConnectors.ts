import type { ConnectorId } from '@/components/ui/ConnectorMark';

/** GitHub Actions workflow / secret tools — distinct from core GitHub. */
export const GITHUB_ACTIONS_TOOLS = new Set([
  'workflow_dispatch',
  'create_workflow_secret',
  'delete_workflow_secret',
  'update_workflow_secret',
]);

/** Mirrors backend POSTGRES_TOOL_HANDLERS keys. */
export const POSTGRES_TOOLS = new Set([
  'execute_sql',
  'list_schemas',
  'list_tables',
]);

export function isPostgresTool(toolName?: string | null): boolean {
  return POSTGRES_TOOLS.has((toolName ?? '').trim().toLowerCase());
}

export function connectorForTool(toolName?: string | null): ConnectorId {
  const t = (toolName ?? '').trim().toLowerCase();
  if (POSTGRES_TOOLS.has(t)) return 'postgres';
  if (GITHUB_ACTIONS_TOOLS.has(t)) return 'github-actions';
  return 'github';
}
