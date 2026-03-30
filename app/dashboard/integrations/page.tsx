'use client';

import { useState } from 'react';
import { Copy, Check, Code } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { useUser } from '@/lib/hooks';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import CopyButton from '@/components/ui/CopyButton';

export default function IntegrationsPage() {
  const { user } = useUser();
  const [copied, setCopied] = useState(false);

  if (!user?.id) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const mcpConfig = {
    mcpServers: {
      aegis: {
        type: 'sse',
        url: `https://app.runaegis.co/sse?user_id=${user.id}`,
      },
    },
  };

  const configCode = JSON.stringify(mcpConfig, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(configCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen">
      <Topbar title="Integrations" subtitle="Connect Aegis to your development tools" />

      <div className="p-6">
        <div className="max-w-3xl">
          {/* MCP Server Configuration */}
          <div className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-foreground" />
                <h2 className="text-sm font-medium text-foreground">MCP Server Configuration</h2>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Add this configuration to your Claude desktop app's configuration file to enable Aegis integration.
                </p>
              </div>

              <div className="relative rounded-md bg-muted/50 border border-border overflow-hidden">
                <div className="absolute right-2 top-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-md bg-foreground px-2 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 transition-colors"
                  >
                    {copied ? (
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

                <pre className="p-4 pr-24 overflow-x-auto text-xs text-foreground font-mono">
                  <code>{configCode}</code>
                </pre>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Setup Instructions:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Copy the configuration above</li>
                  <li>Open Claude desktop app settings</li>
                  <li>Locate the configuration file (usually <code className="text-xs bg-muted px-1.5 py-0.5 rounded">~/config/claude_desktop_config.json</code>)</li>
                  <li>Paste the configuration in the <code className="text-xs bg-muted px-1.5 py-0.5 rounded">mcpServers</code> object</li>
                  <li>Restart Claude</li>
                </ol>
              </div>

              <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="text-xs text-blue-500 font-medium">ℹ Your User ID</p>
                <p className="text-xs text-blue-500/80 mt-1 font-mono">{user.id}</p>
              </div>
            </div>
          </div>

          {/* Additional Resources */}
          <div className="mt-6 rounded-md border border-border bg-card">
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
          </div>
        </div>
      </div>
    </div>
  );
}
