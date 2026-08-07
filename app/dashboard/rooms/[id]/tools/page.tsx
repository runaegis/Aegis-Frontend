'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Lock, RotateCcw, Save, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { markSetupStepDone } from '@/components/ui/SetupChecklist';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { fadeUp, staggerContainer } from '@/lib/motion';
import { useRoom } from '@/lib/roomContext';
import type { RoomRolesResponse, RoomToolConnector } from '@/lib/types';

function sortRoleEntries(roles: RoomRolesResponse['roles']) {
  return Object.entries(roles).sort((a, b) => Number(a[0]) - Number(b[0]));
}

export default function RoomToolsPage() {
  const { roomId, role, loading: roomLoading } = useRoom();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [roles, setRoles] = useState<RoomRolesResponse['roles']>({});
  const [connectors, setConnectors] = useState<RoomToolConnector[]>([]);
  const [activeConnectorKey, setActiveConnectorKey] = useState('');
  const [viewingRank, setViewingRank] = useState(1);
  const [serverTools, setServerTools] = useState<Record<string, boolean>>({});
  const [draftTools, setDraftTools] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingTools, setLoadingTools] = useState(false);
  const [saving, setSaving] = useState(false);

  const canEdit = role === 'OWNER';

  const loadMatrix = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const [matrix, roleResponse] = await Promise.all([
        api.getRoomTools(roomId),
        api.getRoomRoles(roomId),
      ]);
      setConnectors(matrix.connectors);
      setRoles(roleResponse.roles);
      setViewingRank(matrix.role_rank ?? 1);
      setActiveConnectorKey((current) => {
        if (current && matrix.connectors.some((connector) => connector.connector_key === current)) {
          return current;
        }
        return (
          matrix.connectors.find((connector) => connector.tool_groups.length > 0)?.connector_key ??
          matrix.connectors[0]?.connector_key ??
          ''
        );
      });
    } catch (err) {
      toast.error("Couldn't load room tools", {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [roomId, toast]);

  useEffect(() => {
    void loadMatrix();
  }, [loadMatrix]);

  const activeConnector = useMemo(
    () => connectors.find((connector) => connector.connector_key === activeConnectorKey) ?? null,
    [activeConnectorKey, connectors],
  );

  const loadConnectorTools = useCallback(async () => {
    if (!roomId || !activeConnector || activeConnector.tool_groups.length === 0) {
      setServerTools({});
      setDraftTools({});
      return;
    }
    setLoadingTools(true);
    try {
      const response = await api.getRoomConnectorRankTools(
        roomId,
        activeConnector.connector_key,
        viewingRank,
      );
      setServerTools(response);
      setDraftTools(response);
    } catch (err) {
      toast.error("Couldn't load connector allowlist", {
        description: err instanceof Error ? err.message : 'Try again.',
      });
      setServerTools({});
      setDraftTools({});
    } finally {
      setLoadingTools(false);
    }
  }, [activeConnector, roomId, toast, viewingRank]);

  useEffect(() => {
    void loadConnectorTools();
  }, [loadConnectorTools]);

  const dirtyKeys = useMemo(() => {
    return Object.keys({ ...serverTools, ...draftTools }).filter(
      (tool) => Boolean(serverTools[tool]) !== Boolean(draftTools[tool]),
    );
  }, [draftTools, serverTools]);
  const dirty = dirtyKeys.length > 0;

  const ready = Boolean(activeConnector?.configured) && Boolean(activeConnector?.private_credentials_configured);

  const changeConnector = (connectorKey: string) => {
    if (dirty) {
      toast.error('Save or reset your changes first');
      return;
    }
    setActiveConnectorKey(connectorKey);
  };

  const changeRank = (rank: number) => {
    if (dirty) {
      toast.error('Save or reset your changes first');
      return;
    }
    setViewingRank(rank);
  };

  const resetDraft = () => setDraftTools(serverTools);

  const save = async () => {
    if (!activeConnector || !canEdit || !dirty) return;
    setSaving(true);
    try {
      const next = await api.updateRoomConnectorRankTools(
        roomId,
        activeConnector.connector_key,
        viewingRank,
        draftTools,
      );
      setServerTools(next);
      setDraftTools(next);
      markSetupStepDone(roomId, 'tools');
      toast.success('Tool allowlist updated');
      await loadMatrix();
    } catch (err) {
      toast.error('Could not update allowlist', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (roomLoading || loading) {
    return (
      <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
        <Skeleton className="h-[280px] w-full rounded-[12px]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-24 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
      <motion.div
        variants={staggerContainer(0.06)}
        initial={reduce ? false : 'hidden'}
        animate="show"
        className="space-y-6"
      >
        <motion.div variants={fadeUp} className="space-y-2">
          <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-[var(--neutral-strong-950)]">
            Tool allowlists
          </h2>
          <p className="text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
            Pick which tools each room role can use, connector by connector.
          </p>
        </motion.div>

        <motion.div variants={fadeUp} className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {connectors.map((connector) => {
            const active = connector.connector_key === activeConnectorKey;
            return (
              <button
                key={connector.connector_key}
                type="button"
                onClick={() => changeConnector(connector.connector_key)}
                className={`rounded-[12px] border p-4 text-left shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-colors ${
                  active
                    ? 'border-[var(--primary-base)] bg-[var(--primary-alpha-10)]/40'
                    : 'border-[var(--stroke-soft-200)] bg-white hover:border-[var(--stroke-sub-300)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                      {connector.display_name}
                    </p>
                    <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                      {connector.description}
                    </p>
                  </div>
                  <Badge tone={connector.tool_groups.length > 0 ? 'success' : 'neutral'}>
                    {connector.tool_groups.length > 0 ? 'Ready' : 'Waiting'}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={connector.configured ? 'success' : 'warning'} leadingDot>
                    {connector.configured ? 'Shared config ready' : 'Shared config missing'}
                  </Badge>
                  <Badge tone={connector.private_credentials_configured ? 'info' : 'neutral'} leadingDot>
                    {connector.private_credentials_configured ? 'Private creds ready' : 'Private creds missing'}
                  </Badge>
                </div>
              </button>
            );
          })}
        </motion.div>

        {activeConnector && (
          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[var(--primary-base)]" strokeWidth={2} />
                  <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                    {activeConnector.display_name}
                  </h3>
                </div>
                <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                  {ready
                    ? 'This connector is ready. Tune the room allowlist per role below.'
                    : 'Tool groups appear only after the room connector and your private credentials are both configured.'}
                </p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-0.5">
                {sortRoleEntries(roles).map(([rank, label]) => {
                  const numericRank = Number(rank);
                  const active = numericRank === viewingRank;
                  return (
                    <button
                      key={rank}
                      type="button"
                      onClick={() => changeRank(numericRank)}
                      className={`rounded-[6px] px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${
                        active
                          ? 'bg-white text-[var(--neutral-strong-950)] shadow-[var(--shadow-regular-xs)]'
                          : 'text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {!canEdit && (
              <div className="border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-5 py-3">
                <div className="flex items-center gap-2 text-[12px] text-[var(--neutral-sub-600)]">
                  <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                  Owners edit connector allowlists. Everyone else can inspect them.
                </div>
              </div>
            )}

            {!ready ? (
              <div className="space-y-3 px-5 py-5">
                <p className="text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
                  Finish connector setup in the room Connectors tab, then come back here to shape the allowlist for each role.
                </p>
                <Link href={`/dashboard/rooms/${roomId}/connectors`}>
                  <Button
                    variant="secondary"
                    size="sm"
                    trailingIcon={<ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />}
                  >
                    Open connectors setup
                  </Button>
                </Link>
              </div>
            ) : loadingTools ? (
              <div className="space-y-3 p-5">
                {[0, 1].map((index) => (
                  <Skeleton key={index} className="h-[88px] w-full rounded-[10px]" />
                ))}
              </div>
            ) : (
              <div className="space-y-4 px-5 py-5">
                {activeConnector.tool_groups.map((group) => (
                  <div
                    key={group.key}
                    className="overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)]"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-3">
                      <p className="text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">
                        {group.label}
                      </p>
                      <Badge tone="info">
                        {group.tools.filter((tool) => draftTools[tool]).length} / {group.tools.length}
                      </Badge>
                    </div>
                    <ul className="divide-y divide-[var(--stroke-soft-200)]">
                      {group.tools.map((tool) => (
                        <li
                          key={tool}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <code className="min-w-0 truncate text-[12px] text-[var(--neutral-strong-950)] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                            {tool}
                          </code>
                          <Switch
                            checked={Boolean(draftTools[tool])}
                            disabled={!canEdit || saving}
                            onChange={(checked) =>
                              setDraftTools((current) => ({ ...current, [tool]: checked }))
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </motion.section>
        )}
      </motion.div>

      {dirty && canEdit && ready && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className="pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2"
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-[12px] border border-[var(--stroke-soft-200)] bg-white px-3 py-2 shadow-[0_12px_32px_rgba(23,23,23,0.12),0_2px_8px_rgba(23,23,23,0.04)]">
            <span className="inline-flex h-6 items-center rounded-[6px] bg-[var(--primary-alpha-10)] px-2 text-[11.5px] font-semibold text-[var(--primary-base)]">
              {dirtyKeys.length} unsaved
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={resetDraft}
              disabled={saving}
              leadingIcon={<RotateCcw className="h-3 w-3" strokeWidth={2} />}
            >
              Reset
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={save}
              disabled={saving}
              leadingIcon={<Save className="h-3 w-3" strokeWidth={2.25} />}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
