'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { BookMarked, Loader2 } from 'lucide-react';
import {
  api,
  AuthError,
  getApiErrorCode,
  getApiErrorMessage,
} from '@/lib/api';
import { MemorySharePreview } from '@/lib/types';
import {
  buildMemorySharePath,
  consumePostAuthRedirect,
  storePostAuthRedirect,
} from '@/lib/authRedirect';
import { installPreviewApi } from '@/lib/preview-data';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { Button } from '@/components/ui/Button';
import { fadeUp, staggerContainer } from '@/lib/motion';

function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      document.documentElement.dataset.demo === 'true' ||
      localStorage.getItem('aegis_demo') === 'true'
    );
  } catch {
    return false;
  }
}

function statusCopy(status: MemorySharePreview['status']): string {
  switch (status) {
    case 'revoked':
      return 'This share link was revoked by the owner.';
    case 'expired':
      return 'This share link has expired.';
    case 'exhausted':
      return 'This share link has reached its use limit.';
    default:
      return 'Add a copy of this memory to your account. The copy is independent after redeem.';
  }
}

export function ShareRedeemClient({ shareCode }: { shareCode: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [preview, setPreview] = useState<MemorySharePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMemoryId, setDoneMemoryId] = useState<string | null>(null);
  const [alreadyRedeemed, setAlreadyRedeemed] = useState(false);

  const sharePath = useMemo(() => buildMemorySharePath(shareCode), [shareCode]);

  const goToAuth = useCallback(() => {
    storePostAuthRedirect(sharePath);
    router.replace(`/auth?next=${encodeURIComponent(sharePath)}`);
  }, [router, sharePath]);

  const load = useCallback(async () => {
    if (isDemoMode()) {
      installPreviewApi();
    }
    storePostAuthRedirect(sharePath);
    setLoading(true);
    setError(null);
    try {
      const next = await api.getMemorySharePreview(shareCode);
      setPreview(next);
      setNeedsAuth(false);
      if (next.already_redeemed && next.redeemed_memory_id) {
        setDoneMemoryId(next.redeemed_memory_id);
        setAlreadyRedeemed(true);
      }
    } catch (err) {
      if (err instanceof AuthError) {
        setNeedsAuth(true);
        setPreview(null);
        return;
      }
      const code = getApiErrorCode(err);
      if (code === 'MEMORY_SHARE_REVOKED') {
        setPreview({
          title: 'Shared memory',
          status: 'revoked',
          already_owned: false,
          already_redeemed: false,
        });
        return;
      }
      if (code === 'MEMORY_SHARE_EXPIRED') {
        setPreview({
          title: 'Shared memory',
          status: 'expired',
          already_owned: false,
          already_redeemed: false,
        });
        return;
      }
      if (code === 'MEMORY_SHARE_EXHAUSTED') {
        setPreview({
          title: 'Shared memory',
          status: 'exhausted',
          already_owned: false,
          already_redeemed: false,
        });
        return;
      }
      setError(
        getApiErrorMessage(
          err,
          code === 'MEMORY_SHARE_NOT_FOUND'
            ? 'This share link was not found.'
            : 'Could not load this share link.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [shareCode, sharePath]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRedeem = async () => {
    setRedeeming(true);
    setError(null);
    try {
      let result;
      try {
        result = await api.redeemMemoryShare(shareCode);
      } catch (err) {
        if (getApiErrorCode(err) === 'MEMORY_SHARE_REDEEM_CONFLICT') {
          result = await api.redeemMemoryShare(shareCode);
        } else {
          throw err;
        }
      }
      setAlreadyRedeemed(result.already_redeemed);
      setDoneMemoryId(result.memory?.id ?? preview?.redeemed_memory_id ?? null);
      consumePostAuthRedirect();
    } catch (err) {
      const code = getApiErrorCode(err);
      if (err instanceof AuthError) {
        goToAuth();
        return;
      }
      if (code === 'MEMORY_SHARE_OWN') {
        setError('This is your own share link. Open Memory to manage it.');
      } else if (code === 'MEMORY_SHARE_REVOKED') {
        setPreview((prev) =>
          prev ? { ...prev, status: 'revoked' } : prev,
        );
      } else if (code === 'MEMORY_SHARE_EXPIRED') {
        setPreview((prev) =>
          prev ? { ...prev, status: 'expired' } : prev,
        );
      } else if (code === 'MEMORY_SHARE_EXHAUSTED') {
        setPreview((prev) =>
          prev ? { ...prev, status: 'exhausted' } : prev,
        );
      } else {
        setError(getApiErrorMessage(err, 'Could not add this memory.'));
      }
    } finally {
      setRedeeming(false);
    }
  };

  const inactive = preview
    ? preview.status !== 'pending'
    : false;
  const canRedeem =
    !!preview &&
    !inactive &&
    !preview.already_owned &&
    !preview.already_redeemed &&
    !doneMemoryId &&
    !needsAuth;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-app)]">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="Aegis home">
          <AegisLogo className="h-7 text-[var(--neutral-strong-950)]" />
        </Link>
        <Link
          href="/dashboard/memory"
          className="text-[12.5px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]"
        >
          Open Memory
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <motion.section
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="w-full max-w-[480px] rounded-[14px] border border-[var(--stroke-soft-200)] bg-white p-6 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <motion.p
            variants={fadeUp}
            className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--primary-base)]"
          >
            Shared memory
          </motion.p>
          <motion.div variants={fadeUp} className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--primary-alpha-10)]">
              <BookMarked className="h-4 w-4 text-[var(--primary-base)]" strokeWidth={2} />
            </div>
            <h1 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.025em] text-[var(--neutral-strong-950)]">
              {loading ? 'Loading share…' : preview?.title ?? 'Shared memory'}
            </h1>
          </motion.div>

          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-[var(--neutral-sub-600)]">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              Checking this link…
            </div>
          ) : (
            <>
              <motion.p
                variants={fadeUp}
                className="text-[14px] leading-[1.6] text-[var(--neutral-sub-600)]"
              >
                {needsAuth
                  ? 'Sign in to preview this shared memory and add a copy to your account.'
                  : preview
                    ? preview.already_owned
                      ? 'This is your own share link. Recipients can redeem it; you already own the source memory.'
                      : statusCopy(preview.status)
                    : 'This share link could not be loaded.'}
              </motion.p>

              {error && (
                <p className="mt-3 text-[13px] text-[var(--error-dark)]">{error}</p>
              )}

              {doneMemoryId && (
                <p className="mt-3 text-[13px] text-[var(--neutral-strong-950)]">
                  {alreadyRedeemed
                    ? 'This memory is already on your account.'
                    : 'Memory added to your account. The copy is unpinned and independent.'}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {needsAuth && (
                  <Button variant="primary" size="md" onClick={goToAuth}>
                    Sign in to continue
                  </Button>
                )}
                {canRedeem && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleRedeem}
                    disabled={redeeming}
                  >
                    {redeeming ? 'Adding memory…' : 'Add to my memory'}
                  </Button>
                )}
                {preview?.already_owned && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => router.push('/dashboard/memory')}
                  >
                    Open my memories
                  </Button>
                )}
                {doneMemoryId && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => router.push('/dashboard/memory')}
                  >
                    View in Memory
                  </Button>
                )}
              </div>
            </>
          )}
        </motion.section>
      </main>
    </div>
  );
}
