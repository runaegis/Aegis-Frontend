'use client';

import type { CSSProperties } from 'react';

/**
 * Tool brand marks rendered from PNGs in /public/integrations.
 * Every logo is rendered inside a fixed-size square so the marks
 * read at consistent visual weight no matter how each source asset
 * is cropped — the image is centered inside the box with `object-contain`.
 */

export type ToolId = 'vscode-copilot' | 'cursor' | 'claude-code';

const SOURCES: Record<ToolId, { src: string; alt: string }> = {
  'vscode-copilot': { src: '/integrations/vscode.png',      alt: 'VS Code' },
  cursor:           { src: '/integrations/cursor.png',      alt: 'Cursor' },
  'claude-code':    { src: '/integrations/claude-code.png', alt: 'Claude Code' },
};

/**
 * Best-effort mapping from a free-form `agent_name` (e.g. `claude-sonnet-4`,
 * `cursor-agent`, `github-copilot`) to the corresponding integration logo.
 * Returns `null` when no confident match is found so callers can fall back
 * to a generic initials avatar.
 */
export function getAgentToolId(agentName?: string | null): ToolId | null {
  if (!agentName) return null;
  const n = agentName.toLowerCase();

  // Host/IDE name wins over the model name. An agent like
  // `copilot Claude Haiku 4.5` is Copilot using a Claude model,
  // so we want the Copilot logo, not the Claude one. Same for
  // `cursor composer` etc.
  if (n.includes('copilot') || n.includes('vscode') || n.includes('vs-code')) {
    return 'vscode-copilot';
  }
  if (n.includes('cursor')) return 'cursor';

  // Only treat the agent as Claude Code when no IDE host is mentioned.
  if (n.includes('claude')) return 'claude-code';

  return null;
}

interface ToolLogoProps {
  id: ToolId;
  /** Outer square edge length in px (default 28). */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function ToolLogo({ id, size = 28, className, style }: ToolLogoProps) {
  const { src, alt } = SOURCES[id];
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Plain <img> — these are small PNGs, no need for next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </span>
  );
}
