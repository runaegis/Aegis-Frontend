'use client';

import Link from 'next/link';
import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Eye, EyeOff, Loader2, MailCheck } from 'lucide-react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fadeUp, staggerContainer } from '@/lib/motion';
import { consumePostAuthRedirect, storePostAuthRedirect } from '@/lib/authRedirect';
import { api, getApiErrorCode, getApiErrorMessage } from '@/lib/api';
import { useEmail, useUser } from '@/lib/hooks';

type AuthMode = 'signin' | 'signup';
type SigninView = 'signin' | 'forgot';

type FormErrors = {
  email?: string;
  password?: string;
  form?: string;
};

type OAuthError = {
  google?: string;
  github?: string;
};

const ENTRY_TRANSITION = {
  duration: 0.22,
  ease: [0.2, 0.8, 0.2, 1] as const,
};

const PREVIEW_ROWS = [
  { label: 'Agent', value: '@backend' },
  { label: 'Connector', value: 'Postgres' },
  { label: 'Arguments', value: 'EXPLAIN SELECT … FROM orders_v2', mono: true },
  { label: 'Result', value: 'seq scan · 412k rows' },
  { label: 'Took', value: '340 ms' },
  { label: 'Tokens', value: '4,208 in · 1,104 out' },
];

const authThemeStyle: CSSProperties = {
  ['--primary-base' as string]: 'var(--auth-accent)',
  ['--primary-dark' as string]: 'var(--auth-accent-hover)',
  ['--primary-alpha-16' as string]: 'var(--auth-accent-soft)',
  ['--primary-alpha-24' as string]: 'var(--auth-accent-border)',
  ['--btn-primary-bg' as string]:
    'linear-gradient(180deg, var(--auth-accent-hover) 0%, var(--auth-accent) 100%)',
  ['--btn-primary-bg-hover' as string]:
    'linear-gradient(180deg, var(--auth-accent) 0%, var(--auth-accent-pressed) 100%)',
  ['--btn-primary-bg-active' as string]:
    'linear-gradient(180deg, var(--auth-accent-pressed) 0%, var(--auth-accent-pressed) 100%)',
  ['--btn-primary-border' as string]: 'var(--auth-accent)',
  ['--btn-primary-shadow' as string]: '0 1px 2px rgba(0, 0, 0, 0.18)',
};

function readNextParam(value: string | null): string {
  return value ? `?next=${encodeURIComponent(value)}` : '';
}

function deriveNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const words = local
    .split(/[._-]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!words.length) return 'Aegis User';

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function AuthPageClient({
  mode,
  nextParam,
}: {
  mode: AuthMode;
  nextParam?: string | null;
}) {
  const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL!;
  const router = useRouter();
  const { setUser } = useUser();
  const { email, setEmail } = useEmail();

  const [signinView, setSigninView] = useState<SigninView>('signin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [oauthError, setOauthError] = useState<OAuthError>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const nextValue = nextParam ?? null;
  const nextSuffix = readNextParam(nextValue);

  useEffect(() => {
    if (nextValue) {
      storePostAuthRedirect(nextValue);
    }
  }, [nextValue]);

  useEffect(() => {
    setPassword('');
    setShowPassword(false);
    setErrors({});
    setOauthError({});
    setLoading(false);
    setOauthLoading(null);
    setSignupSuccess(false);
    setForgotSuccess(false);
    setForgotEmail('');
    setSignupEmail('');
    setVerificationEmail('');
    setResendMessage('');
    setResendCooldown(0);
    if (mode === 'signin') {
      setSigninView('signin');
    }
  }, [mode]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldown((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!resendMessage) return;
    const timer = window.setTimeout(() => setResendMessage(''), 5000);
    return () => window.clearTimeout(timer);
  }, [resendMessage]);

  const validateEmail = (value: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!email.trim()) {
      nextErrors.email = 'This field is required';
    } else if (!validateEmail(email)) {
      nextErrors.email = 'Please enter a valid email address';
    }

    if (mode === 'signup' || signinView === 'signin') {
      if (!password) {
        nextErrors.password = 'This field is required';
      } else if (mode === 'signup' && password.length < 8) {
        nextErrors.password = 'Password must be at least 8 characters';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleOAuth = (provider: 'google' | 'github') => {
    setOauthLoading(provider);
    setOauthError({});
    try {
      if (nextValue) storePostAuthRedirect(nextValue);
      window.location.href = `${BACKEND_URL}/auth/login/${provider}`;
    } catch {
      setOauthError({
        [provider]: `Could not connect to ${
          provider === 'google' ? 'Google' : 'GitHub'
        }`,
      });
      setOauthLoading(null);
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;

    const targetEmail = verificationEmail || signupEmail || email;
    if (!targetEmail) {
      setResendMessage('Enter your email first');
      return;
    }

    setResendCooldown(30);
    try {
      await api.resendVerification(targetEmail);
      setResendMessage('Verification email resent');
    } catch {
      setResendMessage('Failed to resend verification email');
    }
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});
    try {
      await api.registerEmail({
        name: deriveNameFromEmail(email),
        email,
        password,
      });
      setSignupEmail(email);
      setVerificationEmail(email);
      setSignupSuccess(true);
    } catch (err: unknown) {
      switch (getApiErrorCode(err)) {
        case 'ACCOUNT_EXISTS':
          setErrors({ form: 'email_exists' });
          break;
        case 'EMAIL_DELIVERY_FAILED':
          setSignupEmail(email);
          setVerificationEmail(email);
          setSignupSuccess(true);
          setResendMessage('Verification email could not be sent. Try resend.');
          break;
        default:
          setErrors({
            form: getApiErrorMessage(err, 'Could not create account. Please try again.'),
          });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});
    try {
      await api.loginEmail({ email, password });
      let userData: Awaited<ReturnType<typeof api.getUserDetails>>;
      try {
        userData = await api.getUserDetails();
      } catch {
        await api.logOut();
        throw new Error('Could not load your account profile. Please log in again.');
      }

      setUser(userData);

      const onboardingStatus =
        typeof userData.onboarding_status === 'boolean'
          ? userData.onboarding_status
          : (await api.getOnboardingStatus()).onboarding_status;

      setLoggingIn(true);

      window.setTimeout(() => {
        const next = consumePostAuthRedirect();
        if (next) {
          router.push(next);
          return;
        }
        router.push(onboardingStatus ? '/dashboard' : '/onboarding');
      }, 900);
    } catch (err: unknown) {
      switch (getApiErrorCode(err)) {
        case 'INVALID_CREDENTIALS':
        case 'ACCOUNT_NOT_FOUND':
        case 'INVALID_PASSWORD':
          setErrors({ form: 'Email or password is incorrect.' });
          break;
        case 'EMAIL_NOT_VERIFIED':
          setVerificationEmail(email);
          setErrors({ form: 'unverified' });
          break;
        case 'ACCOUNT_LINK_REQUIRED':
          setErrors({
            form: 'This email is linked to another sign-in method. Use the provider you used before.',
          });
          break;
        default:
          setErrors({
            form: getApiErrorMessage(err, 'Something went wrong. Please try again.'),
          });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const nextErrors: FormErrors = {};
    if (!email.trim()) {
      nextErrors.email = 'This field is required';
    } else if (!validateEmail(email)) {
      nextErrors.email = 'Please enter a valid email address';
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      await api.forgotPassword(email);
      setForgotEmail(email);
      setForgotSuccess(true);
    } catch (err: unknown) {
      setErrors({
        form: getApiErrorMessage(err, 'Something went wrong. Please try again.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (mode === 'signup') {
      void handleSignup();
      return;
    }

    if (signinView === 'forgot') {
      void handleForgotPassword();
      return;
    }

    void handleLogin();
  };

  if (loggingIn) {
    return (
      <div
        data-theme="dark"
        className="aegis-auth-theme flex min-h-screen items-center justify-center bg-[var(--bg-app)] px-4"
        style={authThemeStyle}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--primary-base)]" />
          <p className="text-[13px] text-[var(--neutral-sub-600)]">Logging you in…</p>
        </div>
      </div>
    );
  }

  return (
    <div data-theme="dark" className="aegis-auth-theme" style={authThemeStyle}>
      {mode === 'signup' ? (
        <div className="grid min-h-screen bg-[var(--bg-app)] lg:grid-cols-[minmax(0,1fr)_520px]">
          <AuthFormPane
            mode={mode}
            signinView={signinView}
            nextSuffix={nextSuffix}
            email={email}
            password={password}
            loading={loading}
            oauthLoading={oauthLoading}
            oauthError={oauthError}
            errors={errors}
            signupSuccess={signupSuccess}
            forgotSuccess={forgotSuccess}
            signupEmail={signupEmail}
            forgotEmail={forgotEmail}
            resendCooldown={resendCooldown}
            resendMessage={resendMessage}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onTogglePassword={() => setShowPassword((value) => !value)}
            showPassword={showPassword}
            onSubmit={handleSubmit}
            onOAuth={handleOAuth}
            onResendEmail={handleResendEmail}
            onForgotView={() => setSigninView('forgot')}
            onSigninView={() => setSigninView('signin')}
          />
          <SignupPreviewPanel />
        </div>
      ) : (
        <div className="flex min-h-screen bg-[var(--bg-app)]">
          <AuthFormPane
            mode={mode}
            signinView={signinView}
            nextSuffix={nextSuffix}
            email={email}
            password={password}
            loading={loading}
            oauthLoading={oauthLoading}
            oauthError={oauthError}
            errors={errors}
            signupSuccess={signupSuccess}
            forgotSuccess={forgotSuccess}
            signupEmail={signupEmail}
            forgotEmail={forgotEmail}
            resendCooldown={resendCooldown}
            resendMessage={resendMessage}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onTogglePassword={() => setShowPassword((value) => !value)}
            showPassword={showPassword}
            onSubmit={handleSubmit}
            onOAuth={handleOAuth}
            onResendEmail={handleResendEmail}
            onForgotView={() => setSigninView('forgot')}
            onSigninView={() => setSigninView('signin')}
          />
        </div>
      )}
    </div>
  );
}

function AuthFormPane({
  mode,
  signinView,
  nextSuffix,
  email,
  password,
  loading,
  oauthLoading,
  oauthError,
  errors,
  signupSuccess,
  forgotSuccess,
  signupEmail,
  forgotEmail,
  resendCooldown,
  resendMessage,
  showPassword,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onSubmit,
  onOAuth,
  onResendEmail,
  onForgotView,
  onSigninView,
}: {
  mode: AuthMode;
  signinView: SigninView;
  nextSuffix: string;
  email: string;
  password: string;
  loading: boolean;
  oauthLoading: 'google' | 'github' | null;
  oauthError: OAuthError;
  errors: FormErrors;
  signupSuccess: boolean;
  forgotSuccess: boolean;
  signupEmail: string;
  forgotEmail: string;
  resendCooldown: number;
  resendMessage: string;
  showPassword: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onOAuth: (provider: 'google' | 'github') => void;
  onResendEmail: () => void;
  onForgotView: () => void;
  onSigninView: () => void;
}) {
  const reduce = useReducedMotion();

  const title =
    mode === 'signup'
      ? 'Create your account'
      : signinView === 'forgot'
        ? 'Reset your password'
        : 'Sign in';

  const description =
    mode === 'signup'
      ? 'Aegis records every call your agents make, so you can read back what happened.'
      : signinView === 'forgot'
        ? 'Enter your email and we’ll send you a password reset link.'
        : null;

  const footer =
    mode === 'signup' ? (
      <>
        <p className="text-[var(--neutral-soft-400)]">
          We send a verification link. You can look around before you open it, but agents
          cannot connect until you do.
        </p>
        <p className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[var(--neutral-soft-400)]">Already have an account?</span>
          <Link
            href={`/auth/signin${nextSuffix}`}
            className="font-medium text-[var(--primary-base)] hover:text-[var(--primary-dark)]"
          >
            Sign in
          </Link>
        </p>
      </>
    ) : signinView === 'forgot' ? (
      <p className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-[var(--neutral-soft-400)]">Remembered it?</span>
        <button
          type="button"
          onClick={onSigninView}
          className="font-medium text-[var(--primary-base)] hover:text-[var(--primary-dark)]"
        >
          Back to sign in
        </button>
      </p>
    ) : (
      <p className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-[var(--neutral-soft-400)]">New here?</span>
        <Link
          href={`/auth/signup${nextSuffix}`}
          className="font-medium text-[var(--primary-base)] hover:text-[var(--primary-dark)]"
        >
          Create an account
        </Link>
      </p>
    );

  const showOAuth = signinView !== 'forgot';
  const submitLabel =
    mode === 'signup'
      ? loading
        ? 'Creating account…'
        : 'Create account'
      : signinView === 'forgot'
        ? loading
          ? 'Sending link…'
          : 'Send reset link'
        : loading
          ? 'Signing in…'
          : 'Sign in';

  return (
    <section className="flex min-h-screen flex-1 items-center justify-center px-6 py-12 sm:px-8">
      <motion.div
        className="w-full max-w-[400px]"
        variants={staggerContainer(0.05, 0.02)}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >
        <AnimatePresence mode="wait" initial={false}>
          {signupSuccess ? (
            <motion.div
              key="signup-success"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={ENTRY_TRANSITION}
            >
              <SuccessState
                title="Check your inbox"
                description={
                  <>
                    We&rsquo;ve sent a verification link to{' '}
                    <span className="font-medium text-[var(--neutral-strong-950)]">
                      {signupEmail}
                    </span>
                    .
                  </>
                }
                footer={
                  resendCooldown > 0 ? (
                    <span className="text-[var(--neutral-soft-400)]">
                      Resend in {resendCooldown}s
                    </span>
                  ) : resendMessage ? (
                    <span className="text-[var(--success)]">{resendMessage}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={onResendEmail}
                      className="font-medium text-[var(--primary-base)] hover:text-[var(--primary-dark)]"
                    >
                      Resend email
                    </button>
                  )
                }
              />
            </motion.div>
          ) : forgotSuccess ? (
            <motion.div
              key="forgot-success"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={ENTRY_TRANSITION}
            >
              <SuccessState
                title="Reset link sent"
                description={
                  <>
                    If an account exists for{' '}
                    <span className="font-medium text-[var(--neutral-strong-950)]">
                      {forgotEmail}
                    </span>
                    , you&rsquo;ll receive a reset link shortly.
                  </>
                }
                footer={
                  <button
                    type="button"
                    onClick={onSigninView}
                    className="font-medium text-[var(--primary-base)] hover:text-[var(--primary-dark)]"
                  >
                    Back to sign in
                  </button>
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key={`${mode}-${signinView}`}
              variants={staggerContainer(0.04, 0.02)}
              initial={reduce ? false : 'hidden'}
              animate="show"
              exit="hidden"
            >
              <motion.div variants={fadeUp}>
                <AegisLogo
                  style={{ height: 22, width: 'auto', color: 'var(--neutral-strong-950)' }}
                />
              </motion.div>

              <motion.div variants={fadeUp} className="mt-7">
                <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--neutral-strong-950)]">
                  {title}
                </h1>
                {description ? (
                  <p className="mt-1.5 max-w-[340px] text-[13px] leading-[1.45] text-[var(--neutral-sub-600)]">
                    {description}
                  </p>
                ) : null}
              </motion.div>

              {showOAuth ? (
                <motion.div variants={fadeUp} className="mt-7 space-y-2">
                  <OAuthButton
                    provider="google"
                    loading={oauthLoading === 'google'}
                    disabled={oauthLoading !== null}
                    onClick={() => onOAuth('google')}
                  />
                  {oauthError.google ? (
                    <p className="text-[11px] text-[var(--error)]">{oauthError.google}</p>
                  ) : null}

                  <OAuthButton
                    provider="github"
                    loading={oauthLoading === 'github'}
                    disabled={oauthLoading !== null}
                    onClick={() => onOAuth('github')}
                  />
                  {oauthError.github ? (
                    <p className="text-[11px] text-[var(--error)]">{oauthError.github}</p>
                  ) : null}
                </motion.div>
              ) : null}

              {showOAuth ? (
                <motion.div variants={fadeUp} className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[var(--stroke-soft-200)]" />
                  <span className="text-[11px] text-[var(--neutral-soft-400)]">or</span>
                  <div className="h-px flex-1 bg-[var(--stroke-soft-200)]" />
                </motion.div>
              ) : null}

              <motion.form variants={fadeUp} onSubmit={onSubmit} className="space-y-4" noValidate>
                <Field label="EMAIL" error={errors.email}>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    placeholder="rhea@superset.dev"
                    invalid={!!errors.email}
                    autoComplete="email"
                  />
                </Field>

                {signinView !== 'forgot' || mode === 'signup' ? (
                  <Field
                    label="PASSWORD"
                    error={errors.password}
                    trailing={
                      mode === 'signin' && signinView === 'signin' ? (
                        <button
                          type="button"
                          onClick={onForgotView}
                          className="text-[11px] font-medium text-[var(--primary-base)] hover:text-[var(--primary-dark)]"
                        >
                          Forgot your password?
                        </button>
                      ) : null
                    }
                  >
                    <PasswordInput
                      value={password}
                      onChange={onPasswordChange}
                      show={showPassword}
                      toggleShow={onTogglePassword}
                      invalid={!!errors.password}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    />
                  </Field>
                ) : null}

                {errors.form ? (
                  <FormError error={errors.form} nextSuffix={nextSuffix} onResend={onResendEmail} />
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={loading}
                  leadingIcon={
                    loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined
                  }
                >
                  {submitLabel}
                </Button>
              </motion.form>

              <motion.div
                variants={fadeUp}
                className="mt-6 space-y-2 text-[11px] leading-[1.4] text-[var(--neutral-soft-400)]"
              >
                {footer}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}

function SignupPreviewPanel() {
  return (
    <aside className="hidden border-l border-[var(--stroke-soft-200)] bg-[var(--bg-surface-alt)] lg:flex lg:min-h-screen lg:flex-col lg:justify-center">
      <div className="w-full px-12">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--neutral-soft-400)]">
          What you get
        </p>
        <h2 className="mt-4 max-w-[320px] text-[17px] font-semibold tracking-[-0.02em] text-[var(--neutral-strong-950)]">
          One record of everything your agents do
        </h2>

        <div className="mt-6 overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2 border-b border-[var(--stroke-soft-200)] bg-[var(--bg-app)] px-4 py-3">
            <AgentAvatar name="Nova" size="xs" className="rounded-[6px]" />
            <span className="font-mono text-[12px] text-[var(--neutral-strong-950)]">
              postgres.explain
            </span>
            <div className="flex-1" />
            <StatusPill />
          </div>

          <div className="divide-y divide-[var(--stroke-soft-200)]">
            {PREVIEW_ROWS.map((row) => (
              <div key={row.label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 px-4 py-2">
                <span className="text-[11px] text-[var(--neutral-soft-400)]">{row.label}</span>
                <span
                  className={
                    row.mono
                      ? 'font-mono text-[11px] leading-[1.45] text-[var(--neutral-sub-600)]'
                      : 'text-[11px] text-[var(--neutral-sub-600)]'
                  }
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 border-t border-[var(--stroke-soft-200)] bg-[var(--bg-app)] px-4 py-3">
            <span className="mt-[1px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-sub-300)] text-[8px] text-[var(--neutral-sub-600)]">
              i
            </span>
            <p className="text-[11px] leading-[1.45] text-[var(--neutral-sub-600)]">
              Every call an agent makes is stored like this, with what it sent and what
              came back.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Field({
  label,
  error,
  trailing,
  children,
}: {
  label: string;
  error?: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label className="text-[11px] font-medium tracking-[0.02em] text-[var(--neutral-soft-400)]">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {error ? <p className="mt-1.5 text-[11px] text-[var(--error)]">{error}</p> : null}
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  show,
  toggleShow,
  invalid,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  toggleShow: () => void;
  invalid: boolean;
  autoComplete?: string;
}) {
  return (
    <Input
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="••••••••"
      invalid={invalid}
      autoComplete={autoComplete}
      trailingIcon={
        <button
          type="button"
          onClick={toggleShow}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="text-[var(--neutral-soft-400)] hover:text-[var(--neutral-strong-950)]"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
}

function FormError({
  error,
  nextSuffix,
  onResend,
}: {
  error: string;
  nextSuffix: string;
  onResend: () => void;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--error)]/20 bg-[var(--error-lighter)]/10 px-3 py-2.5 text-[12px] leading-[1.5] text-[var(--error)]">
      {error === 'email_exists' ? (
        <>
          An account with this email already exists.{' '}
          <Link href={`/auth/signin${nextSuffix}`} className="font-medium underline">
            Sign in instead.
          </Link>
        </>
      ) : error === 'unverified' ? (
        <>
          Please verify your email before logging in.{' '}
          <button type="button" onClick={onResend} className="font-medium underline">
            Resend verification email
          </button>
        </>
      ) : (
        error
      )}
    </div>
  );
}

function OAuthButton({
  provider,
  loading,
  disabled,
  onClick,
}: {
  provider: 'google' | 'github';
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const label = provider === 'google' ? 'Continue with Google' : 'Continue with GitHub';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[8px] border border-[var(--stroke-sub-300)] bg-[var(--bg-surface-alt)] px-4 text-[13px] font-medium text-[var(--neutral-strong-950)] hover:border-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] disabled:opacity-60"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting…
        </>
      ) : (
        <>
          {provider === 'google' ? <GoogleGlyph /> : <GitHubGlyph />}
          {label}
        </>
      )}
    </button>
  );
}

function SuccessState({
  title,
  description,
  footer,
}: {
  title: string;
  description: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="text-left">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--auth-accent-soft)] text-[var(--primary-base)]">
        <MailCheck className="h-5 w-5" />
      </span>
      <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-[var(--neutral-strong-950)]">
        {title}
      </h2>
      <p className="mt-2 text-[13px] leading-[1.45] text-[var(--neutral-sub-600)]">
        {description}
      </p>
      {footer ? (
        <div className="mt-5 text-[11px] leading-[1.45] text-[var(--neutral-sub-600)]">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function StatusPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-[4px] bg-[var(--neutral-soft-200)] px-2 py-1 text-[11px] text-[var(--neutral-sub-600)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
      Completed
    </span>
  );
}

function GoogleGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC04"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GitHubGlyph() {
  return (
    <svg
      className="h-4 w-4 text-[var(--neutral-strong-950)]"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
