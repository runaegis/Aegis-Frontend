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

/** Aegis's own cross-session memory tools — not tied to any connector
 *  the run happens to be authenticated against. Previously fell through
 *  to the default ('github') and rendered the GitHub mark, which was
 *  misleading in the Runs table. */
export const MEMORY_TOOLS = new Set([
  'set_memory',
  'update_memory',
  'list_memory',
  'get_memory_from_name',
]);

/** Mirrors backend MONGODB_TOOL_HANDLERS keys. */
export const MONGODB_TOOLS = new Set([
  'mongo_find',
  'mongo_aggregate',
  'list_databases',
  'list_collections',
  'mongo_insert',
  'mongo_update',
  'mongo_delete',
]);

export function isPostgresTool(toolName?: string | null): boolean {
  return POSTGRES_TOOLS.has((toolName ?? '').trim().toLowerCase());
}

export function isMongoTool(toolName?: string | null): boolean {
  return MONGODB_TOOLS.has((toolName ?? '').trim().toLowerCase());
}

export function isMemoryTool(toolName?: string | null): boolean {
  return MEMORY_TOOLS.has((toolName ?? '').trim().toLowerCase());
}

export function connectorForTool(toolName?: string | null): ConnectorId {
  const t = (toolName ?? '').trim().toLowerCase();
  if (POSTGRES_TOOLS.has(t)) return 'postgres';
  if (MONGODB_TOOLS.has(t)) return 'mongodb';
  if (GITHUB_ACTIONS_TOOLS.has(t)) return 'github-actions';
  if (MEMORY_TOOLS.has(t)) return 'memory';
  return 'github';
}
