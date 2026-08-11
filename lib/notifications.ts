import type { NotificationPreferences, NotificationType } from './types';

export type NotificationPreferenceKey =
  | 'notify_allow'
  | 'notify_deny'
  | 'notify_approval'
  | 'notify_rewrite';

export type NotificationPreferenceDescriptor = {
  key: NotificationPreferenceKey;
  type: NotificationType;
  label: 'Allow' | 'Deny' | 'Approval' | 'Rewrite';
  badgeLabel: NotificationType;
  description: string;
  tone: 'success' | 'error' | 'warning' | 'feature';
  defaultEnabled: boolean;
};

export const NOTIFICATION_PREFERENCE_FIELDS: readonly NotificationPreferenceDescriptor[] = [
  {
    key: 'notify_allow',
    type: 'ALLOW',
    label: 'Allow',
    badgeLabel: 'ALLOW',
    description: 'Notify when an action is allowed to proceed.',
    tone: 'success',
    defaultEnabled: false,
  },
  {
    key: 'notify_deny',
    type: 'DENY',
    label: 'Deny',
    badgeLabel: 'DENY',
    description: 'Notify when a policy blocks an action.',
    tone: 'error',
    defaultEnabled: true,
  },
  {
    key: 'notify_approval',
    type: 'APPROVAL',
    label: 'Approval',
    badgeLabel: 'APPROVAL',
    description: 'Notify when an action needs approval before it can proceed.',
    tone: 'warning',
    defaultEnabled: true,
  },
  {
    key: 'notify_rewrite',
    type: 'REWRITE',
    label: 'Rewrite',
    badgeLabel: 'REWRITE',
    description: 'Notify when Aegis rewrites an action into a safer path.',
    tone: 'feature',
    defaultEnabled: true,
  },
] as const;

const NOTIFICATION_TYPE_TO_KEY: Record<NotificationType, NotificationPreferenceKey> = {
  ALLOW: 'notify_allow',
  DENY: 'notify_deny',
  APPROVAL: 'notify_approval',
  REWRITE: 'notify_rewrite',
};

export function buildDefaultNotificationPreferences(): NotificationPreferences {
  return {
    notify_allow: false,
    notify_deny: true,
    notify_approval: true,
    notify_rewrite: true,
    created_at: null,
    updated_at: null,
  };
}

export function normalizeNotificationType(
  value: string | null | undefined,
): NotificationType | null {
  const upper = (value ?? '').trim().toUpperCase();
  if (upper === 'ALLOW') return 'ALLOW';
  if (upper === 'DENY') return 'DENY';
  if (upper === 'REWRITE') return 'REWRITE';
  if (upper === 'APPROVAL' || upper === 'REQUIRE_APPROVAL') return 'APPROVAL';
  return null;
}

export function notificationPreferenceKeyForType(
  type: NotificationType,
): NotificationPreferenceKey {
  return NOTIFICATION_TYPE_TO_KEY[type];
}

export function isNotificationTypeEnabled(
  preferences: NotificationPreferences,
  type: NotificationType,
): boolean {
  return Boolean(preferences[notificationPreferenceKeyForType(type)]);
}
