export function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function formatFullTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getInitials(name: string | null | undefined): string {
  if (name == null || typeof name !== 'string') return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/[_\-\s]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function truncate(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '…';
}

export function formatDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const diffMs = end - start;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}m ${diffSec % 60}s`;
  return `${diffHr}h ${diffMin % 60}m`;
}

export function formatExecutionTimeMs(
  value: number | string | bigint | null | undefined
): string {
  if (value === null || value === undefined) return '—';
  const ms = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) {
    const seconds = ms / 1000;
    const decimals = ms < 10000 ? 2 : 1;
    return `${seconds.toFixed(decimals)}s`;
  }

  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;

  const hours = Math.floor(minutes / 60);
  const minutesRemainder = minutes % 60;
  return `${hours}h ${minutesRemainder}m`;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

const MCP_AEGIS_TOOL_PREFIX = 'mcp_aegis_';

/** Strip `mcp_aegis_` for UI labels while keeping raw `tool_name` for API/color stability. */
export function formatMcpAegisToolDisplayName(toolName: string): string {
  if (!toolName) return '';
  return toolName.startsWith(MCP_AEGIS_TOOL_PREFIX)
    ? toolName.slice(MCP_AEGIS_TOOL_PREFIX.length)
    : toolName;
}

/** Stable category for MCP Aegis GitHub tools — color = category, not random. */
export type AegisToolCategory =
  | 'files_content'
  | 'pull_request'
  | 'repos_branches'
  | 'issues_comments'
  | 'search_read'
  | 'actions_workflows'
  | 'fallback';

const CATEGORY_HUE: Record<AegisToolCategory, number | null> = {
  files_content: 152,
  pull_request: 268,
  repos_branches: 184,
  issues_comments: 38,
  search_read: 212,
  actions_workflows: 16,
  fallback: null,
};

/** Soft pill fill + readable label on the same hue ramp (no bright border / glow). */
const CATEGORY_CHIP: Record<
  AegisToolCategory,
  { fill: [h: number, s: number, l: number, a: number]; text: [h: number, s: number, l: number] }
> = {
  files_content: { fill: [152, 36, 30, 0.22], text: [152, 22, 76] },
  pull_request: { fill: [268, 38, 32, 0.22], text: [268, 24, 78] },
  repos_branches: { fill: [184, 32, 28, 0.22], text: [184, 22, 77] },
  issues_comments: { fill: [38, 42, 30, 0.22], text: [38, 26, 78] },
  search_read: { fill: [212, 36, 30, 0.22], text: [212, 22, 78] },
  actions_workflows: { fill: [16, 44, 32, 0.22], text: [16, 28, 76] },
  fallback: { fill: [220, 10, 26, 0.32], text: [220, 6, 70] },
};

/**
 * Classify tool by name (with or without `mcp_aegis_` prefix).
 * Order matters: PR and issues before generic `get_` / `list_` / `search_`.
 */
export function getAegisToolCategory(toolName: string): AegisToolCategory {
  const raw = (toolName || '').toLowerCase();
  const n = raw.startsWith(MCP_AEGIS_TOOL_PREFIX) ? raw.slice(MCP_AEGIS_TOOL_PREFIX.length) : raw;

  if (n.includes('pull_request')) return 'pull_request';
  if (n.includes('issue')) return 'issues_comments';

  if (n.includes('create_or_update_file') || n.includes('push_files')) return 'files_content';

  if (n.startsWith('search_') || n.startsWith('get_') || n.startsWith('list_')) return 'search_read';

  if (n.includes('workflow') || n.includes('dispatch') || n.includes('runner')) {
    return 'actions_workflows';
  }

  if (n.includes('branch') || n.includes('repository') || n.includes('fork')) {
    return 'repos_branches';
  }

  if (n.includes('comment')) return 'issues_comments';

  return 'fallback';
}

export type ToolChipStyle = {
  backgroundColor: string;
  color: string;
};

/** Hue for subtle accents (dots, bars). `null` = use neutral gray. */
export function getToolAccentHue(toolName: string): number | null {
  return CATEGORY_HUE[getAegisToolCategory(toolName)];
}

export function getToolChipStyle(toolName: string): ToolChipStyle {
  const cat = getAegisToolCategory(toolName);
  const { fill, text } = CATEGORY_CHIP[cat];
  const [fh, fs, fl, fa] = fill;
  const [th, ts, tl] = text;
  return {
    backgroundColor: `hsla(${fh}, ${fs}%, ${fl}%, ${fa})`,
    color: `hsl(${th}, ${ts}%, ${tl}%)`,
  };
}
