/**
 * Client-derived oversight signals for agent memory.
 *
 * The `user_memory` row only stores { id, title, memory, created_at,
 * updated_at }. It has no provenance (which agent / room / session wrote
 * it) and no risk flags. But a memory is a durable claim the agent will
 * act on every future session, so an operator needs to triage: is any of
 * this sensitive, stale, or redundant?
 *
 * These three signals are all derivable from the existing row with no
 * backend change and no fabricated data:
 *
 *   • secret     — heuristic scan of the memory text for credential-shaped
 *                  content (keys, tokens, connection strings, private keys).
 *                  Labelled "Possible secret" because it is a heuristic, not
 *                  a claim. This is the highest-value oversight flag for a
 *                  security product: a leaked credential sitting in agent
 *                  memory would be re-used silently.
 *   • stale      — updated_at older than STALE_AFTER_DAYS.
 *   • duplicate  — another entry shares the same (normalized) title.
 *
 * Richer signals (contradiction, "read in N sessions", author agent/room)
 * need the audit-log join and are intentionally out of scope for v1.
 */

import type { Memory } from './types';
import type { BadgeTone } from '@/components/ui/Badge';

export type MemorySignalKey = 'secret' | 'stale' | 'duplicate';

export interface MemorySignal {
  key: MemorySignalKey;
  label: string;
  tone: BadgeTone;
  /** One-line explanation shown on hover / in the detail panel. */
  hint: string;
}

/** A memory untouched for longer than this reads as stale. */
export const STALE_AFTER_DAYS = 45;

// Conservative, structure-anchored patterns. Each requires a distinctive
// prefix or shape so ordinary prose ("rotate the api key in settings")
// does not trip the flag — only credential-shaped strings do.
const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/, // PEM private key block
  /\bA(?:KIA|SIA|GPA|IDA|ROA|NPA|NVA|CCA)[0-9A-Z]{16}\b/, // AWS access key ids
  /\bsk-[A-Za-z0-9]{20,}\b/, // OpenAI-style secret key
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, // GitHub PAT / OAuth token
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, // Slack token
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/, // JWT
  /\b(?:postgres(?:ql)?|mongodb(?:\+srv)?|mysql|redis|amqps?):\/\/[^\s:@/]+:[^\s:@/]+@/i, // conn string with password
  /\b(?:api[_-]?key|secret|password|passwd|token|bearer|access[_-]?key)\b\s*[:=]\s*["']?[A-Za-z0-9._\-/+]{12,}/i, // secret-looking assignment
];

/** Heuristic: does this text look like it contains a credential? */
export function looksLikeSecret(text?: string | null): boolean {
  if (!text) return false;
  return SECRET_PATTERNS.some((re) => re.test(text));
}

/** Whole days since an ISO timestamp, or null if unparseable. */
export function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/** Last-touched timestamp for a memory (updated beats created). */
export function lastTouched(m: Memory): string | null {
  return m.updated_at ?? m.created_at ?? null;
}

export function isStale(m: Memory): boolean {
  const d = daysSince(lastTouched(m));
  return d !== null && d > STALE_AFTER_DAYS;
}

function normalizeTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Compute the signal list for every memory in one pass (duplicates need
 * the whole set). Returns a map keyed by memory id.
 */
export function computeSignalMap(memories: Memory[]): Record<string, MemorySignal[]> {
  const titleCounts = new Map<string, number>();
  for (const m of memories) {
    const k = normalizeTitle(m.title);
    titleCounts.set(k, (titleCounts.get(k) ?? 0) + 1);
  }

  const map: Record<string, MemorySignal[]> = {};
  for (const m of memories) {
    const signals: MemorySignal[] = [];
    if (looksLikeSecret(m.memory)) {
      signals.push({
        key: 'secret',
        label: 'Possible secret',
        tone: 'error',
        hint: 'This entry looks like it contains a credential or token. Review and remove it if so.',
      });
    }
    if (isStale(m)) {
      signals.push({
        key: 'stale',
        label: 'Stale',
        tone: 'warning',
        hint: `Not updated in over ${STALE_AFTER_DAYS} days.`,
      });
    }
    if ((titleCounts.get(normalizeTitle(m.title)) ?? 0) > 1) {
      signals.push({
        key: 'duplicate',
        label: 'Duplicate title',
        tone: 'neutral',
        hint: 'Another entry shares this title. One may be redundant.',
      });
    }
    map[m.id] = signals;
  }
  return map;
}

export interface MemoryRollups {
  total: number;
  updatedThisWeek: number;
  secrets: number;
  stale: number;
}

export function computeRollups(
  memories: Memory[],
  signalMap: Record<string, MemorySignal[]>,
): MemoryRollups {
  let updatedThisWeek = 0;
  let secrets = 0;
  let stale = 0;
  for (const m of memories) {
    const d = daysSince(lastTouched(m));
    if (d !== null && d <= 7) updatedThisWeek += 1;
    const sigs = signalMap[m.id] ?? [];
    if (sigs.some((s) => s.key === 'secret')) secrets += 1;
    if (sigs.some((s) => s.key === 'stale')) stale += 1;
  }
  return { total: memories.length, updatedThisWeek, secrets, stale };
}
