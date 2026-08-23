'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { buildMemoryShareUrl } from '@/lib/authRedirect';
import { Memory, MemoryShare, MemoryShareStatus } from '@/lib/types';
import { Dialog } from '@/components/workspaces/Dialog';
import { Button } from '@/components/ui/Button';
import CopyButton from '@/components/ui/CopyButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { useToast } from '@/components/ui/Toast';

function statusLabel(status?: MemoryShareStatus): string {
  switch (status) {
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

function usesLabel(share: MemoryShare): string {
  const used = share.used_count ?? 0;
  if (share.max_uses == null) {
    return `${used.toLocaleString()} ${used === 1 ? 'use' : 'uses'} · unlimited`;
  }
  return `${used.toLocaleString()} / ${share.max_uses.toLocaleString()} uses`;
}

export function ShareMemoryDialog({
  memory,
  open,
  onOpenChange,
}: {
  memory: Memory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const [shares, setShares] = useState<MemoryShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<MemoryShare | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadShares = useCallback(async () => {
    if (!memory) return;
    setLoading(true);
    setError(null);
    try {
      setShares(await api.getMemoryShares(memory.id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load share links.'));
    } finally {
      setLoading(false);
    }
  }, [memory]);

  useEffect(() => {
    if (!open || !memory) {
      setCreatedUrl(null);
      setShares([]);
      setError(null);
      return;
    }
    void loadShares();
  }, [open, memory, loadShares]);

  const handleCreate = async () => {
    if (!memory) return;
    setCreating(true);
    setError(null);
    try {
      const share = await api.createMemoryShare(memory.id, {
        expires_in_hours: 168,
        max_uses: null,
      });
      const url = share.share_url || buildMemoryShareUrl(share.share_code);
      setCreatedUrl(url);
      setShares((prev) => [share, ...prev.filter((row) => row.id !== share.id)]);
      toast.success('Share link created');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create share link.'));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!pendingRevoke) return;
    const target = pendingRevoke;
    setRevoking(true);
    try {
      await api.revokeMemoryShare(target.id);
      setShares((prev) =>
        prev.map((row) =>
          row.id === target.id ? { ...row, status: 'revoked' } : row,
        ),
      );
      if (createdUrl && createdUrl.includes(target.share_code)) {
        setCreatedUrl(null);
      }
      setPendingRevoke(null);
      toast.success('Share link revoked');
    } catch (err) {
      toast.error('Could not revoke share link', {
        description: getApiErrorMessage(err),
      });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <>
      <Dialog
        open={open && memory !== null}
        onOpenChange={onOpenChange}
        width={520}
        title="Share this memory"
        description={
          memory ? (
            <>
              Generate an open link for{' '}
              <span className="font-semibold text-[var(--neutral-strong-950)]">
                &ldquo;{memory.title}&rdquo;
              </span>
              . Anyone signed in who opens it gets their own copy. Revoking a
              link does not remove copies already made.
            </>
          ) : null
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
                Expires in 168 hours. Unlimited uses until you revoke it.
              </p>
            </div>
          )}

          <Button
            variant="primary"
            size="md"
            onClick={handleCreate}
            disabled={creating || !memory}
            leadingIcon={<Link2 className="h-3.5 w-3.5" strokeWidth={2} />}
          >
            {creating ? 'Creating link…' : 'Create share link'}
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
            ) : shares.length === 0 ? (
              <p className="text-[12.5px] text-[var(--neutral-sub-600)]">
                No share links yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--stroke-soft-200)] overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)]">
                {shares.map((share) => {
                  const url = share.share_url || buildMemoryShareUrl(share.share_code);
                  const inactive = share.status && share.status !== 'pending';
                  return (
                    <li
                      key={share.id || share.share_code}
                      className="flex items-start justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[11.5px] text-[var(--neutral-strong-950)]">
                          {url}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--neutral-soft-400)]">
                          {statusLabel(share.status)} · {usesLabel(share)}
                          {share.expires_at ? (
                            <>
                              {' · '}
                              <RelativeTime timestamp={share.expires_at} />
                            </>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!inactive && <CopyButton text={url} />}
                        {!inactive && (
                          <button
                            type="button"
                            aria-label="Revoke share link"
                            onClick={() => setPendingRevoke(share)}
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
        title="Revoke this share link?"
        description="The link will stop working immediately. Memories already copied by recipients are kept."
        confirmLabel="Revoke link"
        loading={revoking}
        onConfirm={handleRevoke}
      />
    </>
  );
}
