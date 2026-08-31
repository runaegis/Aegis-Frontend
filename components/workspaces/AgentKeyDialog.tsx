'use client';

import { TriangleAlert } from 'lucide-react';
import type { WorkspaceAgentKeyResponse } from '@/lib/api';
import { getMcpClaudeUrl, getMcpCursorUrl } from '@/lib/mcp-connect';
import { Button } from '@/components/ui/Button';
import CopyButton from '@/components/ui/CopyButton';
import { Dialog } from './Dialog';
import { AgentGlyph } from './agent-visuals';

/**
 * Shown once, immediately after a key is issued or rotated.
 *
 * Follows the convention used by Cohere, Appwrite, and Anam: the secret is
 * revealed a single time, paired with the exact config the operator needs
 * to paste, and an unambiguous warning that it cannot be retrieved later.
 */
export function AgentKeyDialog({
  open,
  onOpenChange,
  issued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issued: WorkspaceAgentKeyResponse | null;
}) {
  const snippet = issued
    ? JSON.stringify({ mcpServers: issued.mcp_config_snippet }, null, 2)
    : '';
  const cursorUrl = issued
    ? getMcpCursorUrl(issued.mcp_config_snippet, issued.agent_key)
    : '';
  const claudeUrl = issued
    ? getMcpClaudeUrl(issued.mcp_config_snippet, issued.agent_key)
    : '';

  return (
    <Dialog
      open={open && !!issued}
      onOpenChange={onOpenChange}
      width={560}
      title={issued ? `Agent key for @${issued.agent.handle}` : 'Agent key'}
      description="Copy this now. For security it is shown once and cannot be retrieved again. If you lose it, rotate the key to issue a new one."
      footer={
        <Button variant="primary" size="md" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      {issued && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5">
            <AgentGlyph handle={issued.agent.handle} roleLabel={issued.agent.role_label} />
            <div className="min-w-0">
              <p className="font-mono text-[13px] font-medium text-[var(--neutral-strong-950)]">
                @{issued.agent.handle}
              </p>
              {issued.agent.role_label && (
                <p className="truncate text-[11.5px] text-[var(--neutral-sub-600)]">
                  {issued.agent.role_label}
                </p>
              )}
            </div>
          </div>

          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-[rgba(246,181,30,0.35)] bg-[rgba(246,181,30,0.10)] px-3 py-2"
          >
            <TriangleAlert size={14} className="mt-px shrink-0 text-[var(--warning-dark)]" />
            <p className="text-[12px] leading-[1.5] text-[var(--warning-dark)]">
              Treat this like a password. Do not commit it to a repository or paste it into a shared
              channel.
            </p>
          </div>

          {/* The secret */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12px] font-medium text-[var(--neutral-sub-600)]">
                Agent key
              </span>
              <CopyButton text={issued.agent_key} />
            </div>
            <pre className="overflow-x-auto rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5 font-mono text-[11.5px] leading-[1.6] text-[var(--neutral-strong-950)]">
              {issued.agent_key}
            </pre>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[var(--neutral-sub-600)]">
                Cursor URL
              </span>
              <CopyButton text={cursorUrl} label="Copy Cursor URL" />
            </div>
            <pre className="overflow-x-auto rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5 font-mono text-[11.5px] leading-[1.6] text-[var(--neutral-strong-950)]">
              {cursorUrl}
            </pre>
            <p className="mt-1.5 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
              Paste into Cursor as a Streamable HTTP MCP server. The workspace key is already in the
              query. Header auth in the snippet below still works.
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[var(--neutral-sub-600)]">
                Claude URL
              </span>
              <CopyButton text={claudeUrl} label="Copy Claude URL" />
            </div>
            <pre className="overflow-x-auto rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5 font-mono text-[11.5px] leading-[1.6] text-[var(--neutral-strong-950)]">
              {claudeUrl}
            </pre>
            <p className="mt-1.5 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
              Paste as a Claude custom connector. Set Authentication to None. Do not use OAuth.
            </p>
          </div>

          {/* Ready-to-paste config — headers remain for clients that want them */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12px] font-medium text-[var(--neutral-sub-600)]">
                MCP configuration
              </span>
              <CopyButton text={snippet} label="Copy snippet" />
            </div>
            <pre className="max-h-[168px] overflow-auto rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5 font-mono text-[11.5px] leading-[1.6] text-[var(--neutral-strong-950)]">
              {snippet}
            </pre>
            <p className="mt-1.5 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
              Optional mcp.json snippet. Headers stay valid; dashboard REST still uses the logged-in
              cookie, never X-Agent-Key.
            </p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
