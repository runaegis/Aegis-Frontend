'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  CheckCircle2,
  KeyRound,
  Link2,
  Lock,
  Plug,
  Save,
  Settings2,
  Shield,
  Slash,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ConnectorCredentialsModal } from '@/components/connectors/ConnectorCredentialsModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Select } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { fadeUp, staggerContainer } from '@/lib/motion';
import { useRoom } from '@/lib/roomContext';
import type {
  ConnectorCatalogItem,
  PrivateConnectorCredentialStatus,
  RoomConnectorConfig,
  RoomConnectorPoliciesResponse,
  RoomRolesResponse,
} from '@/lib/types';

type PublicField = {
  key: string;
  label: string;
  description: string | null;
  required: boolean;
  inputType: 'text' | 'url' | 'number';
  rawType?: string;
};

type PolicyDraft = {
  effect: string;
  minimum_role_rank_required: number;
  is_enabled: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parsePublicFields(item: ConnectorCatalogItem | null): PublicField[] {
  const schema = asRecord(item?.public_config_schema);
  const properties = asRecord(schema?.properties);
  const required = Array.isArray(schema?.required)
    ? schema.required.filter((value): value is string => typeof value === 'string')
    : [];

  if (!properties) return [];

  return Object.entries(properties)
    .map(([key, value]) => {
      const prop = asRecord(value);
      const rawType = typeof prop?.type === 'string' ? prop.type : 'string';
      return {
        key,
        label:
          (typeof prop?.title === 'string' && prop.title.trim()) ||
          key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
        description:
          typeof prop?.description === 'string' ? prop.description : null,
        required: required.includes(key),
        rawType,
        inputType:
          rawType === 'integer' || rawType === 'number'
            ? 'number'
            : key.toLowerCase().includes('url')
              ? 'url'
              : 'text',
      } satisfies PublicField;
    })
    .sort((a, b) => Number(b.required) - Number(a.required) || a.label.localeCompare(b.label));
}

function stringifyFieldValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function coerceFieldValue(rawValue: string, field: PublicField): unknown {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';
  if (field.rawType === 'integer' || field.rawType === 'number') {
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : trimmed;
  }
  if (field.rawType === 'boolean') {
    return trimmed === 'true';
  }
  if (field.rawType === 'array' || field.rawType === 'object') {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function sortRoleEntries(roles: RoomRolesResponse['roles']) {
  return Object.entries(roles).sort((a, b) => Number(a[0]) - Number(b[0]));
}

export default function RoomConnectorsPage() {
  const { roomId, role, loading: roomLoading } = useRoom();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [catalog, setCatalog] = useState<ConnectorCatalogItem[]>([]);
  const [roomConnectors, setRoomConnectors] = useState<Record<string, RoomConnectorConfig>>({});
  const [privateStatus, setPrivateStatus] = useState<Record<string, PrivateConnectorCredentialStatus>>({});
  const [roles, setRoles] = useState<RoomRolesResponse['roles']>({});
  const [loading, setLoading] = useState(true);

  const [activeConnectorKey, setActiveConnectorKey] = useState<string>('');
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [disableTarget, setDisableTarget] = useState<string | null>(null);
  const [credentialsTarget, setCredentialsTarget] = useState<string | null>(null);

  const [policies, setPolicies] = useState<RoomConnectorPoliciesResponse | null>(null);
  const [policyDraft, setPolicyDraft] = useState<Record<string, PolicyDraft>>({});
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [savingPolicies, setSavingPolicies] = useState(false);

  const canManageConnector = role === 'OWNER' || role === 'ADMIN';

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const [catalogItems, roomConfigs, privateCreds, roleResponse] = await Promise.all([
        api.getConnectorCatalog(true),
        api.getRoomConnectorConfigs(roomId),
        api.getPrivateConnectorCredentials(),
        api.getRoomRoles(roomId),
      ]);

      setCatalog(catalogItems);
      setRoomConnectors(Object.fromEntries(roomConfigs.map((item) => [item.connector_key, item])));
      setPrivateStatus(Object.fromEntries(privateCreds.map((item) => [item.connector_key, item])));
      setRoles(roleResponse.roles);
      setActiveConnectorKey((current) => current || catalogItems[0]?.connector_key || '');
    } catch (err) {
      toast.error("Couldn't load room connectors", {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [roomId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCatalogItem = useMemo(
    () => catalog.find((item) => item.connector_key === activeConnectorKey) ?? null,
    [activeConnectorKey, catalog],
  );
  const activeRoomConfig = activeConnectorKey ? roomConnectors[activeConnectorKey] ?? null : null;
  const activePrivateStatus = activeConnectorKey ? privateStatus[activeConnectorKey] ?? null : null;
  const publicFields = useMemo(() => parsePublicFields(activeCatalogItem), [activeCatalogItem]);

  useEffect(() => {
    if (!activeConnectorKey) return;
    const config = roomConnectors[activeConnectorKey];
    const nextValues = Object.fromEntries(
      publicFields.map((field) => [
        field.key,
        stringifyFieldValue(config?.public_config?.[field.key]),
      ]),
    );
    setConfigValues(nextValues);
  }, [activeConnectorKey, publicFields, roomConnectors]);

  const loadPolicies = useCallback(async () => {
    if (!roomId || !activeConnectorKey || !activeRoomConfig?.configured) {
      setPolicies(null);
      setPolicyDraft({});
      return;
    }
    setLoadingPolicies(true);
    try {
      const response = await api.getRoomConnectorPolicies(roomId, activeConnectorKey);
      setPolicies(response);
      setPolicyDraft(
        Object.fromEntries(
          response.policies.map((policy) => [
            policy.policy_key,
            {
              effect: policy.effect ?? 'DENY',
              minimum_role_rank_required: policy.minimum_role_rank_required ?? 1,
              is_enabled: policy.is_enabled ?? true,
            },
          ]),
        ),
      );
    } catch (err) {
      toast.error("Couldn't load connector policies", {
        description: err instanceof Error ? err.message : 'Try again.',
      });
      setPolicies(null);
      setPolicyDraft({});
    } finally {
      setLoadingPolicies(false);
    }
  }, [activeConnectorKey, activeRoomConfig?.configured, roomId, toast]);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  const configDirty = useMemo(() => {
    if (!activeRoomConfig) {
      return publicFields.some((field) => (configValues[field.key] ?? '').trim().length > 0);
    }
    return publicFields.some(
      (field) =>
        stringifyFieldValue(activeRoomConfig.public_config?.[field.key]) !==
        (configValues[field.key] ?? ''),
    );
  }, [activeRoomConfig, configValues, publicFields]);

  const policyDirty = useMemo(() => {
    const source = Object.fromEntries(
      (policies?.policies ?? []).map((policy) => [
        policy.policy_key,
        {
          effect: policy.effect ?? 'DENY',
          minimum_role_rank_required: policy.minimum_role_rank_required ?? 1,
          is_enabled: policy.is_enabled ?? true,
        },
      ]),
    );
    return JSON.stringify(source) !== JSON.stringify(policyDraft);
  }, [policies?.policies, policyDraft]);

  const saveConfig = async () => {
    if (!activeConnectorKey || !canManageConnector) return;
    const payload = Object.fromEntries(
      publicFields
        .map((field) => [field.key, coerceFieldValue(configValues[field.key] ?? '', field)] as const)
        .filter((entry) => {
          const value = entry[1];
          if (typeof value === 'string') return value.trim().length > 0;
          return value !== '' && value != null;
        }),
    );

    const missing = publicFields.filter(
      (field) => field.required && !String(payload[field.key] ?? '').trim(),
    );
    if (missing.length > 0) {
      toast.error('Missing required fields', {
        description: missing.map((field) => field.label).join(', '),
      });
      return;
    }

    setSavingConfig(true);
    try {
      const updated = await api.saveRoomConnectorConfig(roomId, activeConnectorKey, payload);
      setRoomConnectors((current) => ({ ...current, [updated.connector_key]: updated }));
      toast.success('Shared connector config saved');
      await loadPolicies();
    } catch (err) {
      toast.error('Could not save connector config', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const savePolicies = async () => {
    if (!activeConnectorKey || !policies?.can_manage || !policyDirty) return;
    setSavingPolicies(true);
    try {
      const response = await api.updateRoomConnectorPolicies(
        roomId,
        activeConnectorKey,
        policyDraft,
      );
      setPolicies(response);
      setPolicyDraft(
        Object.fromEntries(
          response.policies.map((policy) => [
            policy.policy_key,
            {
              effect: policy.effect ?? 'DENY',
              minimum_role_rank_required: policy.minimum_role_rank_required ?? 1,
              is_enabled: policy.is_enabled ?? true,
            },
          ]),
        ),
      );
      toast.success('Connector policies updated');
    } catch (err) {
      toast.error('Could not update policies', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setSavingPolicies(false);
    }
  };

  if (roomLoading || loading) {
    return (
      <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
        <Skeleton className="h-[320px] w-full rounded-[12px]" />
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
            Room connectors
          </h2>
          <p className="text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
            Shared room config lives here. Private credentials stay user-scoped and are checked per member.
          </p>
        </motion.div>

        <motion.div variants={fadeUp} className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {catalog.map((item) => {
            const configured = Boolean(roomConnectors[item.connector_key]?.configured);
            const personalReady = Boolean(privateStatus[item.connector_key]?.configured);
            const active = item.connector_key === activeConnectorKey;

            return (
              <button
                key={item.connector_key}
                type="button"
                onClick={() => setActiveConnectorKey(item.connector_key)}
                className={`rounded-[12px] border p-4 text-left shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-colors ${
                  active
                    ? 'border-[var(--primary-base)] bg-[var(--primary-alpha-10)]/40'
                    : 'border-[var(--stroke-soft-200)] bg-white hover:border-[var(--stroke-sub-300)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                      {item.display_name}
                    </p>
                    <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                      {item.description}
                    </p>
                  </div>
                  {configured ? <Badge tone="success">Configured</Badge> : <Badge tone="neutral">Setup needed</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={configured ? 'success' : 'warning'} leadingDot>
                    {configured ? 'Shared config ready' : 'Shared config missing'}
                  </Badge>
                  <Badge tone={personalReady ? 'info' : 'neutral'} leadingDot>
                    {personalReady ? 'Private creds ready' : 'Private creds missing'}
                  </Badge>
                </div>
              </button>
            );
          })}
        </motion.div>

        {activeCatalogItem && (
          <motion.div
            variants={fadeUp}
            className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]"
          >
            <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-[var(--primary-base)]" strokeWidth={2} />
                    <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                      Shared room config
                    </h3>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                    This is the resource every member in the room targets for {activeCatalogItem.display_name}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {activeRoomConfig?.configured && canManageConnector && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDisableTarget(activeCatalogItem.connector_key)}
                      leadingIcon={<Slash className="h-3.5 w-3.5" strokeWidth={2} />}
                    >
                      Disable
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={saveConfig}
                    disabled={!canManageConnector || !configDirty || savingConfig}
                    leadingIcon={<Save className="h-3.5 w-3.5" strokeWidth={2.25} />}
                  >
                    {savingConfig ? 'Saving…' : activeRoomConfig?.configured ? 'Save changes' : 'Save config'}
                  </Button>
                </div>
              </div>

              <div className="space-y-4 px-5 py-4">
                {publicFields.length === 0 ? (
                  <p className="text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
                    This connector has no public room-scoped fields yet.
                  </p>
                ) : (
                  publicFields.map((field) => (
                    <div key={field.key}>
                      <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                        {field.label}
                        {field.required && <span className="ml-1 normal-case">(required)</span>}
                      </label>
                      <Input
                        type={field.inputType}
                        value={configValues[field.key] ?? ''}
                        onChange={(event) =>
                          setConfigValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        disabled={!canManageConnector}
                      />
                      {field.description && (
                        <p className="mt-1.5 text-[11.5px] leading-[1.5] text-[var(--neutral-soft-400)]">
                          {field.description}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <div className="space-y-6">
              <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                <div className="border-b border-[var(--stroke-soft-200)] px-5 py-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-[var(--primary-base)]" strokeWidth={2} />
                    <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                      Private credentials
                    </h3>
                  </div>
                </div>
                <div className="space-y-3 px-5 py-4">
                  <div className="rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-3">
                    <div className="flex items-start gap-2.5">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--neutral-soft-400)]" strokeWidth={2} />
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">
                          User-scoped by design
                        </p>
                        <p className="mt-0.5 text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
                          Shared room config does not replace personal credentials. Each member still brings their own secret.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {activePrivateStatus?.configured ? (
                      <Badge tone="success" leadingIcon={<CheckCircle2 className="h-3 w-3" strokeWidth={2.25} />}>
                        Your credentials are ready
                      </Badge>
                    ) : (
                      <Badge tone="warning" leadingDot>
                        Your credentials are missing
                      </Badge>
                    )}
                  </div>

                  <Button
                    variant="secondary"
                    onClick={() => setCredentialsTarget(activeCatalogItem.connector_key)}
                    leadingIcon={<Plug className="h-3.5 w-3.5" strokeWidth={2} />}
                  >
                    {activePrivateStatus?.configured ? 'Update my credentials' : 'Add my credentials'}
                  </Button>
                </div>
              </section>

              <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-[var(--primary-base)]" strokeWidth={2} />
                      <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                        Policy actions
                      </h3>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                      Choose what happens when this connector hits a policy boundary.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={savePolicies}
                    disabled={!policies?.can_manage || !policyDirty || savingPolicies}
                    leadingIcon={<Save className="h-3.5 w-3.5" strokeWidth={2.25} />}
                  >
                    {savingPolicies ? 'Saving…' : 'Save policies'}
                  </Button>
                </div>

                <div className="px-5 py-4">
                  {!activeRoomConfig?.configured ? (
                    <p className="text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
                      Save the shared room config first. Policy actions unlock once the connector is enabled for the room.
                    </p>
                  ) : loadingPolicies ? (
                    <div className="space-y-2">
                      {[0, 1].map((index) => (
                        <Skeleton key={index} className="h-[72px] w-full rounded-[10px]" />
                      ))}
                    </div>
                  ) : (policies?.policies.length ?? 0) === 0 ? (
                    <p className="text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
                      This connector does not publish room policy rules yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {policies?.policies.map((policy) => {
                        const draft = policyDraft[policy.policy_key] ?? {
                          effect: policy.effect ?? 'DENY',
                          minimum_role_rank_required: policy.minimum_role_rank_required ?? 1,
                          is_enabled: policy.is_enabled ?? true,
                        };

                        return (
                          <div
                            key={policy.policy_key}
                            className="rounded-[10px] border border-[var(--stroke-soft-200)] px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">
                                  {policy.display_name ?? policy.policy_key}
                                </p>
                                {policy.description && (
                                  <p className="mt-0.5 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                                    {policy.description}
                                  </p>
                                )}
                              </div>
                              <Switch
                                checked={draft.is_enabled}
                                onChange={(checked) =>
                                  setPolicyDraft((current) => ({
                                    ...current,
                                    [policy.policy_key]: {
                                      ...draft,
                                      is_enabled: checked,
                                    },
                                  }))
                                }
                                disabled={!policies.can_manage}
                              />
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                                  Effect
                                </label>
                                <Select
                                  value={draft.effect}
                                  disabled={!policies.can_manage}
                                  onChange={(event) =>
                                    setPolicyDraft((current) => ({
                                      ...current,
                                      [policy.policy_key]: {
                                        ...draft,
                                        effect: event.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="ALLOW">Allow</option>
                                  <option value="REQUIRE_APPROVAL">Require approval</option>
                                  <option value="DENY">Deny</option>
                                </Select>
                              </div>
                              <div>
                                <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                                  Approval rank
                                </label>
                                <Select
                                  value={String(draft.minimum_role_rank_required ?? 1)}
                                  disabled={!policies.can_manage || draft.effect !== 'REQUIRE_APPROVAL'}
                                  onChange={(event) =>
                                    setPolicyDraft((current) => ({
                                      ...current,
                                      [policy.policy_key]: {
                                        ...draft,
                                        minimum_role_rank_required: Number(event.target.value),
                                      },
                                    }))
                                  }
                                >
                                  {sortRoleEntries(roles).map(([rank, label]) => (
                                    <option key={rank} value={rank}>
                                      Rank {rank} · {label}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-5 py-4">
                <div className="flex items-start gap-3">
                  <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--neutral-soft-400)]" strokeWidth={2} />
                  <p className="text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
                    End-to-end readiness means both badges are green: the room has a shared target here, and you have private credentials saved for the same connector.
                  </p>
                </div>
              </section>
            </div>
          </motion.div>
        )}
      </motion.div>

      <ConnectorCredentialsModal
        open={credentialsTarget !== null}
        connectorKey={credentialsTarget ?? ''}
        connectorName={
          catalog.find((item) => item.connector_key === credentialsTarget)?.display_name ?? 'Connector'
        }
        catalogItem={catalog.find((item) => item.connector_key === credentialsTarget) ?? null}
        status={credentialsTarget ? privateStatus[credentialsTarget] ?? null : null}
        onClose={() => setCredentialsTarget(null)}
        onSaved={(status) => {
          setPrivateStatus((current) => ({ ...current, [status.connector_key]: status }));
          toast.success('Private credentials saved');
        }}
      />

      <ConfirmDialog
        open={disableTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDisableTarget(null);
        }}
        title="Disable this room connector?"
        description="The shared target will stop being available in this room until it is configured again."
        confirmLabel="Disable connector"
        onConfirm={async () => {
          if (!disableTarget) return;
          try {
            await api.disableRoomConnector(roomId, disableTarget);
            setRoomConnectors((current) => {
              const next = { ...current };
              delete next[disableTarget];
              return next;
            });
            if (activeConnectorKey === disableTarget) {
              setPolicies(null);
              setPolicyDraft({});
            }
            setDisableTarget(null);
            toast.success('Connector disabled');
          } catch (err) {
            toast.error('Could not disable connector', {
              description: err instanceof Error ? err.message : 'Try again.',
            });
          }
        }}
      />
    </div>
  );
}
