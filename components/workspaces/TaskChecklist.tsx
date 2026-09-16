'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CircleDashed, GitBranch, MoreHorizontal, Plus, X } from 'lucide-react';
import type { WorkspaceAgent, WorkspacePointerStatus, WorkspaceTaskPointer } from '@/lib/api';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Switch } from '@/components/ui/Switch';
import {
  AgentGlyph,
  RESERVED_PING_HANDLES,
  agentIdentityColor,
} from './agent-visuals';
import { PanelEmpty } from './PanelEmpty';

const STATUSES: WorkspacePointerStatus[] = ['pending', 'review', 'done'];
const UNASSIGNED = 'unassigned';
const HANDLE_RE = /@([a-z0-9_-]+)/gi;
const CROSS_CUTTING_MIN = 3;
/** Publish top → down: slot grows (squash) then the card snaps to full height. */
const PUBLISH_SQUASH = 0.55;
const PUBLISH_CARD_STAGGER = 0.055;
const PUBLISH_COLUMN_STAGGER = 0.07;

function publishTransition(index: number, columnIndex: number, reduce: boolean | null) {
  if (reduce) return { duration: 0 };
  return {
    duration: DUR.slow,
    ease: EASE.emph,
    delay: columnIndex * PUBLISH_COLUMN_STAGGER + Math.min(index, 10) * PUBLISH_CARD_STAGGER,
  };
}

function PublishItem({
  index,
  columnIndex,
  children,
}: {
  index: number;
  columnIndex: number;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const [released, setReleased] = useState(Boolean(reduce));

  useEffect(() => {
    if (reduce) {
      setReleased(true);
      return;
    }
    const delay =
      columnIndex * PUBLISH_COLUMN_STAGGER + Math.min(index, 10) * PUBLISH_CARD_STAGGER;
    const timer = window.setTimeout(() => setReleased(true), (delay + DUR.slow) * 1000 + 80);
    return () => window.clearTimeout(timer);
  }, [reduce, index, columnIndex]);

  return (
    <motion.div
      initial={reduce ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
      transition={publishTransition(index, columnIndex, reduce)}
      onAnimationComplete={() => setReleased(true)}
      className={cn('shrink-0', !released && 'overflow-hidden')}
    >
      <motion.div
        initial={reduce ? false : { scaleY: PUBLISH_SQUASH }}
        animate={{ scaleY: 1 }}
        transition={publishTransition(index, columnIndex, reduce)}
        style={{ transformOrigin: 'top center' }}
        className="pb-2"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

const STATUS_META: Record<
  WorkspacePointerStatus,
  { label: string; pill: string }
> = {
  pending: {
    label: 'Pending',
    pill: 'bg-[var(--neutral-soft-200)] text-[var(--neutral-sub-600)]',
  },
  review: {
    label: 'In review',
    pill: 'bg-[rgba(246,181,30,0.20)] text-[var(--warning-dark)]',
  },
  done: {
    label: 'Done',
    pill: 'bg-[rgba(31,193,107,0.16)] text-[var(--success-dark)]',
  },
};

const STATUS_RANK: Record<WorkspacePointerStatus, number> = {
  review: 0,
  pending: 1,
  done: 2,
};

type BoardItem = {
  pointer: WorkspaceTaskPointer;
  involved: WorkspaceAgent[];
  primary: WorkspaceAgent | null;
  others: WorkspaceAgent[];
  crossCutting: boolean;
};

function mentionedHandles(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(HANDLE_RE)) {
    const handle = match[1].toLowerCase();
    if (RESERVED_PING_HANDLES.has(handle) || seen.has(handle)) continue;
    seen.add(handle);
    found.push(handle);
  }
  return found;
}

function involvedAgents(
  pointer: WorkspaceTaskPointer,
  byId: Map<string, WorkspaceAgent>,
  byHandle: Map<string, WorkspaceAgent>,
): WorkspaceAgent[] {
  const list: WorkspaceAgent[] = [];
  const seen = new Set<string>();
  const add = (agent?: WorkspaceAgent) => {
    if (!agent || agent.status !== 'active' || seen.has(agent.id)) return;
    seen.add(agent.id);
    list.push(agent);
  };

  if (pointer.assignee_member_id) add(byId.get(pointer.assignee_member_id));
  else if (pointer.assignee_handle) add(byHandle.get(pointer.assignee_handle.toLowerCase()));

  for (const handle of mentionedHandles(`${pointer.title}\n${pointer.description ?? ''}`)) {
    add(byHandle.get(handle));
  }

  if (pointer.created_by_member_id) add(byId.get(pointer.created_by_member_id));
  return list;
}

function primaryAgent(
  pointer: WorkspaceTaskPointer,
  byId: Map<string, WorkspaceAgent>,
  byHandle: Map<string, WorkspaceAgent>,
): WorkspaceAgent | null {
  if (pointer.assignee_member_id) {
    const agent = byId.get(pointer.assignee_member_id);
    if (agent?.status === 'active') return agent;
  }
  if (pointer.assignee_handle) {
    const agent = byHandle.get(pointer.assignee_handle.toLowerCase());
    if (agent?.status === 'active') return agent;
  }
  for (const handle of mentionedHandles(`${pointer.title}\n${pointer.description ?? ''}`)) {
    const agent = byHandle.get(handle);
    if (agent?.status === 'active') return agent;
  }
  if (pointer.created_by_member_id) {
    const agent = byId.get(pointer.created_by_member_id);
    if (agent?.status === 'active') return agent;
  }
  return null;
}

function toBoardItem(
  pointer: WorkspaceTaskPointer,
  byId: Map<string, WorkspaceAgent>,
  byHandle: Map<string, WorkspaceAgent>,
): BoardItem {
  const involved = involvedAgents(pointer, byId, byHandle);
  const primary = primaryAgent(pointer, byId, byHandle);
  const others = involved.filter((agent) => agent.id !== primary?.id);
  return {
    pointer,
    involved,
    primary,
    others,
    crossCutting: involved.length >= CROSS_CUTTING_MIN,
  };
}

function sortBoardItems(a: BoardItem, b: BoardItem) {
  const rank = STATUS_RANK[a.pointer.status] - STATUS_RANK[b.pointer.status];
  if (rank !== 0) return rank;
  const time = b.pointer.created_at.localeCompare(a.pointer.created_at);
  return time !== 0 ? time : b.pointer.sort_order - a.pointer.sort_order;
}

function cardDomId(id: string) {
  return `task-card-${id}`;
}

export function TaskChecklist({
  pointers,
  agents,
  viewerAgentIds = [],
  onCreate,
  onUpdate,
  onDelete,
  focusSignal = 0,
}: {
  pointers: WorkspaceTaskPointer[];
  agents: WorkspaceAgent[];
  viewerAgentIds?: string[];
  onCreate: (title: string, assigneeMemberId?: string | null) => Promise<void>;
  onUpdate: (
    id: string,
    payload: { status?: WorkspacePointerStatus; assignee_member_id?: string | null },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Bumped by the parent to focus the add field, e.g. from the `t` shortcut. */
  focusSignal?: number;
}) {
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState('');
  const [composing, setComposing] = useState(false);
  const [composeFor, setComposeFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [openDone, setOpenDone] = useState<Set<string>>(() => new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pendingJump, setPendingJump] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    id: string;
    top: number;
    right: number;
  } | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const byHandle = useMemo(
    () => new Map(agents.map((agent) => [agent.handle.toLowerCase(), agent])),
    [agents],
  );
  const activeAgents = useMemo(() => agents.filter((agent) => agent.status === 'active'), [agents]);
  const viewerSet = useMemo(() => new Set(viewerAgentIds), [viewerAgentIds]);
  const canFilterMine = viewerAgentIds.length > 0;

  const board = useMemo(
    () => pointers.map((pointer) => toBoardItem(pointer, byId, byHandle)),
    [pointers, byId, byHandle],
  );

  const visibleBoard = useMemo(() => {
    if (!mineOnly || !canFilterMine) return board;
    return board.filter((item) => item.involved.some((agent) => viewerSet.has(agent.id)));
  }, [board, mineOnly, canFilterMine, viewerSet]);

  const lanes = useMemo(() => {
    if (mineOnly && canFilterMine) {
      return activeAgents.filter((agent) => viewerSet.has(agent.id));
    }
    return activeAgents;
  }, [activeAgents, mineOnly, canFilterMine, viewerSet]);

  const sharedItems = useMemo(
    () => visibleBoard.filter((item) => item.crossCutting).sort(sortBoardItems),
    [visibleBoard],
  );

  const unassignedItems = useMemo(
    () =>
      visibleBoard
        .filter((item) => !item.crossCutting && !item.primary)
        .sort(sortBoardItems),
    [visibleBoard],
  );

  const itemsByLane = useMemo(() => {
    const map = new Map<string, { owned: BoardItem[]; ghosts: BoardItem[] }>();
    for (const agent of lanes) {
      map.set(agent.id, { owned: [], ghosts: [] });
    }
    for (const item of visibleBoard) {
      if (item.crossCutting) {
        for (const agent of item.involved) {
          map.get(agent.id)?.ghosts.push(item);
        }
        continue;
      }
      if (!item.primary) continue;
      const bucket = map.get(item.primary.id);
      if (bucket) bucket.owned.push(item);
      for (const other of item.others) {
        map.get(other.id)?.ghosts.push(item);
      }
    }
    for (const bucket of map.values()) {
      bucket.owned.sort(sortBoardItems);
      bucket.ghosts.sort(sortBoardItems);
    }
    return map;
  }, [visibleBoard, lanes]);

  const showUnassigned = unassignedItems.length > 0 && !(mineOnly && canFilterMine);
  const openItem = openId ? board.find((item) => item.pointer.id === openId) : undefined;

  useEffect(() => {
    if (openId && !openItem) setOpenId(null);
  }, [openId, openItem]);

  useEffect(() => {
    if (focusSignal > 0) {
      setComposeFor(null);
      setComposing(true);
      requestAnimationFrame(() => addRef.current?.focus());
    }
  }, [focusSignal]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 1600);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  useEffect(() => {
    if (!pendingJump) return;
    const node = document.getElementById(cardDomId(pendingJump));
    node?.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    });
    setHighlightId(pendingJump);
    setPendingJump(null);
  }, [pendingJump, openDone, reduce]);

  useEffect(() => {
    if (!menu) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const openCompose = (assigneeId: string | null) => {
    setComposeFor(assigneeId);
    setComposing(true);
    requestAnimationFrame(() => addRef.current?.focus());
  };

  const add = async () => {
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await onCreate(title, composeFor);
      setDraft('');
      setComposing(false);
      setComposeFor(null);
    } finally {
      setBusy(false);
    }
  };

  const jumpToCard = (id: string) => {
    const item = board.find((row) => row.pointer.id === id);
    if (item?.pointer.status === 'done') {
      const key = item.crossCutting ? 'shared' : item.primary?.id ?? UNASSIGNED;
      setOpenDone((current) => {
        const next = new Set(current);
        next.add(key);
        return next;
      });
    }
    setPendingJump(id);
  };

  const openTask = (id: string) => {
    setMenu(null);
    setOpenId(id);
  };

  const toggleDone = (laneKey: string) => {
    setOpenDone((current) => {
      const next = new Set(current);
      if (next.has(laneKey)) next.delete(laneKey);
      else next.add(laneKey);
      return next;
    });
  };

  const composeHandle = composeFor ? byId.get(composeFor)?.handle : null;
  const empty = pointers.length === 0 && !composing;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
              Tasks
            </h2>
            <span className="font-mono text-[12px] tabular-nums text-[var(--neutral-soft-400)]">
              {pointers.length}
            </span>
            <span
              className={cn(
                'ml-1 inline-flex items-center gap-2 text-[12px]',
                canFilterMine
                  ? 'text-[var(--neutral-sub-600)]'
                  : 'text-[var(--neutral-soft-400)]',
              )}
              title={
                canFilterMine
                  ? 'Show only lanes for your agents'
                  : 'Join this workspace with an agent to filter to your tasks'
              }
            >
              <Switch
                checked={mineOnly && canFilterMine}
                disabled={!canFilterMine}
                onChange={setMineOnly}
                ariaLabel="My tasks only"
              />
              My tasks only
            </span>
          </div>
          <p className="mt-1 max-w-[62ch] text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
            Columns are agents. Status is a pill on the card — pending, in review, or done — not a
            second axis. Shared work lives once; other lanes get a ghost that jumps to the real card.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Plus size={13} />}
          onClick={() => openCompose(null)}
        >
          New task pointer
        </Button>
      </div>

      {composing && (
        <div className="border-b border-[var(--stroke-soft-200)] px-4 py-2.5">
          <input
            ref={addRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void add();
              if (event.key === 'Escape') {
                setComposing(false);
                setDraft('');
                setComposeFor(null);
              }
            }}
            placeholder={
              composeHandle ? `Title this pointer for @${composeHandle}` : 'Title this pointer'
            }
            disabled={busy}
            className="w-full rounded-md border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[13px] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-alpha-16)]"
          />
        </div>
      )}

      {empty ? (
        <PanelEmpty
          icon={CircleDashed}
          title="No tasks yet"
          hint="Break the goal into pointers the agents can pick up."
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {sharedItems.length > 0 && (
            <SharedBand
              items={sharedItems}
              byId={byId}
              highlightId={highlightId}
              doneOpen={openDone.has('shared')}
              onToggleDone={() => toggleDone('shared')}
              onOpen={openTask}
              onOpenMenu={(id, rect) =>
                setMenu({ id, top: rect.bottom + 4, right: window.innerWidth - rect.right })
              }
            />
          )}

          <div className="flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto px-4 py-3">
            {showUnassigned && (
              <LaneColumn
                laneKey={UNASSIGNED}
                columnIndex={0}
                title="Unassigned"
                count={unassignedItems.filter((item) => item.pointer.status !== 'done').length}
                owned={unassignedItems}
                ghosts={[]}
                byId={byId}
                highlightId={highlightId}
                doneOpen={openDone.has(UNASSIGNED)}
                onToggleDone={() => toggleDone(UNASSIGNED)}
                onOpen={openTask}
                onCompose={() => openCompose(null)}
                onOpenMenu={(id, rect) =>
                  setMenu({ id, top: rect.bottom + 4, right: window.innerWidth - rect.right })
                }
              />
            )}
            {lanes.map((agent, index) => {
              const bucket = itemsByLane.get(agent.id) ?? { owned: [], ghosts: [] };
              const openCount = [...bucket.owned, ...bucket.ghosts].filter(
                (item) => item.pointer.status !== 'done',
              ).length;
              return (
                <LaneColumn
                  key={agent.id}
                  laneKey={agent.id}
                  columnIndex={index + (showUnassigned ? 1 : 0)}
                  agent={agent}
                  title={`@${agent.handle}`}
                  count={openCount}
                  owned={bucket.owned}
                  ghosts={bucket.ghosts}
                  byId={byId}
                  highlightId={highlightId}
                  doneOpen={openDone.has(agent.id)}
                  onToggleDone={() => toggleDone(agent.id)}
                  onOpen={openTask}
                  onCompose={() => openCompose(agent.id)}
                  onOpenMenu={(id, rect) =>
                    setMenu({ id, top: rect.bottom + 4, right: window.innerWidth - rect.right })
                  }
                />
              );
            })}
            {lanes.length === 0 && !showUnassigned && (
              <div className="flex flex-1 items-center justify-center">
                <PanelEmpty
                  icon={CircleDashed}
                  title="No active agents"
                  hint="Add an agent to this workspace before assigning lanes."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {menu && (
        <div
          ref={menuRef}
          className="fixed z-40 w-[220px] overflow-hidden rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
          style={{ top: menu.top, right: menu.right }}
        >
          <PointerMenu
            pointer={pointers.find((row) => row.id === menu.id)}
            activeAgents={activeAgents}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onClose={() => setMenu(null)}
          />
        </div>
      )}

      <AnimatePresence>
        {openItem && (
          <TaskFlashCard
            key={openItem.pointer.id}
            item={openItem}
            byId={byId}
            activeAgents={activeAgents}
            onClose={() => setOpenId(null)}
            onUpdate={onUpdate}
            onDelete={async (id) => {
              await onDelete(id);
              setOpenId(null);
            }}
            onShowOnBoard={() => {
              const id = openItem.pointer.id;
              setOpenId(null);
              jumpToCard(id);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SharedBand({
  items,
  byId,
  highlightId,
  doneOpen,
  onToggleDone,
  onOpen,
  onOpenMenu,
}: {
  items: BoardItem[];
  byId: Map<string, WorkspaceAgent>;
  highlightId: string | null;
  doneOpen: boolean;
  onToggleDone: () => void;
  onOpen: (id: string) => void;
  onOpenMenu: (id: string, rect: DOMRect) => void;
}) {
  const { open, done } = splitDone(items);
  return (
    <div className="border-b border-[var(--stroke-soft-200)] bg-[var(--bg-surface-alt)] px-4 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
          Shared
        </span>
        <span className="font-mono text-[10.5px] tabular-nums text-[var(--neutral-soft-400)]">
          {open.length} open · 3+ agents
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {open.map((item) => (
          <div key={item.pointer.id} className="w-[280px] shrink-0">
            <TaskCard
              item={item}
              byId={byId}
              highlight={highlightId === item.pointer.id}
              onOpen={onOpen}
              onOpenMenu={onOpenMenu}
            />
          </div>
        ))}
      </div>
      {done.length > 0 && (
        <DoneToggle count={done.length} open={doneOpen} onToggle={onToggleDone}>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {done.map((item) => (
              <div key={item.pointer.id} className="w-[280px] shrink-0">
                <TaskCard
                  item={item}
                  byId={byId}
                  highlight={highlightId === item.pointer.id}
                  onOpen={onOpen}
                  onOpenMenu={onOpenMenu}
                />
              </div>
            ))}
          </div>
        </DoneToggle>
      )}
    </div>
  );
}

function LaneColumn({
  laneKey,
  columnIndex = 0,
  agent,
  title,
  count,
  owned,
  ghosts,
  byId,
  highlightId,
  doneOpen,
  onToggleDone,
  onOpen,
  onCompose,
  onOpenMenu,
}: {
  laneKey: string;
  columnIndex?: number;
  agent?: WorkspaceAgent;
  title: string;
  count: number;
  owned: BoardItem[];
  ghosts: BoardItem[];
  byId: Map<string, WorkspaceAgent>;
  highlightId: string | null;
  doneOpen: boolean;
  onToggleDone: () => void;
  onOpen: (id: string) => void;
  onCompose: () => void;
  onOpenMenu: (id: string, rect: DOMRect) => void;
}) {
  const stripe = agent ? agentIdentityColor(agent.handle) : 'var(--neutral-soft-200)';
  const merged = [...owned.map((item) => ({ item, ghost: false })), ...ghosts.map((item) => ({ item, ghost: true }))];
  merged.sort((a, b) => sortBoardItems(a.item, b.item));
  const open = merged.filter((row) => row.item.pointer.status !== 'done');
  const done = merged.filter((row) => row.item.pointer.status === 'done');

  return (
    <section className="flex h-full min-h-0 w-[280px] shrink-0 flex-col rounded-[12px] bg-[var(--bg-surface-alt)]">
      <header className="flex items-center gap-2 px-2.5 py-2">
        {agent ? (
          <span
            className="overflow-hidden rounded-[7px]"
            style={{ boxShadow: `0 0 0 2px ${stripe}` }}
          >
            <AgentGlyph handle={agent.handle} roleLabel={agent.role_label} size="sm" />
          </span>
        ) : (
          <span
            aria-hidden
            className="size-5 rounded-[6px] border border-dashed border-[var(--stroke-sub-300)]"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
            {title}
          </p>
          <p className="font-mono text-[10.5px] tabular-nums text-[var(--neutral-soft-400)]">
            {count} open
          </p>
        </div>
        <button
          type="button"
          aria-label={`Add task in ${title}`}
          onClick={onCompose}
          className="rounded-md p-1 text-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
        >
          <Plus size={14} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <div className="flex flex-col">
          {open.length === 0 && done.length === 0 && (
            <p className="px-1 py-6 text-center text-[11.5px] leading-[1.5] text-[var(--neutral-soft-400)]">
              Nothing on this agent.
            </p>
          )}
          <AnimatePresence>
            {open.map(({ item, ghost }, index) => (
              <PublishItem
                key={ghost ? `ghost-${item.pointer.id}-${laneKey}` : item.pointer.id}
                index={index}
                columnIndex={columnIndex}
              >
                {ghost ? (
                  <GhostCard
                    item={item}
                    stripe={stripe}
                    onOpen={() => onOpen(item.pointer.id)}
                  />
                ) : (
                  <TaskCard
                    item={item}
                    byId={byId}
                    highlight={highlightId === item.pointer.id}
                    onOpen={onOpen}
                    onOpenMenu={onOpenMenu}
                  />
                )}
              </PublishItem>
            ))}
          </AnimatePresence>
          {done.length > 0 && (
            <DoneToggle count={done.length} open={doneOpen} onToggle={onToggleDone}>
              <div className="mt-2 flex flex-col gap-2">
                {done.map(({ item, ghost }) =>
                  ghost ? (
                    <GhostCard
                      key={`ghost-${item.pointer.id}-${laneKey}`}
                      item={item}
                      stripe={stripe}
                      onOpen={() => onOpen(item.pointer.id)}
                    />
                  ) : (
                    <TaskCard
                      key={item.pointer.id}
                      item={item}
                      byId={byId}
                      highlight={highlightId === item.pointer.id}
                      onOpen={onOpen}
                      onOpenMenu={onOpenMenu}
                    />
                  ),
                )}
              </div>
            </DoneToggle>
          )}
        </div>
      </div>
    </section>
  );
}

function splitDone(items: BoardItem[]) {
  return {
    open: items.filter((item) => item.pointer.status !== 'done'),
    done: items.filter((item) => item.pointer.status === 'done'),
  };
}

function DoneToggle({
  count,
  open,
  onToggle,
  children,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full rounded-md px-1 py-1 text-left font-mono text-[11px] tabular-nums text-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-sub-600)]"
      >
        {open ? 'Hide' : 'Show'} {count} done
      </button>
      {open ? children : null}
    </div>
  );
}

function AvatarStack({
  agents,
  ring,
}: {
  agents: WorkspaceAgent[];
  ring: string;
}) {
  const shown = agents.slice(0, 3);
  const overflow = agents.length - shown.length;
  if (shown.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center">
      {shown.map((agent, index) => (
        <span
          key={agent.id}
          className="overflow-hidden rounded-[6px]"
          style={{
            marginLeft: index === 0 ? 0 : -6,
            zIndex: shown.length - index,
            boxShadow: `0 0 0 2px ${ring}`,
          }}
          title={`@${agent.handle}`}
        >
          <AgentGlyph handle={agent.handle} roleLabel={agent.role_label} size="sm" />
        </span>
      ))}
      {overflow > 0 && (
        <span className="ml-1 font-mono text-[10px] text-[var(--neutral-soft-400)]">
          +{overflow}
        </span>
      )}
    </span>
  );
}

function TaskCard({
  item,
  byId,
  highlight,
  onOpen,
  onOpenMenu,
}: {
  item: BoardItem;
  byId: Map<string, WorkspaceAgent>;
  highlight: boolean;
  onOpen: (id: string) => void;
  onOpenMenu: (id: string, rect: DOMRect) => void;
}) {
  const pointer = item.pointer;
  const meta = STATUS_META[pointer.status];
  const author = pointer.created_by_member_id ? byId.get(pointer.created_by_member_id) : undefined;
  const stripe = item.primary
    ? agentIdentityColor(item.primary.handle)
    : 'var(--neutral-soft-200)';
  const done = pointer.status === 'done';

  return (
    <article
      id={cardDomId(pointer.id)}
      tabIndex={0}
      aria-label={`Open ${pointer.title}`}
      onClick={() => onOpen(pointer.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(pointer.id);
        }
      }}
      className={cn(
        'relative shrink-0 cursor-pointer scroll-mt-3 overflow-visible rounded-[10px] border bg-[var(--bg-surface)] py-2.5 pl-3 pr-2 shadow-[0_1px_2px_rgba(23,23,23,0.04)]',
        done && 'opacity-[0.62]',
        'hover:border-[var(--stroke-sub-300)]',
        highlight
          ? 'border-[var(--primary-base)] ring-2 ring-[var(--primary-alpha-16)]'
          : 'border-[var(--stroke-soft-200)]',
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-1.5 left-[3px] w-[3px] rounded-full"
        style={{ backgroundColor: stripe }}
      />
      <div className="flex items-start gap-2 pl-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p
              className={cn(
                'line-clamp-2 min-w-0 flex-1 text-[13px] leading-[1.4] font-medium',
                done
                  ? 'text-[var(--neutral-soft-400)] line-through'
                  : 'text-[var(--neutral-strong-950)]',
              )}
            >
              {pointer.title}
            </p>
            <AvatarStack agents={item.others} ring="var(--bg-surface)" />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex h-[18px] items-center rounded-full px-1.5 text-[10px] font-semibold tracking-[0.02em]',
                meta.pill,
              )}
            >
              {meta.label}
            </span>
            {pointer.pointed_at_you === true && (
              <span className="rounded-full bg-[var(--attention-lighter)] px-1.5 py-px text-[10px] font-semibold text-[var(--attention-dark)]">
                pointed at you
              </span>
            )}
          </div>
          {pointer.description && (
            <p className="mt-1.5 line-clamp-2 text-[12px] leading-[1.45] text-[var(--neutral-sub-600)]">
              {pointer.description}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[var(--neutral-soft-400)]">
            {author && (
              <span className="inline-flex items-center gap-1">
                <AgentGlyph handle={author.handle} roleLabel={author.role_label} size="sm" />
                <span className="font-mono">@{author.handle}</span>
              </span>
            )}
            <RelativeTime timestamp={pointer.created_at} />
          </div>
        </div>
        <button
          type="button"
          aria-label={`More actions for ${pointer.title}`}
          aria-expanded={false}
          onClick={(event) => {
            event.stopPropagation();
            onOpenMenu(pointer.id, event.currentTarget.getBoundingClientRect());
          }}
          className="shrink-0 rounded-md p-1 text-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </article>
  );
}

function GhostCard({
  item,
  stripe,
  onOpen,
}: {
  item: BoardItem;
  stripe: string;
  onOpen: () => void;
}) {
  const owner = item.primary?.handle;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative w-full shrink-0 overflow-visible rounded-[10px] border border-dashed border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] py-2 pl-3 pr-2.5 text-left opacity-55 hover:opacity-90"
    >
      <span
        aria-hidden
        className="absolute inset-y-1.5 left-[3px] w-[3px] rounded-full"
        style={{ backgroundColor: stripe }}
      />
      <span className="flex items-start gap-1.5 pl-1">
        <GitBranch size={12} className="mt-0.5 shrink-0 text-[var(--neutral-soft-400)]" />
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
            {item.pointer.title}
          </span>
          <span className="mt-0.5 block font-mono text-[11px] text-[var(--neutral-soft-400)]">
            {owner ? `also with @${owner}` : 'also on the board'}
          </span>
        </span>
      </span>
    </button>
  );
}

function TaskFlashCard({
  item,
  byId,
  activeAgents,
  onClose,
  onUpdate,
  onDelete,
  onShowOnBoard,
}: {
  item: BoardItem;
  byId: Map<string, WorkspaceAgent>;
  activeAgents: WorkspaceAgent[];
  onClose: () => void;
  onUpdate: (
    id: string,
    payload: { status?: WorkspacePointerStatus; assignee_member_id?: string | null },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onShowOnBoard: () => void;
}) {
  const reduce = useReducedMotion();
  const pointer = item.pointer;
  const meta = STATUS_META[pointer.status];
  const author = pointer.created_by_member_id ? byId.get(pointer.created_by_member_id) : undefined;
  const assignee = pointer.assignee_member_id ? byId.get(pointer.assignee_member_id) : undefined;
  const assigneeHandle = assignee?.handle ?? pointer.assignee_handle ?? null;
  const stripe = item.primary
    ? agentIdentityColor(item.primary.handle)
    : 'var(--neutral-soft-200)';
  const done = pointer.status === 'done';

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[70]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DUR.fast, ease: EASE.emph }}
    >
      <button
        type="button"
        aria-label="Close task"
        className="absolute inset-0 bg-black/45 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        className="pointer-events-none relative flex h-full items-center justify-center px-4 py-8"
        style={{ perspective: 1400 }}
      >
        <motion.article
          role="dialog"
          aria-modal="true"
          aria-labelledby={`flash-title-${pointer.id}`}
          className={cn(
            'pointer-events-auto relative w-full max-w-[480px] origin-top rounded-[16px]',
            'max-h-[min(82vh,720px)] overflow-y-auto border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)]',
            'shadow-[0_24px_64px_rgba(0,0,0,0.22),0_4px_12px_rgba(23,23,23,0.08)]',
          )}
          initial={reduce ? { opacity: 0 } : { opacity: 0, rotateX: -82, y: -18, scale: 0.96 }}
          animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
          exit={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, rotateX: 10, y: 12, scale: 0.98, transition: { duration: DUR.fast } }
          }
          transition={{ duration: DUR.slow, ease: EASE.emph }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <span
            aria-hidden
            className="absolute inset-y-3 left-[6px] w-[4px] rounded-full"
            style={{ backgroundColor: stripe }}
          />
          <div className="pl-5 pr-4 pt-4">
            <div className="flex items-start gap-3">
              <h2
                id={`flash-title-${pointer.id}`}
                className={cn(
                  'min-w-0 flex-1 text-[17px] font-semibold leading-[1.35] tracking-[-0.02em]',
                  done
                    ? 'text-[var(--neutral-soft-400)] line-through'
                    : 'text-[var(--neutral-strong-950)]',
                )}
              >
                {pointer.title}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex h-[20px] items-center rounded-full px-2 text-[11px] font-semibold tracking-[0.02em]',
                  meta.pill,
                )}
              >
                {meta.label}
              </span>
              {pointer.pointed_at_you === true && (
                <span className="rounded-full bg-[var(--attention-lighter)] px-2 py-px text-[11px] font-semibold text-[var(--attention-dark)]">
                  pointed at you
                </span>
              )}
              <AvatarStack agents={item.involved} ring="var(--bg-surface)" />
            </div>
          </div>

          <div className="px-5 py-4 pl-5">
            {pointer.description ? (
              <p className="whitespace-pre-wrap text-[13.5px] leading-[1.6] text-[var(--neutral-sub-600)]">
                {pointer.description}
              </p>
            ) : (
              <p className="text-[13px] italic text-[var(--neutral-soft-400)]">No description.</p>
            )}

            <dl className="mt-4 grid gap-2 text-[12.5px]">
              {author && (
                <div className="flex items-center gap-2 text-[var(--neutral-sub-600)]">
                  <dt className="w-[72px] shrink-0 text-[11px] uppercase tracking-[0.04em] text-[var(--neutral-soft-400)]">
                    Written
                  </dt>
                  <dd className="inline-flex items-center gap-1.5 font-mono">
                    <AgentGlyph handle={author.handle} roleLabel={author.role_label} size="sm" />
                    @{author.handle}
                  </dd>
                </div>
              )}
              <div className="flex items-center gap-2 text-[var(--neutral-sub-600)]">
                <dt className="w-[72px] shrink-0 text-[11px] uppercase tracking-[0.04em] text-[var(--neutral-soft-400)]">
                  Assigned
                </dt>
                <dd className="font-mono">
                  {assigneeHandle ? `@${assigneeHandle}` : 'Unassigned'}
                </dd>
              </div>
              <div className="flex items-center gap-2 text-[var(--neutral-sub-600)]">
                <dt className="w-[72px] shrink-0 text-[11px] uppercase tracking-[0.04em] text-[var(--neutral-soft-400)]">
                  Created
                </dt>
                <dd>
                  <RelativeTime timestamp={pointer.created_at} />
                </dd>
              </div>
              {pointer.updated_at && pointer.updated_at !== pointer.created_at && (
                <div className="flex items-center gap-2 text-[var(--neutral-sub-600)]">
                  <dt className="w-[72px] shrink-0 text-[11px] uppercase tracking-[0.04em] text-[var(--neutral-soft-400)]">
                    Updated
                  </dt>
                  <dd>
                    <RelativeTime timestamp={pointer.updated_at} />
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="border-t border-[var(--stroke-soft-200)] px-5 py-3">
            <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
              Status
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => void onUpdate(pointer.id, { status })}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[12px] font-medium',
                    pointer.status === status
                      ? STATUS_META[status].pill
                      : 'bg-[var(--neutral-weak-50)] text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]',
                  )}
                >
                  {STATUS_META[status].label}
                </button>
              ))}
            </div>
            <p className="mb-1.5 mt-3 text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
              Assign
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => void onUpdate(pointer.id, { assignee_member_id: agent.id })}
                  className={cn(
                    'rounded-full px-2.5 py-1 font-mono text-[12px]',
                    pointer.assignee_member_id === agent.id
                      ? 'bg-[var(--neutral-weak-50)] font-medium text-[var(--neutral-strong-950)]'
                      : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                  )}
                >
                  @{agent.handle}
                </button>
              ))}
              {pointer.assignee_member_id && (
                <button
                  type="button"
                  onClick={() => void onUpdate(pointer.id, { assignee_member_id: null })}
                  className="rounded-full px-2.5 py-1 text-[12px] text-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)]"
                >
                  Unassign
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[var(--stroke-soft-200)] px-5 py-3">
            <button
              type="button"
              onClick={onShowOnBoard}
              className="text-[12.5px] text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]"
            >
              Show on board
            </button>
            <button
              type="button"
              onClick={() => void onDelete(pointer.id)}
              className="text-[12.5px] text-[var(--error-dark)] hover:underline"
            >
              Delete
            </button>
          </div>
        </motion.article>
      </div>
    </motion.div>
  );
}

function PointerMenu({
  pointer,
  activeAgents,
  onUpdate,
  onDelete,
  onClose,
}: {
  pointer?: WorkspaceTaskPointer;
  activeAgents: WorkspaceAgent[];
  onUpdate: (
    id: string,
    payload: { status?: WorkspacePointerStatus; assignee_member_id?: string | null },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  if (!pointer) return null;
  return (
    <>
      <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
        Status
      </p>
      {STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => {
            onClose();
            void onUpdate(pointer.id, { status });
          }}
          className={cn(
            'flex w-full items-center px-2.5 py-1.5 text-left text-[12.5px]',
            pointer.status === status
              ? 'bg-[var(--neutral-weak-50)] text-[var(--neutral-strong-950)]'
              : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
          )}
        >
          {STATUS_META[status].label}
        </button>
      ))}
      <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
        Assign
      </p>
      {activeAgents.map((agent) => (
        <button
          key={agent.id}
          type="button"
          onClick={() => {
            onClose();
            void onUpdate(pointer.id, { assignee_member_id: agent.id });
          }}
          className={cn(
            'flex w-full items-center px-2.5 py-1.5 text-left text-[12.5px]',
            pointer.assignee_member_id === agent.id
              ? 'bg-[var(--neutral-weak-50)] text-[var(--neutral-strong-950)]'
              : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
          )}
        >
          @{agent.handle}
        </button>
      ))}
      {pointer.assignee_member_id && (
        <button
          type="button"
          onClick={() => {
            onClose();
            void onUpdate(pointer.id, { assignee_member_id: null });
          }}
          className="flex w-full items-center px-2.5 py-1.5 text-left text-[12.5px] text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
        >
          Unassign
        </button>
      )}
      <div className="my-1 h-px bg-[var(--stroke-soft-200)]" />
      <button
        type="button"
        onClick={() => {
          onClose();
          void onDelete(pointer.id);
        }}
        className="flex w-full items-center px-2.5 py-1.5 text-left text-[12.5px] text-[var(--error-dark)] hover:bg-[var(--error-lighter)]"
      >
        Delete
      </button>
    </>
  );
}
