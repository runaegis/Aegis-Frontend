'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AtSign,
  Bot,
  Code2,
  CircleDashed,
  Database,
  KeyRound,
  MessageSquareText,
  Monitor,
  Paperclip,
  Plus,
  Search,
  Send,
  Server,
  Shield,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { api, type WorkspaceAgentKeyResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type AgentStatus = 'active' | 'removed';

type AgentMembership = {
  id: string;
  handle: string;
  role_label: string | null;
  status: AgentStatus;
};

type WorkspaceFileRef = {
  url: string;
  filename: string;
  content_type?: string | null;
  size: number;
  uploader_member_id?: string | null;
};

type WorkspaceMessage = {
  id: string;
  workspace_id?: string;
  sender_member_id: string;
  message_text: string | null;
  mentioned_member_ids: string[];
  file_refs: WorkspaceFileRef[];
  created_at: string;
};

type AgentWorkspace = {
  id: string;
  title: string;
  task: string;
  agents: AgentMembership[];
  messages: WorkspaceMessage[];
  agent_count?: number;
  message_count?: number;
  created_at: string;
};

type Mention = {
  handle: string;
  agent?: AgentMembership;
};

const STATUS_OPTIONS: AgentStatus[] = ['active', 'removed'];

type AgentVisual = {
  Icon: LucideIcon;
  shell: string;
  icon: string;
  label: string;
};

const AGENT_VISUAL_FALLBACK: AgentVisual = {
  Icon: Bot,
  shell: 'bg-[var(--neutral-strong-950)] text-white shadow-[0_12px_30px_rgba(23,23,23,0.18)]',
  icon: 'text-white',
  label: 'Agent',
};

function normalizeHandle(value: string) {
  return value
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

function extractMentions(task: string, agents: AgentMembership[]): Mention[] {
  const byHandle = new Map(agents.map((agent) => [agent.handle.toLowerCase(), agent]));
  const seen = new Set<string>();
  const mentions: Mention[] = [];
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;

  for (const match of task.matchAll(mentionRegex)) {
    const handle = match[1].toLowerCase();
    if (seen.has(handle)) continue;
    seen.add(handle);
    mentions.push({ handle, agent: byHandle.get(handle) });
  }

  return mentions;
}

function findAgent(agents: AgentMembership[], memberId: string) {
  return agents.find((agent) => agent.id === memberId);
}

function inferRoleLabel(handle: string) {
  if (handle.includes('front') || handle.includes('ui')) return 'Frontend product agent';
  if (handle.includes('back') || handle.includes('api')) return 'Backend engineer agent';
  if (handle.includes('infra') || handle.includes('terraform')) return 'Infrastructure agent';
  if (handle.includes('security') || handle.includes('review')) return 'Review agent';
  return `Agent @${handle}`;
}

function getAgentVisual(agent?: AgentMembership): AgentVisual {
  const identity = `${agent?.handle ?? ''} ${agent?.role_label ?? ''}`.toLowerCase();

  if (identity.includes('front') || identity.includes('ui')) {
    return {
      Icon: Monitor,
      shell: 'bg-[linear-gradient(135deg,#1d4ed8,#60a5fa)] text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)]',
      icon: 'text-white',
      label: 'Frontend',
    };
  }

  if (identity.includes('back') || identity.includes('api')) {
    return {
      Icon: Server,
      shell: 'bg-[linear-gradient(135deg,#0f766e,#2dd4bf)] text-white shadow-[0_14px_34px_rgba(13,148,136,0.25)]',
      icon: 'text-white',
      label: 'Backend',
    };
  }

  if (identity.includes('infra') || identity.includes('terraform')) {
    return {
      Icon: Database,
      shell: 'bg-[linear-gradient(135deg,#7c2d12,#fb923c)] text-white shadow-[0_14px_34px_rgba(234,88,12,0.25)]',
      icon: 'text-white',
      label: 'Infra',
    };
  }

  if (identity.includes('security') || identity.includes('review')) {
    return {
      Icon: ShieldCheck,
      shell: 'bg-[linear-gradient(135deg,#581c87,#a78bfa)] text-white shadow-[0_14px_34px_rgba(124,58,237,0.25)]',
      icon: 'text-white',
      label: 'Review',
    };
  }

  return AGENT_VISUAL_FALLBACK;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function renderTextWithMentions(text: string, agents: AgentMembership[]) {
  const parts = text.split(/(@[a-zA-Z0-9_-]+)/g);

  return parts.map((part, index) => {
    if (!part.startsWith('@')) return part;

    const handle = part.slice(1).toLowerCase();
    const agent = agents.find((candidate) => candidate.handle.toLowerCase() === handle);

    return (
      <MentionPill key={`${part}-${index}`} handle={handle} agent={agent} inline />
    );
  });
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<AgentWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentKeyResponse, setAgentKeyResponse] = useState<WorkspaceAgentKeyResponse | null>(null);
  const [workspaceTitle, setWorkspaceTitle] = useState('');
  const [workspaceTask, setWorkspaceTask] = useState('');
  const [agentHandle, setAgentHandle] = useState('');
  const [agentRoleLabel, setAgentRoleLabel] = useState('');
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  const [showInspect, setShowInspect] = useState(false);
  const [query, setQuery] = useState('');
  const [messageDraft, setMessageDraft] = useState('');

  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  const hydrateWorkspaceDetail = useCallback(async (workspaceId: string) => {
    setLoadingWorkspace(true);
    try {
      const detail = await api.getWorkspace(workspaceId);
      setWorkspaces((current) =>
        current.map((workspace) =>
          workspace.id === workspaceId
            ? {
                id: detail.workspace.id,
                title: detail.workspace.title,
                task: detail.workspace.task ?? '',
                agents: detail.agents,
                messages: detail.messages,
                agent_count: detail.agents.length,
                message_count: detail.messages.length,
                created_at: detail.workspace.created_at,
              }
            : workspace,
        ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const summaries = await api.getWorkspaces();
      const nextWorkspaces = summaries.map((workspace) => ({
        id: workspace.id,
        title: workspace.title,
        task: workspace.task ?? '',
        agents: [],
        messages: [],
        agent_count: workspace.agent_count,
        message_count: workspace.message_count,
        created_at: workspace.created_at,
      }));
      setWorkspaces(nextWorkspaces);
      const nextActiveId = activeWorkspaceId || nextWorkspaces[0]?.id || '';
      setActiveWorkspaceId(nextActiveId);
      setError(null);
      if (nextActiveId) {
        await hydrateWorkspaceDetail(nextActiveId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, hydrateWorkspaceDetail]);

  useEffect(() => {
    void fetchWorkspaces();
    // Run once on mount. Subsequent active workspace changes hydrate separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    void hydrateWorkspaceDetail(activeWorkspaceId);
  }, [activeWorkspaceId, hydrateWorkspaceDetail]);

  const filteredWorkspaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaces;

    return workspaces.filter((workspace) => {
      const agentText = workspace.agents
        .map((agent) => `${agent.handle} ${agent.role_label}`)
        .join(' ')
        .toLowerCase();
      return (
        workspace.title.toLowerCase().includes(q) ||
        workspace.task.toLowerCase().includes(q) ||
        agentText.includes(q)
      );
    });
  }, [query, workspaces]);

  const mentions = useMemo(
    () => (activeWorkspace ? extractMentions(activeWorkspace.task, activeWorkspace.agents) : []),
    [activeWorkspace],
  );

  const resolvedMentionCount = mentions.filter((mention) => mention.agent).length;
  const activeAgents = activeWorkspace?.agents.filter((agent) => agent.status === 'active') ?? [];
  const selectedMessageSender = activeAgents[0];
  const typingAgent = activeAgents.find((agent) => agent.id !== selectedMessageSender?.id) ?? activeAgents[0];

  const updateActiveWorkspace = (patch: Partial<Pick<AgentWorkspace, 'title' | 'task'>>) => {
    if (!activeWorkspace) return;
    setWorkspaces((current) =>
      current.map((workspace) =>
        workspace.id === activeWorkspace.id ? { ...workspace, ...patch } : workspace,
      ),
    );
  };

  const updateAgent = (agentId: string, patch: Partial<AgentMembership>) => {
    if (!activeWorkspace) return;
    setWorkspaces((current) =>
      current.map((workspace) =>
        workspace.id === activeWorkspace.id
          ? {
              ...workspace,
              agents: workspace.agents.map((agent) =>
                agent.id === agentId ? { ...agent, ...patch } : agent,
              ),
            }
          : workspace,
      ),
    );
  };

  const saveActiveWorkspace = async () => {
    if (!activeWorkspace) return;
    try {
      const updated = await api.updateWorkspace(activeWorkspace.id, {
        title: activeWorkspace.title,
        task: activeWorkspace.task,
      });
      setWorkspaces((current) =>
        current.map((workspace) =>
          workspace.id === activeWorkspace.id
            ? {
                ...workspace,
                title: updated.title,
                task: updated.task ?? '',
                created_at: updated.created_at,
              }
            : workspace,
        ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const saveAgent = async (agent: AgentMembership) => {
    if (!activeWorkspace) return;
    try {
      const updated = await api.updateWorkspaceAgent(activeWorkspace.id, agent.id, {
        handle: agent.handle,
        role_label: agent.role_label,
        status: agent.status,
      });
      setWorkspaces((current) =>
        current.map((workspace) =>
          workspace.id === activeWorkspace.id
            ? {
                ...workspace,
                agents: workspace.agents.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
              }
            : workspace,
        ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const mergeAgent = (updated: AgentMembership) => {
    if (!activeWorkspace) return;
    setWorkspaces((current) =>
      current.map((workspace) =>
        workspace.id === activeWorkspace.id
          ? {
              ...workspace,
              agents: workspace.agents.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : workspace,
      ),
    );
  };

  const rotateAgentKey = async (agent: AgentMembership) => {
    if (!activeWorkspace) return;
    try {
      const response = await api.rotateWorkspaceAgentKey(activeWorkspace.id, agent.id);
      mergeAgent(response.agent);
      setAgentKeyResponse(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const revokeAgent = async (agent: AgentMembership) => {
    if (!activeWorkspace) return;
    try {
      const updated = await api.revokeWorkspaceAgent(activeWorkspace.id, agent.id);
      mergeAgent(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const revokeAgentKeyOnly = async (agent: AgentMembership) => {
    if (!activeWorkspace) return;
    try {
      const response = await api.revokeWorkspaceAgentKey(activeWorkspace.id, agent.id);
      mergeAgent(response.agent);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setError(null);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const createWorkspace = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = workspaceTitle.trim();
    if (!title) return;
    void (async () => {
      try {
        const detail = await api.createWorkspace({
          title,
          task: workspaceTask.trim() || null,
        });
        const workspace: AgentWorkspace = {
          id: detail.workspace.id,
          title: detail.workspace.title,
          task: detail.workspace.task ?? '',
          agents: detail.agents,
          messages: detail.messages,
          agent_count: detail.agents.length,
          message_count: detail.messages.length,
          created_at: detail.workspace.created_at,
        };
        setWorkspaces((current) => [workspace, ...current]);
        setActiveWorkspaceId(workspace.id);
        setWorkspaceTitle('');
        setWorkspaceTask('');
        setQuery('');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  };

  const createAgent = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeWorkspace) return;

    const handle = normalizeHandle(agentHandle);
    const roleLabel = agentRoleLabel.trim() || inferRoleLabel(handle);
    if (!handle) return;

    const handleExists = activeWorkspace.agents.some(
      (agent) => agent.handle.toLowerCase() === handle,
    );
    if (handleExists) {
      setError(
        'Handle already exists in this workspace. Removed handles are not reusable until the backend changes the unique index.',
      );
      return;
    }

    void (async () => {
      try {
        const response = await api.createWorkspaceAgent(activeWorkspace.id, {
          handle,
          role_label: roleLabel,
        });
        setWorkspaces((current) =>
          current.map((workspace) =>
            workspace.id === activeWorkspace.id
              ? {
                  ...workspace,
                  agents: [...workspace.agents, response.agent],
                  agent_count: (workspace.agent_count ?? workspace.agents.length) + 1,
                }
              : workspace,
          ),
        );
        setAgentKeyResponse(response);
        setAgentHandle('');
        setAgentRoleLabel('');
        setShowAgentDetails(false);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  };

  const postMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeWorkspace || !selectedMessageSender) return;

    const text = messageDraft.trim();
    if (!text) return;

    void (async () => {
      try {
        const message = await api.createWorkspaceMessage(activeWorkspace.id, {
          sender_member_id: selectedMessageSender.id,
          message_text: text,
          file_refs: [],
        });
        setWorkspaces((current) =>
          current.map((workspace) =>
            workspace.id === activeWorkspace.id
              ? {
                  ...workspace,
                  messages: [...workspace.messages, message],
                  message_count: (workspace.message_count ?? workspace.messages.length) + 1,
                }
              : workspace,
          ),
        );
        setMessageDraft('');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg-app)]">
        <div className="rounded-[18px] bg-white px-5 py-4 text-[13px] font-medium text-[var(--neutral-sub-600)] shadow-[0_16px_48px_rgba(23,23,23,0.08)]">
          Loading workspaces...
        </div>
      </main>
    );
  }

  if (!activeWorkspace) {
    return (
      <main className="min-h-screen bg-[var(--bg-app)]">
        <div className="mx-auto flex min-h-screen max-w-[560px] items-center px-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Create your first workspace</CardTitle>
            </CardHeader>
            <CardBody>
              {error && (
                <p className="mb-3 rounded-[10px] bg-[var(--error-lighter)] px-3 py-2 text-[12px] text-[var(--error-dark)]">
                  {error}
                </p>
              )}
              <form onSubmit={createWorkspace} className="space-y-3">
                <Input
                  value={workspaceTitle}
                  onChange={(event) => setWorkspaceTitle(event.target.value)}
                  placeholder="Workspace title"
                />
                <textarea
                  value={workspaceTask}
                  onChange={(event) => setWorkspaceTask(event.target.value)}
                  placeholder="Task. Mention agents with @handle..."
                  className="min-h-[120px] w-full resize-none rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-3 py-2 text-[13px] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] hover:border-[var(--neutral-soft-400)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
                />
                <Button type="submit" variant="primary" fullWidth disabled={!workspaceTitle.trim()}>
                  Create workspace
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg-app)]">
      <header className="sticky top-0 z-20 border-b border-[var(--stroke-soft-200)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex shrink-0 text-[var(--neutral-strong-950)] transition-opacity hover:opacity-80"
              aria-label="Aegis dashboard"
            >
              <AegisLogo style={{ height: 21, width: 'auto' }} />
            </Link>
            <div className="hidden h-5 w-px bg-[var(--stroke-soft-200)] sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--neutral-strong-950)]">
                Agent Workspaces
              </h1>
              <p className="hidden text-[12px] text-[var(--neutral-soft-400)] sm:block">
                Watch agents coordinate, mention, and hand off work
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loadingWorkspace && (
              <Badge tone="neutral" uppercase>
                Syncing
              </Badge>
            )}
            <button
              type="button"
              onClick={() => setShowInspect((value) => !value)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-[9px] border px-2.5 text-[12px] font-semibold transition-colors',
                showInspect
                  ? 'border-[var(--primary-base)] bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
                  : 'border-[var(--stroke-soft-200)] bg-white text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)]',
              )}
              title="Toggle inspect mode"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Inspect</span>
            </button>
            <Badge tone="primary" uppercase>
              UX only
            </Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1800px] grid-cols-1 gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)] lg:px-8">
        {error && (
          <div className="rounded-[12px] bg-[var(--error-lighter)] px-4 py-3 text-[12.5px] font-medium text-[var(--error-dark)] lg:col-span-2">
            {error}
          </div>
        )}
        <aside className="space-y-4 lg:sticky lg:top-[76px] lg:max-h-[calc(100dvh-92px)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <Card className="border-transparent bg-transparent shadow-none">
            <CardHeader className="border-0 px-1 pb-2 pt-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Workspaces
                </p>
                <CardTitle className="mt-1">Load a workspace</CardTitle>
              </div>
              <Badge tone="neutral">{workspaces.length}</Badge>
            </CardHeader>
            <CardBody className="space-y-3 px-1 pt-0">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search workspaces..."
                leadingIcon={<Search className="h-3.5 w-3.5" />}
              />
              <div className="space-y-2">
                {filteredWorkspaces.map((workspace) => {
                  const isActive = workspace.id === activeWorkspace.id;
                  const workspaceMentions = extractMentions(workspace.task, workspace.agents);
                  return (
                    <button
                      key={workspace.id}
                      type="button"
                      onClick={() => setActiveWorkspaceId(workspace.id)}
                      className={cn(
                        'w-full rounded-[14px] p-3 text-left transition-all',
                        isActive
                          ? 'bg-white shadow-[0_14px_40px_rgba(23,23,23,0.08)] ring-1 ring-[var(--primary-alpha-24)]'
                          : 'bg-transparent hover:bg-white hover:shadow-[0_8px_24px_rgba(23,23,23,0.05)]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 text-[13px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                          {workspace.title}
                        </p>
                        <Badge tone={isActive ? 'primary' : 'neutral'} uppercase>
                          {workspace.agent_count ?? workspace.agents.length}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11.5px] leading-[1.45] text-[var(--neutral-sub-600)]">
                        {workspace.task || 'No task added yet.'}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[10.5px] text-[var(--neutral-soft-400)]">
                        <span>{formatCreatedAt(workspace.created_at)}</span>
                        <span>
                          {workspace.message_count ?? workspace.messages.length} chats · {workspaceMentions.length} mentions
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card className="border-transparent bg-transparent shadow-none">
            <CardHeader className="border-0 px-1 pb-2 pt-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Create
                </p>
                <CardTitle className="mt-1">New workspace</CardTitle>
              </div>
              <Plus className="h-4 w-4 text-[var(--neutral-soft-400)]" />
            </CardHeader>
            <CardBody className="px-1 pt-0">
              <form onSubmit={createWorkspace} className="space-y-3">
                <Input
                  value={workspaceTitle}
                  onChange={(event) => setWorkspaceTitle(event.target.value)}
                  placeholder="Workspace title"
                />
                <textarea
                  value={workspaceTask}
                  onChange={(event) => setWorkspaceTask(event.target.value)}
                  placeholder="Task. Mention agents with @handle..."
                  className="min-h-[104px] w-full resize-none rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-3 py-2 text-[13px] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] hover:border-[var(--neutral-soft-400)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
                />
                <Button type="submit" variant="primary" fullWidth disabled={!workspaceTitle.trim()}>
                  Create workspace
                </Button>
              </form>
            </CardBody>
          </Card>
        </aside>

        <section className="space-y-5 lg:min-w-0">
          <Card className="border-transparent bg-white/70 shadow-[0_16px_48px_rgba(23,23,23,0.05)]">
            <CardHeader className="items-start border-0 pb-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Workspace brief
                </p>
                <CardTitle className="mt-1 text-[20px] tracking-[-0.03em]">{activeWorkspace.title}</CardTitle>
                {showInspect && (
                  <p className="mt-1 text-[12px] text-[var(--neutral-soft-400)]">
                    id: <span className="font-mono">{activeWorkspace.id}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                <Badge tone="info" leadingIcon={<Users className="h-3 w-3" />}>
                  {activeWorkspace.agents.length} agents
                </Badge>
                <span className="animate-pulse">
                  <Badge tone="primary" leadingIcon={<AtSign className="h-3 w-3" />}>
                  {resolvedMentionCount}/{mentions.length} mentions
                  </Badge>
                </span>
                <Badge tone="neutral" leadingIcon={<MessageSquareText className="h-3 w-3" />}>
                  {activeWorkspace.messages.length} messages
                </Badge>
                <Button type="button" variant="secondary" size="sm" onClick={saveActiveWorkspace}>
                  Save brief
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
                  Title
                </label>
                <Input
                  value={activeWorkspace.title}
                  onChange={(event) => updateActiveWorkspace({ title: event.target.value })}
                  placeholder="Workspace title"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
                    Task
                  </label>
                  <span className="text-[11px] text-[var(--neutral-soft-400)]">
                    Use @handle to request a handoff
                  </span>
                </div>
                <textarea
                  value={activeWorkspace.task}
                  onChange={(event) => updateActiveWorkspace({ task: event.target.value })}
                  placeholder="Describe the goal and mention agents with @handle..."
                  className="min-h-[220px] w-full resize-none rounded-[10px] border border-[var(--stroke-sub-300)] bg-white px-3 py-2.5 text-[13px] leading-[1.55] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] hover:border-[var(--neutral-soft-400)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
                />
              </div>
            </CardBody>
          </Card>

          <Card className="border-[var(--primary-alpha-24)] bg-white shadow-[0_24px_80px_rgba(23,23,23,0.10)] ring-1 ring-[var(--primary-alpha-10)]">
            <CardHeader className="items-start border-[var(--primary-alpha-10)] bg-[radial-gradient(circle_at_top_right,rgba(250,115,25,0.13),transparent_32%),linear-gradient(180deg,#fff,#fffaf7)]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Live agent room
                </p>
                <CardTitle className="mt-1 text-[18px] tracking-[-0.03em]">Agent group chat</CardTitle>
                {typingAgent && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-2.5 py-1 text-[11.5px] font-medium text-[var(--neutral-sub-600)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" />
                    </span>
                    @{typingAgent.handle} is typing...
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {showInspect && (
                  <Badge tone="neutral" uppercase>
                    workspace_message
                  </Badge>
                )}
                <MessageSquareText className="h-4 w-4 text-[var(--primary-base)]" />
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="min-h-[520px] max-h-[calc(100dvh-330px)] space-y-5 overflow-y-auto rounded-[18px] bg-[linear-gradient(180deg,#fffaf7_0%,#f7f7f7_100%)] p-4 xl:min-h-[620px] 2xl:min-h-[700px]">
                {activeWorkspace.messages.length === 0 ? (
                  <EmptyPanel
                    icon={<MessageSquareText className="h-4 w-4" />}
                    title="No workspace messages yet"
                    body="Agent handoffs and mention-driven chat history will show up here."
                  />
                ) : (
                  activeWorkspace.messages.map((message) => {
                    const sender = findAgent(activeWorkspace.agents, message.sender_member_id);
                    const mentionedAgents = message.mentioned_member_ids
                      .map((memberId) => findAgent(activeWorkspace.agents, memberId))
                      .filter((agent): agent is AgentMembership => Boolean(agent));
                    const senderName = sender?.handle ?? 'unknown-agent';

                    return (
                      <article key={message.id} className="group flex items-start gap-3">
                        <AgentGlyph agent={sender} />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">
                              @{senderName}
                            </span>
                            {sender && <StatusPill status={sender.status} />}
                            <span className="text-[10.5px] text-[var(--neutral-soft-400)]">
                              {formatCreatedAt(message.created_at)}
                            </span>
                          </div>

                          <div className="rounded-[18px] bg-white px-4 py-3 shadow-[0_12px_34px_rgba(23,23,23,0.08)] ring-1 ring-[var(--stroke-soft-200)] transition-transform duration-200 group-hover:-translate-y-0.5">
                            <p className="whitespace-pre-wrap text-[13px] leading-[1.55] text-[var(--neutral-strong-950)]">
                              {renderTextWithMentions(message.message_text ?? '', activeWorkspace.agents)}
                            </p>

                            {(mentionedAgents.length > 0 || message.file_refs.length > 0) && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {mentionedAgents.map((agent) => (
                                  <MentionPill key={agent.id} handle={agent.handle} agent={agent} />
                                ))}
                                {message.file_refs.map((file) => (
                                  <span
                                    key={`${message.id}-${file.filename}`}
                                    className="inline-flex h-[22px] items-center gap-1.5 rounded-[7px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-2 text-[11px] font-medium text-[var(--neutral-sub-600)]"
                                  >
                                    <Paperclip className="h-3 w-3" />
                                    <span className="max-w-[180px] truncate">{file.filename}</span>
                                    <span className="text-[var(--neutral-soft-400)]">
                                      {formatFileSize(file.size)}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {showInspect && (
                            <p className="mt-1 font-mono text-[10.5px] text-[var(--neutral-soft-400)]">
                              {message.id} · sender_member_id: {message.sender_member_id}
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              <form onSubmit={postMessage} className="rounded-[16px] bg-white p-3 shadow-[0_10px_32px_rgba(23,23,23,0.06)] ring-1 ring-[var(--stroke-soft-200)]">
                <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[190px_minmax(0,1fr)]">
                  <div className="flex h-9 items-center gap-2 rounded-[10px] bg-[var(--neutral-weak-50)] px-2.5">
                    {selectedMessageSender ? (
                      <>
                        <AgentGlyph agent={selectedMessageSender} compact />
                        <span className="min-w-0 truncate font-mono text-[12px] font-semibold text-[var(--neutral-strong-950)]">
                          @{selectedMessageSender.handle}
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px] text-[var(--neutral-soft-400)]">
                        No active agent
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 rounded-[8px] bg-[var(--primary-alpha-10)] px-3 text-[11.5px] font-medium text-[var(--primary-dark)]">
                    <MessageSquareText className="h-3.5 w-3.5" />
                    Type @handle in the message to mention an agent.
                  </div>
                </div>
                <textarea
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  placeholder="Post as selected agent. Mention another agent with @handle..."
                  className="min-h-[92px] w-full resize-none rounded-[10px] border border-[var(--stroke-sub-300)] bg-white px-3 py-2.5 text-[13px] leading-[1.55] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] hover:border-[var(--neutral-soft-400)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
                  disabled={activeAgents.length === 0}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-[var(--neutral-soft-400)]">
                    Attachments appear as file chips in the thread.
                  </p>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!messageDraft.trim() || activeAgents.length === 0}
                    leadingIcon={<Send className="h-3.5 w-3.5" />}
                  >
                    Post
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card className="border-transparent bg-transparent shadow-none">
            <CardHeader className="border-0 px-1 pb-2 pt-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Mention resolver
                </p>
                <CardTitle className="mt-1">Task mentions</CardTitle>
              </div>
              <AtSign className="h-4 w-4 text-[var(--neutral-soft-400)]" />
            </CardHeader>
            <CardBody className="px-1 pt-0">
              {mentions.length === 0 ? (
                <EmptyPanel
                  icon={<CircleDashed className="h-4 w-4" />}
                  title="No mentions in this task"
                  body="Type @backend, @frontend, or any configured handle in the task field."
                />
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {mentions.map((mention) => (
                    <div
                      key={mention.handle}
                      className={cn(
                        'rounded-[14px] p-3 shadow-[0_8px_24px_rgba(23,23,23,0.04)]',
                        mention.agent
                          ? 'bg-white'
                          : 'bg-[var(--error-lighter)] ring-1 ring-[var(--error)]/20',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <MentionPill handle={mention.handle} agent={mention.agent} />
                        {mention.agent ? <StatusPill status={mention.agent.status} /> : <Badge tone="error">unknown</Badge>}
                      </div>
                      <p className="mt-1 text-[11.5px] text-[var(--neutral-sub-600)]">
                        {mention.agent
                          ? mention.agent.role_label ?? 'Workspace agent'
                          : 'No agent has this handle in the workspace.'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </section>

        <aside className="space-y-5 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-[76px] xl:self-start">
          <Card className="border-transparent bg-transparent shadow-none">
            <CardHeader className="border-0 px-1 pb-2 pt-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Agents
                </p>
                <CardTitle className="mt-1">Invite an agent</CardTitle>
              </div>
              <Bot className="h-4 w-4 text-[var(--neutral-soft-400)]" />
            </CardHeader>
            <CardBody className="px-1 pt-0">
              <form onSubmit={createAgent} className="space-y-3">
                <Input
                  value={agentHandle}
                  onChange={(event) => setAgentHandle(event.target.value)}
                  placeholder="handle, e.g. backend"
                  leadingIcon={<AtSign className="h-3.5 w-3.5" />}
                />
                <button
                  type="button"
                  onClick={() => setShowAgentDetails((value) => !value)}
                  className="text-[12px] font-semibold text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--neutral-strong-950)]"
                >
                  {showAgentDetails ? 'Hide details' : 'Add role details'}
                </button>
                {showAgentDetails && (
                  <Input
                    value={agentRoleLabel}
                    onChange={(event) => setAgentRoleLabel(event.target.value)}
                    placeholder="Optional role label"
                  />
                )}
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  disabled={!normalizeHandle(agentHandle)}
                >
                  Create agent
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card className="border-transparent bg-transparent shadow-none">
            <CardHeader className="border-0 px-1 pb-2 pt-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Agent roster
                </p>
                <CardTitle className="mt-1">Memberships</CardTitle>
              </div>
              <KeyRound className="h-4 w-4 text-[var(--neutral-soft-400)]" />
            </CardHeader>
            <CardBody className="space-y-3 px-1 pt-0">
              {activeWorkspace.agents.length === 0 ? (
                <EmptyPanel
                  icon={<Users className="h-4 w-4" />}
                  title="No agents yet"
                  body="Create a workspace member before @mentions can resolve."
                />
              ) : (
                activeWorkspace.agents.map((agent) => {
                  const duplicateHandle = activeWorkspace.agents.some(
                    (other) =>
                      other.id !== agent.id &&
                      other.handle.toLowerCase() === agent.handle.toLowerCase(),
                  );

                  return (
                    <div
                      key={agent.id}
                      className="rounded-[16px] bg-white p-3 shadow-[0_10px_30px_rgba(23,23,23,0.06)] ring-1 ring-[var(--stroke-soft-200)]"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <AgentGlyph agent={agent} compact />
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">
                              @{agent.handle}
                            </p>
                            {showInspect ? (
                              <p className="truncate text-[11px] text-[var(--neutral-soft-400)]">
                                {agent.id}
                              </p>
                            ) : (
                              <p className="truncate text-[11px] text-[var(--neutral-soft-400)]">
                                {getAgentVisual(agent).label}
                              </p>
                            )}
                          </div>
                        </div>
                        <StatusPill status={agent.status} />
                      </div>

                      <div className="space-y-2">
                        <Input
                          value={agent.handle}
                          onChange={(event) =>
                            updateAgent(agent.id, {
                              handle: normalizeHandle(event.target.value),
                            })
                          }
                          onBlur={(event) =>
                            void saveAgent({
                              ...agent,
                              handle: normalizeHandle(event.target.value),
                            })
                          }
                          invalid={duplicateHandle}
                          leadingIcon={<AtSign className="h-3.5 w-3.5" />}
                        />
                        {duplicateHandle && (
                          <p className="text-[11px] text-[var(--error-dark)]">
                            Handles must be unique inside a workspace.
                          </p>
                        )}
                        <Input
                          value={agent.role_label ?? ''}
                          onChange={(event) =>
                            updateAgent(agent.id, { role_label: event.target.value })
                          }
                          onBlur={(event) =>
                            void saveAgent({
                              ...agent,
                              role_label: event.target.value,
                            })
                          }
                        />
                        <Select
                          value={agent.status}
                          onChange={(event) => {
                            const status = event.target.value as AgentStatus;
                            const nextAgent = { ...agent, status };
                            updateAgent(agent.id, { status });
                            void saveAgent(nextAgent);
                          }}
                          className="w-full"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </Select>
                        <div className="grid grid-cols-1 gap-1.5 pt-1 sm:grid-cols-2 xl:grid-cols-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void rotateAgentKey(agent)}
                          >
                            Generate key
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void revokeAgentKeyOnly(agent)}
                          >
                            Revoke key only
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => void revokeAgent(agent)}
                            disabled={agent.status === 'removed'}
                            className="sm:col-span-2 xl:col-span-1"
                          >
                            Remove agent
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>

          <Card className="border-transparent bg-transparent shadow-none">
            <CardBody className="px-1">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--primary-alpha-10)] text-[var(--primary-base)]">
                  <Shield className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">
                    Identity flow wired
                  </p>
                  <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                    Create or rotate a key to reveal the raw AEGIS_AGENT_KEY once,
                    then paste the snippet into your MCP config.
                    {showInspect ? ' Inspect mode reveals mock row identifiers.' : ''}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>

      {agentKeyResponse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[640px] rounded-[18px] bg-white p-5 shadow-[0_24px_80px_rgba(23,23,23,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  One-time agent key
                </p>
                <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-[var(--neutral-strong-950)]">
                  Copy @{agentKeyResponse.agent.handle}&apos;s identity now
                </h2>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                  Aegis stores only the hash. This key will not be shown again after
                  you close this panel.
                </p>
              </div>
              <StatusPill status={agentKeyResponse.agent.status} />
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
                    AEGIS_AGENT_KEY
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void copyText(agentKeyResponse.agent_key)}
                  >
                    Copy key
                  </Button>
                </div>
                <code className="block max-h-[120px] overflow-auto rounded-[12px] bg-[var(--neutral-weak-50)] p-3 font-mono text-[12px] leading-[1.5] text-[var(--neutral-strong-950)]">
                  {agentKeyResponse.agent_key}
                </code>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
                    MCP config snippet
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void copyText(JSON.stringify(agentKeyResponse.mcp_config_snippet, null, 2))
                    }
                  >
                    Copy snippet
                  </Button>
                </div>
                <pre className="max-h-[220px] overflow-auto rounded-[12px] bg-[var(--neutral-strong-950)] p-3 text-[12px] leading-[1.5] text-white">
                  {JSON.stringify(agentKeyResponse.mcp_config_snippet, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAgentKeyResponse(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function AgentGlyph({
  agent,
  compact = false,
}: {
  agent?: AgentMembership;
  compact?: boolean;
}) {
  const visual = getAgentVisual(agent);
  const Icon = visual.Icon;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        compact ? 'h-8 w-8 rounded-[10px]' : 'h-11 w-11 rounded-[16px]',
        agent?.status === 'removed'
          ? 'bg-[var(--neutral-soft-200)] text-[var(--neutral-soft-400)] shadow-none'
          : visual.shell,
      )}
      title={agent ? `@${agent.handle} - ${agent.role_label ?? 'Workspace agent'}` : 'Unknown agent'}
    >
      <Icon className={cn(compact ? 'h-4 w-4' : 'h-5 w-5', visual.icon)} strokeWidth={2.2} />
    </span>
  );
}

function StatusPill({ status }: { status: AgentStatus }) {
  const active = status === 'active';
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold tracking-[0.01em]',
        active
          ? 'bg-[rgba(31,193,107,0.16)] text-[var(--success-dark)]'
          : 'bg-[var(--neutral-soft-200)] text-[var(--neutral-sub-600)]',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          active ? 'bg-[var(--success)]' : 'bg-[var(--neutral-soft-400)]',
        )}
      />
      {status}
    </span>
  );
}

function MentionPill({
  handle,
  agent,
  inline = false,
}: {
  handle: string;
  agent?: AgentMembership;
  inline?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-mono font-bold transition-colors',
        inline ? 'mx-0.5 h-[22px] px-2 text-[11.5px] align-baseline' : 'h-[24px] px-2.5 text-[12px]',
        agent
          ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-dark)] ring-1 ring-[var(--primary-alpha-16)]'
          : 'bg-[var(--error-lighter)] text-[var(--error-dark)] ring-1 ring-[var(--error)]/20',
      )}
      title={agent ? agent.role_label ?? `@${agent.handle}` : 'Unknown handle'}
    >
      <AtSign className="h-3 w-3" />
      {handle}
    </span>
  );
}

function EmptyPanel({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[10px] border border-dashed border-[var(--stroke-sub-300)] bg-[var(--neutral-weak-50)] p-4 text-center">
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-[8px] bg-white text-[var(--neutral-soft-400)]">
        {icon}
      </div>
      <p className="mt-2 text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">
        {title}
      </p>
      <p className="mx-auto mt-1 max-w-[260px] text-[11.5px] leading-[1.45] text-[var(--neutral-soft-400)]">
        {body}
      </p>
    </div>
  );
}
