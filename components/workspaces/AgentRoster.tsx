'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, Link2, Plus } from 'lucide-react';
import {
  api,
  type WorkspaceAgent,
  type WorkspaceAgentStatus,
  type WorkspaceRun,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { cn, formatCompactNumber } from '@/lib/utils';
import { AgentGlyph, normalizeHandle } from './agent-visuals';
import { PanelEmpty } from './PanelEmpty';
import { InviteWorkspaceDialog } from './InviteWorkspaceDialog';
import { Dialog } from './Dialog';

type AgentRunStats = {
  runs: number;
  tokens: number | null;
  lastAt: string | null;
};

async function rollupRunsByHandle(workspaceId: string): Promise<Record<string, AgentRunStats>> {
  const byHandle: Record<string, AgentRunStats> = {};
  const limit = 100;
  let offset = 0;
  let total = Infinity;
  const cap = 2000;

  const absorb = (run: WorkspaceRun) => {
    const handle = run.agent_handle?.replace(/^@/, '').toLowerCase();
    if (!handle) return;
    const current = byHandle[handle] ?? { runs: 0, tokens: null, lastAt: null };
    current.runs += 1;
    if (run.token_count != null) {
      current.tokens = (current.tokens ?? 0) + run.token_count;
    }
    if (run.timestamp && (!current.lastAt || run.timestamp > current.lastAt)) {
      current.lastAt = run.timestamp;
    }
    byHandle[handle] = current;
  };

  while (offset < total && offset < cap) {
    const page = await api.getWorkspaceRuns(workspaceId, { limit, offset });
    total = page.total;
    page.items.forEach(absorb);
    if (page.items.length === 0) break;
    offset += page.items.length;
  }
  return byHandle;
}

export function AgentRoster({
  workspaceId,
  workspaceTitle,
  agents,
  onInvite,
  onRotate,
  onRemove,
  onUpdate,
  openInviteSignal = 0,
}: {
  workspaceId: string;
  workspaceTitle: string;
  agents: WorkspaceAgent[];
  onInvite: (handle: string, roleLabel: string) => Promise<void>;
  onRotate: (agentId: string) => Promise<void>;
  onRemove: (agentId: string) => Promise<void>;
  onUpdate: (
    agentId: string,
    payload: { handle?: string; role_label?: string | null; status?: WorkspaceAgentStatus },
  ) => Promise<void>;
  /** Bumped by the parent to open the invite form, e.g. from the `i` shortcut. */
  openInviteSignal?: number;
}) {
  const [inviting, setInviting] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<WorkspaceAgent | null>(null);
  const [editing, setEditing] = useState<WorkspaceAgent | null>(null);
  const [editHandle, setEditHandle] = useState('');
  const [editRole, setEditRole] = useState('');
  const [stats, setStats] = useState<Record<string, AgentRunStats>>({});

  useEffect(() => {
    if (openInviteSignal > 0) setInviting(true);
  }, [openInviteSignal]);

  useEffect(() => {
    let cancelled = false;
    void rollupRunsByHandle(workspaceId)
      .then((next) => {
        if (!cancelled) setStats(next);
      })
      .catch(() => {
        if (!cancelled) setStats({});
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, agents.length]);

  const ordered = useMemo(
    () =>
      [...agents].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return a.handle.localeCompare(b.handle);
      }),
    [agents],
  );

  const active = agents.filter((a) => a.status === 'active');
  const normalized = normalizeHandle(handle);
  const duplicate = active.some((a) => a.handle.toLowerCase() === normalized);
  const editNormalized = normalizeHandle(editHandle);
  const editDuplicate =
    Boolean(editing) &&
    active.some(
      (a) => a.id !== editing?.id && a.handle.toLowerCase() === editNormalized,
    );

  const submit = async () => {
    if (!normalized || duplicate || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onInvite(normalized, role.trim());
      setHandle('');
      setRole('');
      setInviting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the agent.');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || !editNormalized || editDuplicate || busy) return;
    setBusy(true);
    try {
      await onUpdate(editing.id, {
        handle: editNormalized,
        role_label: editRole.trim() || null,
      });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the agent.');
    } finally {
      setBusy(false);
    }
  };

  const restoreKey = async (agent: WorkspaceAgent) => {
    setBusy(true);
    try {
      if (agent.status === 'removed') {
        await onUpdate(agent.id, { status: 'active' });
      }
      await onRotate(agent.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-[880px] flex-col gap-3">
          {inviting && (
            <div className="rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] p-4">
              <p className="text-[13px] font-medium text-[var(--neutral-strong-950)]">Add an agent</p>
              <p className="mt-1 text-[12px] text-[var(--neutral-sub-600)]">
                A one-time agent key is issued when the agent is added.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Input
                  autoFocus
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="handle, e.g. backend"
                  invalid={!!normalized && duplicate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit();
                    if (e.key === 'Escape') setInviting(false);
                  }}
                />
                <Input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="role, e.g. Backend engineer agent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit();
                    if (e.key === 'Escape') setInviting(false);
                  }}
                />
              </div>
              {duplicate && (
                <p className="mt-2 text-[11.5px] text-[var(--error-dark)]">
                  @{normalized} is already in this workspace.
                </p>
              )}
              {error && <p className="mt-2 text-[11.5px] text-[var(--error-dark)]">{error}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Button
                  variant="primary"
                  size="md"
                  leadingIcon={<Plus size={13} />}
                  disabled={!normalized || duplicate || busy}
                  onClick={() => void submit()}
                >
                  {busy ? 'Adding...' : 'Add agent'}
                </Button>
                <Button variant="ghost" size="md" onClick={() => setInviting(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  leadingIcon={<Link2 size={13} />}
                  onClick={() => setLinkOpen(true)}
                >
                  Invite via link
                </Button>
              </div>
            </div>
          )}

          {ordered.length === 0 && !inviting && (
            <PanelEmpty
              icon={Bot}
              title="No agents yet"
              hint="Add an agent for a one-time key, or invite another user with a link."
            />
          )}

          {ordered.map((agent) => {
            const rollup = stats[agent.handle.toLowerCase()];
            const revoked = agent.status === 'removed';
            return (
              <article
                key={agent.id}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] p-4 sm:flex-row sm:items-center',
                  revoked && 'opacity-80',
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <AgentGlyph handle={agent.handle} roleLabel={agent.role_label} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-[14px] font-semibold text-[var(--neutral-strong-950)]">
                        @{agent.handle}
                      </span>
                      {agent.role_label && (
                        <span className="text-[12.5px] text-[var(--neutral-sub-600)]">
                          {agent.role_label}
                        </span>
                      )}
                      {revoked && (
                        <span className="rounded-full bg-[var(--neutral-soft-200)] px-1.5 py-px text-[10.5px] font-medium text-[var(--neutral-sub-600)]">
                          revoked
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 grid max-w-[420px] grid-cols-3 gap-3">
                      <Stat
                        value={formatCompactNumber(rollup?.runs ?? 0)}
                        label="runs"
                      />
                      <Stat
                        value={rollup?.tokens != null ? formatCompactNumber(rollup.tokens) : '—'}
                        label="tokens"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[var(--neutral-strong-950)]">
                          {rollup?.lastAt ? (
                            <RelativeTime timestamp={rollup.lastAt} />
                          ) : (
                            'Never'
                          )}
                        </p>
                        <p className="text-[11px] text-[var(--neutral-soft-400)]">last run</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                  {revoked ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void restoreKey(agent)}
                    >
                      Generate a new key
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(agent);
                          setEditHandle(agent.handle);
                          setEditRole(agent.role_label ?? '');
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmRemove(agent)}
                      >
                        Revoke
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title={confirmRemove ? `Revoke @${confirmRemove.handle}?` : 'Revoke agent?'}
        description="Its key stops working immediately and it can no longer post here. Past messages stay in the workspace history."
        confirmLabel="Revoke"
        variant="danger"
        onConfirm={async () => {
          if (confirmRemove) await onRemove(confirmRemove.id);
          setConfirmRemove(null);
        }}
      />

      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing ? `Edit @${editing.handle}` : 'Edit agent'}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!editNormalized || editDuplicate || busy}
              onClick={() => void saveEdit()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Input
            value={editHandle}
            onChange={(e) => setEditHandle(e.target.value)}
            placeholder="handle"
            invalid={editDuplicate}
          />
          <Input
            value={editRole}
            onChange={(e) => setEditRole(e.target.value)}
            placeholder="role label"
          />
          {editDuplicate && (
            <p className="text-[11.5px] text-[var(--error-dark)]">
              @{editNormalized} is already in this workspace.
            </p>
          )}
        </div>
      </Dialog>

      <InviteWorkspaceDialog
        workspaceId={workspaceId}
        workspaceTitle={workspaceTitle}
        open={linkOpen}
        onOpenChange={setLinkOpen}
      />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-medium tabular-nums text-[var(--neutral-strong-950)]">
        {value}
      </p>
      <p className="text-[11px] text-[var(--neutral-soft-400)]">{label}</p>
    </div>
  );
}
