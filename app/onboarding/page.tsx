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
  Copy,
  CheckCircle2,
  Loader2,
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
  const [githubId, setGithubId] = useState(user?.github_user_id || '');
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
      const newUser = { github_user_id: githubId, username, email, access_token: token };
      await api.saveUser(newUser);
      setUser(newUser);
      setStep(2);
    } catch {
      setStep1Error('Failed to save profile. Please try again.');
    } finally {
      setStep1Loading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.syncRepos(user?.github_user_id || githubId);
      const data = await api.getRepos(user?.github_user_id || githubId);
      if (Array.isArray(data)) {
        setRepos(
          data.map((r: any) => ({
            repo_name: r.repo_name || r.name,
            owner: r.owner,
            permission: r.permission || 'allow',
          }))
        );
      }
      setSynced(true);
    } catch {
      // repos may just be empty
    } finally {
      setSyncing(false);
    }
  };

  const handleSetPermission = (index: number, permission: 'allow' | 'deny' | 'require_approval') => {
    setRepos((prev) => prev.map((r, i) => (i === index ? { ...r, permission } : r)));
  };

  const handleBulkPermission = (permission: 'allow' | 'deny' | 'require_approval') => {
    setRepos((prev) => prev.map((r) => ({ ...r, permission })));
  };

  const handleSavePermissions = async () => {
    const uid = user?.github_user_id || githubId;
    if (!uid) return;
    try {
      await api.setPermissions(
        uid,
        repos.map(({ repo_name, owner, permission }) => ({ repo_name, owner, permission }))
      );
      setStep(4);
    } catch {
      // continue anyway
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
            user_id: user?.github_user_id || githubId || '{USER_GITHUB_ID}',
          },
        },
      },
    },
    null,
    2
  );

  const permOptions: Array<{ value: 'allow' | 'deny' | 'require_approval'; label: string; activeClass: string }> = [
    { value: 'allow', label: 'Allow', activeClass: 'bg-green-600 text-white' },
    { value: 'require_approval', label: 'Approval', activeClass: 'bg-purple-600 text-white' },
    { value: 'deny', label: 'Deny', activeClass: 'bg-red-600 text-white' },
  ];

  const tabs = [
    { id: 'claude', label: 'Claude Code' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'windsurf', label: 'Windsurf' },
    { id: 'custom', label: 'Custom / Other' },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#FAFAFA] px-4 py-12">
      {/* Step indicator */}
      <div className="mb-10 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                s < step
                  ? 'bg-green-600 text-white'
                  : s === step
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-200 text-zinc-500'
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 5 && <div className={`h-px w-8 ${s < step ? 'bg-green-600' : 'bg-zinc-200'}`} />}
          </div>
        ))}
      </div>

      <div className="w-full max-w-2xl">
        {/* STEP 1 */}
        {step === 1 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-8">
            <div className="mb-1 flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-zinc-900" />
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Connect your GitHub account</h1>
            </div>
            <p className="mb-6 text-sm text-zinc-500">
              Aegis needs access to your repositories to govern agent actions.
            </p>

            {step1Error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {step1Error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                  GitHub Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="octocat"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                  GitHub User ID
                </label>
                <input
                  type="text"
                  value={githubId}
                  onChange={(e) => setGithubId(e.target.value)}
                  placeholder="12345678"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-zinc-400">
                  Find this at github.com/settings/profile
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Personal Access Token
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 rounded-lg bg-zinc-50 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                Required token permissions
              </p>
              <div className="space-y-1.5">
                {[
                  { scope: 'repo', desc: 'Full control of private repositories' },
                  { scope: 'read:org', desc: 'Read org and team membership' },
                  { scope: 'workflow', desc: 'Update GitHub Actions workflows' },
                ].map((p) => (
                  <div key={p.scope} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-zinc-700">
                      <code className="font-mono text-xs">{p.scope}</code> — {p.desc}
                    </span>
                  </div>
                ))}
              </div>
              <a
                href="https://github.com/settings/tokens/new"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
              >
                How to create a Personal Access Token
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="mt-6">
              <button
                onClick={handleStep1}
                disabled={step1Loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
              >
                {step1Loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-8">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Sync your repositories</h1>
            <p className="mb-6 text-sm text-zinc-500">
              Aegis will discover all repositories accessible with your token.
            </p>

            {!synced ? (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
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
                <p className="mb-4 text-sm font-medium text-zinc-700">
                  {repos.length} repositor{repos.length === 1 ? 'y' : 'ies'} found
                </p>
                <div className="max-h-80 space-y-1.5 overflow-y-auto">
                  {repos.map((repo) => (
                    <div
                      key={`${repo.owner}/${repo.repo_name}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                          {repo.owner?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-zinc-900">{repo.repo_name}</span>
                          <span className="ml-2 text-xs text-zinc-400">{repo.owner}</span>
                        </div>
                      </div>
                      <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 text-xs font-medium text-[#15803D]">
                        Allow
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
                  >
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-8">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Configure repo permissions</h1>
            <p className="mb-4 text-sm text-zinc-500">
              Set the default governance level for each repository.
            </p>

            <div className="mb-4 rounded-lg bg-zinc-50 p-4">
              <div className="space-y-2 text-xs text-zinc-500">
                <p><strong className="text-zinc-700">Allow</strong> — Agent actions proceed with full audit logging</p>
                <p><strong className="text-zinc-700">Require Approval</strong> — All agent actions require human approval before executing</p>
                <p><strong className="text-zinc-700">Deny</strong> — No agent actions allowed on this repository</p>
              </div>
            </div>

            <div className="mb-4 flex gap-2">
              <span className="text-xs text-zinc-400 leading-7">Apply to all:</span>
              {permOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleBulkPermission(opt.value)}
                  className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {repos.map((repo, i) => (
                <div
                  key={`${repo.owner}/${repo.repo_name}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-2.5"
                >
                  <span className="text-sm font-medium text-zinc-900">
                    {repo.owner}/{repo.repo_name}
                  </span>
                  <div className="flex rounded-lg border border-zinc-200">
                    {permOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleSetPermission(i, opt.value)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          repo.permission === opt.value ? opt.activeClass : 'text-zinc-500 hover:bg-zinc-50'
                        } ${opt.value === 'allow' ? 'rounded-l-lg' : ''} ${opt.value === 'deny' ? 'rounded-r-lg' : ''}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={handleSavePermissions}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-8">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Connect your AI agent</h1>
            <p className="mb-6 text-sm text-zinc-500">
              Add Aegis to your agent&apos;s MCP configuration.
            </p>

            <div className="mb-4 flex border-b border-zinc-200">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-b-2 border-zinc-900 text-zinc-900'
                      : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-4">
              <div className="mb-2 flex justify-end">
                <CopyButton text={mcpConfig} />
              </div>
              <pre className="overflow-x-auto font-mono text-sm leading-relaxed text-zinc-300">{mcpConfig}</pre>
            </div>

            <div className="mt-4 rounded-lg bg-zinc-50 p-4">
              {activeTab === 'claude' && (
                <ol className="space-y-1.5 text-sm text-zinc-600">
                  <li>1. Open Claude Code settings</li>
                  <li>2. Navigate to MCP Servers</li>
                  <li>3. Add the configuration above</li>
                  <li>4. Restart Claude Code</li>
                </ol>
              )}
              {activeTab === 'cursor' && (
                <ol className="space-y-1.5 text-sm text-zinc-600">
                  <li>1. Open Cursor Settings &rarr; Features &rarr; MCP</li>
                  <li>2. Click &quot;Add MCP Server&quot;</li>
                  <li>3. Paste the configuration above</li>
                </ol>
              )}
              {activeTab === 'windsurf' && (
                <ol className="space-y-1.5 text-sm text-zinc-600">
                  <li>1. Open ~/.codeium/windsurf/mcp_config.json</li>
                  <li>2. Add the aegis-github server configuration</li>
                </ol>
              )}
              {activeTab === 'custom' && (
                <div className="text-sm text-zinc-600">
                  <p className="mb-2">For any MCP-compatible agent, point your github MCP server URL to:</p>
                  <code className="block rounded bg-zinc-200 px-3 py-2 font-mono text-xs">
                    https://app.runaegis.co/sse
                  </code>
                  <p className="mt-2">
                    With header: <code className="font-mono text-xs">user_id: {user?.github_user_id || githubId}</code>
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-lg border border-zinc-200 p-4">
              <p className="text-sm text-zinc-600">
                Once configured, trigger any agent action and it will appear here.
              </p>
              <div className="mt-3 flex items-center gap-2">
                {verified ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Aegis is receiving agent actions</span>
                  </>
                ) : (
                  <>
                    {checking ? (
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    ) : (
                      <div className="h-4 w-4 animate-pulse rounded-full bg-zinc-300" />
                    )}
                    <span className="text-sm text-zinc-500">Waiting for first agent action...</span>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={() => setStep(5)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                  verified ? 'bg-zinc-900 hover:bg-blue-600' : 'bg-zinc-900 hover:bg-blue-600'
                }`}
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {!verified && (
              <button
                onClick={() => setStep(5)}
                className="mt-2 w-full text-center text-xs text-zinc-400 hover:text-zinc-600"
              >
                Skip for now
              </button>
            )}
          </div>
        )}

        {/* STEP 5 */}
        {step === 5 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Aegis is active</h1>
            <p className="mt-2 text-sm text-zinc-500">Your agents are now governed.</p>

            <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-zinc-200 p-5">
                <p className="text-3xl font-semibold tracking-tight text-zinc-900">{actionCount}</p>
                <p className="mt-1 text-xs text-zinc-400">actions intercepted</p>
              </div>
              <div className="rounded-xl border border-zinc-200 p-5">
                <p className="text-3xl font-semibold tracking-tight text-zinc-900">{repos.length}</p>
                <p className="mt-1 text-xs text-zinc-400">repos protected</p>
              </div>
              <div className="rounded-xl border border-zinc-200 p-5">
                <p className="text-3xl font-semibold tracking-tight text-zinc-900">0</p>
                <p className="mt-1 text-xs text-zinc-400">incidents prevented</p>
              </div>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
              Go to Dashboard
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
