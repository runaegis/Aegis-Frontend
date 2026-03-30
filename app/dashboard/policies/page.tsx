'use client';

import { useState } from 'react';
import { Mail, Shield, Lock, GitBranch, Clock, Eye, FileCode, Zap, AlertTriangle, Scale } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import DecisionBadge from '@/components/ui/DecisionBadge';

const policies = [
  { name: 'Protected Branch Denial', decision: 'REWRITE', description: 'Direct writes to main, master, and release branches are redirected to a safe PR workflow.', icon: GitBranch },
  { name: 'Freeze Window Enforcement', decision: 'DENY', description: 'Write actions during release freeze windows are blocked.', icon: Clock },
  { name: 'Aegis Branch Naming', decision: 'DENY', description: 'All agent-created branches must follow the aegis/{session_id}/{task} convention.', icon: FileCode },
  { name: 'Mandatory PR Flow', decision: 'REQUIRE_APPROVAL', description: 'Every agent write action must result in a pull request.', icon: Eye },
  { name: 'No Autonomous Merge', decision: 'DENY', description: 'Agents cannot merge pull requests without approval.', icon: Lock },
  { name: 'CI Required Before Merge', decision: 'DENY', description: 'Merge attempts are blocked if CI checks have not passed.', icon: Zap },
  { name: 'Repo Allowlist', decision: 'DENY', description: 'Agents can only write to approved repositories.', icon: Shield },
  { name: 'Sensitive Path Approval', decision: 'REQUIRE_APPROVAL', description: 'Changes to CI/CD, infrastructure, and auth paths require approval.', icon: AlertTriangle },
  { name: 'Secret Detection', decision: 'DENY', description: 'Every diff is scanned for API keys, tokens, and credentials.', icon: Lock },
  { name: 'Blast Radius Gate', decision: 'REQUIRE_APPROVAL', description: 'Large source changes require approval.', icon: Scale },
];

export default function PoliciesPage() {
  const [activeStates, setActiveStates] = useState<Record<number, boolean>>(
    Object.fromEntries(policies.map((_, i) => [i, true]))
  );

  const togglePolicy = (index: number) => {
    setActiveStates((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const activeCount = Object.values(activeStates).filter(Boolean).length;

  return (
    <div className="min-h-screen">
      <Topbar title="Policies" subtitle="Rules that evaluate every agent action" />
      <div className="p-6">
        <div className="mb-4 text-sm text-muted-foreground">
          {activeCount} of {policies.length} policies active
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {policies.map((policy, i) => {
            const Icon = policy.icon;
            return (
              <div
                key={i}
                className={`rounded-md border border-border bg-card p-4 ${!activeStates[i] && 'opacity-50'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <h3 className="text-sm font-medium text-foreground">{policy.name}</h3>
                      <DecisionBadge decision={policy.decision} size="sm" />
                    </div>
                  </div>
                  <button
                    onClick={() => togglePolicy(i)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${activeStates[i] ? 'bg-foreground/80' : 'bg-muted'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${activeStates[i] ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{policy.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-foreground">Custom Policy Configuration</h3>
              <p className="text-xs text-muted-foreground">Contact us to customize policies for your organization.</p>
            </div>
              <a href="mailto:deals@runaegis.com" className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90">
              Contact Sales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
