'use client';

/**
 * Shared identity language for agents.
 *
 * Every agent gets one deterministic hue derived from its handle, so the
 * same agent reads identically in the roster, in the message stream, and
 * inside an @mention. Hues are drawn from the existing semantic tokens
 * rather than a new palette, which keeps the surface on-system and lets
 * dark mode inherit for free.
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import {
  Activity,
  Bot,
  ChartNoAxesColumn,
  Database,
  Monitor,
  Server,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GenerativeAvatar } from '@/components/ui/GenerativeAvatar';

export type AgentHue = 'feature' | 'info' | 'success' | 'warning' | 'primary';

const HUES: AgentHue[] = ['feature', 'info', 'success', 'warning', 'primary'];

/** Tinted surfaces mirror the Badge component's rgba approach for consistency. */
/**
 * Hue carries identity, not decoration.
 *
 * Earlier this surface filled every glyph and mention with a saturated
 * tint, which turned a busy room into a rainbow. Following Linear, colour
 * is now demoted to the smallest carrier that still identifies an agent:
 * text and a status dot. Surfaces stay neutral so hierarchy comes from
 * type and borders instead.
 */
export const HUE_STYLES: Record<
  AgentHue,
  { chip: string; glyph: string; dot: string; text: string }
> = {
  feature: {
    chip: 'text-[var(--feature-dark)]',
    glyph: 'text-[var(--feature-dark)]',
    dot: 'bg-[var(--feature)]',
    text: 'text-[var(--feature-dark)]',
  },
  info: {
    chip: 'text-[var(--info-dark)]',
    glyph: 'text-[var(--info-dark)]',
    dot: 'bg-[var(--information)]',
    text: 'text-[var(--info-dark)]',
  },
  success: {
    chip: 'text-[var(--success-dark)]',
    glyph: 'text-[var(--success-dark)]',
    dot: 'bg-[var(--success)]',
    text: 'text-[var(--success-dark)]',
  },
  warning: {
    chip: 'text-[var(--warning-dark)]',
    glyph: 'text-[var(--warning-dark)]',
    dot: 'bg-[var(--warning)]',
    text: 'text-[var(--warning-dark)]',
  },
  primary: {
    chip: 'text-[var(--primary-dark)]',
    glyph: 'text-[var(--primary-dark)]',
    dot: 'bg-[var(--primary-base)]',
    text: 'text-[var(--primary-dark)]',
  },
};

/**
 * Hue assignment.
 *
 * Hashing a handle is stable but collides: in a small room two agents can
 * land on the same hue and stop being distinguishable, which defeats the
 * point. So the roster assigns hues by position and every consumer reads
 * them from context. The hash stays as the fallback for handles that are
 * not roster members, such as a mention of someone who has left.
 */
const AgentHueContext = createContext<Record<string, AgentHue> | null>(null);

export function AgentHueProvider({
  handles,
  children,
}: {
  handles: string[];
  children: ReactNode;
}) {
  const key = handles.join('|').toLowerCase();
  const map = useMemo(() => {
    const next: Record<string, AgentHue> = {};
    handles.forEach((handle, index) => {
      next[handle.toLowerCase()] = HUES[index % HUES.length];
    });
    return next;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <AgentHueContext.Provider value={map}>{children}</AgentHueContext.Provider>;
}

/**
 * Returns a resolver, so it is safe to use inside list rendering.
 *
 * Memoised on the map: an unstable identity here invalidates every
 * consumer's `useMemo` on each render, which is subtle but real (it once
 * left an animated list restarting forever and stuck at opacity 0).
 */
export function useHueResolver(): (handle: string) => AgentHue {
  const map = useContext(AgentHueContext);
  return useCallback(
    (handle: string) => map?.[handle.toLowerCase()] ?? hueForHandle(handle),
    [map],
  );
}

/** Stable hash fallback for handles outside the current roster. */
export function hueForHandle(handle: string): AgentHue {
  let hash = 0;
  const normalized = handle.toLowerCase();
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return HUES[hash % HUES.length];
}

const ICON_RULES: Array<{ match: RegExp; icon: LucideIcon }> = [
  { match: /sec|audit|risk|compliance/, icon: ShieldCheck },
  { match: /front|ui|web|design/, icon: Monitor },
  { match: /back|api|server/, icon: Database },
  { match: /devops|infra|platform|deploy/, icon: Server },
  { match: /data|analytics|report/, icon: ChartNoAxesColumn },
  { match: /perf|latency|speed/, icon: Activity },
];

export function iconForHandle(handle: string, roleLabel?: string | null): LucideIcon {
  const haystack = `${handle} ${roleLabel ?? ''}`.toLowerCase();
  return ICON_RULES.find((rule) => rule.match.test(haystack))?.icon ?? Bot;
}

/** Strips a leading @ and normalizes to the handle charset the API expects. */
export function normalizeHandle(value: string) {
  return value
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
}

const GLYPH_SIZE = {
  sm: { px: 20, radius: 6 },
  md: { px: 28, radius: 7 },
  lg: { px: 32, radius: 8 },
} as const;

/**
 * Agent identity mark — same generative profile photo as the user
 * avatar in the sidebar footer, seeded by handle so each agent is
 * stable and distinct. roleLabel is accepted so existing call sites
 * keep compiling; identity is the handle.
 */
export function AgentGlyph({
  handle,
  roleLabel: _roleLabel,
  size = 'md',
  className,
}: {
  handle: string;
  roleLabel?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims = GLYPH_SIZE[size];
  return (
    <GenerativeAvatar
      seed={`agent:${handle.toLowerCase()}`}
      variant="user"
      size={dims.px}
      radius={dims.radius}
      className={className}
    />
  );
}

/**
 * Inline `@handle` token.
 *
 * Colour lives in the text, not a filled pill, so a message with four
 * mentions still reads as prose rather than as a row of badges.
 */
export function MentionChip({
  handle,
  known = true,
  tone = 'hue',
}: {
  handle: string;
  known?: boolean;
  tone?: 'hue' | 'primary';
}) {
  const hue = useHueResolver()(handle);
  return (
    <span
      className={cn(
        'font-medium',
        tone === 'primary' ? 'text-[13.5px]' : 'font-mono text-[12.5px]',
        !known
          ? 'text-[var(--neutral-soft-400)] line-through'
          : tone === 'primary'
            ? 'text-[var(--primary-dark)]'
            : HUE_STYLES[hue].chip,
      )}
    >
      @{handle}
    </span>
  );
}

/** Colored `@handle` label, hue resolved from the roster. */
export function AgentHandle({ handle, className }: { handle: string; className?: string }) {
  const hue = useHueResolver()(handle);
  return (
    <span className={cn('font-mono text-[11.5px]', HUE_STYLES[hue].text, className)}>
      @{handle}
    </span>
  );
}

/**
 * Renders free text with `@handle` tokens promoted to chips. Handles that
 * do not belong to the workspace stay muted, so a typo is visible rather
 * than silently styled as a real mention.
 */
export function MentionText({
  text,
  knownHandles,
  className,
  tone = 'hue',
}: {
  text: string;
  knownHandles: string[];
  className?: string;
  tone?: 'hue' | 'primary';
}) {
  const known = new Set(knownHandles.map((h) => h.toLowerCase()));
  const parts = text.split(/(@[a-z0-9_-]+)/gi);
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (/^@[a-z0-9_-]+$/i.test(part)) {
          const handle = part.slice(1);
          return (
            <MentionChip
              key={index}
              handle={handle}
              known={known.has(handle.toLowerCase())}
              tone={tone}
            />
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}
