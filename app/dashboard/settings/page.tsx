'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import { Repo } from '@/lib/types';
import Topbar from '@/components/layout/Topbar';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function SettingsPage() {
  const { user, setUser } = useUser();
  const [username, setUsername] = useState(user?.username || '');
  const [userId, setUserId] = useState(user?.github_user_id || '');
  const [email, setEmail] = useState(user?.email || '');
  const [token, setToken] = useState(user?.access_token || '');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);
  const [permsSaved, setPermsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = useCallback(async () => {
    if (!user?.github_user_id) return;
    setLoadingRepos(true);
    try {
      const data = await api.getRepos(user.github_user_id);
      if (Array.isArray(data)) {
        setRepos(data.map((r: any) => ({
          repo_name: r.repo_name || r.name,
          owner: r.owner,
          permission: r.permission || 'allow',
        })));
      }
    } catch {
      setError('Failed to load repositories');
    } finally {
      setLoadingRepos(false);
    }
  }, [user?.github_user_id]);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updatedUser = { github_user_id: userId, username, email, access_token: token };
      await api.saveUser(updatedUser);
      setUser(updatedUser);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch {
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!user?.github_user_id) return;
    setSyncing(true);
    try {
      await api.syncRepos(user.github_user_id);
      await fetchRepos();
    } catch {
      setError('Failed to sync repositories');
    } finally {
      setSyncing(false);
    }
  };

  const setPermission = (index: number, permission: 'allow' | 'deny' | 'require_approval') => {
    setRepos((prev) => prev.map((r, i) => (i === index ? { ...r, permission } : r)));
  };

  const handleSavePermissions = async () => {
    if (!user?.github_user_id) return;
    setSavingPerms(true);
    try {
      await api.setPermissions(
        user.github_user_id,
        repos.map(({ repo_name, owner, permission }) => ({ repo_name, owner, permission }))
      );
      setPermsSaved(true);
      setTimeout(() => setPermsSaved(false), 2000);
    } catch {
      setError('Failed to save permissions');
    } finally {
      setSavingPerms(false);
    }
  };

  const permOptions: Array<{ value: 'allow' | 'deny' | 'require_approval'; label: string; activeClass: string }> = [
    { value: 'allow', label: 'Allow', activeClass: 'bg-green-600 text-white' },
    { value: 'require_approval', label: 'Approval', activeClass: 'bg-purple-600 text-white' },
    { value: 'deny', label: 'Deny', activeClass: 'bg-red-600 text-white' },
  ];

  return (
    <div>
      <Topbar title="Settings" subtitle="Manage your profile and repository permissions" />
      <div className="p-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Profile</h2>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                GitHub Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                GitHub User ID
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                Access Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 pr-10 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : profileSaved ? 'Saved!' : 'Save Profile'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Repository Permissions</h2>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Repos'}
            </button>
          </div>

          {loadingRepos ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : repos.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No repositories found. Click &quot;Sync Repos&quot; to discover your repositories.</p>
          ) : (
            <>
              <div className="mt-5 space-y-2">
                {repos.map((repo, i) => (
                  <div
                    key={`${repo.owner}/${repo.repo_name}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-3"
                  >
                    <div>
                      <span className="text-sm font-medium text-zinc-900">{repo.repo_name}</span>
                      <span className="ml-2 text-xs text-zinc-400">{repo.owner}</span>
                    </div>
                    <div className="flex rounded-lg border border-zinc-200">
                      {permOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setPermission(i, opt.value)}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            repo.permission === opt.value
                              ? opt.activeClass
                              : 'text-zinc-500 hover:bg-zinc-50'
                          } ${opt.value === 'allow' ? 'rounded-l-lg' : ''} ${
                            opt.value === 'deny' ? 'rounded-r-lg' : ''
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <button
                  onClick={handleSavePermissions}
                  disabled={savingPerms}
                  className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingPerms ? 'Saving...' : permsSaved ? 'Saved!' : 'Save Permissions'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
