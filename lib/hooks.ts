'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from './types';

const USER_KEY = 'aegis_user';
const ONBOARDING_KEY = 'aegis_onboarding_step';
const EMAIL_KEY = 'aegis_email';

function readString(raw: Record<string, unknown>, key: string): string | undefined {
  return typeof raw[key] === 'string' ? raw[key] : undefined;
}

function sanitizeUser(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;
  const email = readString(data, 'email') ?? '';
  const name = readString(data, 'name') ?? readString(data, 'username') ?? '';
  const username = readString(data, 'username') ?? (name || email.split('@')[0] || '');
  const onboardingStep = Number(data.onboarding_step);
  const onboardingStatus =
    typeof data.onboarding_status === 'boolean'
      ? data.onboarding_status
      : Number.isFinite(onboardingStep)
        ? onboardingStep >= 4
        : null;

  if (!email && !name && !username && !readString(data, 'id')) {
    return null;
  }

  return {
    id: readString(data, 'id'),
    name: name || null,
    username,
    email,
    avatar_url: readString(data, 'avatar_url') ?? null,
    email_verified_at: readString(data, 'email_verified_at') ?? null,
    is_active: typeof data.is_active === 'boolean' ? data.is_active : undefined,
    primary_auth_method: readString(data, 'primary_auth_method') ?? null,
    onboarding_status: onboardingStatus,
    created_at: readString(data, 'created_at') ?? null,
  };
}

export function useUser() {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        const sanitized = sanitizeUser(JSON.parse(stored));
        if (sanitized) {
          localStorage.setItem(USER_KEY, JSON.stringify(sanitized));
          setUserState(sanitized);
        } else {
          localStorage.removeItem(USER_KEY);
        }
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const setUser = useCallback((u: User) => {
    const sanitized = sanitizeUser(u);
    if (!sanitized) {
      localStorage.removeItem(USER_KEY);
      setUserState(null);
      return;
    }
    localStorage.setItem(USER_KEY, JSON.stringify(sanitized));
    setUserState(sanitized);
  }, []);

  const clearUser = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('aegis_preview');
    setUserState(null);
  }, []);

  return {
    user,
    setUser,
    clearUser,
    isLoading,
    isOnboarded: !!user,
  };
}

export function useAutoRefresh(callback: () => void, intervalMs: number = 60000) {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      callbackRef.current();
      setLastUpdated(new Date());
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);

  return { lastUpdated };
}

export function useEmail() {
  const [email, setEmailState] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem(EMAIL_KEY);
    if (stored) {
      setEmailState(stored);
    }
  }, []);

  const setEmail = useCallback((e: string) => {
    localStorage.setItem(EMAIL_KEY, e);
    setEmailState(e);
  }, []);

  const clearEmail = useCallback(() => {
    localStorage.removeItem(EMAIL_KEY);
    setEmailState('');
  }, []);

  return { email, setEmail, clearEmail };
}
