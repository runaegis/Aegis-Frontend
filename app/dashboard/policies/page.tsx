'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpRight,
  BookOpen,
  Boxes,
  Shield,
  Users,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { PoliciesSkeleton } from '@/components/ui/PageSkeletons';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { api } from '@/lib/api';
import { fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';
import type { ConnectorCatalogItem, RoomSummary } from '@/lib/types';
import {
  getRoomCreatedAt,
  getRoomDisplayName,
  getRoomRoleLabel,
  getRoomRoleBadgeTone,
  getRoomSlug,
} from '@/lib/utils';

function getRoomId(room: RoomSummary): string {
  return String(room.id || room.room_id || '');
}

function getRoomTypeLabel(roomType?: string | null): string {
  return roomType === 'personal' ? 'Personal' : 'Shared';
}

export default function PoliciesPage() {
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [catalog, setCatalog] = useState<ConnectorCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      if (!userLoading) {
        setRooms([]);
        setCatalog([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const [roomItems, connectorCatalog] = await Promise.all([
        api.getMyRooms(),
        api.getConnectorCatalog(),
      ]);
      setRooms(roomItems);
      setCatalog(connectorCatalog);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load policy configuration surfaces.',
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id, userLoading]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 60000);

  const activeConnectorCount = useMemo(
    () => catalog.filter((item) => item.is_active !== false).length,
    [catalog],
  );

  if (userLoading || (loading && rooms.length === 0 && catalog.length === 0)) {
    return (
      <>
        <Topbar title="Policies" subtitle="Room connector rules" />
        <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <PoliciesSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Policies"
        subtitle="Room connector rules"
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
      />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}

        <motion.div
          className="space-y-6"
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
        >
          <motion.header variants={fadeUp}>
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]">
              Governance
            </p>
            <h1 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]">
              Policies now live on room connectors
            </h1>
            <p className="mt-2 max-w-[720px] text-[13.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
              The legacy global policy string is gone. Configure Allow, Deny, and Require Approval
              rules per connector inside each room.
            </p>
          </motion.header>

          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="grid grid-cols-1 divide-y divide-[var(--stroke-soft-200)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <MetricCell label="Governed rooms" value={rooms.length} />
              <MetricCell label="Active connectors" value={activeConnectorCount} />
              <MetricCell label="How it works" value="Room → Connector → Policy" copyTone="feature" />
            </div>
          </motion.section>

          <motion.section
            variants={fadeUp}
            className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-5 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--primary-lighter)] text-[var(--primary-base)]">
                    <BookOpen className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <h2 className="text-[15px] font-semibold text-[var(--neutral-strong-950)]">
                    Configure policies from the connector tab
                  </h2>
                </div>
                <p className="max-w-[720px] text-[12.5px] leading-[1.6] text-[var(--neutral-sub-600)]">
                  Pick a room, open its Connectors tab, choose a configured connector, then tune its
                  policy rules and approval rank requirements.
                </p>
              </div>
              <Link href="/dashboard/rooms">
                <Button variant="secondary" leadingIcon={<Users className="h-3.5 w-3.5" strokeWidth={2} />}>
                  Open rooms
                </Button>
              </Link>
            </div>
          </motion.section>

          {rooms.length === 0 ? (
            <motion.div variants={fadeUp} className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              <EmptyState
                icon={<Shield className="h-5 w-5" />}
                title="No rooms to configure yet"
                description="Create a room first, then attach connectors and define policies for each integration."
                action={
                  <Link href="/dashboard/rooms">
                    <Button variant="primary">Create a room</Button>
                  </Link>
                }
              />
            </motion.div>
          ) : (
            <motion.ul
              variants={staggerContainer(0.03, 0.18)}
              initial={reduce ? false : 'hidden'}
              animate="show"
              className="space-y-3"
            >
              {rooms.map((room) => {
                const roomId = getRoomId(room);
                const createdAt = getRoomCreatedAt(room);
                const roomHref = `/dashboard/rooms/${roomId}`;
                const connectorHref = `${roomHref}/connectors`;

                return (
                  <motion.li
                    key={roomId}
                    variants={fadeUpSm}
                    className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-colors hover:border-[var(--stroke-sub-300)]"
                  >
                    <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-[15px] font-semibold text-[var(--neutral-strong-950)]">
                            {getRoomDisplayName(room)}
                          </h2>
                          <Badge tone={getRoomRoleBadgeTone(room.role, room.role_rank)} uppercase>
                            {getRoomRoleLabel(room.role, room.role_rank)}
                          </Badge>
                          <Badge tone="neutral">{getRoomTypeLabel(room.room_type)}</Badge>
                        </div>
                        <p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
                          {room.description?.trim() || 'Configure connector rules, approval ranks, and room-specific safety rails.'}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--neutral-soft-400)]">
                          <span className="inline-flex items-center gap-1">
                            <Boxes className="h-3.5 w-3.5" strokeWidth={2} />
                            {activeConnectorCount.toLocaleString()} catalog connectors available
                          </span>
                          {createdAt && (
                            <>
                              <span className="text-[var(--stroke-sub-300)]">·</span>
                              <span>
                                Created <RelativeTime timestamp={createdAt} />
                              </span>
                            </>
                          )}
                          {room.owner_username && (
                            <>
                              <span className="text-[var(--stroke-sub-300)]">·</span>
                              <span>Owner {room.owner_username}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={roomHref}>
                          <Button variant="secondary">Open room</Button>
                        </Link>
                        <Link href={connectorHref}>
                          <Button
                            variant="primary"
                            trailingIcon={<ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />}
                          >
                            Manage policies
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <div className="border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-5 py-2.5 text-[11.5px] text-[var(--neutral-soft-400)]">
                      Room slug <span className="font-medium text-[var(--neutral-sub-600)]">{getRoomSlug(getRoomDisplayName(room), roomId)}</span>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </motion.div>
      </div>
    </>
  );
}

function MetricCell({
  label,
  value,
  copyTone,
}: {
  label: string;
  value: number | string;
  copyTone?: 'feature';
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      <p
        className="mt-1 text-[24px] font-semibold tracking-[-0.03em]"
        style={{
          color: copyTone === 'feature' ? 'var(--feature)' : 'var(--neutral-strong-950)',
        }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
