'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  CreditCard,
  Palette,
  RefreshCw,
  Trash2,
  Upload,
  User as UserIcon,
  LogOut,
  Map,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import Topbar from '@/components/layout/Topbar';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { UserAvatar } from '@/components/ui/UserAvatar';
import {
  removeCustomAvatar,
  setCustomAvatarFromFile,
  useCustomAvatar,
} from '@/lib/customAvatar';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';
import { requestProductTour } from '@/lib/productTour';

// ── Settings tabs ─────────────────────────────────────────────────────────────
// Keep this page intentionally small: these are the only settings subtabs.
type SectionId = 'account' | 'appearance' | 'plans-usage' | 'danger';

type Section = {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  description: string;
};

const SECTIONS: Section[] = [
  {
    id: 'account',
    label: 'Account',
    icon: UserIcon,
    description: 'Your profile, account details, and product tour.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
    description: 'Theme and visual preferences for the dashboard.',
  },
  {
    id: 'plans-usage',
    label: 'Plans and Usage',
    icon: CreditCard,
    description: 'Your plan, usage, and billing information.',
  },
  {
    id: 'danger',
    label: 'Danger Zone',
    icon: AlertTriangle,
    description: 'Irreversible account actions and session controls.',
  },
];

export default function SettingsPage() {
  const { user, setUser, clearUser } = useUser();
  const reduce = useReducedMotion();
  const toast = useToast();
  const router = useRouter();

  const [active, setActive] = useState<SectionId>(() => {
    if (typeof window === 'undefined') return 'account';
    const hash = window.location.hash.replace('#', '') as SectionId;
    return SECTIONS.some((section) => section.id === hash) ? hash : 'account';
  });

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '') as SectionId;
      if (SECTIONS.some((section) => section.id === hash)) {
        setActive(hash);
      }
    };

    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goTo = (id: SectionId) => {
    setActive(id);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  const activeSection = useMemo(
    () => SECTIONS.find((section) => section.id === active) ?? SECTIONS[0],
    [active],
  );

  return (
    <>
      <Topbar title="Settings" subtitle="Account, appearance, usage, security" minimal />

      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <motion.aside
            className="lg:sticky lg:top-[72px] lg:self-start"
            initial={reduce ? false : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: DUR.default, ease: EASE.out, delay: 0.08 }}
          >
            <nav aria-label="Settings" className="space-y-0.5">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = active === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => goTo(section.id)}
                    className={[
                      'flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] font-medium tracking-[-0.01em] transition-colors',
                      isActive
                        ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
                        : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                    ].join(' ')}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </motion.aside>

          <motion.main
            key={active}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.default, ease: EASE.out }}
          >
            <header className="mb-6">
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]">
                Settings
              </p>
              <h1 className="text-[24px] font-semibold leading-[1.15] tracking-[-0.03em] text-[var(--neutral-strong-950)]">
                {activeSection.label}
              </h1>
              <p className="mt-1.5 text-[13.5px] text-[var(--neutral-sub-600)]">
                {activeSection.description}
              </p>
            </header>

            {active === 'account' && (
              <AccountSection
                user={user}
                setUser={setUser}
                onSuccess={(message) => toast.success(message)}
                onError={(message) => toast.error(message)}
                reduce={!!reduce}
              />
            )}

            {active === 'appearance' && <AppearanceSection reduce={!!reduce} />}

            {active === 'plans-usage' && <PlansUsageSection reduce={!!reduce} />}

            {active === 'danger' && (
              <DangerSection
                clearUser={clearUser}
                onError={(message) => toast.error(message)}
                onSuccess={(message) => toast.success(message)}
                onLoggedOut={() => router.replace('/auth')}
                reduce={!!reduce}
              />
            )}
          </motion.main>
        </div>
      </div>
    </>
  );
}

// ── Shared primitives ────────────────────────────────────────────────────────
function SettingsCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-5 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--stroke-soft-200)] p-5">
        <div>
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[12.5px] text-[var(--neutral-sub-600)]">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="mb-1.5 block text-[12px] font-medium text-[var(--neutral-sub-600)]">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11.5px] text-[var(--neutral-soft-400)]">{hint}</p>
      )}
    </div>
  );
}

function Row({
  title,
  description,
  meta,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--neutral-strong-950)]">{title}</p>
        {description && (
          <p className="mt-0.5 text-[12px] text-[var(--neutral-sub-600)]">{description}</p>
        )}
        {meta && <div className="mt-1">{meta}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Account ──────────────────────────────────────────────────────────────────
function AccountSection({
  user,
  setUser,
  onError,
  onSuccess,
  reduce,
}: {
  user: ReturnType<typeof useUser>['user'];
  setUser: ReturnType<typeof useUser>['setUser'];
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  reduce: boolean;
}) {
  const [username, setUsername] = useState(user?.name || user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const customAvatar = useCustomAvatar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUsername(user.name || user.username || '');
    setEmail(user.email || '');
  }, [user]);

  const onAvatarFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAvatarBusy(true);
    try {
      await setCustomAvatarFromFile(file);
      onSuccess('Profile picture updated');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save the image.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const saveIdentity = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const updated = await api.updateUserDetails({
        name: username,
        email,
      });

      setUser({
        ...(user ?? {}),
        ...updated,
      });
      onSuccess('Profile updated');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Identity"
          description="Your public-facing details inside Aegis."
        >
          <div className="mb-5 flex items-center gap-4">
            <UserAvatar
              seed={user?.username || user?.email || 'user'}
              size={64}
              radius={14}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[var(--neutral-strong-950)]">
                Profile picture
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--neutral-soft-400)]">
                {customAvatar
                  ? 'Custom upload. Remove to use the generative default.'
                  : 'Auto-generated from your username.'}
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onAvatarFile}
            />

            {customAvatar && (
              <Button
                variant="secondary"
                onClick={() => {
                  removeCustomAvatar();
                  onSuccess('Reverted to generative avatar');
                }}
                disabled={avatarBusy}
              >
                Remove
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
              leadingIcon={<Upload className="h-3.5 w-3.5" strokeWidth={2} />}
            >
              {customAvatar ? 'Replace' : 'Upload'}
            </Button>
          </div>

          <Field label="Display name">
            <Input value={username} onChange={(event) => setUsername(event.target.value)} />
          </Field>

          <Field label="Email" hint="Used for approval and incident notifications.">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <div className="mt-5 flex items-center justify-end">
            <Button
              variant="primary"
              onClick={() => void saveIdentity()}
              disabled={saving}
              leadingIcon={
                saving ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                ) : undefined
              }
            >
              Save
            </Button>
          </div>
        </SettingsCard>
      </motion.div>

      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Product tour"
          description="Replay the walkthrough of workspaces, agents, Memory, and Prompts whenever you need it."
        >
          <Button
            variant="secondary"
            size="md"
            leadingIcon={<Map className="h-3.5 w-3.5" strokeWidth={2} />}
            onClick={() => requestProductTour()}
          >
            Replay tour
          </Button>
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

function UsageBlock({
  label,
  used,
  cap,
  suffix,
}: {
  label: string;
  used: number;
  cap: number;
  suffix?: string;
}) {
  const ratio = cap > 0 ? Math.min(100, Math.max(0, (used / cap) * 100)) : 0;
  return (
    <div className="rounded-[10px] border border-[var(--stroke-sub-300)] bg-[var(--panel-soft)] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--neutral-soft-500)]">
          {label}
        </span>
        <span className="text-[11px] text-[var(--neutral-soft-400)]">
          {Math.round(ratio)}%
        </span>
      </div>
      <div className="mb-3 flex items-end gap-2">
        <span className="text-2xl font-semibold text-[var(--text-primary)]">
          {used.toLocaleString()}
        </span>
        <span className="pb-1 text-[11px] text-[var(--neutral-soft-400)]">
          / {cap.toLocaleString()}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--stroke-sub-300)]">
        <div
          className="h-full rounded-full bg-[var(--primary-base)]"
          style={{ width: `${ratio}%` }}
        />
      </div>
      {suffix ? (
        <div className="mt-2 text-[11px] text-[var(--neutral-soft-400)]">
          {suffix}
        </div>
      ) : null}
    </div>
  );
}

// ── Appearance ───────────────────────────────────────────────────────────────
function AppearanceSection({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Theme"
          description="Choose how the dashboard looks. Auth and onboarding stay light by design."
        >
          <ThemeToggle variant="card" />
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

// ── Plans and Usage ──────────────────────────────────────────────────────────
function PlansUsageSection({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Current plan"
          description="Manage what Aegis costs your team."
          action={<Badge tone="primary" uppercase>Free</Badge>}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <UsageBlock label="Sessions" used={28} cap={100} suffix="this month" />
            <UsageBlock label="Decisions" used={1240} cap={5000} suffix="this month" />
            <UsageBlock label="Tokens" used={184310} cap={500000} suffix="this month" />
          </div>

          <div className="mt-5 flex items-center justify-end">
            <a href="mailto:deals@runaegis.co">
              <Button variant="primary">Upgrade plan</Button>
            </a>
          </div>
        </SettingsCard>
      </motion.div>

      <motion.div variants={fadeUp}>
        <SettingsCard
          title="Invoices"
          description="Receipts for your records."
        >
          <p className="rounded-[8px] border border-dashed border-[var(--stroke-sub-300)] p-6 text-center text-[12.5px] text-[var(--neutral-soft-400)]">
            No invoices yet. You&apos;re on the free plan.
          </p>
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

// ── Danger Zone ───────────────────────────────────────────────────────────────
function DangerSection({
  clearUser,
  onError,
  onSuccess,
  onLoggedOut,
  reduce,
}: {
  clearUser: ReturnType<typeof useUser>['clearUser'];
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onLoggedOut: () => void;
  reduce: boolean;
}) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const confirmLogoutAll = useCallback(async () => {
    setLogoutBusy(true);
    try {
      await api.logoutAllDevices();
      clearUser();
      setLogoutOpen(false);
      onSuccess('Signed out of all devices');
      onLoggedOut();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not sign out of all devices.');
    } finally {
      setLogoutBusy(false);
    }
  }, [clearUser, onError, onLoggedOut, onSuccess]);

  const confirmDeleteAccount = useCallback(async () => {
    if (deleteConfirmation.trim() !== 'DELETE') return;

    setDeleteBusy(true);
    try {
      await api.deleteUser({ confirmation: deleteConfirmation.trim() });
      clearUser();
      setDeleteOpen(false);
      onLoggedOut();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not delete your account.');
    } finally {
      setDeleteBusy(false);
    }
  }, [clearUser, deleteConfirmation, onError, onLoggedOut]);

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial={reduce ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <DangerCard
          title="Sign out of every device"
          description="Invalidate every active session, including this device. You will need to sign in again."
          actionLabel="Sign out everywhere"
          icon={LogOut}
          onAction={() => setLogoutOpen(true)}
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <DangerCard
          title="Delete account"
          description="Permanently remove your Aegis account and its associated data. This cannot be undone."
          actionLabel="Delete account"
          icon={Trash2}
          onAction={() => {
            setDeleteConfirmation('');
            setDeleteOpen(true);
          }}
          permanent
        />
      </motion.div>

      {logoutOpen && (
        <Modal
          danger
          title="Sign out of every device?"
          description="All active sessions, including this one, will be invalidated. You will need to sign in again."
          onClose={() => {
            if (!logoutBusy) setLogoutOpen(false);
          }}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setLogoutOpen(false)}
                disabled={logoutBusy}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void confirmLogoutAll()}
                disabled={logoutBusy}
                leadingIcon={
                  logoutBusy ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
                  )
                }
              >
                Sign out everywhere
              </Button>
            </>
          }
        />
      )}

      {deleteOpen && (
        <Modal
          danger
          title="Delete your account?"
          description="This permanently deletes your Aegis account. This action cannot be undone."
          onClose={() => {
            if (!deleteBusy) setDeleteOpen(false);
          }}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteBusy}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void confirmDeleteAccount()}
                disabled={deleteBusy || deleteConfirmation.trim() !== 'DELETE'}
                leadingIcon={
                  deleteBusy ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  )
                }
              >
                Delete account
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-[9px] border border-[var(--error)]/20 bg-[var(--error-lighter)] p-3">
              <p className="text-[12px] font-medium text-[var(--error)]">
                This action is permanent. Your account cannot be restored after deletion.
              </p>
            </div>

            <Field
              label="Type DELETE to confirm"
              hint="This confirmation is case-sensitive."
            >
              <Input
                autoFocus
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </Field>
          </div>
        </Modal>
      )}
    </motion.div>
  );
}

function DangerCard({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon,
  permanent,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  icon?: LucideIcon;
  permanent?: boolean;
}) {
  return (
    <section
      className="mb-5 overflow-hidden rounded-[12px] border bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
      style={{ borderColor: 'rgba(251, 55, 72, 0.20)' }}
    >
      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <h2
            className="text-[14px] font-semibold tracking-[-0.01em]"
            style={{ color: permanent ? 'var(--error)' : 'var(--neutral-strong-950)' }}
          >
            {title}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--neutral-sub-600)]">
            {description}
          </p>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-medium"
          style={{
            borderColor: permanent ? 'var(--error)' : 'rgba(251, 55, 72, 0.30)',
            backgroundColor: permanent ? 'var(--error-lighter)' : '#fff',
            color: 'var(--error)',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor = permanent
              ? 'var(--error)'
              : 'var(--error-lighter)';
            event.currentTarget.style.color = permanent ? '#fff' : 'var(--error)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = permanent
              ? 'var(--error-lighter)'
              : '#fff';
            event.currentTarget.style.color = 'var(--error)';
          }}
        >
          {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
          {actionLabel}
        </button>
      </div>
    </section>
  );
}

function Modal({
  title,
  description,
  danger = false,
  children,
  footer,
  onClose,
}: {
  title: string;
  description: string;
  danger?: boolean;
  children?: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="w-full max-w-[460px] overflow-hidden rounded-[14px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_24px_80px_rgba(23,23,23,0.18)]"
      >
        <div className="border-b border-[var(--stroke-soft-200)] p-5">
          <div className="flex items-start gap-3">
            {danger && (
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--error-lighter)] text-[var(--error)]">
                <AlertTriangle className="h-4 w-4" strokeWidth={2} />
              </div>
            )}
            <div>
              <h2
                id="settings-modal-title"
                className="text-[15px] font-semibold tracking-[-0.015em] text-[var(--neutral-strong-950)]"
              >
                {title}
              </h2>
              <p className="mt-1 text-[12.5px] leading-5 text-[var(--neutral-sub-600)]">
                {description}
              </p>
            </div>
          </div>
        </div>

        {children && <div className="p-5">{children}</div>}

        <div className="flex items-center justify-end gap-2 border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-4">
          {footer}
        </div>
      </div>
    </div>
  );
}