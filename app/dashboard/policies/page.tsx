'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import DecisionBadge from '@/components/ui/DecisionBadge';

const policies = [
  {
    name: 'Protected Branch Denial',
    decision: 'REWRITE',
    description:
      'Direct writes to main, master, and release branches are redirected to a safe PR workflow automatically.',
  },
  {
    name: 'Freeze Window Enforcement',
    decision: 'DENY',
    description:
      'Write actions during configured release freeze windows are blocked with an emergency override path.',
  },
  {
    name: 'Aegis Branch Naming',
    decision: 'DENY',
    description:
      'All agent-created branches must follow the aegis/{session_id}/{task} naming convention.',
  },
  {
    name: 'Mandatory PR Flow',
    decision: 'REQUIRE_APPROVAL',
    description:
      'Every agent write action must result in a pull request. No direct merges without review.',
  },
  {
    name: 'No Autonomous Merge',
    decision: 'DENY',
    description:
      'Agents cannot merge pull requests without explicit policy permission or human approval.',
  },
  {
    name: 'CI Required Before Merge',
    decision: 'DENY',
    description:
      'Merge attempts are blocked if required CI checks have not passed.',
  },
  {
    name: 'Repo Allowlist',
    decision: 'DENY',
    description:
      'Agents can only write to explicitly approved repositories. All others are blocked.',
  },
  {
    name: 'Sensitive Path Approval',
    decision: 'REQUIRE_APPROVAL',
    description:
      'Changes to CI/CD, infrastructure, auth, and security paths require human approval.',
  },
  {
    name: 'Secret Detection',
    decision: 'DENY',
    description:
      'Every diff is scanned for API keys, tokens, and credentials. Hard block before policy evaluation.',
  },
  {
    name: 'Blast Radius Gate',
    decision: 'REQUIRE_APPROVAL',
    description:
      'Large source changes require approval. Test-only diffs are automatically approved regardless of size.',
  },
];

export default function PoliciesPage() {
  const [activeStates, setActiveStates] = useState<Record<number, boolean>>(
    Object.fromEntries(policies.map((_, i) => [i, true]))
  );

  const togglePolicy = (index: number) => {
    setActiveStates((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div>
      <Topbar title="Policies" subtitle="These policies evaluate every agent action before it executes." />
      <div className="p-8">
        <div className="grid grid-cols-2 gap-4">
          {policies.map((policy, i) => (
            <div
              key={i}
              className={`rounded-xl border bg-white p-5 transition-opacity ${
                activeStates[i] ? 'border-zinc-200' : 'border-zinc-100 opacity-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <DecisionBadge decision={policy.decision} />
                <h3 className="text-sm font-medium text-zinc-900">{policy.name}</h3>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-zinc-500">{policy.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => togglePolicy(i)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    activeStates[i] ? 'bg-blue-600' : 'bg-zinc-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      activeStates[i] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs text-zinc-400">{activeStates[i] ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-zinc-400" />
            <p className="text-sm text-zinc-500">
              Policy configuration UI coming in v1.1. Contact{' '}
              <a href="mailto:deals@runaegis.com" className="font-medium text-zinc-700 hover:underline">
                deals@runaegis.com
              </a>{' '}
              to customise policies for your organisation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
