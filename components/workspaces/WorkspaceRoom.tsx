'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  MessagesSquare,
  Moon,
  PanelRight,
  Sun,
  Users2,
  X,
} from 'lucide-react';
import {
  api,
  getWorkspaceMessageStreamUrl,
  type WorkspaceAgentKeyResponse,
  type WorkspaceDetail,
  type WorkspaceFileRef,
  type WorkspaceMessage,
  type WorkspacePointerStatus,
  type WorkspaceSummary,
} from '@/lib/api';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { useTheme } from '@/components/ui/ThemeToggle';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { AgentChat } from './AgentChat';
import { AgentKeyDialog } from './AgentKeyDialog';
import { AgentRoster } from './AgentRoster';
import { Composer } from './Composer';
import { MentionText, AgentGlyph, AgentHandle, AgentHueProvider } from './agent-visuals';
import { SampleDataChip, useIsDemo } from './WorkspaceDemoGate';
import { TaskChecklist } from './TaskChecklist';
import { FilesPanel } from './FilesPanel';
import { RoomSummary } from './RoomSummary';
import { RoomSidebar, type SiblingMeta } from './RoomSidebar';
import { InlineEdit } from './InlineEdit';
import { Kbd, ShortcutsDialog, useWorkspaceShortcuts } from './shortcuts';
import { WorkspaceAgentsMdDialog } from './WorkspaceAgentsMdDialog';

type Tab = 'tasks' | 'agents' | 'files';

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
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [siblings, setSiblings] = useState<WorkspaceSummary[]>([]);
  const [siblingMeta, setSiblingMeta] = useState<Record<string, SiblingMeta>>({});
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('tasks');
  const [senderId, setSenderId] = useState<string | null>(null);
  const [issued, setIssued] = useState<WorkspaceAgentKeyResponse | null>(null);
  // Below xl the context rail becomes a drawer, so tasks and agents stay
  // reachable on narrow screens instead of being hidden entirely.
  const [panelOpen, setPanelOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [agentsMdOpen, setAgentsMdOpen] = useState(false);
  // Counters, not booleans: bumping one is an event the child reacts to.
  const [composerFocus, setComposerFocus] = useState(0);
  const [taskFocus, setTaskFocus] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(0);
  const [replyTo, setReplyTo] = useState<{ handle: string; signal: number }>({
    handle: '',
    signal: 0,
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, list] = await Promise.all([api.getWorkspace(workspaceId), api.getWorkspaces()]);
      setDetail(d);
      setSiblings(list);
      setSenderId((current) => {
        const stillActive = d.agents.find((a) => a.id === current && a.status === 'active');
        return stillActive ? current : (d.agents.find((a) => a.status === 'active')?.id ?? null);
      });

      // The summary endpoint carries counts but not rosters or how many
      // tasks are done, so the switcher needs each room's detail. This is
      // an N+1 the real API should collapse by returning done_count and a
      // roster preview on the summary; the current workspace reuses the
      // detail already in hand rather than refetching it.
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
  const doneCount = pointers.filter((p) => p.status === 'done').length;
  const fileCount = (detail?.messages ?? []).reduce(
    (n, m) => n + (m.file_refs?.length ?? 0),
    0,
  );

  // ---- mutations -------------------------------------------------------
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
    await api.createWorkspacePointer(workspaceId, { title });
    await load();
  };

  const updatePointer = async (id: string, status: WorkspacePointerStatus) => {
    await api.updateWorkspacePointer(workspaceId, id, { status });
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

  const saveBrief = async (payload: { title?: string; task?: string | null }) => {
    await api.updateWorkspace(workspaceId, payload);
    await load();
  };

  // Keyboard layer. Disabled while a modal owns the screen.
  useWorkspaceShortcuts(
    {
      focusComposer: () => setComposerFocus((n) => n + 1),
      newTask: () => {
        setTab('tasks');
        setPanelOpen(true);
        setTaskFocus((n) => n + 1);
      },
      inviteAgent: () => {
        setTab('agents');
        setPanelOpen(true);
        setInviteOpen((n) => n + 1);
      },
      toggleHelp: () => setHelpOpen((open) => !open),
      closeOverlays: () => {
        setPanelOpen(false);
        setHelpOpen(false);
      },
    },
    !issued && !agentsMdOpen,
  );

  // ---- loading ---------------------------------------------------------
  if (!detail && !error) {
    return (
      <div className="flex h-dvh">
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

  return (
    <AgentHueProvider handles={agents.map((a) => a.handle)}>
    <div className="flex h-dvh overflow-hidden bg-[var(--bg-app)]">
      {/* Left rail: switch rooms */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[var(--stroke-soft-200)] bg-[var(--white-0)] lg:flex">
        <RoomSidebar workspaces={siblings} meta={siblingMeta} currentId={workspaceId} />
      </aside>

      {/* Center: brief + conversation */}
      <main className="flex min-w-0 flex-1 flex-col bg-[var(--white-0)]">
        <header className="border-b border-[var(--stroke-soft-200)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/workspaces"
              className="rounded-md p-1 text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] lg:hidden"
              aria-label="Back to workspaces"
            >
              <ArrowLeft size={15} />
            </Link>
            <h1 className="min-w-0 text-[15px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
              <InlineEdit
                value={workspace.title}
                ariaLabel="Workspace title"
                placeholder="Untitled workspace"
                onCommit={(title) => saveBrief({ title: title || 'Untitled workspace' })}
                className="w-[32ch] text-[15px] font-semibold tracking-[-0.01em]"
                readClassName="inline-block w-auto max-w-[38ch] truncate whitespace-nowrap"
              />
            </h1>
            <SampleDataChip />
            <div className="ml-auto flex items-center gap-2 font-mono text-[11.5px] text-[var(--neutral-sub-600)]">
              <button
                type="button"
                onClick={() => setAgentsMdOpen(true)}
                title="View AGENTS.md workspace instructions"
                className="inline-flex items-center gap-1 rounded-md border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
              >
                <FileText size={12} />
                AGENTS.md
              </button>
              <span className="inline-flex items-center gap-1">
                <Users2 size={12} /> {activeCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessagesSquare size={12} /> {detail!.messages.length}
              </span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 size={12} /> {doneCount}/{pointers.length}
              </span>
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                aria-label="Open tasks and agents"
                className="rounded-md p-1 text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] xl:hidden"
              >
                <PanelRight size={15} />
              </button>
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

          {/* Roster strip: glyph plus handle reads faster than bare tiles */}
          {activeCount > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {agents
                .filter((a) => a.status === 'active')
                .slice(0, 5)
                .map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5"
                    title={a.role_label ?? `@${a.handle}`}
                  >
                    <AgentGlyph handle={a.handle} roleLabel={a.role_label} size="sm" />
                    <AgentHandle handle={a.handle} />
                  </span>
                ))}
              {activeCount > 5 && (
                <span className="font-mono text-[11px] text-[var(--neutral-soft-400)]">
                  +{activeCount - 5}
                </span>
              )}
            </div>
          )}
        </header>

        {error && (
          <div className="px-4 pt-3">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={load} />
          </div>
        )}

        <AgentChat
          messages={detail!.messages}
          agents={agents}
          pointers={pointers}
          workspaceCreatedAt={workspace.created_at}
          viewerAgentId={senderId}
          workspaceTitle={workspace.title}
          onCreateTask={(text) => {
            setTab('tasks');
            // Message bodies can be long; a task title should stay scannable.
            void createPointer(text.length > 90 ? `${text.slice(0, 87).trimEnd()}...` : text);
          }}
          onReply={(handle) => setReplyTo((r) => ({ handle, signal: r.signal + 1 }))}
        />

        <Composer
          agents={agents}
          senderId={senderId}
          onSenderChange={setSenderId}
          onSend={sendMessage}
          focusSignal={composerFocus}
          replyTo={replyTo}
        />
      </main>

      {/* Backdrop for the drawer form of the rail */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 xl:hidden"
          onClick={() => setPanelOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Right rail: tasks + agents. Static at xl, drawer below it. */}
      <aside
        className={cn(
          'flex w-[320px] shrink-0 flex-col border-l border-[var(--stroke-soft-200)] bg-[var(--white-0)]',
          'max-xl:fixed max-xl:inset-y-0 max-xl:right-0 max-xl:z-50 max-xl:w-[86vw] max-xl:max-w-[340px]',
          'max-xl:shadow-[-8px_0_32px_rgba(0,0,0,0.18)] max-xl:transition-transform max-xl:duration-200',
          panelOpen ? 'max-xl:translate-x-0' : 'max-xl:translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] px-2 py-1.5 xl:hidden">
          <span className="pl-1 text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
            Workspace details
          </span>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            aria-label="Close panel"
            className="rounded-md p-1 text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)]"
          >
            <X size={15} />
          </button>
        </div>
        <RoomSummary
          done={doneCount}
          totalTasks={pointers.length}
          agents={activeCount}
          messages={detail!.messages.length}
          files={fileCount}
        />

        <div className="flex items-center gap-1 border-b border-[var(--stroke-soft-200)] p-2">
          {(
            [
              ['tasks', 'Tasks', pointers.length],
              ['agents', 'Agents', activeCount],
              ['files', 'Files', fileCount],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors',
                tab === key
                  ? 'bg-[var(--neutral-weak-50)] text-[var(--neutral-strong-950)]'
                  : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)]',
              )}
            >
              {label}
              <span className="font-mono text-[11px] text-[var(--neutral-soft-400)]">{count}</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'tasks' && (
            <TaskChecklist
              pointers={pointers}
              onCreate={createPointer}
              onUpdate={updatePointer}
              onDelete={deletePointer}
              focusSignal={taskFocus}
            />
          )}
          {tab === 'agents' && (
            <AgentRoster
              workspaceId={workspaceId}
              workspaceTitle={detail!.workspace.title}
              agents={agents}
              onInvite={inviteAgent}
              onRotate={rotateKey}
              onRemove={removeAgent}
              openInviteSignal={inviteOpen}
            />
          )}
          {tab === 'files' && <FilesPanel messages={detail!.messages} agents={agents} />}
        </div>

        {/* Footer: shortcuts + theme. One row so its height stays the
            34px the composer alignment is measured against. */}
        <div className="flex items-stretch border-t border-[var(--stroke-soft-200)]">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="flex flex-1 items-center justify-between px-3 py-2 text-[11.5px] text-[var(--neutral-soft-400)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
        >
          Keyboard shortcuts
          <Kbd>?</Kbd>
        </button>

        {/* The room is full-bleed, so it never gets the dashboard's
            profile menu. Without a control here there is no way to
            change theme without navigating out. */}
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="border-l border-[var(--stroke-soft-200)] px-2.5 text-[var(--neutral-soft-400)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>
        </div>
      </aside>

      <AgentKeyDialog open={!!issued} onOpenChange={(open) => !open && setIssued(null)} issued={issued} />
      <WorkspaceAgentsMdDialog open={agentsMdOpen} onOpenChange={setAgentsMdOpen} />
      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
    </AgentHueProvider>
  );
}
