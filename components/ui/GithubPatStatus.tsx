'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useUser } from '@/lib/hooks';
import {
  checkGithubPat,
  type GithubPatState,
  type GithubPatStatus as PatStatus,
} from '@/lib/githubPat';
import { Card } from '@/components/ui/Card';
import { ConnectorMark } from '@/components/ui/ConnectorMark';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';

type Accent = NonNullable<React.ComponentProps<typeof Card>['accent']>;

const PRESENTATION: Record<
  GithubPatState,
  {
    label: string;
    tone: BadgeTone;
    accent: Accent;
    icon: LucideIcon;
    title: string;
    fallbackDescription: string;
  }
> = {
  valid: {
    label: 'Active',
    tone: 'success',
    accent: 'success',
    icon: CheckCircle2,
    title: 'GitHub PAT is healthy',
    fallbackDescription: 'GitHub accepted the PAT. Aegis can talk to GitHub on your behalf.',
  },
  expiring_soon: {
    label: 'Expiring soon',
    tone: 'warning',
    accent: 'warning',
    icon: AlertTriangle,
    title: 'GitHub PAT is expiring soon',
    fallbackDescription: 'The PAT still works but will stop soon. Rotate it to avoid interruptions.',
  },
  expired: {
    label: 'Expired',
    tone: 'error',
    accent: 'error',
    icon: XCircle,
    title: 'GitHub PAT has expired',
    fallbackDescription: 'GitHub no longer accepts this PAT. Generate a new one and update Aegis.',
  },
  invalid: {
    label: 'Invalid',
    tone: 'error',
    accent: 'error',
    icon: XCircle,
    title: 'GitHub PAT is invalid',
    fallbackDescription: 'GitHub rejected the PAT because it is expired, revoked, or incorrect.',
  },
  no_token: {
    label: 'Not set',
    tone: 'neutral',
    accent: 'neutral',
    icon: KeyRound,
    title: 'No GitHub PAT on file',
    fallbackDescription: 'Add a classic personal access token so Aegis can reach GitHub.',
  },
  rate_limited: {
    label: 'Rate limited',
    tone: 'warning',
    accent: 'warning',
    icon: ShieldAlert,
    title: "Couldn't verify right now",
    fallbackDescription: 'GitHub rate limit reached. The PAT may still be fine. Retry shortly.',
  },
  network_error: {
    label: 'Unreachable',
    tone: 'neutral',
    accent: 'neutral',
    icon: ShieldAlert,
    title: "Couldn't reach GitHub",
    fallbackDescription: 'A network issue blocked the check. Retry once your connection is back.',
  },
};

function formatExpiry(date: Date): string {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Dashboard only surfaces PAT health when GitHub won't accept it. */
const ALERT_STATES: GithubPatState[] = ['invalid', 'expired', 'no_token'];

export default function GithubPatStatus({ className }: { className?: string }) {
  const { isLoading: userLoading } = useUser();
  const [status, setStatus] = useState<PatStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const pat = null;

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const result = await checkGithubPat(pat);
      setStatus(result);
    } finally {
      setChecking(false);
    }
  }, [pat]);

  useEffect(() => {
    if (userLoading) return;
    setStatus(null);
  }, [userLoading, runCheck]);

  const state = status?.state ?? 'no_token';
  const view = PRESENTATION[state];
  const description = status?.message || view.fallbackDescription;

  // Demo workspace has no real GitHub connection, so token health would be
  // meaningless noise there — never surface it in demo mode. The root
  // `data-demo` attribute is set by the dashboard layout (and the early
  // inline script) for exactly this kind of demo-aware component.
  const isDemoWorkspace =
    typeof document !== 'undefined' &&
    document.documentElement.dataset.demo === 'true';

  // Healthy, unknown, or transient states stay off the dashboard. Only
  // surface when the PAT is missing or GitHub rejects it.
  if (
    isDemoWorkspace ||
    userLoading ||
    checking ||
    !status ||
    !ALERT_STATES.includes(state)
  ) {
    return null;
  }

  // Only reached for no_token / expired / invalid. All three want the same
  // two resolution actions, rendered unconditionally below.
  const actionLabel = state === 'no_token' ? 'Add PAT' : 'Update PAT';
  const accentColor = `var(--${accentVar(view.accent)})`;
  const hasCredentialDetail =
    !!status?.login || !!status?.expiresAt || (status?.scopes?.length ?? 0) > 0;

  return (
    <Card accent={view.accent} className={className}>
      <div className="p-4 sm:p-[18px]">
        <div className="flex items-start gap-3.5">
          {/* GitHub identity with a tone-coded health dot — reads as a
              live connection/credential, not a generic alert banner. */}
          <div className="relative shrink-0">
            <ConnectorMark id="github" size="md" className="cursor-default" />
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-[2.5px] ring-[var(--white-0)]"
              style={{ backgroundColor: accentColor }}
              aria-hidden
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                  GitHub PAT
                </p>
                <p className="mt-0.5 text-[14px] font-semibold text-[var(--neutral-strong-950)]">
                  {view.title}
                </p>
              </div>
              <Badge tone={view.tone} uppercase leadingDot>
                {view.label}
              </Badge>
            </div>

            <p className="mt-1.5 max-w-[58ch] text-[12.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
              {description}
            </p>

            {/* Detail panel for a PAT GitHub actually authenticated. */}
            {hasCredentialDetail && (
              <div className="mt-3 space-y-2 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5">
                {status?.login && (
                  <DetailRow label="Authenticated as">
                    <CodeChip>{status.login}</CodeChip>
                  </DetailRow>
                )}
                {status?.expiresAt && (
                  <DetailRow label="Expires">
                    <span className="text-[12.5px] tabular-nums text-[var(--neutral-strong-950)]">
                      {formatExpiry(status.expiresAt)}
                      {typeof status.daysUntilExpiry === 'number' && status.daysUntilExpiry >= 0 && (
                        <span className="ml-1.5 text-[11.5px] text-[var(--neutral-soft-400)]">
                          ({status.daysUntilExpiry}d left)
                        </span>
                      )}
                    </span>
                  </DetailRow>
                )}
                {(status?.scopes?.length ?? 0) > 0 && (
                  <DetailRow label="Scopes">
                    <div className="flex flex-wrap justify-end gap-1">
                      {status!.scopes!.map((scope) => (
                        <CodeChip key={scope}>{scope}</CodeChip>
                      ))}
                    </div>
                  </DetailRow>
                )}
              </div>
            )}

            {/* Resolution actions: fix in-app, generate on GitHub, re-verify. */}
            <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Link
                href="/dashboard/settings#profile"
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-[var(--white-0)] px-3 text-[12.5px] font-medium text-[var(--neutral-strong-950)] transition-colors hover:bg-[var(--neutral-weak-50)]"
              >
                {actionLabel}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </Link>
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--neutral-strong-950)]"
              >
                Generate on GitHub
                <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
              </a>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void runCheck()}
                disabled={checking}
                aria-label="Re-check GitHub PAT"
                className="ml-auto"
                leadingIcon={
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`}
                    strokeWidth={2}
                  />
                }
              >
                Re-check
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
        {label}
      </span>
      <div className="min-w-0 text-right">{children}</div>
    </div>
  );
}

// Map the Card accent name to the matching CSS color variable for the dot.
function accentVar(accent: Accent): string {
  switch (accent) {
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'feature':
      return 'feature';
    case 'info':
      return 'information';
    default:
      return 'neutral-soft-400';
  }
}
