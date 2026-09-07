'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Moon, Pencil, Sun, UserPlus } from 'lucide-react';
import {
  api,
  getWorkspaceMessageStreamUrl,
  type WorkspaceAgentKeyResponse,
  type WorkspaceAgentStatus,
  type WorkspaceDetail,
  type WorkspaceFileRef,
  type WorkspaceMessage,
  type WorkspacePointerStatus,
  type WorkspaceSummary,
} from '@/lib/api';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/components/ui/ThemeToggle';
import { Skeleton } from '@/components/ui/Skeleton';
import { useUser } from '@/lib/hooks';
import { cn, formatCompactNumber } from '@/lib/utils';
import { AgentChat } from './AgentChat';
import { AgentKeyDialog } from './AgentKeyDialog';
import { AgentRoster } from './AgentRoster';
import { Composer } from './Composer';
import { MentionText, AgentHueProvider } from './agent-visuals';
import { SampleDataChip, useIsDemo } from './WorkspaceDemoGate';
import { DEMO_VIEWER } from '@/lib/workspace-preview';
import { TaskChecklist } from './TaskChecklist';
import { RoomSidebar, type SiblingMeta } from './RoomSidebar';
import { InlineEdit } from './InlineEdit';
import { Kbd, ShortcutsDialog, useWorkspaceShortcuts } from './shortcuts';
import { WorkspaceAgentsMdDialog } from './WorkspaceAgentsMdDialog';
import { InviteWorkspaceDialog } from './InviteWorkspaceDialog';
import { WorkspaceRunsPanel } from './WorkspaceRunsPanel';

type Tab = 'conversation' | 'agents' | 'tasks' | 'runs' | 'settings';

/** Reduces a workspace detail to what the room switcher needs. */
function metaFrom(d: WorkspaceDetail): SiblingMeta {
  const pointers = d.pointers ?? [];
  return {
    agents: d.agents,
    done: pointers.filter((p) => p.status === 'done').length,
    total: pointers.length,
  };
}

function mergeMessage(messages: WorkspaceMessage[], incoming: WorkspaceMessage): WorkspaceMessage[] {
  const index = messages.findIndex((message) => message.id === incoming.id);
  const next =
    index >= 0
      ? messages.map((message) => (message.id === incoming.id ? incoming : message))
      : [...messages, incoming];

  return next.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function WorkspaceRoom({ workspaceId }: { workspaceId: string }) {
  const { theme, setTheme } = useTheme();
  const isDemo = useIsDemo();
  const { user } = useUser();
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [siblings, setSiblings] = useState<WorkspaceSummary[]>([]);
  const [siblingMeta, setSiblingMeta] = useState<Record<string, SiblingMeta>>({});
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('conversation');
  const [senderId, setSenderId] = useState<string | null>(null);
  const [issued, setIssued] = useState<WorkspaceAgentKeyResponse | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [agentsMdOpen, setAgentsMdOpen] = useState(false);
  const [inviteLinkOpen, setInviteLinkOpen] = useState(false);
  const [composerFocus, setComposerFocus] = useState(0);
  const [taskFocus, setTaskFocus] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(0);
  const [titleEdit, setTitleEdit] = useState(0);
  const [runsTotal, setRunsTotal] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, list] = await Promise.all([api.getWorkspace(workspaceId), api.getWorkspaces()]);
      setDetail(d);
      setSiblings(list);
      setSenderId(() => {
        const viewerId = isDemo ? DEMO_VIEWER.userId : user?.id;
        const mine = d.agents.find(
          (a) => a.status === 'active' && viewerId && a.user_id === viewerId,
        );
        return mine?.id ?? d.agents.find((a) => a.status === 'active')?.id ?? null;
      });

      const entries = await Promise.all(
        list.map(async (s) => {
          if (s.id === workspaceId) return [s.id, metaFrom(d)] as const;
          try {
            return [s.id, metaFrom(await api.getWorkspace(s.id))] as const;
          } catch {
            return [
              s.id,
              { agents: [], done: 0, total: s.pointer_count ?? 0 } as SiblingMeta,
            ] as const;
          }
        }),
      );
      setSiblingMeta(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this workspace.');
    }
  }, [workspaceId, user?.id, isDemo]);

  useEffect(() => {
    setTab('conversation');
    setRunsTotal(null);
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isDemo) return;

    const es = new EventSource(getWorkspaceMessageStreamUrl(workspaceId), {
      withCredentials: true,
    });

    es.onmessage = (event) => {
      if (!event.data) return;

      try {
        const incoming = JSON.parse(event.data) as WorkspaceMessage;
        if (!incoming?.id) return;
        if (incoming.workspace_id && incoming.workspace_id !== workspaceId) return;

        setDetail((current) =>
          current
            ? {
                ...current,
                messages: mergeMessage(current.messages, incoming),
              }
            : current,
        );
      } catch {
        // Ignore malformed keepalive or diagnostic events from the stream.
      }
    };

    return () => {
      es.close();
    };
  }, [isDemo, workspaceId]);

  const agents = detail?.agents ?? [];
  const pointers = useMemo(
    () => (detail?.pointers ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    [detail?.pointers],
  );
  const activeCount = agents.filter((a) => a.status === 'active').length;
  const viewerAgentIds = useMemo(() => (senderId ? [senderId] : []), [senderId]);
  const summary = siblings.find((s) => s.id === workspaceId);
  const runCount = summary?.run_count ?? 0;
  const tokenCount = summary?.total_tokens ?? 0;

  const sendMessage = async (text: string, files: WorkspaceFileRef[]) => {
    if (!senderId) return;
    await api.createWorkspaceMessage(workspaceId, {
      sender_member_id: senderId,
      message_text: text || null,
      file_refs: files,
    });
    await load();
  };

  const createPointer = async (title: string) => {
    await api.createWorkspacePointer(workspaceId, {
      title,
      created_by_member_id: senderId,
    });
    await load();
  };

  const updatePointer = async (
    id: string,
    payload: { status?: WorkspacePointerStatus; assignee_member_id?: string | null },
  ) => {
    await api.updateWorkspacePointer(workspaceId, id, payload);
    await load();
  };

  const deletePointer = async (id: string) => {
    await api.deleteWorkspacePointer(workspaceId, id);
    await load();
  };

  const inviteAgent = async (handle: string, roleLabel: string) => {
    const response = await api.createWorkspaceAgent(workspaceId, {
      handle,
      role_label: roleLabel || null,
    });
    setIssued(response);
    await load();
  };

  const rotateKey = async (agentId: string) => {
    const response = await api.rotateWorkspaceAgentKey(workspaceId, agentId);
    setIssued(response);
  };

  const removeAgent = async (agentId: string) => {
    await api.updateWorkspaceAgent(workspaceId, agentId, { status: 'removed' });
    await load();
  };

  const updateAgent = async (
    agentId: string,
    payload: { handle?: string; role_label?: string | null; status?: WorkspaceAgentStatus },
  ) => {
    await api.updateWorkspaceAgent(workspaceId, agentId, payload);
    await load();
  };

  const saveBrief = async (payload: { title?: string; task?: string | null }) => {
    await api.updateWorkspace(workspaceId, payload);
    await load();
  };

  useWorkspaceShortcuts(
    {
      focusComposer: () => {
        setTab('conversation');
        setComposerFocus((n) => n + 1);
      },
      newTask: () => {
        setTab('tasks');
        setTaskFocus((n) => n + 1);
      },
      inviteAgent: () => {
        setTab('agents');
        setInviteOpen((n) => n + 1);
      },
      toggleHelp: () => setHelpOpen((open) => !open),
      closeOverlays: () => {
        setHelpOpen(false);
        setInviteLinkOpen(false);
      },
    },
    !issued && !agentsMdOpen,
  );

  if (!detail && !error) {
    return (
      <div className="workspace-room flex h-dvh">
        <aside className="hidden w-[248px] shrink-0 border-r border-[var(--stroke-soft-200)] p-3 lg:block">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-4 h-9 w-full" />
          <Skeleton className="mt-1.5 h-9 w-full" />
        </aside>
        <div className="flex-1 p-6">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="mt-3 h-4 w-full max-w-[520px]" />
          <Skeleton className="mt-8 h-16 w-full" />
          <Skeleton className="mt-2 h-16 w-3/4" />
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="mx-auto max-w-[640px] px-6 py-10">
        <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={load} />
        <Link
          href="/dashboard/workspaces"
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--primary-dark)] hover:underline"
        >
          <ArrowLeft size={14} /> Back to workspaces
        </Link>
      </div>
    );
  }

  const workspace = detail!.workspace;
  const handles = agents.map((a) => a.handle);

  const tabs: Array<{ key: Tab; label: string; count?: number | string }> = [
    { key: 'conversation', label: 'Conversation', count: detail!.messages.length },
    { key: 'agents', label: 'Agents', count: activeCount },
    { key: 'tasks', label: 'Tasks', count: pointers.length },
    { key: 'runs', label: 'Runs', count: runsTotal ?? '—' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <AgentHueProvider handles={agents.map((a) => a.handle)}>
      <div className="workspace-room flex h-dvh overflow-hidden bg-[var(--bg-app)]">
        <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[var(--stroke-soft-200)] bg-[var(--bg-app)] lg:flex">
          <RoomSidebar workspaces={siblings} meta={siblingMeta} currentId={workspaceId} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-[var(--white-0)]">
          <header className="border-b border-[var(--stroke-soft-200)] px-5 py-4">
            <p className="mb-1.5 text-[11px] text-[var(--neutral-soft-400)]">
              Workspace · {tab}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/dashboard/workspaces"
                className="rounded-md p-1 text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] lg:hidden"
                aria-label="Back to workspaces"
              >
                <ArrowLeft size={15} />
              </Link>
              <h1 className="min-w-0 text-[20px] font-semibold tracking-[-0.022em] text-[var(--neutral-strong-950)]">
                <InlineEdit
                  value={workspace.title}
                  ariaLabel="Workspace title"
                  placeholder="Untitled workspace"
                  onCommit={(title) => saveBrief({ title: title || 'Untitled workspace' })}
                  className="w-[32ch] text-[20px] font-semibold tracking-[-0.022em]"
                  readClassName="inline-block w-auto max-w-[38ch] truncate whitespace-nowrap"
                  editSignal={titleEdit}
                />
              </h1>
              <SampleDataChip />
              <p className="text-[12.5px] text-[var(--neutral-sub-600)]">
                {formatCompactNumber(runCount)} runs · {formatCompactNumber(tokenCount)} tokens
              </p>
              <div className="ml-auto flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<Pencil size={12} />}
                  onClick={() => setTitleEdit((n) => n + 1)}
                >
                  Rename
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setInviteLinkOpen(true)}>
                  Invite
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon={<UserPlus size={13} />}
                  onClick={() => {
                    setTab('agents');
                    setInviteOpen((n) => n + 1);
                  }}
                >
                  Add an agent
                </Button>
              </div>
            </div>

            <div className="mt-1.5 max-w-[76ch] text-[12.5px] leading-[1.6] text-[var(--neutral-sub-600)]">
              <InlineEdit
                value={workspace.task ?? ''}
                ariaLabel="Workspace goal"
                placeholder="Add a goal for this workspace"
                multiline
                onCommit={(task) => saveBrief({ task: task || null })}
                className="text-[12.5px] leading-[1.6]"
                renderRead={(text) => <MentionText text={text} knownHandles={handles} />}
              />
            </div>
          </header>

          <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--stroke-soft-200)] px-4 py-2">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                aria-pressed={tab === item.key}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                  tab === item.key
                    ? 'bg-[var(--neutral-weak-50)] text-[var(--neutral-strong-950)]'
                    : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)]/60 hover:text-[var(--neutral-strong-950)]',
                )}
              >
                {item.label}
                {item.count !== undefined && (
                  <span className="text-[12px] text-[var(--neutral-soft-400)]">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
            <button
              type="button"
              disabled
              title="Coming soon — file storage is not available yet"
              className="ml-0.5 flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium text-[var(--neutral-soft-400)]"
            >
              Files
            </button>
          </div>

          {error && (
            <div className="px-4 pt-3">
              <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={load} />
            </div>
          )}

          {tab === 'conversation' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <AgentChat
                messages={detail!.messages}
                agents={agents}
                viewerAgentIds={viewerAgentIds}
                workspaceTitle={workspace.title}
              />
              <Composer
                agents={agents}
                senderId={senderId}
                onSend={sendMessage}
                focusSignal={composerFocus}
              />
            </div>
          )}

          {tab === 'agents' && (
            <div className="min-h-0 flex-1 overflow-hidden">
              <AgentRoster
                workspaceId={workspaceId}
                workspaceTitle={detail!.workspace.title}
                agents={agents}
                onInvite={inviteAgent}
                onRotate={rotateKey}
                onRemove={removeAgent}
                onUpdate={updateAgent}
                openInviteSignal={inviteOpen}
              />
            </div>
          )}

          {tab === 'tasks' && (
            <div className="min-h-0 flex-1 overflow-hidden">
              <TaskChecklist
                pointers={pointers}
                agents={agents}
                onCreate={createPointer}
                onUpdate={updatePointer}
                onDelete={deletePointer}
                focusSignal={taskFocus}
              />
            </div>
          )}

          <div className={cn('min-h-0 flex-1 overflow-y-auto', tab !== 'runs' && 'hidden')}>
            <WorkspaceRunsPanel workspaceId={workspaceId} onTotalChange={setRunsTotal} />
          </div>

          {tab === 'settings' && (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="max-w-[520px] space-y-3">
                <button
                  type="button"
                  onClick={() => setAgentsMdOpen(true)}
                  className="flex w-full items-center gap-2 rounded-lg border border-[var(--stroke-soft-200)] px-3 py-2.5 text-left text-[13px] text-[var(--neutral-strong-950)] hover:bg-[var(--neutral-weak-50)]"
                >
                  <FileText size={14} className="text-[var(--neutral-sub-600)]" />
                  AGENTS.md
                </button>
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="flex w-full items-center justify-between rounded-lg border border-[var(--stroke-soft-200)] px-3 py-2.5 text-[13px] text-[var(--neutral-strong-950)] hover:bg-[var(--neutral-weak-50)]"
                >
                  Keyboard shortcuts
                  <Kbd>?</Kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="flex w-full items-center gap-2 rounded-lg border border-[var(--stroke-soft-200)] px-3 py-2.5 text-left text-[13px] text-[var(--neutral-strong-950)] hover:bg-[var(--neutral-weak-50)]"
                >
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                  {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                </button>
              </div>
            </div>
          )}
        </main>

        <AgentKeyDialog open={!!issued} onOpenChange={(open) => !open && setIssued(null)} issued={issued} />
        <WorkspaceAgentsMdDialog open={agentsMdOpen} onOpenChange={setAgentsMdOpen} />
        <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
        <InviteWorkspaceDialog
          workspaceId={workspaceId}
          workspaceTitle={workspace.title}
          open={inviteLinkOpen}
          onOpenChange={setInviteLinkOpen}
        />
      </div>
    </AgentHueProvider>
  );
}
