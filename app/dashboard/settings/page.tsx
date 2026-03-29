'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Shield, GitBranch, RefreshCw, Check, ExternalLink } from 'lucide-react';
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

  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [token, setToken] = useState(user?.access_token || '');

  const fetchRepos = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await api.getRepos(user.id);
      setRepos(response?.repos || []);
    } catch { /* ignore */ }
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
      const updated = await api.saveUser({ github_user_id: user.github_user_id, username, email, access_token: token });
      setUser(updated);
      setSuccess('Profile updated');
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
      setSuccess('Repositories synced');
    } catch {
      setError('Failed to sync');
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
        github_repo_id, can_read: can_read || false, can_write: can_write || false,
      }));
      await api.setPermissions(user.id, permissions);
      setSuccess('Permissions saved');
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
    { value: 'require_approval', label: 'Approval', activeClass: 'bg-foreground/10 text-foreground' },
    { value: 'deny', label: 'Deny', activeClass: 'bg-destructive text-white' },
  ];

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'repos', label: 'Repositories', icon: GitBranch },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="min-h-screen">
      <Topbar title="Settings" subtitle="Manage your account" />
      <div className="p-6">
        {error && <div className="mb-4"><ErrorBanner message={error} onDismiss={() => setError(null)} /></div>}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">
            <Check className="h-4 w-4" />
            {success}
          </div>
        )}

        <div className="flex gap-6">
          <div className="w-48 shrink-0">
            <div className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      activeTab === tab.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1">
            {activeTab === 'profile' && (
              <div className="rounded-md border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-medium text-foreground">Profile Settings</h2>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">GitHub Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">GitHub User ID</label>
                    <input type="text" value={String(user?.github_user_id || '')} disabled className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Personal Access Token</label>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
                    >
                      {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'repos' && (
              <div className="rounded-md border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="text-sm font-medium text-foreground">Repository Permissions</h2>
                  <button
                    onClick={handleSyncRepos}
                    disabled={syncing}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    Sync
                  </button>
                </div>
                <div className="p-4">
                  {loading ? (
                    <div className="flex justify-center py-8"><LoadingSpinner /></div>
                  ) : repos.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No repositories synced.</p>
                  ) : (
                    <>
                      <div className="max-h-80 space-y-2 overflow-y-auto">
                        {repos.map((repo, i) => (
                          <div key={repo.full_name} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                            <span className="text-sm text-foreground">{repo.full_name}</span>
                            <div className="flex overflow-hidden rounded-md border border-border">
                              {permOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => handleSetPermission(i, opt.value)}
                                  className={`px-2 py-1 text-xs font-medium ${getPermissionLabel(repo) === opt.value ? opt.activeClass : 'bg-card text-muted-foreground hover:bg-muted'}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={handleSavePermissions}
                          disabled={saving}
                        className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
                        >
                          {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                          Save
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-4">
                <div className="rounded-md border border-border bg-card">
                  <div className="border-b border-border px-4 py-3">
                    <h2 className="text-sm font-medium text-foreground">Active Policies</h2>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {['Protected Branch Denial', 'Freeze Window Enforcement', 'Mandatory PR Flow', 'Secret Detection'].map((policy) => (
                        <div key={policy} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                          <Check className="h-4 w-4 text-success" />
                          {policy}
                        </div>
                      ))}
                    </div>
                    <a href="/dashboard/policies" className="mt-3 inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground transition-colors">
                      Manage policies <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="rounded-md border border-destructive/20 bg-destructive/5">
                  <div className="border-b border-destructive/20 px-4 py-3">
                    <h2 className="text-sm font-medium text-destructive">Danger Zone</h2>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Reset Onboarding</p>
                        <p className="text-xs text-muted-foreground">Start setup again from scratch</p>
                      </div>
                      <button
                        onClick={() => { setStep(1); window.location.href = '/onboarding'; }}
                        className="rounded-md border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                      >
                        Reset
                      </button>
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
