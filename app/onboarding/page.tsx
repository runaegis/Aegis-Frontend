'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, RefreshCw, Check, ChevronRight, ChevronLeft, ExternalLink, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser, useOnboardingStep } from '@/lib/hooks';
import { Repo } from '@/lib/types';
import CopyButton from '@/components/ui/CopyButton';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setUser } = useUser();
  const { step, setStep } = useOnboardingStep();

  const [username, setUsername] = useState(user?.username || '');
  const [githubId, setGithubId] = useState(String(user?.github_user_id || ''));
  const [email, setEmail] = useState(user?.email || '');
  const [token, setToken] = useState(user?.access_token || '');
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState('');

  const [repos, setRepos] = useState<Repo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  const [activeTab, setActiveTab] = useState('claude');
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);

  const [actionCount, setActionCount] = useState(0);

  const handleStep1 = async () => {
    if (!username || !githubId || !email || !token) {
      setStep1Error('All fields are required.');
      return;
    }
    setStep1Loading(true);
    setStep1Error('');
    try {
      const githubUserIdNum = parseInt(githubId, 10);
      if (isNaN(githubUserIdNum)) {
        setStep1Error('GitHub User ID must be a number.');
        setStep1Loading(false);
        return;
      }
      const response = await api.saveUser({ github_user_id: githubUserIdNum, username, email, access_token: token });
      setUser(response);
      setStep(2);
    } catch {
      setStep1Error('Failed to save. Please try again.');
    } finally {
      setStep1Loading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      if (!user?.github_user_id || !user?.access_token) throw new Error('User not initialized');
      const syncResponse = await api.syncRepos(user.github_user_id, user.access_token);
      if (!syncResponse.success) throw new Error(syncResponse.message || 'Sync failed');
      const reposResponse = await api.getRepos(user.id || '');
      if (reposResponse?.repos && Array.isArray(reposResponse.repos)) setRepos(reposResponse.repos);
      setSynced(true);
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleSetPermission = (index: number, permission: 'allow' | 'deny' | 'require_approval') => {
    setRepos((prev) =>
      prev.map((r, i) => {
        if (i === index) {
          if (permission === 'allow') return { ...r, can_read: true, can_write: true };
          if (permission === 'require_approval') return { ...r, can_read: true, can_write: false };
          return { ...r, can_read: false, can_write: false };
        }
        return r;
      })
    );
  };

  const handleBulkPermission = (permission: 'allow' | 'deny' | 'require_approval') => {
    setRepos((prev) =>
      prev.map((r) => {
        if (permission === 'allow') return { ...r, can_read: true, can_write: true };
        if (permission === 'require_approval') return { ...r, can_read: true, can_write: false };
        return { ...r, can_read: false, can_write: false };
      })
    );
  };

  const getPermissionLabel = (repo: Repo): 'allow' | 'deny' | 'require_approval' => {
    if (repo.can_write) return 'allow';
    if (repo.can_read) return 'require_approval';
    return 'deny';
  };

  const handleSavePermissions = async () => {
    if (!user?.id) return;
    try {
      const permissions = repos.map(({ github_repo_id, can_read, can_write }) => ({
        github_repo_id, can_read: can_read || false, can_write: can_write || false,
      }));
      await api.setPermissions(user.id, permissions);
      setStep(4);
    } catch {
      setStep(4);
    }
  };

  useEffect(() => {
    if (step !== 4 || verified) return;
    const interval = setInterval(async () => {
      setChecking(true);
      try {
        const uname = user?.username || username;
        if (!uname) return;
        const result = await api.getRecentActionCount(uname);
        if (result[0] && Number(result[0].count) > 0) setVerified(true);
      } catch { /* ignore */ } finally {
        setChecking(false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, verified, user?.username, username]);

  useEffect(() => {
    if (step !== 5) return;
    const fetchCount = async () => {
      try {
        const metrics = await api.getMetrics();
        setActionCount(Number(metrics.total) || 0);
      } catch { /* ignore */ }
    };
    fetchCount();
  }, [step]);

  const mcpConfig = JSON.stringify({
    mcpServers: {
      'aegis-github': {
        url: 'https://app.runaegis.co/sse',
        headers: { user_id: String(user?.github_user_id || githubId || '{USER_GITHUB_ID}') },
      },
    },
  }, null, 2);

  const permOptions: Array<{ value: 'allow' | 'deny' | 'require_approval'; label: string; activeClass: string }> = [
    { value: 'allow', label: 'Allow', activeClass: 'bg-success text-white' },
    { value: 'require_approval', label: 'Approval', activeClass: 'bg-primary text-white' },
    { value: 'deny', label: 'Deny', activeClass: 'bg-destructive text-white' },
  ];

  const tabs = [
    { id: 'claude', label: 'Claude Code' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'windsurf', label: 'Windsurf' },
    { id: 'custom', label: 'Other' },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      {/* Steps */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
              s < step ? 'bg-success text-white' : s === step ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
            }`}>
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 5 && <div className={`h-px w-6 ${s < step ? 'bg-success' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      <div className="w-full max-w-lg">
        {/* Step 1 */}
        {step === 1 && (
          <div className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h1 className="text-base font-medium text-foreground">Connect GitHub</h1>
              <p className="text-sm text-muted-foreground">Aegis needs access to your repositories.</p>
            </div>
            <div className="p-4 space-y-4">
              {step1Error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{step1Error}</div>}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">GitHub Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="octocat" className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">GitHub User ID</label>
                <input type="text" value={githubId} onChange={(e) => setGithubId(e.target.value)} placeholder="12345678" className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                <p className="mt-1 text-xs text-muted-foreground">Find at api.github.com/users/YOUR_USERNAME</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Personal Access Token</label>
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_xxxx" className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="mb-2 text-xs text-muted-foreground">Required scopes:</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li><code className="text-foreground">repo</code> - Full control of repositories</li>
                  <li><code className="text-foreground">read:org</code> - Read org membership</li>
                  <li><code className="text-foreground">workflow</code> - Update workflows</li>
                </ul>
                <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Create token <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <button onClick={handleStep1} disabled={step1Loading} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {step1Loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h1 className="text-base font-medium text-foreground">Sync Repositories</h1>
              <p className="text-sm text-muted-foreground">Discover repositories with your token.</p>
            </div>
            <div className="p-4">
              {!synced ? (
                <button onClick={handleSync} disabled={syncing} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {syncing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Syncing...</> : <><RefreshCw className="h-4 w-4" /> Sync repositories</>}
                </button>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-success" />
                    {repos.length} repositories found
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {repos.map((repo) => (
                      <div key={repo.full_name} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                        {repo.full_name}
                        <span className="text-xs text-success">Allow</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => setStep(1)} className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                      <ChevronLeft className="h-4 w-4" /> Back
                    </button>
                    <button onClick={() => setStep(3)} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                      Continue <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h1 className="text-base font-medium text-foreground">Configure Permissions</h1>
              <p className="text-sm text-muted-foreground">Set access levels for each repository.</p>
            </div>
            <div className="p-4">
              <div className="mb-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p><span className="text-success font-medium">Allow</span> - Agent actions proceed with logging</p>
                <p><span className="text-primary font-medium">Approval</span> - Actions require human review</p>
                <p><span className="text-destructive font-medium">Deny</span> - No agent actions allowed</p>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Apply to all:</span>
                {permOptions.map((opt) => (
                  <button key={opt.value} onClick={() => handleBulkPermission(opt.value)} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {repos.map((repo, i) => (
                  <div key={repo.full_name} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                    <span className="text-sm text-foreground">{repo.full_name}</span>
                    <div className="flex overflow-hidden rounded-md border border-border">
                      {permOptions.map((opt) => (
                        <button key={opt.value} onClick={() => handleSetPermission(i, opt.value)} className={`px-2 py-1 text-xs font-medium ${getPermissionLabel(repo) === opt.value ? opt.activeClass : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setStep(2)} className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={handleSavePermissions} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Continue <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h1 className="text-base font-medium text-foreground">Connect Agent</h1>
              <p className="text-sm text-muted-foreground">Add Aegis to your MCP configuration.</p>
            </div>
            <div className="p-4">
              <div className="mb-3 flex gap-1 rounded-md bg-muted p-1">
                {tabs.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 rounded px-3 py-1.5 text-xs font-medium ${activeTab === tab.id ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="overflow-hidden rounded-md border border-border">
                <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">MCP Config</span>
                  <CopyButton text={mcpConfig} />
                </div>
                <pre className="overflow-x-auto p-3 font-mono text-xs text-foreground">{mcpConfig}</pre>
              </div>
              <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                {activeTab === 'claude' && <ol className="space-y-1"><li>1. Open Claude Code settings</li><li>2. Navigate to MCP Servers</li><li>3. Add the config above</li><li>4. Restart Claude Code</li></ol>}
                {activeTab === 'cursor' && <ol className="space-y-1"><li>1. Open Settings → Features → MCP</li><li>2. Click Add MCP Server</li><li>3. Paste the config</li></ol>}
                {activeTab === 'windsurf' && <ol className="space-y-1"><li>1. Open ~/.codeium/windsurf/mcp_config.json</li><li>2. Add the aegis-github server</li></ol>}
                {activeTab === 'custom' && <p>Point your MCP server URL to https://app.runaegis.co/sse with header user_id: {String(user?.github_user_id || githubId)}</p>}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
                {verified ? (
                  <><Check className="h-4 w-4 text-success" /><span className="text-success">Agent connected</span></>
                ) : (
                  <><div className={`h-2 w-2 rounded-full ${checking ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} /><span className="text-muted-foreground">Waiting for first action...</span></>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setStep(3)} className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={() => setStep(5)} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Continue <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {!verified && <button onClick={() => setStep(5)} className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground">Skip for now</button>}
            </div>
          </div>
        )}

        {/* Step 5 */}
        {step === 5 && (
          <div className="rounded-md border border-border bg-card text-center">
            <div className="px-4 py-8">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-lg font-medium text-foreground">Aegis is active</h1>
              <p className="mt-1 text-sm text-muted-foreground">Your agents are now governed.</p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-xl font-semibold text-foreground">{actionCount}</p>
                  <p className="text-xs text-muted-foreground">actions</p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-xl font-semibold text-foreground">{repos.length}</p>
                  <p className="text-xs text-muted-foreground">repos</p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-xl font-semibold text-foreground">0</p>
                  <p className="text-xs text-muted-foreground">incidents</p>
                </div>
              </div>
              <button onClick={() => router.push('/dashboard')} className="mt-6 inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Go to Dashboard <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
