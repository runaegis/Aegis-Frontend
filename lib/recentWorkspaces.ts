/**
 * Recently opened agent workspaces, stored in this browser.
 *
 * Visit order is a client preference, not an API field — the list
 * payload has last_activity_at for the room, not last opened by this
 * person. Demo and real workspaces use separate keys so sample rooms
 * never leak into a live account.
 */

export type RecentWorkspace = {
  id: string;
  title: string;
  visitedAt: number;
};

const LIVE_KEY = 'aegis_recent_workspaces';
const DEMO_KEY = 'aegis_recent_workspaces_demo';
const MAX = 8;
const CHANGED_EVENT = 'aegis-recent-workspaces';

function storageKey(): string {
  try {
    return localStorage.getItem('aegis_demo') === 'true' ? DEMO_KEY : LIVE_KEY;
  } catch {
    return LIVE_KEY;
  }
}

function parse(raw: string | null): RecentWorkspace[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (row): row is RecentWorkspace =>
          Boolean(
            row &&
              typeof row === 'object' &&
              typeof (row as RecentWorkspace).id === 'string' &&
              typeof (row as RecentWorkspace).title === 'string' &&
              typeof (row as RecentWorkspace).visitedAt === 'number',
          ),
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function readRecentWorkspaces(): RecentWorkspace[] {
  if (typeof window === 'undefined') return [];
  try {
    return parse(localStorage.getItem(storageKey()));
  } catch {
    return [];
  }
}

export function recordRecentWorkspace(id: string, title: string) {
  if (typeof window === 'undefined' || !id) return;
  const next: RecentWorkspace[] = [
    { id, title: title.trim() || 'Untitled workspace', visitedAt: Date.now() },
    ...readRecentWorkspaces().filter((row) => row.id !== id),
  ].slice(0, MAX);
  try {
    localStorage.setItem(storageKey(), JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGED_EVENT));
  } catch {
    // ignore quota / private-mode failures
  }
}

/** Keep recents that still exist; refresh titles from the live list. */
export function resolveRecentWorkspaces(
  available: Array<{ id: string; title: string }>,
  limit = 5,
): RecentWorkspace[] {
  const byId = new Map(available.map((row) => [row.id, row]));
  return readRecentWorkspaces()
    .map((row) => {
      const live = byId.get(row.id);
      if (!live) return null;
      return { ...row, title: live.title || row.title };
    })
    .filter((row): row is RecentWorkspace => row !== null)
    .slice(0, limit);
}

export function subscribeRecentWorkspaces(onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => onChange();
  window.addEventListener(CHANGED_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CHANGED_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
