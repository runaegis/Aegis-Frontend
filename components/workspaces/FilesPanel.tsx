'use client';

import { Paperclip } from 'lucide-react';
import type { WorkspaceAgent, WorkspaceFileRef, WorkspaceMessage } from '@/lib/api';
import { AgentGlyph } from './agent-visuals';
import { RAIL_FOOTER } from './rail-footer';
import { PanelEmpty } from './PanelEmpty';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Every file shared in the room, newest first.
 *
 * Files are already carried on messages, so this is a second read of
 * existing data rather than new state: it answers "where is that schema
 * someone posted" without scrolling the conversation.
 */
export function FilesPanel({
  messages,
  agents,
}: {
  messages: WorkspaceMessage[];
  agents: WorkspaceAgent[];
}) {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const files = messages
    .flatMap((m) =>
      m.file_refs.map((f) => ({ file: f, sender: byId.get(m.sender_member_id), at: m.created_at })),
    )
    .reverse();

  const totalBytes = files.reduce((n, f) => n + f.file.size, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-1.5 py-1.5">
        {files.length === 0 ? (
          <PanelEmpty
            icon={Paperclip}
            title="No files yet"
            hint="Attach a file to a message and every version shared in this room collects here."
          />
        ) : (
          <FileRows files={files} />
        )}
      </div>

      {/* Shares the rail footer height so the room's bottom rule stays
          continuous across every tab. */}
      <div className={RAIL_FOOTER}>
        <p className="w-full px-1 font-mono text-[11.5px] tabular-nums text-[var(--neutral-soft-400)]">
          {files.length} {files.length === 1 ? 'file' : 'files'}
          {files.length > 0 && ` · ${formatSize(totalBytes)}`}
        </p>
      </div>
    </div>
  );
}

function FileRows({
  files,
}: {
  files: Array<{ file: WorkspaceFileRef; sender?: WorkspaceAgent; at: string }>;
}) {
  return (
    <>
      {files.map(({ file, sender, at }, index) => (
        <div
          key={`${file.file_id ?? file.filename}-${index}`}
          className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--neutral-weak-50)]"
        >
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface-alt)] text-[var(--neutral-sub-600)]">
            <Paperclip size={11} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[12px] text-[var(--neutral-strong-950)]">
              {file.filename}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--neutral-soft-400)]">
              {sender && (
                <>
                  <AgentGlyph handle={sender.handle} roleLabel={sender.role_label} size="sm" />
                  <span className="font-mono">@{sender.handle}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span className="tabular-nums">{formatSize(file.size)}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {new Date(at).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
