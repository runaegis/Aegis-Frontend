'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  GitBranch,
  RefreshCw,
  Check,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useUser, useOnboardingStep } from '@/lib/hooks';
import { Repo } from '@/lib/types';
import CopyButton from '@/components/ui/CopyButton';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setUser } = useUser();
  const { step, setStep } = useOnboardingStep();

  // Step 1 state
  const [username, setUsername] = useState(user?.username || '');
  const [githubId, setGithubId] = useState(String(user?.github_user_id || ''));
  const [email, setEmail] = useState(user?.email || '');
  const [token, setToken] = useState(user?.access_token || '');
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState('');

  // Step 2 state
  const [repos, setRepos] = useState<Repo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  // Step 4 state
  const [activeTab, setActiveTab] = useState('claude');
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);

  // Step 5 state
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
        setStep1Error('GitHub User ID must be a valid number.');
        setStep1Loading(false);
        return;
      }

      const newUser = {
        github_user_id: githubUserIdNum,
        username,
        email,
        access_token: token,
      };
      
      const response = await api.saveUser(newUser);
      setUser(response);
      setStep(2);
    } catch (error) {
      setStep1Error('Failed to save profile. Please try again.');
      console.error(error);
    } finally {
      setStep1Loading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      if (!user?.github_user_id || !user?.access_token) {
        throw new Error('User not properly initialized');
      }

      const syncResponse = await api.syncRepos(user.github_user_id, user.access_token);
      if (!syncResponse.success) {
        throw new Error(syncResponse.message || 'Sync failed');
      }

      const reposResponse = await api.getRepos(user.id || '');
      if (reposResponse?.repos && Array.isArray(reposResponse.repos)) {
        setRepos(reposResponse.repos);
      }
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
          if (permission === 'allow') {
            return { ...r, can_read: true, can_write: true };
          } else if (permission === 'require_approval') {
            return { ...r, can_read: true, can_write: false };
          } else {
            return { ...r, can_read: false, can_write: false };
          }
        }
        return r;
      })
    );
  };

  const handleBulkPermission = (permission: 'allow' | 'deny' | 'require_approval') => {
    setRepos((prev) =>
      prev.map((r) => {
        if (permission === 'allow') {
          return { ...r, can_read: true, can_write: true };
        } else if (permission === 'require_approval') {
          return { ...r, can_read: true, can_write: false };
        } else {
          return { ...r, can_read: false, can_write: false };
        }
      })
    );
  };

  const getPermissionLabel = (repo: Repo): 'allow' | 'deny' | 'require_approval' => {
    if (repo.can_write) return 'allow';
    if (repo.can_read) return 'require_approval';
    return 'deny';
  };

  const handleSavePermissions = async () => {
    if (!user?.id) {
      console.error('User ID not available');
      return;
    }
    try {
      const permissions = repos.map(({ github_repo_id, can_read, can_write }) => ({
        github_repo_id,
        can_read: can_read || false,
        can_write: can_write || false,
      }));
      await api.setPermissions(user.id, permissions);
      setStep(4);
    } catch (error) {
      console.error('Failed to save permissions:', error);
      setStep(4);
    }
  };

  // Step 4 verification polling
  useEffect(() => {
    if (step !== 4 || verified) return;
    const interval = setInterval(async () => {
      setChecking(true);
      try {
        const uname = user?.username || username;
        if (!uname) return;
        const result = await api.getRecentActionCount(uname);
        if (result[0] && Number(result[0].count) > 0) {
          setVerified(true);
        }
      } catch {
        // ignore
      } finally {
        setChecking(false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, verified, user?.username, username]);

  // Step 5 live count
  useEffect(() => {
    if (step !== 5) return;
    const fetchCount = async () => {
      try {
        const metrics = await api.getMetrics();
        setActionCount(Number(metrics.total) || 0);
      } catch {
        // ignore
      }
    };
    fetchCount();
  }, [step]);

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        'aegis-github': {
          url: 'https://app.runaegis.co/sse',
          headers: {
            user_id: String(user?.github_user_id || githubId || '{USER_GITHUB_ID}'),
          },
        },
      },
    },
    null,
    2
  );

  const permOptions: Array<{ value: 'allow' | 'deny' | 'require_approval'; label: string; activeClass: string }> = [
    { value: 'allow', label: 'Allow', activeClass: 'bg-success text-white' },
    { value: 'require_approval', label: 'Approval', activeClass: 'bg-info text-white' },
    { value: 'deny', label: 'Deny', activeClass: 'bg-destructive text-white' },
  ];

  const tabs = [
    { id: 'claude', label: 'Claude Code' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'windsurf', label: 'Windsurf' },
    { id: 'custom', label: 'Custom / Other' },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      {/* Step indicator */}
      <div className="mb-10 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                s < step
                  ? 'bg-success text-white'
                  : s === step
                    ? 'bg-primary text-white ring-4 ring-primary/20'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 5 && <div className={`h-0.5 w-8 rounded-full ${s < step ? 'bg-success' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      <div className="w-full max-w-2xl">
        {/* STEP 1 */}
        {step === 1 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card animate-fade-in">
            <div className="border-b border-border bg-muted/30 px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <GitBranch className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">Connect your GitHub account</h1>
                  <p className="text-sm text-muted-foreground">Aegis needs access to your repositories to govern agent actions.</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              {step1Error && (
                <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive-muted px-4 py-3 text-sm text-destructive">
                  {step1Error}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    GitHub Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="octocat"
                    className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    GitHub User ID
                  </label>
                  <input
                    type="text"
                    value={githubId}
                    onChange={(e) => setGithubId(e.target.value)}
                    placeholder="12345678"
                    className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Your numeric GitHub User ID. Find it at api.github.com/users/YOUR_USERNAME
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Personal Access Token
                  </label>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-border bg-muted/30 p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Required token permissions
                </p>
                <div className="space-y-2">
                  {[
                    { scope: 'repo', desc: 'Full control of private repositories' },
                    { scope: 'read:org', desc: 'Read org and team membership' },
                    { scope: 'workflow', desc: 'Update GitHub Actions workflows' },
                  ].map((p) => (
                    <div key={p.scope} className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      <span className="text-sm text-muted-foreground">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{p.scope}</code>
                        <span className="mx-2">—</span>
                        {p.desc}
                      </span>
                    </div>
                  ))}
                </div>
                <a
                  href="https://github.com/settings/tokens/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
                >
                  Create a Personal Access Token
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="mt-8">
                <button
                  onClick={handleStep1}
                  disabled={step1Loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  {step1Loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card animate-fade-in">
            <div className="border-b border-border bg-muted/30 px-8 py-6">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Sync your repositories</h1>
              <p className="text-sm text-muted-foreground">Aegis will discover all repositories accessible with your token.</p>
            </div>

            <div className="p-8">
              {!synced ? (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-4 py-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Syncing repositories...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Sync repositories
                    </>
                  )}
                </button>
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm font-medium text-foreground">
                      {repos.length} repositor{repos.length === 1 ? 'y' : 'ies'} found
                    </span>
                  </div>
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {repos.map((repo) => (
                      <div
                        key={`${repo.full_name}`}
                        className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                            {repo.full_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-foreground">{repo.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{repo.full_name}</span>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-muted px-2.5 py-1 text-xs font-medium text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          Allow
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex gap-3">
                    <button
                      onClick={() => setStep(1)}
                      className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                    >
                      Continue
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card animate-fade-in">
            <div className="border-b border-border bg-muted/30 px-8 py-6">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Configure repo permissions</h1>
              <p className="text-sm text-muted-foreground">Set the default governance level for each repository.</p>
            </div>

            <div className="p-8">
              <div className="mb-6 rounded-xl border border-border bg-muted/30 p-5">
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold text-success">Allow</span><span className="text-muted-foreground"> — Agent actions proceed with full audit logging</span></p>
                  <p><span className="font-semibold text-info">Require Approval</span><span className="text-muted-foreground"> — All agent actions require human approval</span></p>
                  <p><span className="font-semibold text-destructive">Deny</span><span className="text-muted-foreground"> — No agent actions allowed on this repository</span></p>
                </div>
              </div>

              <div className="mb-5 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Apply to all:</span>
                {permOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleBulkPermission(opt.value)}
                    className="rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto">
                {repos.map((repo, i) => (
                  <div
                    key={`${repo.full_name}`}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {repo.full_name}
                    </span>
                    <div className="flex overflow-hidden rounded-lg border border-border">
                      {permOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleSetPermission(i, opt.value)}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            getPermissionLabel(repo) === opt.value 
                              ? opt.activeClass 
                              : 'bg-card text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  onClick={handleSavePermissions}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card animate-fade-in">
            <div className="border-b border-border bg-muted/30 px-8 py-6">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Connect your AI agent</h1>
              <p className="text-sm text-muted-foreground">Add Aegis to your agent&apos;s MCP configuration.</p>
            </div>

            <div className="p-8">
              {/* Tabs */}
              <div className="mb-5 flex gap-1 rounded-xl bg-muted/50 p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Code Block */}
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
                  <span className="text-xs font-medium text-muted-foreground">MCP Configuration</span>
                  <CopyButton text={mcpConfig} />
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-foreground">{mcpConfig}</pre>
              </div>

              {/* Instructions */}
              <div className="mt-5 rounded-xl border border-border bg-muted/30 p-5">
                {activeTab === 'claude' && (
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-3"><span className="font-semibold text-foreground">1.</span> Open Claude Code settings</li>
                    <li className="flex gap-3"><span className="font-semibold text-foreground">2.</span> Navigate to MCP Servers</li>
                    <li className="flex gap-3"><span className="font-semibold text-foreground">3.</span> Add the configuration above</li>
                    <li className="flex gap-3"><span className="font-semibold text-foreground">4.</span> Restart Claude Code</li>
                  </ol>
                )}
                {activeTab === 'cursor' && (
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-3"><span className="font-semibold text-foreground">1.</span> Open Cursor Settings → Features → MCP</li>
                    <li className="flex gap-3"><span className="font-semibold text-foreground">2.</span> Click &quot;Add MCP Server&quot;</li>
                    <li className="flex gap-3"><span className="font-semibold text-foreground">3.</span> Paste the configuration above</li>
                  </ol>
                )}
                {activeTab === 'windsurf' && (
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-3"><span className="font-semibold text-foreground">1.</span> Open ~/.codeium/windsurf/mcp_config.json</li>
                    <li className="flex gap-3"><span className="font-semibold text-foreground">2.</span> Add the aegis-github server configuration</li>
                  </ol>
                )}
                {activeTab === 'custom' && (
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-3">For any MCP-compatible agent, point your github MCP server URL to:</p>
                    <code className="block rounded-lg bg-muted px-4 py-3 font-mono text-xs text-foreground">
                      https://app.runaegis.co/sse
                    </code>
                    <p className="mt-3">
                      With header: <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">user_id: {String(user?.github_user_id || githubId)}</code>
                    </p>
                  </div>
                )}
              </div>

              {/* Verification Status */}
              <div className="mt-5 rounded-xl border border-border bg-muted/30 p-5">
                <p className="text-sm text-muted-foreground">Once configured, trigger any agent action and it will appear here.</p>
                <div className="mt-3 flex items-center gap-3">
                  {verified ? (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/20">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      </div>
                      <span className="text-sm font-medium text-success">Aegis is receiving agent actions</span>
                    </>
                  ) : (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        {checking ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-muted-foreground" />
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">Waiting for first agent action...</span>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  onClick={() => setStep(5)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {!verified && (
                <button
                  onClick={() => setStep(5)}
                  className="mt-3 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Skip for now
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 5 */}
        {step === 5 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card text-center animate-fade-in">
            <div className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-transparent px-8 py-12">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.1),transparent_50%)]" />
              <div className="relative">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
                  <Shield className="h-10 w-10 text-white" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Aegis is active</h1>
                <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Your agents are now governed
                </p>
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-muted/30 p-5">
                  <p className="text-3xl font-semibold tracking-tight text-foreground">{actionCount}</p>
                  <p className="mt-1 text-xs text-muted-foreground">actions intercepted</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-5">
                  <p className="text-3xl font-semibold tracking-tight text-foreground">{repos.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">repos protected</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-5">
                  <p className="text-3xl font-semibold tracking-tight text-foreground">0</p>
                  <p className="mt-1 text-xs text-muted-foreground">incidents prevented</p>
                </div>
              </div>

              <button
                onClick={() => router.push('/dashboard')}
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                Go to Dashboard
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
