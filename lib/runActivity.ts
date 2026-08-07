import type { ConnectorId } from '@/components/ui/ConnectorMark';
import type { Metrics, SessionAction } from '@/lib/types';
import { RUN_CONNECTOR_FILTERS, connectorForAction, deriveTarget, type RunTarget } from '@/lib/runConnector';
import { formatMcpAegisToolDisplayName, normalizeDecision, readBlastRadius, type CanonicalDecision } from '@/lib/utils';

export type RunFilterDecision = Exclude<CanonicalDecision, 'ERROR' | 'UNKNOWN'>;

export interface RunActivityViewModel {
  action: SessionAction;
  connectorId: ConnectorId;
  decision: CanonicalDecision;
  toolLabel: string;
  target: RunTarget;
  targetFilterKey: string | null;
  targetFilterLabel: string | null;
  searchableText: string;
}

export interface RunActivityFilters {
  searchQuery: string;
  agentFilter: string[];
  decisionFilter: string[];
  connectorFilter: string[];
  targetFilter: string[];
  toolFilter: string[];
  scopedSessionId?: string | null;
}

const RUN_DECISION_ORDER: RunFilterDecision[] = [
  'ALLOW',
  'DENY',
  'REWRITE',
  'REQUIRE_APPROVAL',
];

function targetFilterParts(target: RunTarget): {
  key: string | null;
  label: string | null;
} {
  if (!target.primary) {
    return { key: null, label: null };
  }

  const kind = target.kind || 'TARGET';
  return {
    key: `${kind}:${target.primary}`,
    label: `${kind}: ${target.primary}`,
  };
}

function toSearchableParts(parts: Array<string | null | undefined>): string {
  return parts
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();
}

export function buildRunActivityViewModel(action: SessionAction): RunActivityViewModel {
  const connectorId = connectorForAction(action);
  const decision = normalizeDecision(action.decision);
  const toolLabel = formatMcpAegisToolDisplayName(action.tool_name || '') || action.tool_name || 'Unknown';
  const target = deriveTarget(action);
  const { key, label } = targetFilterParts(target);

  return {
    action,
    connectorId,
    decision,
    toolLabel,
    target,
    targetFilterKey: key,
    targetFilterLabel: label,
    searchableText: toSearchableParts([
      action.agent_name,
      action.tool_name,
      toolLabel,
      connectorId,
      target.kind,
      target.primary,
      target.secondary,
      action.action_summary,
      action.session_id,
      action.connector_key,
      action.target_display,
      action.target_ref,
      action.target_repo,
      action.target_branch,
      action.policy,
      readBlastRadius(action),
      decision,
    ]),
  };
}

function compareAlpha(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

export function buildRunActivityFilterOptions(items: RunActivityViewModel[]) {
  const agentSet = new Set<string>();
  const connectorSet = new Set<string>();
  const targetSet = new Map<string, string>();
  const toolSet = new Map<string, string>();

  for (const item of items) {
    if (item.action.agent_name) {
      agentSet.add(item.action.agent_name);
    }
    connectorSet.add(item.connectorId);
    if (item.targetFilterKey && item.targetFilterLabel) {
      targetSet.set(item.targetFilterKey, item.targetFilterLabel);
    }
    if (item.action.tool_name) {
      toolSet.set(item.action.tool_name, item.toolLabel);
    }
  }

  const agents = Array.from(agentSet)
    .sort(compareAlpha)
    .map((value) => ({ value, label: value }));

  const connectors = RUN_CONNECTOR_FILTERS.filter((id) => connectorSet.has(id)).map((value) => ({
    value,
    label: value,
  }));

  const decisions = RUN_DECISION_ORDER.filter((decision) =>
    items.some((item) => item.decision === decision),
  ).map((value) => ({
    value,
    label: value === 'REQUIRE_APPROVAL' ? 'Approval' : value,
  }));

  const targets = Array.from(targetSet.entries())
    .sort((left, right) => compareAlpha(left[1], right[1]))
    .map(([value, label]) => ({ value, label }));

  const tools = Array.from(toolSet.entries())
    .sort((left, right) => compareAlpha(left[1], right[1]))
    .map(([value, label]) => ({ value, label }));

  return {
    agents,
    connectors,
    decisions,
    targets,
    tools,
  };
}

export function filterRunActivity(
  items: RunActivityViewModel[],
  filters: RunActivityFilters,
): RunActivityViewModel[] {
  const searchQuery = filters.searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.scopedSessionId && item.action.session_id !== filters.scopedSessionId) {
      return false;
    }

    if (filters.agentFilter.length > 0) {
      const agentName = item.action.agent_name || '';
      if (!filters.agentFilter.includes(agentName)) {
        return false;
      }
    }

    if (filters.decisionFilter.length > 0 && !filters.decisionFilter.includes(item.decision)) {
      return false;
    }

    if (filters.connectorFilter.length > 0 && !filters.connectorFilter.includes(item.connectorId)) {
      return false;
    }

    if (filters.targetFilter.length > 0) {
      if (!item.targetFilterKey || !filters.targetFilter.includes(item.targetFilterKey)) {
        return false;
      }
    }

    if (filters.toolFilter.length > 0) {
      const toolName = item.action.tool_name || '';
      if (!filters.toolFilter.includes(toolName)) {
        return false;
      }
    }

    if (searchQuery && !item.searchableText.includes(searchQuery)) {
      return false;
    }

    return true;
  });
}

export function summarizeRunActivity(items: RunActivityViewModel[]): Metrics {
  return items.reduce<Metrics>(
    (metrics, item) => {
      metrics.total += 1;
      if (item.decision === 'ALLOW') metrics.allows += 1;
      if (item.decision === 'DENY') metrics.denies += 1;
      if (item.decision === 'REWRITE') metrics.rewrites += 1;
      if (item.decision === 'REQUIRE_APPROVAL') metrics.approvals += 1;
      return metrics;
    },
    {
      total: 0,
      allows: 0,
      denies: 0,
      rewrites: 0,
      approvals: 0,
    },
  );
}
