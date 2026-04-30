'use client';

import { useEffect, useMemo, useState } from 'react';
import { Mail, Shield, Lock, GitBranch, Clock, Eye, FileCode, Zap, AlertTriangle, Scale } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import DecisionBadge from '@/components/ui/DecisionBadge';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';

const policies = [
  { key: 'protected_branch_denial', name: 'Protected Branch Denial', decision: 'REWRITE', description: 'Direct writes to main, master, and release branches are redirected to a safe PR workflow.', icon: GitBranch },
  { key: 'freeze_window_enforcement', name: 'Freeze Window Enforcement', decision: 'DENY', description: 'Write actions during release freeze windows are blocked.', icon: Clock },
  { key: 'aegis_branch_naming', name: 'Aegis Branch Naming', decision: 'DENY', description: 'All agent-created branches must follow the aegis/{session_id}/{task} convention.', icon: FileCode },
  { key: 'mandatory_pr_flow', name: 'Mandatory PR Flow', decision: 'REQUIRE_APPROVAL', description: 'Every agent write action must result in a pull request.', icon: Eye },
  { key: 'no_autonomous_merge', name: 'No Autonomous Merge', decision: 'DENY', description: 'Agents cannot merge pull requests without approval.', icon: Lock },
  { key: 'ci_required_before_merge', name: 'CI Required Before Merge', decision: 'DENY', description: 'Merge attempts are blocked if CI checks have not passed.', icon: Zap },
  { key: 'repo_allowlist', name: 'Repo Allowlist', decision: 'DENY', description: 'Agents can only write to approved repositories.', icon: Shield },
  { key: 'sensitive_path_approval', name: 'Sensitive Path Approval', decision: 'REQUIRE_APPROVAL', description: 'Changes to CI/CD, infrastructure, and auth paths require approval.', icon: AlertTriangle },
  { key: 'secret_detection', name: 'Secret Detection', decision: 'DENY', description: 'Every diff is scanned for API keys, tokens, and credentials.', icon: Lock },
  { key: 'blast_radius_gate', name: 'Blast Radius Gate', decision: 'REQUIRE_APPROVAL', description: 'Large source changes require approval.', icon: Scale },
];

const decodePolicyString = (policyString: string): Record<string, boolean> => {
  const bits = policyString.replace(/[^01]/g, '');
  return Object.fromEntries(
    policies.map((policy, index) => [policy.key, bits[index] === '1'])
  ) as Record<string, boolean>;
};

const encodePolicyString = (activeStates: Record<string, boolean>): string =>
  policies.map((policy) => (activeStates[policy.key] ? '1' : '0')).join('');

export default function PoliciesPage() {
  const { user, isLoading: userLoading } = useUser();

  const defaultPolicyState = useMemo(
    () => Object.fromEntries(policies.map((p) => [p.key, true])) as Record<string, boolean>,
    []
  );

  // state as { policy_key: boolean }
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>(
    defaultPolicyState
  );

  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const togglePolicy = (key: string) => {
    setActiveStates((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeCount = Object.values(activeStates).filter(Boolean).length;

  useEffect(() => {
    const userId = user?.id;
    if (!userId || userLoading) return;

    let isMounted = true;

    const loadPolicies = async () => {
      try {
        const storedPolicyString = await api.getUserPolicy(userId);
        if (!isMounted) return;

        setActiveStates({
          ...defaultPolicyState,
          ...(storedPolicyString ? decodePolicyString(storedPolicyString) : {}),
        });
      } catch (err) {
        console.error('Failed to load user policies', err);
      }
    };

    loadPolicies();

    return () => {
      isMounted = false;
    };
  }, [user?.id, userLoading, defaultPolicyState]);
const handleSave = async () => {
  if (!user?.id) {
    console.warn("No user ID available");
    return;
  }
  try {
    setLoading(true);
    const policyString = encodePolicyString(activeStates);
    console.log("Saving policy:", { userId: user.id, policyString });
    
    await api.upsertUserPolicy(user.id, policyString);
    console.log("Policy saved successfully");
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  } catch (err) {
    console.error('Save failed', err);
  } finally {
    setLoading(false);
  }
};
  return (
    <div className="min-h-screen">
      <Topbar title="Policies" subtitle="Rules that evaluate every agent action" />

      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {activeCount} of {policies.length} policies active
          </div>

          {/* ✅ SAVE BUTTON */}
          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="text-sm text-green-500 font-medium">Saved successfully!</span>
            )}
            <button
              onClick={handleSave}
              disabled={loading || userLoading || !user?.id}
              className="rounded-md bg-foreground px-4 py-2 text-sm text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {policies.map((policy) => {
            const Icon = policy.icon;
            const isActive = activeStates[policy.key];

            return (
              <div
                key={policy.key}
                className={`rounded-md border border-border bg-card p-4 ${!isActive && 'opacity-50'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <h3 className="text-sm font-medium text-foreground">{policy.name}</h3>
                      <DecisionBadge decision={policy.decision} size="sm" />
                    </div>
                  </div>

                  {/* TOGGLE */}
                  <button
                    onClick={() => togglePolicy(policy.key)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      isActive ? 'bg-foreground/80' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                        isActive ? 'translate-x-4' : ''
                      }`}
                    />
                  </button>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {policy.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="mt-6 rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-foreground">Custom Policy Configuration</h3>
              <p className="text-xs text-muted-foreground">
                Contact us to customize policies for your organization.
              </p>
            </div>
            <a
              href="mailto:deals@runaegis.com"
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}