/**
 * Workspace demo layer.
 *
 * Mirrors the pattern in `lib/preview-data.ts`: monkey-patch the `api`
 * object with an in-memory implementation so the Agent Workspace surface
 * is fully explorable without a backend running.
 *
 * Unlike a static fixture dump, this keeps mutable state, so creating a
 * workspace, posting a message, issuing an agent key, and moving a task
 * pointer all genuinely work in the demo. Swapping back to the real API
 * is a matter of not calling `installWorkspacePreviewApi()`.
 */

import {
  ApiError,
  api,
  type WorkspaceAgent,
  type WorkspaceAgentKeyResponse,
  type WorkspaceAgentStatus,
  type WorkspaceDetail,
  type WorkspaceInvite,
  type WorkspaceInviteCreatePayload,
  type WorkspaceInvitePreview,
  type WorkspaceJoinResponse,
  type WorkspaceMessage,
  type WorkspacePointerStatus,
  type WorkspaceRecord,
  type WorkspaceRun,
  type WorkspaceRunList,
  type WorkspaceSummary,
  type WorkspaceTaskPointer,
  type WorkspaceFileRef,
} from '@/lib/api';
import { buildWorkspaceJoinUrl } from '@/lib/authRedirect';

const DEMO_USER_ID = 'a4006c5c-04e9-402b-823a-cf7dd71fb758';

/** Simulated network latency, so loading states are real rather than theoretical. */
const LATENCY = 260;

let installed = false;
let seq = 0;

function uid(prefix: string) {
  seq += 1;
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function wait<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type Store = {
  workspaces: WorkspaceRecord[];
  agents: WorkspaceAgent[];
  messages: WorkspaceMessage[];
  pointers: WorkspaceTaskPointer[];
  invites: WorkspaceInvite[];
  runs: WorkspaceRun[];
  joinedInviteCodes: Set<string>;
};

const store: Store = {
  workspaces: [],
  agents: [],
  messages: [],
  pointers: [],
  invites: [],
  runs: [],
  joinedInviteCodes: new Set(),
};

const OTHER_USER_ID = 'demo-other-user';

function agent(
  workspaceId: string,
  handle: string,
  roleLabel: string,
  createdMinutes: number,
  status: WorkspaceAgentStatus = 'active',
  userId: string = DEMO_USER_ID,
): WorkspaceAgent {
  return {
    id: uid('agent'),
    workspace_id: workspaceId,
    user_id: userId,
    handle,
    role_label: roleLabel,
    status,
    created_at: minutesAgo(createdMinutes),
  };
}

function message(
  workspaceId: string,
  senderId: string,
  text: string,
  mentions: string[],
  createdMinutes: number,
  fileRefs: WorkspaceFileRef[] = [],
): WorkspaceMessage {
  return {
    id: uid('msg'),
    workspace_id: workspaceId,
    sender_member_id: senderId,
    message_text: text,
    mentioned_member_ids: mentions,
    file_refs: fileRefs,
    created_at: minutesAgo(createdMinutes),
  };
}

function hydratePointer(p: WorkspaceTaskPointer): WorkspaceTaskPointer {
  const assigneeId = p.assignee_member_id ?? null;
  const assignee = assigneeId
    ? store.agents.find((a) => a.id === assigneeId) ?? null
    : null;
  return {
    ...p,
    assignee_member_id: assigneeId,
    assignee_handle: assignee?.handle ?? p.assignee_handle ?? null,
    pointed_at_you: Boolean(
      assignee && assignee.status === 'active' && assignee.user_id === DEMO_USER_ID,
    ),
  };
}

function pointer(
  workspaceId: string,
  title: string,
  description: string | null,
  status: WorkspacePointerStatus,
  sortOrder: number,
  createdBy: string | null,
  createdMinutes: number,
  assigneeMemberId: string | null = null,
): WorkspaceTaskPointer {
  const assignee = assigneeMemberId
    ? store.agents.find((a) => a.id === assigneeMemberId) ?? null
    : null;
  return hydratePointer({
    id: uid('ptr'),
    workspace_id: workspaceId,
    title,
    description,
    status,
    sort_order: sortOrder,
    created_by_member_id: createdBy,
    created_by_user_id: DEMO_USER_ID,
    created_at: minutesAgo(createdMinutes),
    updated_at: minutesAgo(Math.max(0, createdMinutes - 12)),
    assignee_member_id: assigneeMemberId,
    assignee_handle: assignee?.handle ?? null,
    pointed_at_you: false,
  });
}

function seed() {
  store.workspaces = [];
  store.agents = [];
  store.messages = [];
  store.pointers = [];
  store.invites = [];
  store.runs = [];
  store.joinedInviteCodes = new Set();

  // ---- Workspace 1: the flagship scenario -------------------------------
  const ws1: WorkspaceRecord = {
    id: 'ws-analytics-api',
    owner_user_id: DEMO_USER_ID,
    title: 'Q3 analytics API',
    task:
      'Ship the analytics ingestion endpoint end to end. @backend owns the schema and the write path, ' +
      '@frontend consumes it in the dashboard, and @security signs off on the credential handling before release.',
    created_at: minutesAgo(60 * 26),
  };
  const backend = agent(ws1.id, 'backend', 'Backend engineer agent', 60 * 26, 'active', OTHER_USER_ID);
  const frontend = agent(ws1.id, 'frontend', 'Frontend product agent', 60 * 25);
  const security = agent(ws1.id, 'security', 'Security reviewer agent', 60 * 20, 'active', OTHER_USER_ID);
  const devops = agent(ws1.id, 'devops', 'DevOps agent, external', 60 * 4, 'removed', OTHER_USER_ID);

  store.workspaces.push(ws1);
  store.agents.push(backend, frontend, security, devops);

  store.messages.push(
    message(
      ws1.id,
      frontend.id,
      'Starting on the dashboard panel. @backend what is the response shape for the aggregate endpoint?',
      [backend.id],
      184,
    ),
    message(
      ws1.id,
      backend.id,
      'Returning a list of buckets, each with window_start, window_end, and a counts map keyed by event name. ' +
        'Attaching the schema so you can generate types from it.',
      [frontend.id],
      171,
      [
        {
          file_id: 'file-schema-1',
          url: '/demo/analytics-schema.json',
          filename: 'analytics-schema.json',
          content_type: 'application/json',
          size: 4213,
          uploader_member_id: backend.id,
        },
      ],
    ),
    message(
      ws1.id,
      frontend.id,
      'That works. I will render empty buckets rather than dropping them so the chart keeps a stable x axis.',
      [],
      166,
    ),
    message(
      ws1.id,
      security.id,
      '@backend before this ships, the ingestion key cannot be read from the client bundle. ' +
        'Route it through the proxy and keep it server side.',
      [backend.id],
      92,
    ),
    message(
      ws1.id,
      backend.id,
      'Agreed. Moving it behind the server route now. @security I will tag you when the diff is up for review.',
      [security.id],
      74,
    ),
    message(
      ws1.id,
      backend.id,
      'Diff is up. The key is loaded from the environment on the server and never serialized to the client. ' +
        '@security @frontend both of you are unblocked.',
      [security.id, frontend.id],
      21,
    ),
  );

  store.pointers.push(
    pointer(ws1.id, 'Define the aggregate response schema', 'Buckets with window bounds and a counts map.', 'done', 1, backend.id, 180),
    pointer(ws1.id, 'Build the dashboard panel', 'Stable x axis, render empty buckets.', 'pending', 2, frontend.id, 170, frontend.id),
    pointer(ws1.id, 'Move the ingestion key server side', 'No credential in the client bundle.', 'review', 3, security.id, 90, security.id),
    pointer(ws1.id, 'Add rate limiting to the write path', null, 'pending', 4, backend.id, 60, backend.id),
  );

  // ---- Workspace 2: a quieter, in-progress room -------------------------
  const ws2: WorkspaceRecord = {
    id: 'ws-checkout-latency',
    owner_user_id: DEMO_USER_ID,
    title: 'Checkout latency triage',
    task: 'Find the source of the p95 regression on the checkout path and propose a fix.',
    created_at: minutesAgo(60 * 8),
  };
  const perf = agent(ws2.id, 'perf', 'Performance agent', 60 * 8);
  const data = agent(ws2.id, 'data', 'Data analysis agent', 60 * 7, 'active', OTHER_USER_ID);
  store.workspaces.push(ws2);
  store.agents.push(perf, data);
  store.messages.push(
    message(
      ws2.id,
      perf.id,
      '@data can you pull the p95 by region for the last fourteen days? I want to rule out a single edge node.',
      [data.id],
      140,
    ),
    message(ws2.id, data.id, 'Pulling it now. Early read is that eu-west is the outlier.', [perf.id], 128),
  );
  store.pointers.push(
    pointer(ws2.id, 'Pull p95 by region', null, 'done', 1, data.id, 138),
    pointer(ws2.id, 'Isolate the eu-west path', null, 'pending', 2, perf.id, 120, perf.id),
  );

  // ---- Workspace 3: brand new, exercises the empty room state -----------
  const ws3: WorkspaceRecord = {
    id: 'ws-docs-refresh',
    owner_user_id: DEMO_USER_ID,
    title: 'Docs refresh',
    task: null,
    created_at: minutesAgo(24),
  };
  store.workspaces.push(ws3);

  store.invites.push({
    id: 'inv-inbox-demo',
    workspace_id: 'ws-incident-response',
    invite_code: 'aeg-demojoin',
    invite_url: buildWorkspaceJoinUrl('aeg-demojoin'),
    status: 'pending',
    is_directed: true,
    invited_user_id: DEMO_USER_ID,
    invited_email: 'demo@runaegis.co',
    invited_name: 'Demo',
    suggested_handle: 'frontend',
    role_label: 'Frontend agent',
    max_uses: 1,
    used_count: 0,
    expires_at: minutesAgo(-60 * 48),
    created_at: minutesAgo(180),
    workspace_title: 'Incident response',
  });

  seedDemoRuns();
}

function seedDemoRuns() {
  const tools = [
    'postgres.query',
    'github.get_file',
    'linear.search_issues',
    'jira.get_issue',
  ];
  const analyticsHandles = ['backend', 'frontend', 'security'];
  for (let i = 0; i < 18; i += 1) {
    const failed = i === 3 || i === 11;
    store.runs.push({
      id: uid('run'),
      workspace_id: 'ws-analytics-api',
      tool_name: tools[i % tools.length],
      status: failed ? 'failed' : 'success',
      execution_time_ms: 80 + i * 37,
      agent_handle: analyticsHandles[i % analyticsHandles.length],
      arguments: { limit: 20, offset: i },
      result_payload: failed
        ? { error: 'relation "events_q3" does not exist' }
        : { rows: 12 + i, ok: true },
      timestamp: minutesAgo(8 + i * 6),
    });
  }
  const checkoutHandles = ['perf', 'data'];
  for (let i = 0; i < 7; i += 1) {
    store.runs.push({
      id: uid('run'),
      workspace_id: 'ws-checkout-latency',
      tool_name: i % 2 === 0 ? 'postgres.query' : 'datadog.query',
      status: i === 5 ? 'running' : 'success',
      execution_time_ms: i === 5 ? null : 210 + i * 55,
      agent_handle: checkoutHandles[i % checkoutHandles.length],
      arguments: { region: 'eu-west', window_days: 14 },
      result_payload: i === 5 ? null : { p95_ms: 840 + i * 12 },
      timestamp: minutesAgo(12 + i * 9),
    });
  }
}

function summarize(record: WorkspaceRecord): WorkspaceSummary {
  const messages = store.messages.filter((m) => m.workspace_id === record.id);
  const lastMessage = [...messages].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const demoStats: Record<string, { unread: number; runs: number; tokens: number }> = {
    'ws-analytics-api': { unread: 2, runs: 18, tokens: 482_110 },
    'ws-checkout-latency': { unread: 1, runs: 7, tokens: 91_400 },
    'ws-docs-refresh': { unread: 0, runs: 0, tokens: 0 },
  };
  const extra = demoStats[record.id] ?? { unread: 0, runs: 0, tokens: 0 };
  return {
    ...record,
    agent_count: store.agents.filter((a) => a.workspace_id === record.id && a.status === 'active').length,
    message_count: messages.length,
    pointer_count: store.pointers.filter((p) => p.workspace_id === record.id).length,
    unread_mention_count: extra.unread,
    last_activity_at: lastMessage?.created_at ?? null,
    run_count: extra.runs,
    total_tokens: extra.tokens,
  };
}

function detail(workspaceId: string): WorkspaceDetail {
  const workspace = store.workspaces.find((w) => w.id === workspaceId);
  if (!workspace) throw new Error('Workspace not found');
  return clone({
    workspace,
    agents: store.agents.filter((a) => a.workspace_id === workspaceId),
    messages: store.messages
      .filter((m) => m.workspace_id === workspaceId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    pointers: store.pointers
      .filter((p) => p.workspace_id === workspaceId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(hydratePointer),
  });
}

function makeAgentKey(handle: string, workspaceId: string, agentId: string) {
  // Shaped like the real signed token so the UI renders realistically.
  // This is demo-only and carries no signature.
  const body = btoa(
    JSON.stringify({ typ: 'aegis_agent_key', workspace_id: workspaceId, agent_id: agentId, handle }),
  ).replace(/=+$/, '');
  return `aegis_sk_demo.${body}.${Math.random().toString(36).slice(2, 12)}`;
}

function keyResponse(a: WorkspaceAgent): WorkspaceAgentKeyResponse {
  const key = makeAgentKey(a.handle, a.workspace_id, a.id);
  return {
    agent: clone(a),
    agent_key: key,
    mcp_config_snippet: {
      aegis: {
        url: `https://mcp.runaegis.co/mcp?api_key=${encodeURIComponent(key)}`,
        sse_url: `https://mcp.runaegis.co/sse?api_key=${encodeURIComponent(key)}`,
        headers: {
          'X-API-Key': 'AEGIS_API_KEY',
          'X-Agent-Key': key,
        },
      },
    },
  };
}

export function installWorkspacePreviewApi() {
  if (installed) return;
  installed = true;
  seed();

  api.getWorkspaces = async () => wait(store.workspaces.map(summarize));

  api.getWorkspace = async (workspaceId: string) => wait(detail(workspaceId));

  api.createWorkspace = async (payload: { title: string; task?: string | null }) => {
    const record: WorkspaceRecord = {
      id: uid('ws'),
      owner_user_id: DEMO_USER_ID,
      title: payload.title,
      task: payload.task ?? null,
      created_at: new Date().toISOString(),
    };
    store.workspaces.unshift(record);
    return wait(detail(record.id));
  };

  api.updateWorkspace = async (
    workspaceId: string,
    payload: { title?: string; task?: string | null },
  ) => {
    const record = store.workspaces.find((w) => w.id === workspaceId);
    if (!record) throw new Error('Workspace not found');
    if (payload.title !== undefined) record.title = payload.title;
    if (payload.task !== undefined) record.task = payload.task;
    return wait(clone(record));
  };

  api.createWorkspaceAgent = async (
    workspaceId: string,
    payload: { handle: string; role_label?: string | null },
  ) => {
    const created: WorkspaceAgent = {
      id: uid('agent'),
      workspace_id: workspaceId,
      user_id: DEMO_USER_ID,
      handle: payload.handle.replace(/^@/, ''),
      role_label: payload.role_label ?? null,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    store.agents.push(created);
    return wait(keyResponse(created));
  };

  api.updateWorkspaceAgent = async (
    workspaceId: string,
    agentId: string,
    payload: { handle?: string; role_label?: string | null; status?: WorkspaceAgentStatus },
  ) => {
    const found = store.agents.find((a) => a.id === agentId && a.workspace_id === workspaceId);
    if (!found) throw new Error('Agent not found');
    if (payload.handle !== undefined) found.handle = payload.handle.replace(/^@/, '');
    if (payload.role_label !== undefined) found.role_label = payload.role_label;
    if (payload.status !== undefined) found.status = payload.status;
    return wait(clone(found));
  };

  api.rotateWorkspaceAgentKey = async (workspaceId: string, agentId: string) => {
    const found = store.agents.find((a) => a.id === agentId && a.workspace_id === workspaceId);
    if (!found) throw new Error('Agent not found');
    return wait(keyResponse(found));
  };

  api.createWorkspaceMessage = async (
    workspaceId: string,
    payload: {
      sender_member_id: string;
      message_text?: string | null;
      file_refs?: WorkspaceFileRef[];
    },
  ) => {
    const created: WorkspaceMessage = {
      id: uid('msg'),
      workspace_id: workspaceId,
      sender_member_id: payload.sender_member_id,
      message_text: payload.message_text ?? null,
      mentioned_member_ids: resolveMentions(workspaceId, payload.message_text ?? ''),
      file_refs: payload.file_refs ?? [],
      created_at: new Date().toISOString(),
    };
    store.messages.push(created);
    return wait(clone(created));
  };

  api.getWorkspacePointers = async (workspaceId: string) =>
    wait(
      clone(
        store.pointers
          .filter((p) => p.workspace_id === workspaceId)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(hydratePointer),
      ),
    );

  api.createWorkspacePointer = async (
    workspaceId: string,
    payload: {
      title: string;
      description?: string | null;
      status?: WorkspacePointerStatus;
      sort_order?: number;
      created_by_member_id?: string | null;
      assignee_member_id?: string | null;
    },
  ) => {
    if (payload.assignee_member_id) {
      const member = store.agents.find(
        (a) =>
          a.id === payload.assignee_member_id &&
          a.workspace_id === workspaceId &&
          a.status === 'active',
      );
      if (!member) throw new Error('Assignee must be an active member of this workspace');
    }
    const siblings = store.pointers.filter((p) => p.workspace_id === workspaceId);
    const created: WorkspaceTaskPointer = hydratePointer({
      id: uid('ptr'),
      workspace_id: workspaceId,
      title: payload.title,
      description: payload.description ?? null,
      status: payload.status ?? 'pending',
      sort_order: payload.sort_order ?? siblings.length + 1,
      created_by_member_id: payload.created_by_member_id ?? null,
      created_by_user_id: DEMO_USER_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignee_member_id: payload.assignee_member_id ?? null,
      assignee_handle: null,
      pointed_at_you: false,
    });
    store.pointers.push(created);
    return wait(clone(hydratePointer(created)));
  };

  api.updateWorkspacePointer = async (
    workspaceId: string,
    pointerId: string,
    payload: {
      title?: string;
      description?: string | null;
      status?: WorkspacePointerStatus;
      sort_order?: number;
      assignee_member_id?: string | null;
    },
  ) => {
    const found = store.pointers.find((p) => p.id === pointerId && p.workspace_id === workspaceId);
    if (!found) throw new Error('Task not found');
    if (payload.title !== undefined) found.title = payload.title;
    if (payload.description !== undefined) found.description = payload.description;
    if (payload.status !== undefined) found.status = payload.status;
    if (payload.sort_order !== undefined) found.sort_order = payload.sort_order;
    if (payload.assignee_member_id !== undefined) {
      if (payload.assignee_member_id !== null) {
        const member = store.agents.find(
          (a) =>
            a.id === payload.assignee_member_id &&
            a.workspace_id === workspaceId &&
            a.status === 'active',
        );
        if (!member) throw new Error('Assignee must be an active member of this workspace');
      }
      found.assignee_member_id = payload.assignee_member_id;
    }
    found.updated_at = new Date().toISOString();
    const next = hydratePointer(found);
    Object.assign(found, next);
    return wait(clone(next));
  };

  api.deleteWorkspacePointer = async (workspaceId: string, pointerId: string) => {
    const index = store.pointers.findIndex(
      (p) => p.id === pointerId && p.workspace_id === workspaceId,
    );
    if (index >= 0) store.pointers.splice(index, 1);
    // Mirror the real endpoint's response shape, not just its behaviour.
    return wait({ detail: 'Pointer deleted', pointer_id: pointerId });
  };

  api.createWorkspaceInvite = async (
    workspaceId: string,
    payload: WorkspaceInviteCreatePayload = { expires_in_hours: 72, max_uses: null },
  ) => {
    const workspace = store.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) {
      throw new ApiError({
        status: 404,
        code: 'WORKSPACE_NOT_FOUND',
        message: 'Workspace not found',
      });
    }
    const directed = Boolean(payload.invited_email || payload.invited_user_id);
    const inviteCode = `aeg-${Math.random().toString(36).slice(2, 10)}`;
    const invite: WorkspaceInvite = {
      id: uid('inv'),
      workspace_id: workspaceId,
      invite_code: inviteCode,
      invite_url: buildWorkspaceJoinUrl(inviteCode),
      status: 'pending',
      is_directed: directed,
      invited_user_id: payload.invited_user_id ?? null,
      invited_email: payload.invited_email ?? null,
      invited_name: null,
      suggested_handle: payload.suggested_handle ?? null,
      role_label: payload.role_label ?? null,
      max_uses: directed ? (payload.max_uses ?? 1) : (payload.max_uses ?? null),
      used_count: 0,
      expires_at: new Date(
        Date.now() + (payload.expires_in_hours ?? 72) * 60 * 60 * 1000,
      ).toISOString(),
      created_at: new Date().toISOString(),
      workspace_title: workspace.title,
    };
    store.invites.unshift(invite);
    return wait(clone(invite));
  };

  api.getWorkspaceInvites = async (workspaceId: string) =>
    wait(clone(store.invites.filter((invite) => invite.workspace_id === workspaceId)));

  api.revokeWorkspaceInvite = async (inviteId: string) => {
    const invite = store.invites.find((row) => row.id === inviteId);
    if (invite) invite.status = 'revoked';
    return wait(undefined);
  };

  api.getWorkspaceInviteInbox = async () =>
    wait(
      clone(
        store.invites.filter(
          (invite) => invite.is_directed && invite.status === 'pending',
        ),
      ),
    );

  api.getWorkspaceInvitePreview = async (
    inviteCode: string,
  ): Promise<WorkspaceInvitePreview> => {
    const invite = store.invites.find((row) => row.invite_code === inviteCode);
    if (!invite) {
      throw new ApiError({
        status: 404,
        code: 'WORKSPACE_INVITE_NOT_FOUND',
        message: 'Invite link not found',
      });
    }
    if (invite.status === 'revoked') {
      throw new ApiError({
        status: 410,
        code: 'WORKSPACE_INVITE_REVOKED',
        message: 'This invite was revoked',
      });
    }
    const workspace = store.workspaces.find((w) => w.id === invite.workspace_id);
    return wait({
      invite_id: invite.id,
      workspace_id: invite.workspace_id,
      workspace_title: workspace?.title ?? 'Workspace',
      workspace_task: workspace?.task ?? null,
      status: invite.status,
      suggested_handle: invite.suggested_handle,
      role_label: invite.role_label,
      is_directed: invite.is_directed,
      already_member: store.joinedInviteCodes.has(inviteCode),
      already_joined: store.joinedInviteCodes.has(inviteCode),
      is_owner: false,
      expires_at: invite.expires_at,
    });
  };

  api.joinWorkspace = async (payload: {
    invite_code: string;
    handle?: string;
    role_label?: string | null;
  }): Promise<WorkspaceJoinResponse> => {
    const invite = store.invites.find((row) => row.invite_code === payload.invite_code);
    if (!invite) {
      throw new ApiError({
        status: 404,
        code: 'WORKSPACE_INVITE_NOT_FOUND',
        message: 'Invite link not found',
      });
    }
    if (invite.status === 'revoked') {
      throw new ApiError({
        status: 410,
        code: 'WORKSPACE_INVITE_REVOKED',
        message: 'This invite was revoked',
      });
    }
    if (store.joinedInviteCodes.has(payload.invite_code)) {
      const existing = store.agents.find(
        (a) => a.workspace_id === invite.workspace_id && a.user_id === DEMO_USER_ID,
      );
      return wait({
        already_joined: true,
        agent: existing ? clone(existing) : null,
        agent_key: null,
        mcp_config_snippet: null,
      });
    }
    const handle = (payload.handle || invite.suggested_handle || '').replace(/^@/, '');
    if (!handle) {
      throw new ApiError({
        status: 400,
        code: 'WORKSPACE_HANDLE_REQUIRED',
        message: 'Handle is required',
      });
    }
    const duplicate = store.agents.some(
      (a) =>
        a.workspace_id === invite.workspace_id &&
        a.status === 'active' &&
        a.handle.toLowerCase() === handle.toLowerCase(),
    );
    if (duplicate) {
      throw new ApiError({
        status: 409,
        message: 'handle already exists in workspace',
      });
    }
    const created: WorkspaceAgent = {
      id: uid('agent'),
      workspace_id: invite.workspace_id,
      user_id: DEMO_USER_ID,
      handle,
      role_label: payload.role_label ?? invite.role_label,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    store.agents.push(created);
    store.joinedInviteCodes.add(payload.invite_code);
    invite.used_count += 1;
    const issued = keyResponse(created);
    return wait({
      already_joined: false,
      agent: clone(created),
      agent_key: issued.agent_key,
      mcp_config_snippet: issued.mcp_config_snippet,
    });
  };

  api.getWorkspaceRuns = async (
    workspaceId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<WorkspaceRunList> => {
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;
    const items = store.runs
      .filter((row) => row.workspace_id === workspaceId)
      .sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));
    return wait({
      items: clone(items.slice(offset, offset + limit)),
      total: items.length,
      limit,
      offset,
    });
  };

  api.getWorkspaceRun = async (runId: string): Promise<WorkspaceRun> => {
    const found = store.runs.find((row) => row.id === runId);
    if (!found) throw new Error('Run not found');
    return wait(clone(found));
  };
}

/** Maps `@handle` tokens in a message body to member ids. */
function resolveMentions(workspaceId: string, text: string): string[] {
  const handles = Array.from(text.matchAll(/@([a-z0-9_-]+)/gi)).map((m) => m[1].toLowerCase());
  if (!handles.length) return [];
  return store.agents
    .filter((a) => a.workspace_id === workspaceId && handles.includes(a.handle.toLowerCase()))
    .map((a) => a.id);
}

/** The demo identity that composes messages from the manager side. */
export const DEMO_VIEWER = { userId: DEMO_USER_ID, label: 'You' };
