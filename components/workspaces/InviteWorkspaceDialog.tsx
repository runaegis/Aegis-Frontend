'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';
import {
  api,
  getApiErrorMessage,
  type WorkspaceInvite,
  type WorkspaceInviteStatus,
} from '@/lib/api';
import { buildWorkspaceJoinUrl } from '@/lib/authRedirect';
import { Dialog } from '@/components/workspaces/Dialog';
import { Button } from '@/components/ui/Button';
import CopyButton from '@/components/ui/CopyButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { useToast } from '@/components/ui/Toast';

function statusLabel(status?: WorkspaceInviteStatus): string {
  switch (status) {
    case 'accepted':
      return 'Accepted';
    case 'revoked':
      return 'Revoked';
    case 'expired':
      return 'Expired';
    case 'exhausted':
      return 'Use limit reached';
    default:
      return 'Active';
  }
}

function usesLabel(invite: WorkspaceInvite): string {
  const used = invite.used_count ?? 0;
  if (invite.max_uses == null) {
    return `${used.toLocaleString()} ${used === 1 ? 'use' : 'uses'} · unlimited`;
  }
  return `${used.toLocaleString()} / ${invite.max_uses.toLocaleString()} uses`;
}

export function InviteWorkspaceDialog({
  workspaceId,
  workspaceTitle,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  workspaceTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<WorkspaceInvite | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [email, setEmail] = useState('');
  const [suggestedHandle, setSuggestedHandle] = useState('');
  const [roleLabel, setRoleLabel] = useState('');

  const loadInvites = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      setInvites(await api.getWorkspaceInvites(workspaceId));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load invite links.'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!open || !workspaceId) {
      setCreatedUrl(null);
      setInvites([]);
      setError(null);
      setEmail('');
      setSuggestedHandle('');
      setRoleLabel('');
      return;
    }
    void loadInvites();
  }, [open, workspaceId, loadInvites]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const invitedEmail = email.trim() || null;
      const invite = await api.createWorkspaceInvite(workspaceId, {
        expires_in_hours: 72,
        max_uses: invitedEmail ? 1 : null,
        invited_email: invitedEmail,
        suggested_handle: suggestedHandle.trim() || null,
        role_label: roleLabel.trim() || null,
      });
      const url = invite.invite_url || buildWorkspaceJoinUrl(invite.invite_code);
      setCreatedUrl(url);
      setInvites((prev) => [invite, ...prev.filter((row) => row.id !== invite.id)]);
      toast.success(invitedEmail ? 'Directed invite created' : 'Invite link created');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create invite link.'));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!pendingRevoke) return;
    const target = pendingRevoke;
    setRevoking(true);
    try {
      await api.revokeWorkspaceInvite(target.id);
      setInvites((prev) =>
        prev.map((row) =>
          row.id === target.id ? { ...row, status: 'revoked' } : row,
        ),
      );
      if (createdUrl && createdUrl.includes(target.invite_code)) {
        setCreatedUrl(null);
      }
      setPendingRevoke(null);
      toast.success('Invite link revoked');
    } catch (err) {
      toast.error('Could not revoke invite link', {
        description: getApiErrorMessage(err),
      });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        width={520}
        title="Invite another user's agent"
        description={
          <>
            Generate a link for{' '}
            <span className="font-semibold text-[var(--neutral-strong-950)]">
              &ldquo;{workspaceTitle}&rdquo;
            </span>
            . The recipient signs in, picks a handle, and gets a one-time agent
            key for MCP. Leave email blank for an open link.
          </>
        }
      >
        <div className="space-y-4">
          {createdUrl && (
            <div className="rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  New link
                </span>
                <CopyButton text={createdUrl} />
              </div>
              <p className="break-all font-mono text-[12px] leading-[1.5] text-[var(--neutral-strong-950)]">
                {createdUrl}
              </p>
              <p className="mt-2 text-[12px] text-[var(--neutral-sub-600)]">
                Expires in 72 hours.
                {email.trim()
                  ? ' Directed to one user.'
                  : ' Unlimited uses until you revoke it.'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Optional: recipient email"
            />
            <Input
              value={suggestedHandle}
              onChange={(e) => setSuggestedHandle(e.target.value)}
              placeholder="Optional: suggested handle, e.g. frontend"
            />
            <Input
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
              placeholder="Optional: role, e.g. Frontend agent"
            />
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={handleCreate}
            disabled={creating}
            leadingIcon={<Link2 className="h-3.5 w-3.5" strokeWidth={2} />}
          >
            {creating
              ? 'Creating link…'
              : email.trim()
                ? 'Create directed invite'
                : 'Create invite link'}
          </Button>

          {error && (
            <p className="text-[12.5px] text-[var(--error-dark)]">{error}</p>
          )}

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
              Existing links
            </p>
            {loading ? (
              <p className="text-[12.5px] text-[var(--neutral-sub-600)]">
                Loading links…
              </p>
            ) : invites.length === 0 ? (
              <p className="text-[12.5px] text-[var(--neutral-sub-600)]">
                No invite links yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--stroke-soft-200)] overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)]">
                {invites.map((invite) => {
                  const url =
                    invite.invite_url || buildWorkspaceJoinUrl(invite.invite_code);
                  const inactive = invite.status && invite.status !== 'pending';
                  return (
                    <li
                      key={invite.id || invite.invite_code}
                      className="flex items-start justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[11.5px] text-[var(--neutral-strong-950)]">
                          {url}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--neutral-soft-400)]">
                          {statusLabel(invite.status)}
                          {invite.is_directed ? ' · directed' : ' · open'}
                          {' · '}
                          {usesLabel(invite)}
                          {invite.invited_email ? ` · ${invite.invited_email}` : null}
                          {invite.expires_at ? (
                            <>
                              {' · '}
                              <RelativeTime timestamp={invite.expires_at} />
                            </>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!inactive && <CopyButton text={url} />}
                        {!inactive && (
                          <button
                            type="button"
                            aria-label="Revoke invite link"
                            onClick={() => setPendingRevoke(invite)}
                            className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--neutral-soft-400)] transition-colors hover:bg-[var(--error-lighter)] hover:text-[var(--error)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={pendingRevoke !== null}
        onOpenChange={(next) => {
          if (!next) setPendingRevoke(null);
        }}
        variant="danger"
        title="Revoke this invite?"
        description="The link will stop working immediately. Agents that already joined stay in the workspace."
        confirmLabel="Revoke link"
        loading={revoking}
        onConfirm={handleRevoke}
      />
    </>
  );
}
