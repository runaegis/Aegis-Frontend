import { SessionAction, Session, User, RepoPermission, Metrics } from './types';

const API_BASE = 'http://localhost:8000';

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

  saveUser: async (user: User) => {
    // Step 1: Create user on backend
    const createResponse = await fetch(`${API_BASE}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github_user_id: user.github_user_id,
        username: user.username,
        email: user.email,
        access_token: user.access_token,
      }),
    }).then((r) => r.json());

    if (!createResponse.success) {
      throw new Error(createResponse.message || 'Failed to create user');
    }

    // Step 2: Fetch the created user to get the UUID id
    const userResponse = await fetch(`${API_BASE}/user?email=${encodeURIComponent(user.email)}`)
      .then((r) => r.json());

    return userResponse; // Returns {id, github_user_id, username, access_token, created_at}
  },

  syncRepos: (github_user_id: number, github_pat: string) =>
    fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_user_id, github_pat }),
    }).then((r) => r.json()),

  getRepos: (user_id: string) =>
    fetch(`${API_BASE}/repos/${user_id}`).then((r) => r.json()),

  setPermissions: (user_id: string, permissions: RepoPermission[]) =>
    fetch(`${API_BASE}/permissions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permissions: permissions.map((p) => ({
          user_id,
          github_repo_id: p.github_repo_id,
          can_read: p.can_read || false,
          can_write: p.can_write || false,
        })),
      }),
    }).then((r) => r.json()),
};
