'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { Loader2, Users2 } from 'lucide-react';
import {
  ApiError,
  api,
  AuthError,
  getApiErrorCode,
  getApiErrorMessage,
  type WorkspaceAgentKeyResponse,
  type WorkspaceInvitePreview,
} from '@/lib/api';
import {
  buildWorkspaceJoinPath,
  consumePostAuthRedirect,
  storePostAuthRedirect,
} from '@/lib/authRedirect';
import { isWorkspaceDemoMode } from '@/components/workspaces/WorkspaceDemoGate';
import { installWorkspacePreviewApi } from '@/lib/workspace-preview';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fadeUp, staggerContainer } from '@/lib/motion';
import { AgentKeyDialog } from '@/components/workspaces/AgentKeyDialog';
import { normalizeHandle } from '@/components/workspaces/agent-visuals';

function statusCopy(preview: WorkspaceInvitePreview): string {
  switch (preview.status) {
    case 'revoked':
      return 'This invite was revoked by the workspace owner.';
    case 'expired':
      return 'This invite has expired.';
    case 'exhausted':
      return 'This invite has reached its use limit.';
    case 'accepted':
      return 'This invite has already been used.';
    default:
      return preview.workspace_task
        ? preview.workspace_task
        : 'Join this workspace with your agent. You will get a one-time key for MCP.';
  }
}

function previewFromStatus(
  status: WorkspaceInvitePreview['status'],
): WorkspaceInvitePreview {
  return {
    invite_id: '',
    workspace_id: '',
    workspace_title: 'Workspace invite',
    workspace_task: null,
    status,
    suggested_handle: null,
    role_label: null,
    is_directed: false,
    already_member: false,
    already_joined: false,
    is_owner: false,
    expires_at: null,
  };
}

export function JoinWorkspaceClient({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [preview, setPreview] = useState<WorkspaceInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [issued, setIssued] = useState<WorkspaceAgentKeyResponse | null>(null);
  const [alreadyJoined, setAlreadyJoined] = useState(false);

  const joinPath = useMemo(() => buildWorkspaceJoinPath(inviteCode), [inviteCode]);

  const goToAuth = useCallback(() => {
    storePostAuthRedirect(joinPath);
    router.replace(`/auth?next=${encodeURIComponent(joinPath)}`);
  }, [router, joinPath]);

  const load = useCallback(async () => {
    if (isWorkspaceDemoMode()) {
      installWorkspacePreviewApi();
    }
    storePostAuthRedirect(joinPath);
    setLoading(true);
    setError(null);
    try {
      const next = await api.getWorkspaceInvitePreview(inviteCode);
      setPreview(next);
      setNeedsAuth(false);
      if (next.suggested_handle) setHandle(next.suggested_handle);
      if (next.role_label) setRoleLabel(next.role_label);
      if (next.already_joined || next.already_member) {
        setAlreadyJoined(true);
      }
    } catch (err) {
      if (err instanceof AuthError) {
        setNeedsAuth(true);
        setPreview(null);
        return;
      }
      const code = getApiErrorCode(err);
      if (code === 'WORKSPACE_INVITE_REVOKED') {
        setPreview(previewFromStatus('revoked'));
        return;
      }
      if (code === 'WORKSPACE_INVITE_EXPIRED') {
        setPreview(previewFromStatus('expired'));
        return;
      }
      if (code === 'WORKSPACE_INVITE_EXHAUSTED') {
        setPreview(previewFromStatus('exhausted'));
        return;
      }
      if (code === 'WORKSPACE_INVITE_OWN') {
        setPreview({
          ...previewFromStatus('pending'),
          is_owner: true,
        });
        setError('This is your own invite link. Open the workspace to manage it.');
        return;
      }
      setError(
        getApiErrorMessage(
          err,
          code === 'WORKSPACE_INVITE_NOT_FOUND'
            ? 'This invite link was not found.'
            : 'Could not load this invite.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [inviteCode, joinPath]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleJoin = async () => {
    const normalized = normalizeHandle(handle) || preview?.suggested_handle || '';
    if (!normalized && !preview?.suggested_handle) {
      setError('Choose a handle for your agent.');
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const result = await api.joinWorkspace({
        invite_code: inviteCode,
        handle: normalized || undefined,
        role_label: roleLabel.trim() || preview?.role_label || null,
      });
      consumePostAuthRedirect();
      setAlreadyJoined(result.already_joined);
      if (result.already_joined) {
        return;
      }
      if (result.agent && result.agent_key && result.mcp_config_snippet) {
        setIssued({
          agent: result.agent,
          agent_key: result.agent_key,
          mcp_config_snippet: result.mcp_config_snippet,
        });
      }
      if (result.agent?.workspace_id) {
        setPreview((prev) =>
          prev
            ? { ...prev, workspace_id: result.agent?.workspace_id ?? prev.workspace_id }
            : prev,
        );
      }
    } catch (err) {
      const code = getApiErrorCode(err);
      if (err instanceof AuthError) {
        goToAuth();
        return;
      }
      if (code === 'WORKSPACE_INVITE_OWN') {
        setError('This is your own invite link. Open the workspace to manage it.');
      } else if (code === 'WORKSPACE_INVITE_WRONG_USER' || code === 'WORKSPACE_INVITE_USER_MISMATCH') {
        setError('This invite was sent to a different account.');
      } else if (code === 'WORKSPACE_HANDLE_REQUIRED' || code === 'WORKSPACE_HANDLE_INVALID') {
        setError(getApiErrorMessage(err, 'Choose a valid handle for your agent.'));
      } else if (code === 'WORKSPACE_INVITE_REVOKED') {
        setPreview((prev) => (prev ? { ...prev, status: 'revoked' } : prev));
      } else if (code === 'WORKSPACE_INVITE_EXPIRED') {
        setPreview((prev) => (prev ? { ...prev, status: 'expired' } : prev));
      } else if (code === 'WORKSPACE_INVITE_EXHAUSTED') {
        setPreview((prev) => (prev ? { ...prev, status: 'exhausted' } : prev));
      } else if (err instanceof ApiError && err.status === 409) {
        setError('That handle is already in this workspace. Pick a different one.');
      } else {
        setError(getApiErrorMessage(err, 'Could not join this workspace.'));
      }
    } finally {
      setJoining(false);
    }
  };

  const inactive = preview ? preview.status !== 'pending' : false;
  const canJoin =
    !!preview &&
    !inactive &&
    !preview.is_owner &&
    !preview.already_joined &&
    !alreadyJoined &&
    !issued &&
    !needsAuth;

  const workspaceHref = preview?.workspace_id
    ? `/workspaces/${preview.workspace_id}`
    : '/dashboard/workspaces';

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-app)]">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="Aegis home">
          <AegisLogo className="h-7 text-[var(--neutral-strong-950)]" />
        </Link>
        <Link
          href="/dashboard/workspaces"
          className="text-[12.5px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]"
        >
          Open Workspaces
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
            Workspace invite
          </motion.p>
          <motion.div variants={fadeUp} className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--primary-alpha-10)]">
              <Users2 className="h-4 w-4 text-[var(--primary-base)]" strokeWidth={2} />
            </div>
            <h1 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.025em] text-[var(--neutral-strong-950)]">
              {loading
                ? 'Loading invite…'
                : preview?.workspace_title ?? 'Workspace invite'}
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
                  ? 'Sign in to preview this workspace invite and join with your agent.'
                  : preview?.is_owner
                    ? 'This is your own invite link. Recipients can join; you already own the workspace.'
                    : preview
                      ? alreadyJoined || preview.already_joined || preview.already_member
                        ? 'You already have an agent in this workspace.'
                        : statusCopy(preview)
                      : 'This invite could not be loaded.'}
              </motion.p>

              {error && (
                <p className="mt-3 text-[13px] text-[var(--error-dark)]">{error}</p>
              )}

              {canJoin && (
                <div className="mt-4 space-y-2">
                  <Input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="handle, e.g. frontend"
                    autoFocus={!preview?.suggested_handle}
                  />
                  <Input
                    value={roleLabel}
                    onChange={(e) => setRoleLabel(e.target.value)}
                    placeholder="Optional role, e.g. Frontend agent"
                  />
                  <p className="text-[12px] text-[var(--neutral-sub-600)]">
                    After you join, copy the Cursor URL (Streamable HTTP) or Claude URL
                    (SSE). Header auth still works; dashboard REST stays cookie-only.
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {needsAuth && (
                  <Button variant="primary" size="md" onClick={goToAuth}>
                    Sign in to continue
                  </Button>
                )}
                {canJoin && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleJoin}
                    disabled={joining}
                  >
                    {joining ? 'Joining…' : 'Join workspace'}
                  </Button>
                )}
                {(preview?.is_owner || alreadyJoined || issued) && (
                  <Button
                    variant={issued ? 'secondary' : 'primary'}
                    size="md"
                    onClick={() => router.push(workspaceHref)}
                  >
                    Open workspace
                  </Button>
                )}
              </div>
            </>
          )}
        </motion.section>
      </main>

      <AgentKeyDialog
        open={!!issued}
        onOpenChange={(open) => !open && setIssued(null)}
        issued={issued}
      />
    </div>
  );
}
