import { SessionAction, Session, User, RepoPermission, Metrics } from './types';

const API_BASE = 'https://api.runaegis.co';

async function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, params }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Query failed');
  return data.rows.map((row: any[]) =>
    Object.fromEntries(
      data.columns.map((col: string, i: number) => [col, row[i]])
    )
  ) as T[];
}

export const api = {
  healthCheck: () =>
    fetch(`${API_BASE}/health`).then((r) => r.json()),

  getRuns: (username?: string) =>
    query<SessionAction>(
      username
        ? `SELECT * FROM session_actions WHERE agent_name ILIKE $1 ORDER BY timestamp DESC LIMIT 200`
        : `SELECT * FROM session_actions ORDER BY timestamp DESC LIMIT 200`,
      username ? [`%${username}%`] : []
    ),

  getSessions: () =>
    query<Session>(`
      SELECT session_id, agent_name,
        COUNT(*) as action_count,
        MIN(timestamp) as started_at,
        MAX(timestamp) as last_action_at,
        array_agg(DISTINCT target_repo) as repos,
        SUM(CASE WHEN decision='ALLOW' THEN 1 ELSE 0 END) as allows,
        SUM(CASE WHEN decision='DENY' THEN 1 ELSE 0 END) as denies,
        SUM(CASE WHEN decision='REWRITE' THEN 1 ELSE 0 END) as rewrites,
        SUM(CASE WHEN decision ILIKE '%APPROVAL%' THEN 1 ELSE 0 END) as approvals
      FROM session_actions
      GROUP BY session_id, agent_name
      ORDER BY last_action_at DESC
    `),

  getSessionActions: (sessionId: string) =>
    query<SessionAction>(
      `SELECT * FROM session_actions WHERE session_id = $1 ORDER BY sequence_order ASC`,
      [sessionId]
    ),

  getMetrics: async (): Promise<Metrics> => {
    const rows = await query<Metrics>(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN decision='ALLOW' THEN 1 ELSE 0 END) as allows,
        SUM(CASE WHEN decision='DENY' THEN 1 ELSE 0 END) as denies,
        SUM(CASE WHEN decision='REWRITE' THEN 1 ELSE 0 END) as rewrites,
        SUM(CASE WHEN decision ILIKE '%APPROVAL%' THEN 1 ELSE 0 END) as approvals
      FROM session_actions
    `);
    return rows[0] || { total: 0, allows: 0, denies: 0, rewrites: 0, approvals: 0 };
  },

  getApprovals: () =>
    query<SessionAction>(
      `SELECT * FROM session_actions WHERE decision ILIKE '%APPROVAL%' ORDER BY timestamp DESC LIMIT 200`
    ),

  getAuditTrail: (limit: number = 50, offset: number = 0) =>
    query<SessionAction>(
      `SELECT * FROM session_actions ORDER BY timestamp DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),

  getAuditTrailByDateRange: (startDate: string, endDate: string) =>
    query<SessionAction>(
      `SELECT * FROM session_actions WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp DESC`,
      [startDate, endDate]
    ),

  getRecentActionCount: (username: string) =>
    query<{ count: number }>(
      `SELECT COUNT(*) as count FROM session_actions WHERE agent_name ILIKE $1 AND timestamp > NOW() - INTERVAL '5 minutes'`,
      [`%${username}%`]
    ),

  saveUser: (user: User) =>
    fetch(`${API_BASE}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    }).then((r) => r.json()),

  syncRepos: (userId: string) =>
    fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    }).then((r) => r.json()),

  getRepos: (userId: string) =>
    fetch(`${API_BASE}/repos/${userId}`).then((r) => r.json()),

  setPermissions: (userId: string, permissions: RepoPermission[]) =>
    fetch(`${API_BASE}/permissions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, permissions }),
    }).then((r) => r.json()),
};
