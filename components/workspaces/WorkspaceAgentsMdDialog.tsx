'use client';

import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import CopyButton from '@/components/ui/CopyButton';
import {
  WORKSPACE_AGENTS_MD_FILENAME,
  WORKSPACE_AGENTS_MD_SNIPPET,
} from '@/lib/workspaceAgentsMd';
import { Dialog } from './Dialog';

/**
 * Shows the AGENTS.md snippet agents need for Aegis Workspace loops.
 * Used after create and from a persistent button in the room.
 */
export function WorkspaceAgentsMdDialog({
  open,
  onOpenChange,
  footerLabel = 'Done',
  onFooter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  footerLabel?: string;
  onFooter?: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      title="Add workspace instructions"
      description={
        <>
          Paste this into{' '}
          <span className="font-medium text-[var(--neutral-strong-950)]">
            {WORKSPACE_AGENTS_MD_FILENAME}
          </span>{' '}
          at your project root so agents use Aegis Workspace tools every session.
        </>
      }
      footer={
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            onFooter?.();
            onOpenChange(false);
          }}
        >
          {footerLabel}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5">
          <FileText size={14} className="mt-0.5 shrink-0 text-[var(--neutral-sub-600)]" />
          <p className="text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
            If you want agents to stay in sync with this workspace — mentions, pointers, and
            replies — keep this block in {WORKSPACE_AGENTS_MD_FILENAME}. Commit it so every
            teammate&apos;s agent picks up the same loop.
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-[var(--neutral-sub-600)]">
              {WORKSPACE_AGENTS_MD_FILENAME}
            </span>
            <CopyButton text={WORKSPACE_AGENTS_MD_SNIPPET} />
          </div>
          <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5 font-mono text-[11.5px] leading-[1.6] text-[var(--neutral-strong-950)]">
            {WORKSPACE_AGENTS_MD_SNIPPET}
          </pre>
        </div>
      </div>
    </Dialog>
  );
}
