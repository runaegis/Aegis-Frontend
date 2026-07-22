/**
 * Shadow Report builder.
 *
 * The Shadow Report is derived entirely from recorded `session_actions` — the
 * same rows the audit log already stores (decision, blast radius, policy,
 * summary). Nothing here needs a new backend field: once a room runs in
 * observe mode (the proxy records the would-be decision without enforcing it),
 * this turns that history into the "here's what we'd have caught" report.
 *
 * Keeping it a pure function means the same code path renders preview data and
 * real `getSessionsByRoomId` data — no divergence between the demo and prod.
 */

import type { RoomSessionAction, ShadowMoment, ShadowReport } from './types';

export type ShadowWindow = '24h' | '7d' | '30d' | 'all';

const WINDOW_MS: Record<ShadowWindow, number | null> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  all: null,
};

export const SHADOW_WINDOWS: { key: ShadowWindow; label: string }[] = [
  { key: '24h', label: '24 hours' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
];

type Bucket = 'allow' | 'deny' | 'rewrite' | 'approval';

/**
 * Collapse the backend's free-form decision string into the four buckets the
 * report counts. Governance logs are allow-heavy, so anything unrecognized
 * falls to `allow` rather than inflating the would-block numbers.
 */
export function decisionBucket(raw?: string | null): Bucket {
  const d = (raw ?? '').trim().toLowerCase();
  if (d === 'deny' || d === 'denied' || d === 'rejected' || d === 'blocked') return 'deny';
  if (d === 'rewrite' || d === 'rewritten') return 'rewrite';
  if (
    d === 'require_approval' ||
    d === 'requires_approval' ||
    d === 'approval' ||
    d === 'pending' ||
    d === 'approved'
  )
    return 'approval';
  return 'allow';
}

/** Severity rank for sorting moments — higher is more severe. */
const BLAST_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function blastValue(a: RoomSessionAction): string {
  return (a.blast_radius ?? a.blast_redius ?? '').toString();
}

function blastRank(a: RoomSessionAction): number {
  return BLAST_RANK[blastValue(a).trim().toLowerCase()] ?? 0;
}

function actionTime(a: RoomSessionAction): number {
  const t = Date.parse(a.timestamp);
  return Number.isNaN(t) ? 0 : t;
}

/** Human label for the would-be decision, used in moment headlines. */
const WOULD_LABEL: Record<Bucket, string> = {
  allow: 'ALLOW',
  deny: 'DENY',
  rewrite: 'REWRITE',
  approval: 'REQUIRE_APPROVAL',
};

function momentHeadline(a: RoomSessionAction, bucket: Bucket): string {
  const agent = a.agent_name || 'An agent';
  const target = a.target_branch
    ? `${a.target_repo}:${a.target_branch}`
    : a.target_repo;
  const summary = (a.action_summary || '').trim();
  const verb =
    bucket === 'deny'
      ? 'would have been blocked'
      : bucket === 'rewrite'
        ? 'would have been rewritten to a safe equivalent'
        : 'would have paused for approval';
  if (summary) return `${summary} — ${verb}.`;
  return `${agent} ran ${a.tool_name} on ${target} — ${verb}.`;
}

interface BuildOpts {
  window?: ShadowWindow;
  /** Max moments to surface. */
  maxMoments?: number;
  /** ISO string to stamp the report; pass from the caller (no Date.now here). */
  generatedAt?: string;
}

/**
 * Build a ShadowReport from a room's recorded actions. `now` is passed in so
 * the window filter is deterministic and testable; when omitted the window
 * filter is skipped (treats everything as in-window).
 */
export function buildShadowReport(
  roomId: string,
  repoName: string,
  actions: RoomSessionAction[],
  now: number | null,
  opts: BuildOpts = {},
): ShadowReport {
  const window = opts.window ?? '7d';
  const maxMoments = opts.maxMoments ?? 6;
  const windowMs = WINDOW_MS[window];

  const inWindow =
    windowMs == null || now == null
      ? actions
      : actions.filter((a) => {
          const t = actionTime(a);
          return t === 0 || now - t <= windowMs;
        });

  const counts = { allow: 0, deny: 0, rewrite: 0, approval: 0 };
  const toolCounts = new Map<string, number>();
  const flagged: ShadowMoment[] = [];

  for (const a of inWindow) {
    const bucket = decisionBucket(a.decision);
    counts[bucket] += 1;
    toolCounts.set(a.tool_name, (toolCounts.get(a.tool_name) ?? 0) + 1);
    if (bucket !== 'allow') {
      flagged.push({ action: a, wouldDecision: WOULD_LABEL[bucket], headline: momentHeadline(a, bucket) });
    }
  }

  // Moments: most severe first (blast radius), then most recent.
  flagged.sort((x, y) => {
    const br = blastRank(y.action) - blastRank(x.action);
    if (br !== 0) return br;
    return actionTime(y.action) - actionTime(x.action);
  });

  const distribution = [...toolCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    roomId,
    repoName,
    window,
    generatedAt: opts.generatedAt ?? '',
    totalObserved: inWindow.length,
    counts,
    distribution,
    moments: flagged.slice(0, maxMoments),
  };
}

/** Total actions Aegis would have acted on (the headline "caught" number). */
export function wouldActCount(report: ShadowReport): number {
  return report.counts.deny + report.counts.rewrite + report.counts.approval;
}
