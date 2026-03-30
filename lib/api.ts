import { SessionAction, Session, User, RepoPermission, Metrics } from './types';

const API_BASE = 'http://localhost:8000';

function parseDatetime(value: any): string | any {
  if (typeof value !== 'string') return value;

  // Parse Python datetime repr: datetime.datetime(2026, 3, 29, 19, 49, 1, 381221, tzinfo=datetime.timezone.utc)
  const datetimeMatch = value.match(
    /datetime\.datetime\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)/
  );

  if (datetimeMatch) {
    const [, year, month, day, hour, minute, second, microsecond] = datetimeMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second),
      parseInt(microsecond) / 1000
    ).toISOString();
  }

  return value;
}

function parseRow(row: any, columns?: string[]): any {
  let obj: any = row;

  if (Array.isArray(row) && columns) {
    obj = Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]));
  }

  // Parse all datetime-like fields
  const datetimeFields = ['timestamp', 'started_at', 'last_action_at', 'created_at'];
  for (const field of datetimeFields) {
    if (obj[field]) obj[field] = parseDatetime(String(obj[field]));
  }

  return obj;
}

async function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, params }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Query failed');
  return data.rows.map((row: any) => parseRow(row, data.columns)) as T[];
}

export const api = {
  healthCheck: () =>
    fetch(`${API_BASE}/health`).then((r) => r.json()),

  // Fetch ALL runs — filter by user_id in JS (user_id may be null in DB)
  getRuns: async (userId?: string): Promise<SessionAction[]> => {
    const rows = await query<SessionAction>(
      `SELECT * FROM session_actions ORDER BY timestamp DESC LIMIT 500`
    );
    if (!userId) return rows;
    // Filter client-side: include rows where user_id matches OR is null (legacy rows)
    return rows.filter((r) => r.user_id === userId || r.user_id == null);
  },

  getSessions: async (userId?: string): Promise<Session[]> => {
    const rows = await query<Session>(`
      SELECT session_id, agent_name, user_id,
        COUNT(*) as action_count,
        MIN(timestamp) as started_at,
        MAX(timestamp) as last_action_at,
        array_agg(DISTINCT target_repo) as repos,
        SUM(CASE WHEN decision='ALLOW' THEN 1 ELSE 0 END) as allows,
        SUM(CASE WHEN decision='DENY' THEN 1 ELSE 0 END) as denies,
        SUM(CASE WHEN decision='REWRITE' THEN 1 ELSE 0 END) as rewrites,
        SUM(CASE WHEN decision ILIKE '%APPROVAL%' THEN 1 ELSE 0 END) as approvals
      FROM session_actions
      GROUP BY session_id, agent_name, user_id
      ORDER BY last_action_at DESC
    `);
    if (!userId) return rows;
    return rows.filter((r) => r.user_id === userId || r.user_id == null);
  },
  getSessionActions: (sessionId: string) =>
    query<SessionAction>(
      `SELECT * FROM session_actions WHERE session_id = %s ORDER BY sequence_order ASC`,
      [sessionId]
    ),
 
  getMetrics: async (userId?: string): Promise<Metrics> => {
    const runs = await api.getRuns(userId);
    const total = runs.length;
    const allows = runs.filter((r) => r.decision?.toUpperCase() === 'ALLOW').length;
    const denies = runs.filter((r) => r.decision?.toUpperCase() === 'DENY').length;
    const rewrites = runs.filter((r) => r.decision?.toUpperCase() === 'REWRITE').length;
    const approvals = runs.filter((r) => r.decision?.toUpperCase().includes('APPROVAL')).length;
    return { total, allows, denies, rewrites, approvals };
  },

  getApprovals: async (): Promise<SessionAction[]> => {
    const rows = await query<SessionAction>(
      `SELECT * FROM session_actions ORDER BY timestamp DESC LIMIT 200`
    );
    return rows.filter((r) => r.decision?.toUpperCase().includes('APPROVAL'));
  },

  getAuditTrail: (limit: number = 50, offset: number = 0) =>
    query<SessionAction>(
      `SELECT * FROM session_actions ORDER BY timestamp DESC LIMIT %s OFFSET %s`,
      [limit, offset]
    ),

  getAuditTrailByDateRange: (startDate: string, endDate: string) =>
    query<SessionAction>(
      `SELECT * FROM session_actions WHERE timestamp >= %s AND timestamp <= %s ORDER BY timestamp DESC`,
      [startDate, endDate]
    ),

  getRecentActionCount: async (username: string): Promise<{ count: number }[]> => {
    const rows = await query<SessionAction>(
      `SELECT * FROM session_actions WHERE timestamp > NOW() - INTERVAL '5 minutes'`
    );
    const count = rows.filter((r) =>
      r.agent_name?.toLowerCase().includes(username.toLowerCase())
    ).length;
    return [{ count }];
  },

  saveUser: async (user: User) => {
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

    const userResponse = await fetch(
      `${API_BASE}/user?email=${encodeURIComponent(user.email)}`
    ).then((r) => r.json());

    return userResponse;
  },

  syncRepos: (github_user_id: number, github_pat: string) =>
    fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_user_id, github_pat }),
    }).then((r) => r.json()),

  getRepos: (user_id: string) =>
    fetch(`${API_BASE}/repos/${user_id}`).then((r) => r.json()),

  setPermission: (user_id: string, github_repo_id: number, can_read: boolean, can_write: boolean) =>
    fetch(`${API_BASE}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id,
        github_repo_id,
        can_read,
        can_write,
      }),
    }).then((r) => r.json()),

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