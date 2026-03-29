'use client';

import { useState } from 'react';
import { Mail, Shield, Lock, GitBranch, Clock, Eye, FileCode, Zap, AlertTriangle, Scale } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import DecisionBadge from '@/components/ui/DecisionBadge';

const policies = [
  {
    name: 'Protected Branch Denial',
    decision: 'REWRITE',
    description: 'Direct writes to main, master, and release branches are redirected to a safe PR workflow automatically.',
    icon: GitBranch,
  },
  {
    name: 'Freeze Window Enforcement',
    decision: 'DENY',
    description: 'Write actions during configured release freeze windows are blocked with an emergency override path.',
    icon: Clock,
  },
  {
    name: 'Aegis Branch Naming',
    decision: 'DENY',
    description: 'All agent-created branches must follow the aegis/{session_id}/{task} naming convention.',
    icon: FileCode,
  },
  {
    name: 'Mandatory PR Flow',
    decision: 'REQUIRE_APPROVAL',
    description: 'Every agent write action must result in a pull request. No direct merges without review.',
    icon: Eye,
  },
  {
    name: 'No Autonomous Merge',
    decision: 'DENY',
    description: 'Agents cannot merge pull requests without explicit policy permission or human approval.',
    icon: Lock,
  },
  {
    name: 'CI Required Before Merge',
    decision: 'DENY',
    description: 'Merge attempts are blocked if required CI checks have not passed.',
    icon: Zap,
  },
  {
    name: 'Repo Allowlist',
    decision: 'DENY',
    description: 'Agents can only write to explicitly approved repositories. All others are blocked.',
    icon: Shield,
  },
  {
    name: 'Sensitive Path Approval',
    decision: 'REQUIRE_APPROVAL',
    description: 'Changes to CI/CD, infrastructure, auth, and security paths require human approval.',
    icon: AlertTriangle,
  },
  {
    name: 'Secret Detection',
    decision: 'DENY',
    description: 'Every diff is scanned for API keys, tokens, and credentials. Hard block before policy evaluation.',
    icon: Lock,
  },
  {
    name: 'Blast Radius Gate',
    decision: 'REQUIRE_APPROVAL',
    description: 'Large source changes require approval. Test-only diffs are automatically approved regardless of size.',
    icon: Scale,
  },
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
      <Topbar title="Policies" subtitle="These policies evaluate every agent action before it executes." />
      <div className="p-8">
        {/* Stats */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-muted px-4 py-3">
            <Shield className="h-5 w-5 text-success" />
            <div>
              <span className="text-xl font-semibold text-foreground">{activeCount}</span>
              <span className="ml-2 text-sm text-muted-foreground">active policies</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <span className="text-xl font-semibold text-foreground">{policies.length - activeCount}</span>
            <span className="text-sm text-muted-foreground">inactive</span>
          </div>
        </div>

        {/* Policies Grid */}
        <div className="grid grid-cols-2 gap-4">
          {policies.map((policy, i) => {
            const Icon = policy.icon;
            return (
              <div
                key={i}
                className={`group overflow-hidden rounded-xl border bg-card p-6 transition-all ${
                  activeStates[i] 
                    ? 'border-border hover:border-border-hover' 
                    : 'border-border/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      activeStates[i] ? 'bg-muted' : 'bg-muted/50'
                    }`}>
                      <Icon className={`h-5 w-5 ${activeStates[i] ? 'text-foreground' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{policy.name}</h3>
                      <div className="mt-1">
                        <DecisionBadge decision={policy.decision} size="sm" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Toggle */}
                  <button
                    onClick={() => togglePolicy(i)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      activeStates[i] ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                        activeStates[i] ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {policy.description}
                </p>
                
                <div className="mt-4 flex items-center justify-between">
                  <span className={`text-xs font-medium ${
                    activeStates[i] ? 'text-success' : 'text-muted-foreground'
                  }`}>
                    {activeStates[i] ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact Banner */}
        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">Custom Policy Configuration</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Policy configuration UI coming in v1.1. Contact us to customise policies for your organisation.
              </p>
            </div>
            <a 
              href="mailto:deals@runaegis.com" 
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
