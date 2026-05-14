'use client';

import type { CSSProperties } from 'react';

/**
 * Tool brand marks rendered from PNGs in /public/integrations.
 * Every logo is rendered inside a fixed-size square so the marks
 * read at consistent visual weight no matter how each source asset
 * is cropped — the image is centered inside the box with `object-contain`.
 */

type ToolId = 'vscode-copilot' | 'cursor' | 'claude-code';

const SOURCES: Record<ToolId, { src: string; alt: string }> = {
  'vscode-copilot': { src: '/integrations/vscode.png',      alt: 'VS Code' },
  cursor:           { src: '/integrations/cursor.png',      alt: 'Cursor' },
  'claude-code':    { src: '/integrations/claude-code.png', alt: 'Claude Code' },
};

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
