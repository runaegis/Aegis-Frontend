'use client';

/**
 * Password reset — `?token=...` flow landed on from the email link.
 *
 * Same split-screen pattern as /auth: brand showcase on the left (lg+),
 * form on the right. The three lifecycle states (validating, invalid
 * token, success) each get a centered success-panel treatment matching
 * the auth signup-success / forgot-success panels.
 *
 * Backend wiring preserved exactly as the engineer wrote it:
 *   - `apiFetch` for both endpoints (sends HTTPonly cookies via
 *      credentials: 'include' inside the helper).
 *   - GET /auth/validate-reset-token on mount.
 *   - POST /auth/reset-password on submit, with structured error-code
 *      handling (INVALID_RESET_TOKEN / WEAK_PASSWORD / fallback).
 *   - router.push('/auth') for the post-success redirect.
 */

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  MailCheck,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fadeUp, staggerContainer } from '@/lib/motion';

const FEATURE_BULLETS = [
  'Audit every agent action',
  'Policies gate the dangerous moves',
  'Approve sensitive actions in one click',
];

function ResetPasswordPage() {
  const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const reduce = useReducedMotion();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  // ─── Validate token on mount (engineer's logic, untouched) ─────────────
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Invalid or missing reset link');
        setValidating(false);
        return;
      }
      try {
        const res = await apiFetch(
          `${BACKEND_URL}/auth/validate-reset-token?token=${encodeURIComponent(token)}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          },
        );
        if (res.ok) {
          setTokenValid(true);
          setError(null);
        } else {
          const data = await res.json();
          setError(data.detail || "Reset link has expired or is invalid");
        }
      } catch {
        setError('Failed to validate reset link');
      } finally {
        setValidating(false);
      }
    };
    validateToken();
  }, [token, BACKEND_URL]);

  // ─── Password strength rules ───────────────────────────────────────────
  const hasValidLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const passwordsMatch =
    !!password && !!confirmPassword && password === confirmPassword;

  const validatePasswords = () => {
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return false;
    }
    if (!hasValidLength) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match');
      return false;
    }
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      setError('Password must contain uppercase, lowercase, and numbers');
      return false;
    }
    return true;
  };

  // ─── Submit (engineer's structured-error logic preserved) ──────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validatePasswords()) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${BACKEND_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to reset password");
      }
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        router.push('/auth');
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Layout ────────────────────────────────────────────────────────────
  return (
    <div className="grid min-h-screen grid-cols-1 bg-[var(--bg-app)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <ShowcasePanel reduce={!!reduce} />

      <section className="relative flex min-h-screen flex-col px-4 py-8 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between lg:hidden">
          <AegisLogo
            style={{ height: 22, width: 'auto', color: 'var(--neutral-strong-950)' }}
          />
        </div>

        <div className="hidden items-center justify-end lg:flex">
          <Link
            href="/auth"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--neutral-strong-950)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
            Back to log in
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <motion.div
            className="w-full max-w-[420px] py-8"
            variants={staggerContainer(0.04, 0.02)}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            {validating && <ValidatingState />}
            {!validating && !tokenValid && <InvalidTokenState message={error} />}
            {!validating && tokenValid && success && <SuccessState />}
            {!validating && tokenValid && !success && (
              <ResetForm
                password={password}
                confirmPassword={confirmPassword}
                showPassword={showPassword}
                showConfirm={showConfirm}
                loading={loading}
                error={error}
                hasValidLength={hasValidLength}
                hasUpperCase={hasUpperCase}
                hasLowerCase={hasLowerCase}
                hasNumbers={hasNumbers}
                passwordsMatch={passwordsMatch}
                onPasswordChange={(v) => {
                  setPassword(v);
                  setError(null);
                }}
                onConfirmChange={(v) => {
                  setConfirmPassword(v);
                  setError(null);
                }}
                onTogglePassword={() => setShowPassword((s) => !s)}
                onToggleConfirm={() => setShowConfirm((s) => !s)}
                onSubmit={handleSubmit}
              />
            )}
          </motion.div>
        </div>

        <div className="mx-auto mt-auto w-full max-w-[420px] pt-6">
          <p className="text-center text-[11.5px] text-[var(--neutral-soft-400)] lg:text-left">
            Remember your password?{' '}
            <Link
              href="/auth"
              className="font-semibold text-[var(--primary-base)] transition-colors hover:text-[var(--primary-dark)]"
            >
              Back to log in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md">
          <div className="rounded-md border border-border bg-card p-6 sm:p-8">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-2 text-foreground">
              Password Reset Successful
            </h1>
            <p className="text-center text-sm text-muted-foreground mb-6">
              Your password has been successfully reset. You'll be redirected to
              login shortly.
            </p>
            <Link
              href="/auth"
              className="w-full inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

function SuccessState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="rounded-md border border-border bg-card p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Reset Your Password
            </h1>
            <p className="text-sm text-muted-foreground">
              Create a new password for your Aegis account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-muted-foreground mb-1.5"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter new password"
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label
                htmlFor="confirm"
                className="block text-xs font-medium text-muted-foreground mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Confirm new password"
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="mt-4 p-3 rounded-md bg-muted/50 border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Password requirements:
              </p>
              <ul className="space-y-1">
                <li className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${hasValidLength ? "bg-green-500" : "bg-border"}`}
                  />
                  <span
                    className={
                      hasValidLength
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    At least 8 characters
                  </span>
                </li>
                <li className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${hasUpperCase ? "bg-green-500" : "bg-border"}`}
                  />
                  <span
                    className={
                      hasUpperCase ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    One uppercase letter
                  </span>
                </li>
                <li className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${hasLowerCase ? "bg-green-500" : "bg-border"}`}
                  />
                  <span
                    className={
                      hasLowerCase ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    One lowercase letter
                  </span>
                </li>
                <li className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${hasNumbers ? "bg-green-500" : "bg-border"}`}
                  />
                  <span
                    className={
                      hasNumbers ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    One number
                  </span>
                </li>
                <li className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${passwordsMatch ? "bg-green-500" : "bg-border"}`}
                  />
                  <span
                    className={
                      passwordsMatch
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    Passwords match
                  </span>
                </li>
              </ul>
            </div>

        {error && (
          <div
            className="rounded-[8px] border px-3 py-2.5 text-[12.5px] leading-[1.5]"
            style={{
              backgroundColor: 'var(--error-lighter)',
              borderColor: 'rgba(251, 55, 72, 0.22)',
              color: 'var(--error-dark)',
            }}
          >
            {error}
          </div>
        )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !tokenValid}
              className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6"
            >
              {loading ? "Resetting Password..." : "Reset Password"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              Remember your password?{" "}
              <Link
                href="/auth"
                className="text-foreground hover:underline font-medium"
              >
                Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Requirement({
  met,
  children,
}: {
  met: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 text-[12px]">
      <span
        aria-hidden
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full transition-colors ${
          met ? '' : 'border border-[var(--stroke-sub-300)]'
        }`}
        style={met ? { backgroundColor: 'var(--success)' } : undefined}
      >
        {met && <Check className="h-[8px] w-[8px] text-white" strokeWidth={3} />}
      </span>
      <span
        className={met ? 'text-[var(--neutral-strong-950)]' : 'text-[var(--neutral-soft-400)]'}
      >
        {children}
      </span>
    </li>
  );
}

// ─── Suspense wrapper ───────────────────────────────────────────────────────

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)]">
          <Loader2
            className="h-7 w-7 animate-spin"
            style={{ color: 'var(--primary-base)' }}
          />
        </div>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
