'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GitBranch,
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
import { Card, CardBody, CardHeader, CardTitle, CardEyebrow } from '@/components/ui/Card';
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
    title: 'GitHub token is healthy',
    fallbackDescription: 'GitHub accepted the token. Aegis can talk to GitHub on your behalf.',
  },
  expiring_soon: {
    label: 'Expiring soon',
    tone: 'warning',
    accent: 'warning',
    icon: AlertTriangle,
    title: 'GitHub token is expiring soon',
    fallbackDescription: 'The token still works but will stop soon. Rotate it to avoid interruptions.',
  },
  expired: {
    label: 'Expired',
    tone: 'error',
    accent: 'error',
    icon: XCircle,
    title: 'GitHub token has expired',
    fallbackDescription: 'GitHub no longer accepts this token. Generate a new one and update Aegis.',
  },
  invalid: {
    label: 'Invalid',
    tone: 'error',
    accent: 'error',
    icon: XCircle,
    title: 'GitHub token is invalid',
    fallbackDescription: 'GitHub rejected the token (expired, revoked, or incorrect).',
  },
  no_token: {
    label: 'Not set',
    tone: 'neutral',
    accent: 'neutral',
    icon: KeyRound,
    title: 'No GitHub token on file',
    fallbackDescription: 'Add a classic personal access token so Aegis can reach GitHub.',
  },
  rate_limited: {
    label: 'Rate limited',
    tone: 'warning',
    accent: 'warning',
    icon: ShieldAlert,
    title: "Couldn't verify right now",
    fallbackDescription: 'GitHub rate limit reached. The token may still be fine — retry shortly.',
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

/** Dashboard only surfaces token health when GitHub won't accept the PAT. */
const ALERT_STATES: GithubPatState[] = ['invalid', 'expired', 'no_token'];

export default function GithubPatStatus({ className }: { className?: string }) {
  const { user, isLoading: userLoading } = useUser();
  const [status, setStatus] = useState<PatStatus | null>(null);
  const [checking, setChecking] = useState(false);

  // Classic PAT lives on the user as `access_token`; `github_pat` is the
  // payload field name used when saving — read either for resilience.
  const pat = user?.access_token || user?.github_pat;

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
    void runCheck();
  }, [userLoading, runCheck]);

  const state = status?.state ?? 'no_token';
  const view = PRESENTATION[state];
  const Icon = view.icon;
  const description = status?.message || view.fallbackDescription;
  const showManageLink =
    state === 'expired' || state === 'invalid' || state === 'no_token' || state === 'expiring_soon';

  // Healthy, unknown, or transient states stay off the dashboard — only
  // surface when the token is missing or GitHub rejects it.
  if (userLoading || checking || !status || !ALERT_STATES.includes(state)) {
    return null;
  }

  return (
    <Card accent={view.accent} className={className}>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          <GitBranch className="h-4 w-4 shrink-0 text-[var(--neutral-strong-950)]" strokeWidth={2} aria-hidden />
          <div className="min-w-0">
            <CardEyebrow className="mb-0.5">GitHub access token</CardEyebrow>
            <CardTitle>Token health</CardTitle>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={view.tone} uppercase leadingDot>
            {checking ? 'Checking' : view.label}
          </Badge>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void runCheck()}
            disabled={checking}
            aria-label="Re-check token"
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
      </CardHeader>

      <CardBody>
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
            style={{ backgroundColor: 'var(--neutral-weak-50)' }}
          >
            <Icon
              className="h-4 w-4"
              style={{ color: `var(--${accentVar(view.accent)})` }}
              strokeWidth={2}
              aria-hidden
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
              {view.title}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
              {description}
            </p>

            {/* Detail rows for a token GitHub actually authenticated. */}
            {(status?.login || status?.expiresAt || (status?.scopes?.length ?? 0) > 0) && (
              <div className="mt-3 space-y-2 border-t border-[var(--stroke-soft-200)] pt-3">
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
                {status?.expiresAt === null && status?.state === 'valid' && (
                  <DetailRow label="Expires">
                    <span className="text-[12.5px] text-[var(--neutral-sub-600)]">No expiration set</span>
                  </DetailRow>
                )}
                {(status?.scopes?.length ?? 0) > 0 && (
                  <DetailRow label="Scopes">
                    <div className="flex flex-wrap gap-1">
                      {status!.scopes!.map((scope) => (
                        <CodeChip key={scope}>{scope}</CodeChip>
                      ))}
                    </div>
                  </DetailRow>
                )}
              </div>
            )}

            {showManageLink && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--primary-base)] hover:underline"
                >
                  Manage tokens on GitHub
                  <ExternalLink className="h-3 w-3" strokeWidth={2} />
                </a>
                <a
                  href="/dashboard/settings#profile"
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--primary-base)]"
                >
                  Update token in Settings
                </a>
              </div>
            )}
          </div>
        </div>
      </CardBody>
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

// Map the Card accent name to the matching CSS color variable for the icon.
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
