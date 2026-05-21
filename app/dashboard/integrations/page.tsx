'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Copy } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { useUser } from '@/lib/hooks';
import { IntegrationsSkeleton } from '@/components/ui/PageSkeletons';
import { CodeChip } from '@/components/ui/CodeChip';
import { JsonHighlight } from '@/components/ui/JsonHighlight';
import { ToolLogo } from '@/components/ui/ToolLogo';
import { useToast } from '@/components/ui/Toast';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';

type Tool = 'vscode-copilot' | 'cursor' | 'claude-code';

const TOOLS: { id: Tool; name: string; subtitle: string; configPath: string }[] = [
  { id: 'vscode-copilot', name: 'VS Code Copilot', subtitle: 'Workspace .vscode/mcp.json', configPath: '.vscode/mcp.json' },
  { id: 'cursor',         name: 'Cursor',          subtitle: 'User ~/.cursor/mcp.json',  configPath: '~/.cursor/mcp.json' },
  { id: 'claude-code',    name: 'Claude Code',     subtitle: 'User ~/.claude/mcp.json',  configPath: '~/.claude/mcp.json' },
];

export default function IntegrationsPage() {
  const { user } = useUser();
  const reduce = useReducedMotion();
  const toast = useToast();
  const [selectedTool, setSelectedTool] = useState<Tool>('vscode-copilot');
  const [copied, setCopied] = useState(false);

  const sseUrl = `https://app.runaegis.co/sse?user_id=${user?.id ?? '<USER_ID>'}&room_id=<ROOM_ID>&access_token=<ACCESS_TOKEN>&role=<ROLE>`;

  const configFor = (tool: Tool): string => {
    if (tool === 'vscode-copilot') {
      return JSON.stringify(
        { servers: { aegis_dep: { type: 'sse', url: sseUrl } } },
        null,
        2,
      );
    }
    return JSON.stringify(
      { mcpServers: { aegis_dep: { transport: 'sse', url: sseUrl } } },
      null,
      2,
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(configFor(selectedTool));
      setCopied(true);
      toast.success('Copied to clipboard', {
        description: 'Paste it into your tool settings to finish wiring.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard API can fail (browser perms, non-HTTPS, etc.).
      // Surface the failure so the user doesn't think they copied.
      toast.error('Could not copy', {
        description:
          err instanceof Error
            ? err.message
            : 'Your browser blocked clipboard access. Try selecting the text manually.',
      });
    }
  };

  if (!user?.id) {
    return (
      <>
        <Topbar title="Integrations" subtitle="Connect Aegis to your dev tools" />
        <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <IntegrationsSkeleton />
        </div>
      </>
    );
  }

  const active = TOOLS.find((t) => t.id === selectedTool)!;
  const configCode = configFor(selectedTool);

  return (
    <>
      <Topbar title="Integrations" subtitle="Connect Aegis to your dev tools" />
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <motion.header
          className="mb-6"
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
        >
          <motion.p
            variants={fadeUp}
            className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]"
          >
            Integrations
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            Connect Aegis to your agent
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
          >
            Pick your tool, copy the snippet, paste it into your MCP config.
          </motion.p>
        </motion.header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Tool picker — sticky on desktop so it stays in view */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.16 }}
            className="space-y-6 lg:sticky lg:top-[72px]"
          >
            <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Choose your tool
                </h2>
              </div>
              <ul className="divide-y divide-[var(--stroke-soft-200)]">
                {TOOLS.map((t) => {
                  const isActive = selectedTool === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => setSelectedTool(t.id)}
                        className={[
                          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                          isActive
                            ? 'bg-[var(--primary-alpha-10)]'
                            : 'hover:bg-[var(--neutral-weak-50)]',
                        ].join(' ')}
                      >
                        <ToolLogo id={t.id} size={28} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-[var(--neutral-strong-950)]">
                            {t.name}
                          </span>
                          <span className="block truncate text-[11.5px] text-[var(--neutral-soft-400)]">
                            {t.subtitle}
                          </span>
                        </span>
                        <span
                          className={[
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                            isActive
                              ? 'border-[var(--primary-base)]'
                              : 'border-[var(--stroke-sub-300)]',
                          ].join(' ')}
                          aria-hidden
                        >
                          {isActive && (
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: 'var(--primary-base)' }}
                            />
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-3 text-[11.5px] text-[var(--neutral-soft-400)]">
                More tools (Windsurf, Codex) coming soon.
              </div>
            </div>

            <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Quick tips
                </h2>
              </div>
              <ul className="space-y-2.5 p-4 text-[12.5px] text-[var(--neutral-sub-600)]">
                <li className="flex gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--neutral-soft-400)]" />
                  Rooms are required for access. Create one before you connect.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--neutral-soft-400)]" />
                  Keep your access token private and rotate if exposed.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--neutral-soft-400)]" />
                  Role values: OWNER, ADMIN, or DEVELOPER.
                </li>
              </ul>
            </div>
          </motion.div>

          {/* Setup */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.22 }}
            className="space-y-6"
          >
            {/* Getting started 3-step strip */}
            <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Getting started
                </h2>
              </div>
              <div className="grid grid-cols-1 divide-y divide-[var(--stroke-soft-200)] md:grid-cols-3 md:divide-y-0 md:divide-x">
                <Step n={1} title="Create Room" desc="Make a room in Aegis to generate access." />
                <Step n={2} title="Copy Credentials" desc="Grab room ID, access token, and role." />
                <Step n={3} title="Paste Config" desc="Add the config and restart your tool." />
              </div>
            </div>

            {/* Config snippet */}
            <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <ToolLogo id={active.id} size={22} />
                  <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                    {active.name} setup
                  </h2>
                </div>
                <CodeChip>{active.configPath}</CodeChip>
              </div>

              {/* User ID callout */}
              <div className="border-b border-[var(--stroke-soft-200)] px-5 py-4">
                <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                  Your User ID
                </p>
                <p className="text-[12.5px] text-[var(--neutral-strong-950)]">
                  {user.id}
                </p>
              </div>

              {/* Pre-flight */}
              <div className="border-b border-[var(--stroke-soft-200)] px-5 py-4">
                <p className="text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
                  Before you connect
                </p>
                <ol className="mt-2 space-y-1.5 text-[12.5px] text-[var(--neutral-sub-600)]">
                  <ListStep n={1}>Create a room in Aegis</ListStep>
                  <ListStep n={2}>Copy the room ID, access token, and role</ListStep>
                  <ListStep n={3}>Replace the placeholders in the config below</ListStep>
                </ol>
              </div>

              {/* Code block — Gladia/Stellate-style: header w/ traffic-light
                  + filename chip + lang tag + copy. Body has line numbers
                  in a muted gutter and tokenized JSON via JsonHighlight. */}
              <div className="border-t border-[var(--stroke-soft-200)]">
                <div className="flex items-center justify-between bg-[var(--neutral-weak-50)] px-4 py-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center gap-1" aria-hidden>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#fb3748' }} />
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#f6b51e' }} />
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#1fc16b' }} />
                    </span>
                    <CodeChip>{active.configPath}</CodeChip>
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                      JSON
                    </span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="inline-flex h-7 items-center gap-1.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-2.5 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} strokeWidth={2.25} />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="overflow-x-auto bg-white">
                  <div className="flex">
                    {/* Line number gutter */}
                    <div
                      className="select-none border-r border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] py-4 pl-4 pr-3 text-right text-[11.5px] leading-[1.7] text-[var(--neutral-soft-400)] [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                      aria-hidden
                    >
                      {configCode.split('\n').map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                    {/* Source */}
                    <pre className="flex-1 overflow-x-auto px-4 py-4 text-[12px] leading-[1.7] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                      <code><JsonHighlight code={configCode} /></code>
                    </pre>
                  </div>
                </div>
              </div>

              {/* Post-flight */}
              <div className="border-t border-[var(--stroke-soft-200)] px-5 py-4">
                <p className="text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
                  Add it to {active.name}
                </p>
                <ol className="mt-2 space-y-1.5 text-[12.5px] text-[var(--neutral-sub-600)]">
                  {selectedTool === 'vscode-copilot' && (
                    <>
                      <ListStep n={1}>
                        Create a <CodeChip>.vscode</CodeChip> folder in your project
                      </ListStep>
                      <ListStep n={2}>
                        Create <CodeChip>mcp.json</CodeChip> inside it
                      </ListStep>
                      <ListStep n={3}>
                        Paste the config under the <CodeChip>servers</CodeChip> key
                      </ListStep>
                      <ListStep n={4}>Restart VS Code</ListStep>
                    </>
                  )}
                  {selectedTool === 'cursor' && (
                    <>
                      <ListStep n={1}>
                        Create <CodeChip>~/.cursor/mcp.json</CodeChip>
                      </ListStep>
                      <ListStep n={2}>
                        Or use workspace-level <CodeChip>.cursor/mcp.json</CodeChip>
                      </ListStep>
                      <ListStep n={3}>
                        Paste the config under the <CodeChip>mcpServers</CodeChip> key
                      </ListStep>
                      <ListStep n={4}>Restart Cursor</ListStep>
                    </>
                  )}
                  {selectedTool === 'claude-code' && (
                    <>
                      <ListStep n={1}>
                        Create <CodeChip>~/.claude/mcp.json</CodeChip>
                      </ListStep>
                      <ListStep n={2}>
                        Or use project-level <CodeChip>.claude/mcp.json</CodeChip>
                      </ListStep>
                      <ListStep n={3}>
                        Paste the config under the <CodeChip>mcpServers</CodeChip> key
                      </ListStep>
                      <ListStep n={4}>Restart Claude Code</ListStep>
                    </>
                  )}
                </ol>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="p-5">
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-[var(--primary-base)]"
        style={{ backgroundColor: 'var(--primary-alpha-10)' }}
      >
        {n}
      </span>
      <p className="mt-3 text-[13px] font-semibold text-[var(--neutral-strong-950)]">{title}</p>
      <p className="mt-1 text-[12px] text-[var(--neutral-sub-600)]">{desc}</p>
    </div>
  );
}

function ListStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--neutral-weak-50)] text-[10px] font-bold text-[var(--neutral-sub-600)]">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
