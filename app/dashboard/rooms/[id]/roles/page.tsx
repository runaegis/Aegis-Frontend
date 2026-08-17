'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Plus, Save, Shield, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { fadeUp, staggerContainer } from '@/lib/motion';
import { useRoom } from '@/lib/roomContext';
import { isRoomOwner } from '@/lib/utils';

function sortRoleEntries(roles: Record<string, string>) {
  return Object.entries(roles).sort((a, b) => Number(a[0]) - Number(b[0]));
}

export default function RoomRolesPage() {
  const { roomId, members, roleRank, loading: roomLoading } = useRoom();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [roles, setRoles] = useState<Record<string, string>>({});
  const [draftRoles, setDraftRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canEdit = isRoomOwner(roleRank);

  const loadRoles = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const response = await api.getRoomRoles(roomId);
      setRoles(response.roles);
      setDraftRoles(response.roles);
    } catch (err) {
      toast.error("Couldn't load room roles", {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [roomId, toast]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const entries = useMemo(() => sortRoleEntries(draftRoles), [draftRoles]);
  const dirty = JSON.stringify(roles) !== JSON.stringify(draftRoles);

  const save = async () => {
    if (!canEdit || !dirty) return;
    setSaving(true);
    try {
      const nextRoles = Object.fromEntries(
        Object.entries(draftRoles).map(([rank, label]) => [rank, label.trim() || `Rank ${rank}`]),
      );
      const updated = await api.updateRoomRoles(roomId, nextRoles);
      setRoles(updated.roles);
      setDraftRoles(updated.roles);
      toast.success('Room roles updated');
    } catch (err) {
      toast.error('Could not update room roles', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const addRank = () => {
    const nextRank = String(
      Math.max(0, ...Object.keys(draftRoles).map((key) => Number(key) || 0)) + 1,
    );
    setDraftRoles((current) => ({ ...current, [nextRank]: `Rank ${nextRank}` }));
  };

  if (roomLoading || loading) {
    return (
      <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
        <Skeleton className="h-[220px] w-full rounded-[12px]" />
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
        <motion.section
          variants={fadeUp}
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--primary-alpha-10)] text-[var(--primary-base)]">
                  <Shield className="h-4 w-4" strokeWidth={2} />
                </span>
                <div>
                  <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-[var(--neutral-strong-950)]">
                    Room roles
                  </h2>
                  <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                    Numeric rank drives authority. Lower rank means more authority.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={addRank}
                  leadingIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2} />}
                >
                  Add rank
                </Button>
              )}
              <Button
                size="sm"
                variant="primary"
                onClick={save}
                disabled={!canEdit || !dirty || saving}
                leadingIcon={<Save className="h-3.5 w-3.5" strokeWidth={2.25} />}
              >
                {saving ? 'Saving…' : 'Save roles'}
              </Button>
            </div>
          </div>

          <div className="divide-y divide-[var(--stroke-soft-200)]">
            {entries.map(([rank, label]) => {
              const count = members.filter(
                (member) => String(member.role_rank ?? '') === rank,
              ).length;

              return (
                <div
                  key={rank}
                  className="grid gap-3 px-5 py-4 md:grid-cols-[110px_minmax(0,1fr)_auto]"
                >
                  <div className="flex items-center gap-2">
                    <Badge tone={Number(rank) === 1 ? 'primary' : 'neutral'} uppercase>
                      Rank {rank}
                    </Badge>
                  </div>
                  <div className="min-w-0">
                    <Input
                      value={label}
                      onChange={(event) =>
                        setDraftRoles((current) => ({
                          ...current,
                          [rank]: event.target.value,
                        }))
                      }
                      disabled={!canEdit || Number(rank) === 1}
                    />
                    <p className="mt-1.5 text-[11.5px] text-[var(--neutral-soft-400)]">
                      {Number(rank) === 1
                        ? 'Rank 1 stays the owner role.'
                        : 'Members at this rank inherit the room tool and policy defaults for the same rank.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-start md:justify-end">
                    <Badge tone="info">
                      {count} {count === 1 ? 'member' : 'members'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          variants={fadeUp}
          className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-5 py-4"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200)] bg-white text-[var(--feature)]">
              <Sparkles className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                How to use this
              </p>
              <p className="mt-1 text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
                Keep the labels human-friendly here, then use the Members page to move people between ranks and the Tools page to tune what each rank can do.
              </p>
              <p className="mt-2 text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
                Removing a rank is not wired yet. Safe removal needs the backend to reindex member ranks, connector tool policies, and approval thresholds in one pass.
              </p>
            </div>
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}
