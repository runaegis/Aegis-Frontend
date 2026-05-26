'use client';

/**
 * Agents inventory — `/dashboard/agents`.
 *
 * "Who are the agents in your workspace?" — the first new-customer
 * question and the first investor question. Lists every agent we've
 * seen tool calls from, with a snapshot of their footprint:
 *
 *   - Total run count
 *   - Last-seen relative time
 *   - Top 3 most-used tools
 *   - Decision distribution mini-bar (ALLOW / DENY / REWRITE / APPROVAL)
 *
 * DELIBERATELY ABSENT
 *   - No trust score. Backend doesn't persist `semantic_type` /
 *     behavioral baselines yet (Engineering Sprint Board Tickets 1 +
 *     2 + Layer 4 roadmap), so trust would be invented on the
 *     frontend — exactly the kind of "lying about features" we want
 *     to avoid per the demo-vs-real principle. Trust band UI ships
 *     with the v3 mock and lights up on prod once backend is ready.
 *   - No quarantine band, no anomaly counts, no review queue routing.
 *     Same reason.
 *
 * Source data is `useDashboardData().sessionActions` — same data
 * Runs / Sessions / ⌘K palette already use. Empty state when
 * sessionActions is empty.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { Bot, ArrowUpRight, Activity } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { AgentMark } from '@/components/ui/AgentMark';
import EmptyState from '@/components/ui/EmptyState';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { useDashboardData } from '@/lib/dashboardDataContext';
import { useUser } from '@/lib/hooks';
import { fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';
import {
  HOVER_LIFT_HOVER,
  HOVER_LIFT_TAP,
} from '@/components/ui/HoverLift';
import { RoomsSkeleton } from '@/components/ui/PageSkeletons';

interface AgentSummary {
  name: string;
  runCount: number;
  lastSeen: string;
  topTools: string[];
  decisions: {
    allow: number;
    deny: number;
    rewrite: number;
    approval: number;
  };
}

const DECISION_COLORS = {
  allow: 'var(--success)',
  deny: 'var(--error)',
  rewrite: 'var(--primary-base)',
  approval: 'var(--warning-dark)',
} as const;

const DECISION_LABELS = {
  allow: 'ALLOW',
  deny: 'DENY',
  rewrite: 'REWRITE',
  approval: 'APPROVAL',
} as const;

export default function AgentsPage() {
  const { isLoading: userLoading } = useUser();
  const { sessionActions, runsLoading: dataLoading } = useDashboardData();
  const reduce = useReducedMotion();

  const agents: AgentSummary[] = useMemo(() => {
    if (!sessionActions.length) return [];

    const byName = new Map<string, AgentSummary>();

    for (const action of sessionActions) {
      const name = action.agent_name || 'unknown';
      let agent = byName.get(name);
      if (!agent) {
        agent = {
          name,
          runCount: 0,
          lastSeen: action.timestamp,
          topTools: [],
          decisions: { allow: 0, deny: 0, rewrite: 0, approval: 0 },
        };
        byName.set(name, agent);
      }

      agent.runCount += 1;
      if (
        new Date(action.timestamp).getTime() >
        new Date(agent.lastSeen).getTime()
      ) {
        agent.lastSeen = action.timestamp;
      }

      // Decision bucketing — case-insensitive + tolerant of v1's
      // historical 'cd' (REWRITE) abbreviation in the union type.
      const decision = (action.decision || '').toUpperCase();
      if (decision === 'ALLOW') agent.decisions.allow += 1;
      else if (decision === 'DENY') agent.decisions.deny += 1;
      else if (decision === 'REWRITE' || decision === 'CD')
        agent.decisions.rewrite += 1;
      else if (decision === 'REQUIRE_APPROVAL')
        agent.decisions.approval += 1;
    }

    // Top tools per agent — count tool_name occurrences, take top 3.
    for (const action of sessionActions) {
      const agent = byName.get(action.agent_name || 'unknown');
      if (!agent) continue;
      // Track once per agent in a temp scope outside the loop. Simpler
      // to do a second pass with a per-agent map.
    }

    for (const agent of byName.values()) {
      const toolCounts = new Map<string, number>();
      for (const action of sessionActions) {
        if (action.agent_name !== agent.name) continue;
        const tool = action.tool_name || 'unknown';
        toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1);
      }
      agent.topTools = Array.from(toolCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tool]) => tool);
    }

    // Sort by run count desc — most-active agents first.
    return Array.from(byName.values()).sort(
      (a, b) => b.runCount - a.runCount,
    );
  }, [sessionActions]);

  if (userLoading || dataLoading) {
    return (
      <>
        <Topbar title="Agents" subtitle="Every agent active in your workspace" />
        <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <RoomsSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Agents"
        subtitle={`${agents.length} ${agents.length === 1 ? 'agent' : 'agents'} active in your workspace`}
      />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {agents.length === 0 ? (
          <EmptyState
            icon={<Bot className="h-5 w-5" strokeWidth={2} />}
            title="No agents yet"
            description="Once your AI agents start making calls through Aegis, they'll appear here with their footprint and recent activity."
          />
        ) : (
          <motion.div
            variants={staggerContainer(0.04)}
            initial={reduce ? false : 'hidden'}
            animate="show"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {agents.map((agent) => (
              <motion.div
                key={agent.name}
                variants={fadeUpSm}
                whileHover={HOVER_LIFT_HOVER}
                whileTap={HOVER_LIFT_TAP}
              >
                <Link
                  href={`/dashboard/runs?agent=${encodeURIComponent(agent.name)}`}
                  className="group flex h-full flex-col gap-3 rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-[box-shadow,border-color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:border-[var(--primary-base)]/30 hover:shadow-[0_8px_24px_rgba(23,23,23,0.06)]"
                >
                  {/* Identity row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AgentMark name={agent.name} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                          {agent.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--neutral-soft-400)]">
                          Last seen <RelativeTime timestamp={agent.lastSeen} />
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)] transition-colors group-hover:text-[var(--primary-base)]"
                      strokeWidth={2}
                    />
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                    <div>
                      <p className="font-mono uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
                        Runs
                      </p>
                      <p className="mt-0.5 font-semibold tabular-nums text-[var(--neutral-strong-950)]">
                        {agent.runCount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
                        Top tool
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--neutral-strong-950)]">
                        {agent.topTools[0] ?? '—'}
                      </p>
                    </div>
                  </div>

                  {/* Decision distribution — mini stacked bar.
                      Renders only when at least one decision is
                      counted; otherwise the bar is empty so we hide
                      it rather than show a flat gray line. */}
                  {agent.runCount > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex h-1.5 w-full items-stretch gap-[1px] overflow-hidden rounded-[2px]">
                        {(['allow', 'deny', 'rewrite', 'approval'] as const).map(
                          (key) => {
                            const value = agent.decisions[key];
                            if (value === 0) return null;
                            const pct = (value / agent.runCount) * 100;
                            return (
                              <span
                                key={key}
                                className="block"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: DECISION_COLORS[key],
                                }}
                                title={`${DECISION_LABELS[key]} · ${value}`}
                              />
                            );
                          },
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-[var(--neutral-soft-400)]">
                        {(['allow', 'deny', 'rewrite', 'approval'] as const)
                          .filter((key) => agent.decisions[key] > 0)
                          .map((key) => (
                            <span key={key} className="inline-flex items-center gap-1">
                              <span
                                aria-hidden
                                className="inline-block h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: DECISION_COLORS[key] }}
                              />
                              <span>
                                {DECISION_LABELS[key].toLowerCase()}{' '}
                                <span className="text-[var(--neutral-sub-600)]">
                                  {agent.decisions[key]}
                                </span>
                              </span>
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </>
  );
}
