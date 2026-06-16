/**
 * Connector catalog metadata shared by the Connectors list page and the
 * per-connector detail page (`/dashboard/connectors/[id]`).
 *
 * `CONNECTORS` (name/category/description/policy/primitive) lives in
 * `components/ui/ConnectorMark.tsx` — the visual single source of truth.
 * This module adds the two things the detail page needs on top of it:
 *   1. STATUS_BY_ID  — live / in-progress / coming-soon
 *   2. CONNECTOR_CAPABILITIES — what the underlying tool does that Aegis
 *      proxies + governs ("governs"), vs. what Aegis layers on top that the
 *      native tool can't do itself ("aegisAdds"). The aegisAdds list is the
 *      differentiation surface — grounded in the backend (REWRITE,
 *      approval gating, protected-branch interception, the CI-checker +
 *      secret-scanner agents, agent-identity governance, token metering).
 */

import type { ConnectorId } from '@/components/ui/ConnectorMark';

export type ConnectorStatus = 'live' | 'in-progress' | 'coming-soon';

export const STATUS_BY_ID: Record<ConnectorId, ConnectorStatus> = {
  github: 'live',
  'github-actions': 'live',
  slack: 'in-progress',
  postgres: 'in-progress',
  linear: 'coming-soon',
  jira: 'coming-soon',
  terraform: 'coming-soon',
};

export interface Capability {
  label: string;
  detail: string;
}

export interface ConnectorCapabilities {
  /** Native actions of the underlying tool that Aegis proxies + governs. */
  governs: Capability[];
  /** What Aegis layers on top that the native tool does not do itself.
   *  This is the value-add over the raw integration. */
  aegisAdds: Capability[];
  /** Optional note shown under the header (e.g. a shared connection). */
  note?: string;
}

export const CONNECTOR_CAPABILITIES: Partial<Record<ConnectorId, ConnectorCapabilities>> = {
  github: {
    governs: [
      { label: 'Pull requests', detail: 'Open, update, and merge pull requests.' },
      { label: 'File + branch writes', detail: 'create_or_update_file, push_files, create_branch.' },
      { label: 'Issues', detail: 'Create and update issues.' },
      { label: 'Repo reads', detail: 'Search and read code, commits, and metadata.' },
    ],
    aegisAdds: [
      { label: 'REWRITE', detail: 'Rewrites an unsafe action into a safe equivalent. A push to a protected branch becomes a pull request on an Aegis-managed branch, so the change still ships without ever landing on main directly.' },
      { label: 'Pre-action approval', detail: 'Risky writes pause for a human reviewer before they execute, instead of running and being caught after.' },
      { label: 'Protected-branch interception', detail: 'Direct writes to a protected branch are caught and rerouted to a PR.' },
      { label: 'Inline secret scanning', detail: 'Each action is scanned for exposed credentials before it reaches GitHub, not just at rest in the repo.' },
      { label: 'Per-role tool allowlist', detail: 'Each role only gets the tools you allow; everything else is denied at the proxy.' },
      { label: 'Classification + audit trail', detail: 'Every call is classified by semantic_type and blast radius, and written to an immutable, exportable audit log.' },
      { label: 'Token metering', detail: 'Per-action token and cost attribution for every tool call.' },
    ],
  },
  'github-actions': {
    governs: [
      { label: 'Workflow dispatch', detail: 'Trigger GitHub Actions workflows.' },
      { label: 'Re-run / cancel', detail: 'Re-run or cancel workflow runs.' },
    ],
    aegisAdds: [
      { label: 'Approval-gated dispatch', detail: 'Triggering a workflow, especially a production deploy, pauses for human sign-off before it runs.' },
      { label: 'CI-pass enforcement', detail: 'The CI-checker agent verifies CI and PR context before an action is allowed to proceed.' },
      { label: 'Production stays human-only', detail: 'Production deployment is never agent-initiated without explicit approval.' },
    ],
    note: 'Rides your existing GitHub connection — no separate setup or token. GitHub Actions governance is a capability layered on the GitHub connector.',
  },
};
