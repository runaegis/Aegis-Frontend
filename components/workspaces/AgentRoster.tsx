'use client';

import { useEffect, useState } from 'react';
import { Bot, KeyRound, Plus, UserMinus, UserPlus } from 'lucide-react';
import type { WorkspaceAgent } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { AgentGlyph, normalizeHandle } from './agent-visuals';
import { RAIL_FOOTER } from './rail-footer';
import { PanelEmpty } from './PanelEmpty';

export function AgentRoster({
  agents,
  onInvite,
  onRotate,
  onRemove,
  openInviteSignal = 0,
}: {
  agents: WorkspaceAgent[];
  onInvite: (handle: string, roleLabel: string) => Promise<void>;
  onRotate: (agentId: string) => Promise<void>;
  onRemove: (agentId: string) => Promise<void>;
  /** Bumped by the parent to open the invite form, e.g. from the `i` shortcut. */
  openInviteSignal?: number;
}) {
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (openInviteSignal > 0) setInviting(true);
  }, [openInviteSignal]);
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<WorkspaceAgent | null>(null);

  const active = agents.filter((a) => a.status === 'active');
  const removed = agents.filter((a) => a.status === 'removed');
  const normalized = normalizeHandle(handle);
  const duplicate = active.some((a) => a.handle.toLowerCase() === normalized);

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-1.5 py-1.5">
        {active.map((a) => (
          <div
            key={a.id}
            className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--neutral-weak-50)]"
          >
            <AgentGlyph handle={a.handle} roleLabel={a.role_label} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-mono text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
                  @{a.handle}
                </span>
                <span
                  className="size-1.5 shrink-0 rounded-full bg-[var(--success)]"
                  title="Active"
                  aria-label="Active"
                />
              </div>
              {a.role_label && (
                <p className="truncate text-[11px] text-[var(--neutral-sub-600)]">{a.role_label}</p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => void onRotate(a.id)}
                title="Rotate agent key"
                aria-label={`Rotate key for @${a.handle}`}
                className="rounded p-1 text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-soft-200)] hover:text-[var(--neutral-strong-950)]"
              >
                <KeyRound size={13} />
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(a)}
                title="Remove from workspace"
                aria-label={`Remove @${a.handle}`}
                className="rounded p-1 text-[var(--neutral-sub-600)] hover:bg-[rgba(251,55,72,0.12)] hover:text-[var(--error-dark)]"
              >
                <UserMinus size={13} />
              </button>
            </div>
          </div>
        ))}

        {active.length === 0 && (
          <PanelEmpty
            icon={Bot}
            title="No agents yet"
            hint="Invite an agent to get a one-time key and the MCP config it needs to join."
          />
        )}

        {removed.length > 0 && (
          <div className="mt-2 border-t border-[var(--stroke-soft-200)] pt-2">
            <p className="px-2 pb-1 text-[10.5px] font-medium uppercase tracking-[0.04em] text-[var(--neutral-soft-400)]">
              Removed
            </p>
            {removed.map((a) => (
              <div key={a.id} className="flex items-center gap-2.5 px-2 py-1.5 opacity-55">
                <AgentGlyph handle={a.handle} roleLabel={a.role_label} size="sm" />
                <span className="truncate font-mono text-[12px] text-[var(--neutral-sub-600)] line-through">
                  @{a.handle}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite */}
      <div className={cn(RAIL_FOOTER, inviting && 'items-stretch py-2')}>
        <div className="w-full">
        {!inviting ? (
          <Button
            variant="secondary"
            size="md"
            fullWidth
            leadingIcon={<UserPlus size={13} />}
            onClick={() => setInviting(true)}
          >
            Invite an agent
          </Button>
        ) : (
          <div className="space-y-2">
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
            {duplicate && (
              <p className="text-[11.5px] text-[var(--error-dark)]">
                @{normalized} is already in this workspace.
              </p>
            )}
            {error && <p className="text-[11.5px] text-[var(--error-dark)]">{error}</p>}
            <div className="flex items-center gap-1.5">
              <Button
                variant="primary"
                size="md"
                leadingIcon={<Plus size={13} />}
                disabled={!normalized || duplicate || busy}
                onClick={submit}
              >
                {busy ? 'Adding...' : 'Add agent'}
              </Button>
              <Button variant="ghost" size="md" onClick={() => setInviting(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
            <p className={cn('text-[11px] leading-[1.5] text-[var(--neutral-sub-600)]')}>
              A one-time agent key is issued when the agent is added.
            </p>
          </div>
        )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title={confirmRemove ? `Remove @${confirmRemove.handle}?` : 'Remove agent?'}
        description="Its key stops working immediately and it can no longer post here. Past messages stay in the workspace history."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={async () => {
          if (confirmRemove) await onRemove(confirmRemove.id);
          setConfirmRemove(null);
        }}
      />
    </div>
  );
}
