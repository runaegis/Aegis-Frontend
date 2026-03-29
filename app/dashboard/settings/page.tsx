'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  User,
  Key,
  Shield,
  GitBranch,
  RefreshCw,
  Trash2,
  Check,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Settings2,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { api } from '@/lib/api';
import { useUser, useOnboardingStep } from '@/lib/hooks';
import { Repo } from '@/lib/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorBanner from '@/components/ui/ErrorBanner';

export default function SettingsPage() {
  const { user, setUser } = useUser();
  const { setStep } = useOnboardingStep();
  const [activeTab, setActiveTab] = useState('profile');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile form state
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [token, setToken] = useState(user?.access_token || '');

  const fetchRepos = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await api.getRepos(user.id);
      setRepos(response?.repos || []);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
      setToken(user.access_token || '');
      fetchRepos();
    }
  }, [user, fetchRepos]);

  const handleSaveProfile = async () => {
    if (!user?.github_user_id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.saveUser({
        github_user_id: user.github_user_id,
        username,
        email,
        access_token: token,
      });
      setUser(updated);
      setSuccess('Profile updated successfully');
    } catch {
      setError('Failed to update profile');
    }
    setSaving(false);
  };

  const handleSyncRepos = async () => {
    if (!user?.github_user_id || !user?.access_token) return;
    setSyncing(true);
    setError(null);
    try {
      await api.syncRepos(user.github_user_id, user.access_token);
      await fetchRepos();
      setSuccess('Repositories synced successfully');
    } catch {
      setError('Failed to sync repositories');
    }
    setSyncing(false);
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

  const handleSavePermissions = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    try {
      const permissions = repos.map(({ github_repo_id, can_read, can_write }) => ({
        github_repo_id,
        can_read: can_read || false,
        can_write: can_write || false,
      }));
      await api.setPermissions(user.id, permissions);
      setSuccess('Permissions saved successfully');
    } catch {
      setError('Failed to save permissions');
    }
    setSaving(false);
  };

  const getPermissionLabel = (repo: Repo): 'allow' | 'deny' | 'require_approval' => {
    if (repo.can_write) return 'allow';
    if (repo.can_read) return 'require_approval';
    return 'deny';
  };

  const permOptions: Array<{ value: 'allow' | 'deny' | 'require_approval'; label: string; activeClass: string }> = [
    { value: 'allow', label: 'Allow', activeClass: 'bg-success text-white' },
    { value: 'require_approval', label: 'Approval', activeClass: 'bg-info text-white' },
    { value: 'deny', label: 'Deny', activeClass: 'bg-destructive text-white' },
  ];

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'repos', label: 'Repositories', icon: GitBranch },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="min-h-screen">
      <Topbar title="Settings" subtitle="Manage your account and preferences" />
      <div className="p-8">
        {/* Messages */}
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}
        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-success/30 bg-success-muted px-5 py-4 text-sm text-success animate-fade-in">
            <CheckCircle2 className="h-5 w-5" />
            {success}
          </div>
        )}

        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-60 shrink-0">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Settings
                  </span>
                </div>
              </div>
              <div className="p-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeTab === 'profile' && (
              <div className="overflow-hidden rounded-xl border border-border bg-card animate-fade-in">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h2 className="text-lg font-semibold text-foreground">Profile Settings</h2>
                  <p className="text-sm text-muted-foreground">Manage your account information</p>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        GitHub Username
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        GitHub User ID
                      </label>
                      <input
                        type="text"
                        value={String(user?.github_user_id || '')}
                        disabled
                        className="w-full cursor-not-allowed rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
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
                        className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      />
                      <a
                        href="https://github.com/settings/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Manage tokens on GitHub
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
                    >
                      {saving ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'repos' && (
              <div className="overflow-hidden rounded-xl border border-border bg-card animate-fade-in">
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Repository Permissions</h2>
                    <p className="text-sm text-muted-foreground">
                      Control which repositories agents can access
                    </p>
                  </div>
                  <button
                    onClick={handleSyncRepos}
                    disabled={syncing}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    Sync
                  </button>
                </div>
                <div className="p-6">
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <LoadingSpinner />
                    </div>
                  ) : repos.length === 0 ? (
                    <div className="py-12 text-center">
                      <GitBranch className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No repositories synced yet.</p>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-96 space-y-2 overflow-y-auto">
                        {repos.map((repo, i) => (
                          <div
                            key={`${repo.full_name}`}
                            className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                                {repo.full_name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <span className="text-sm font-medium text-foreground">{repo.full_name}</span>
                            </div>
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
                      <div className="mt-6 flex justify-end">
                        <button
                          onClick={handleSavePermissions}
                          disabled={saving}
                          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
                        >
                          {saving ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Save Permissions
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6 animate-fade-in">
                {/* Active Policies */}
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="border-b border-border bg-muted/30 px-6 py-4">
                    <h2 className="text-lg font-semibold text-foreground">Active Policies</h2>
                    <p className="text-sm text-muted-foreground">Security policies protecting your repositories</p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        'Protected Branch Denial',
                        'Freeze Window Enforcement',
                        'Mandatory PR Flow',
                        'Secret Detection',
                      ].map((policy) => (
                        <div
                          key={policy}
                          className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3"
                        >
                          <CheckCircle2 className="h-5 w-5 text-success" />
                          <span className="text-sm font-medium text-foreground">{policy}</span>
                        </div>
                      ))}
                    </div>
                    <a
                      href="/dashboard/policies"
                      className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Manage all policies
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="overflow-hidden rounded-xl border border-destructive/30 bg-destructive-muted">
                  <div className="border-b border-destructive/30 px-6 py-4">
                    <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
                    <p className="text-sm text-muted-foreground">Irreversible and destructive actions</p>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Reset Onboarding</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Start the setup process again from scratch
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setStep(1);
                          window.location.href = '/onboarding';
                        }}
                        className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive-muted px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Reset
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card p-5">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Delete Account</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Permanently delete your Aegis account and all data
                        </p>
                      </div>
                      <div className="group relative">
                        <button
                          disabled
                          className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-destructive/30 bg-destructive-muted px-4 py-2 text-sm font-medium text-destructive opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-lg group-hover:block">
                          Contact support to delete
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
