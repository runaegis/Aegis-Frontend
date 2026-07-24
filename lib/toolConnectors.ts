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

/** Agent Workspace tools — same Aegis-owned surface; show the memory mark. */
export const WORKSPACE_TOOLS = new Set([
  'workspace_list_handles',
  'workspace_get_context',
  'workspace_check_mentions',
  'workspace_list_pointers',
  'workspace_post',
  'workspace_add_pointer',
  'workspace_update_pointer',
  'workspace_get_messages',
  'workspace_delete_pointer',
]);

export function isPostgresTool(toolName?: string | null): boolean {
  return POSTGRES_TOOLS.has((toolName ?? '').trim().toLowerCase());
}

export function isMemoryTool(toolName?: string | null): boolean {
  const t = (toolName ?? '').trim().toLowerCase();
  return MEMORY_TOOLS.has(t) || WORKSPACE_TOOLS.has(t) || t.startsWith('workspace_');
}

export function connectorForTool(toolName?: string | null): ConnectorId {
  const t = (toolName ?? '').trim().toLowerCase();
  if (POSTGRES_TOOLS.has(t)) return 'postgres';
  if (GITHUB_ACTIONS_TOOLS.has(t)) return 'github-actions';
  if (MEMORY_TOOLS.has(t) || WORKSPACE_TOOLS.has(t) || t.startsWith('workspace_')) {
    return 'memory';
  }
  return 'github';
}
