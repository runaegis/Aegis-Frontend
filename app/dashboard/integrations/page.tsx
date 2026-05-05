'use client';

import { useState } from 'react';
import { Copy, Check, Code } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { useUser } from '@/lib/hooks';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function IntegrationsPage() {
  const { user } = useUser();
  const [copiedVscode, setCopiedVscode] = useState(false);
  const [copiedCursor, setCopiedCursor] = useState(false);
  const [copiedClaude, setCopiedClaude] = useState(false);
  const [selectedTool, setSelectedTool] = useState('vscode-copilot');

  const vscodeConfig = {
    servers: {
      aegis_dep: {
        type: 'sse',
        url: `https://app.runaegis.co/sse?user_id=${user?.id ?? '<USER_ID>'}&room_id=<ROOM_ID>&access_token=<ACCESS_TOKEN>&role=<ROLE>`,
      },
    },
  };

  const vscodeConfigCode = JSON.stringify(vscodeConfig, null, 2);

  const cursorConfig = {
    mcpServers: {
      aegis_dep: {
        transport: 'sse',
        url: `https://app.runaegis.co/sse?user_id=${user?.id ?? '<USER_ID>'}&room_id=<ROOM_ID>&access_token=<ACCESS_TOKEN>&role=<ROLE>`,
      },
    },
  };

  const cursorConfigCode = JSON.stringify(cursorConfig, null, 2);

  const claudeConfig = {
    mcpServers: {
      aegis_dep: {
        transport: 'sse',
        url: `https://app.runaegis.co/sse?user_id=${user?.id ?? '<USER_ID>'}&room_id=<ROOM_ID>&access_token=<ACCESS_TOKEN>&role=<ROLE>`,
      },
    },
  };

  const claudeConfigCode = JSON.stringify(claudeConfig, null, 2);

  const handleCopyVscode = () => {
    navigator.clipboard.writeText(vscodeConfigCode);
    setCopiedVscode(true);
    setTimeout(() => setCopiedVscode(false), 2000);
  };

  const handleCopyCursor = () => {
    navigator.clipboard.writeText(cursorConfigCode);
    setCopiedCursor(true);
    setTimeout(() => setCopiedCursor(false), 2000);
  };

  const handleCopyClaude = () => {
    navigator.clipboard.writeText(claudeConfigCode);
    setCopiedClaude(true);
    setTimeout(() => setCopiedClaude(false), 2000);
  };

  if (!user?.id) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar title="Integrations" subtitle="Connect Aegis to your development tools" />

      <div className="p-6">
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-6">
            {/* Tool Selection */}
            <div className="rounded-md border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-medium text-foreground">Choose Your Tool</h2>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background/40 p-3 text-foreground transition hover:border-foreground/40">
                  <input
                    type="radio"
                    name="tool"
                    className="mt-1 h-4 w-4 rounded-full border-border text-foreground"
                    checked={selectedTool === 'vscode-copilot'}
                    onChange={() => setSelectedTool('vscode-copilot')}
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">VS Code Copilot</span>
                    <span className="text-xs text-muted-foreground">Use .vscode/mcp.json</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background/40 p-3 text-foreground transition hover:border-foreground/40">
                  <input
                    type="radio"
                    name="tool"
                    className="mt-1 h-4 w-4 rounded-full border-border text-foreground"
                    checked={selectedTool === 'cursor'}
                    onChange={() => setSelectedTool('cursor')}
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">Cursor</span>
                    <span className="text-xs text-muted-foreground">Use ~/.cursor/mcp.json</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background/40 p-3 text-foreground transition hover:border-foreground/40">
                  <input
                    type="radio"
                    name="tool"
                    className="mt-1 h-4 w-4 rounded-full border-border text-foreground"
                    checked={selectedTool === 'claude-code'}
                    onChange={() => setSelectedTool('claude-code')}
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">Claude Code</span>
                    <span className="text-xs text-muted-foreground">Use ~/.claude/mcp.json</span>
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">
                  More tools (Windsurf, Codex) are coming soon.
                </p>
              </div>
            </div>

            <div className="rounded-md border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-medium text-foreground">Quick Tips</h2>
              </div>
              <div className="p-4 text-sm text-muted-foreground">
                <ul className="space-y-2">
                  <li>Rooms are required for access. Create one before you connect.</li>
                  <li>Keep your access token private and rotate it if exposed.</li>
                  <li>Use role values like OWNER, ADMIN, or DEVELOPER.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-md border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-medium text-foreground">Getting Started</h2>
              </div>
              <div className="p-4 text-sm text-muted-foreground">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-border bg-background/40 p-3">
                    <p className="text-xs font-medium text-foreground">1. Create Room</p>
                    <p className="mt-1 text-xs">Make a room in Aegis to generate access.</p>
                  </div>
                  <div className="rounded-md border border-border bg-background/40 p-3">
                    <p className="text-xs font-medium text-foreground">2. Copy Credentials</p>
                    <p className="mt-1 text-xs">Grab room ID, access token, and role.</p>
                  </div>
                  <div className="rounded-md border border-border bg-background/40 p-3">
                    <p className="text-xs font-medium text-foreground">3. Paste Config</p>
                    <p className="mt-1 text-xs">Add the config and restart your tool.</p>
                  </div>
                </div>
              </div>
            </div>

            {selectedTool === 'vscode-copilot' && (
              <div className="rounded-md border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-foreground" />
                  <h2 className="text-sm font-medium text-foreground">VS Code Copilot Setup</h2>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                  <p className="text-xs text-blue-500 font-medium">Your User ID</p>
                  <p className="text-xs text-blue-500/80 mt-1 font-mono">{user.id}</p>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Before you connect</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Create a room in Aegis</li>
                    <li>Copy the room ID, access token, and role</li>
                    <li>Replace the placeholders in the config below</li>
                  </ol>
                </div>

                <div className="overflow-hidden rounded-md border border-border bg-muted/50">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="text-xs text-muted-foreground">.vscode/mcp.json</span>
                    <button
                      onClick={handleCopyVscode}
                      className="flex items-center gap-1.5 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background hover:bg-foreground/90 transition-colors"
                    >
                      {copiedVscode ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-xs text-foreground font-mono">
                    <code>{vscodeConfigCode}</code>
                  </pre>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Add it to your workspace</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Create a <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.vscode</code> folder in your project</li>
                    <li>Create <code className="text-xs bg-muted px-1.5 py-0.5 rounded">mcp.json</code> inside it</li>
                    <li>Paste the config under the <code className="text-xs bg-muted px-1.5 py-0.5 rounded">servers</code> key</li>
                    <li>Restart VS Code</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

            {selectedTool === 'cursor' && (
              <div className="rounded-md border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-foreground" />
                  <h2 className="text-sm font-medium text-foreground">Cursor Setup</h2>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                  <p className="text-xs text-blue-500 font-medium">Your User ID</p>
                  <p className="text-xs text-blue-500/80 mt-1 font-mono">{user.id}</p>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Before you connect</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Create a room in Aegis</li>
                    <li>Copy the room ID, access token, and role</li>
                    <li>Replace the placeholders in the config below</li>
                  </ol>
                </div>

                <div className="overflow-hidden rounded-md border border-border bg-muted/50">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="text-xs text-muted-foreground">~/.cursor/mcp.json</span>
                    <button
                      onClick={handleCopyCursor}
                      className="flex items-center gap-1.5 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background hover:bg-foreground/90 transition-colors"
                    >
                      {copiedCursor ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-xs text-foreground font-mono">
                    <code>{cursorConfigCode}</code>
                  </pre>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Add it to Cursor</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Create <code className="text-xs bg-muted px-1.5 py-0.5 rounded">~/.cursor/mcp.json</code></li>
                    <li>Or use workspace-level <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.cursor/mcp.json</code></li>
                    <li>Paste the config under the <code className="text-xs bg-muted px-1.5 py-0.5 rounded">mcpServers</code> key</li>
                    <li>Restart Cursor</li>
                  </ol>
                </div>

              </div>
            </div>
          )}

            {selectedTool === 'claude-code' && (
              <div className="rounded-md border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-foreground" />
                  <h2 className="text-sm font-medium text-foreground">Claude Code Setup</h2>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                  <p className="text-xs text-blue-500 font-medium">Your User ID</p>
                  <p className="text-xs text-blue-500/80 mt-1 font-mono">{user.id}</p>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Before you connect</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Create a room in Aegis</li>
                    <li>Copy the room ID, access token, and role</li>
                    <li>Replace the placeholders in the config below</li>
                  </ol>
                </div>

                <div className="overflow-hidden rounded-md border border-border bg-muted/50">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="text-xs text-muted-foreground">~/.claude/mcp.json</span>
                    <button
                      onClick={handleCopyClaude}
                      className="flex items-center gap-1.5 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background hover:bg-foreground/90 transition-colors"
                    >
                      {copiedClaude ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-xs text-foreground font-mono">
                    <code>{claudeConfigCode}</code>
                  </pre>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Add it to Claude Code</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Create <code className="text-xs bg-muted px-1.5 py-0.5 rounded">~/.claude/mcp.json</code></li>
                    <li>Or use project-level <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.claude/mcp.json</code></li>
                    <li>Paste the config under the <code className="text-xs bg-muted px-1.5 py-0.5 rounded">mcpServers</code> key</li>
                    <li>Restart Claude Code</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

            {/* Additional Resources */}
            {/* <div className="rounded-md border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-medium text-foreground">Resources</h2>
              </div>
              <div className="p-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
                      Model Context Protocol Documentation →
                    </a>
                  </li>
                  <li>
                    <a href="https://github.com/modelcontextprotocol" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
                      MCP GitHub Repository →
                    </a>
                  </li>
                </ul>
              </div>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
