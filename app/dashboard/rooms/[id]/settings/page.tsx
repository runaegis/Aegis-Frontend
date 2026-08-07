'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, ArrowLeft, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { fadeUp, staggerContainer } from '@/lib/motion';
import { useRoom } from '@/lib/roomContext';
import {
  getRoomRoleBadgeTone,
  isRoomOwner,
  parseApiUtcTimestamp,
} from '@/lib/utils';

export default function RoomSettingsPage() {
  const { roomId, room, members, role, roleRank, loading, refresh } = useRoom();
  const router = useRouter();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [pendingTransferTo, setPendingTransferTo] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const isOwner = isRoomOwner(roleRank);
  const transferTargets = useMemo(
    () =>
      members.filter(
        (member) => member.user_id && member.role_rank !== 1,
      ),
    [members],
  );

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success('Room ID copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const transferOwnership = async () => {
    if (!pendingTransferTo) return;
    setWorking(true);
    try {
      await api.transferRoomOwnership(roomId, pendingTransferTo);
      await refresh();
      setTransferOpen(false);
      setPendingTransferTo('');
      toast.success('Ownership transferred');
    } catch (err) {
      toast.error('Could not transfer ownership', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setWorking(false);
    }
  };

  const leaveRoom = async () => {
    setWorking(true);
    try {
      await api.leaveRoom(roomId);
      toast.success('Left room');
      router.push('/dashboard/rooms');
    } catch (err) {
      toast.error('Could not leave room', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setWorking(false);
    }
  };

  const deleteRoom = async () => {
    setWorking(true);
    try {
      await api.deleteRoom(roomId);
      toast.success('Room deleted');
      router.push('/dashboard/rooms');
    } catch (err) {
      toast.error('Could not delete room', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
        <Skeleton className="h-[240px] w-full rounded-[12px]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
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
          <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
              Identity
            </h2>
            <p className="mt-0.5 text-[11.5px] text-[var(--neutral-soft-400)]">
              Core room metadata and ownership details.
            </p>
          </div>
          <dl className="divide-y divide-[var(--stroke-soft-200)]">
            <SettingsRow label="Name" value={room?.name ?? '—'} />
            <SettingsRow label="Description" value={room?.description ?? '—'} />
            <SettingsRow label="Type" value={room?.room_type ?? 'shared'} />
            {room?.repo_name && (
              <SettingsRow label="Repository" value={room.repo_name} />
            )}
            <SettingsRow
              label="Room ID"
              value={
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-[var(--neutral-sub-600)]">
                    {roomId}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={copyRoomId}
                    leadingIcon={<Copy className="h-3 w-3" strokeWidth={2} />}
                  >
                    Copy
                  </Button>
                </div>
              }
            />
            <SettingsRow label="Owner" value={room?.owner_username ?? '—'} />
            <SettingsRow
              label="Your authority rank"
              value={
                <Badge tone={getRoomRoleBadgeTone(role, roleRank)} uppercase className="text-[10.5px]">
                  {typeof roleRank === 'number' ? `Rank ${roleRank}` : 'Unknown'}
                </Badge>
              }
            />
            <SettingsRow
              label="Your role"
              value={
                <Badge tone={getRoomRoleBadgeTone(role, roleRank)} uppercase className="text-[10.5px]">
                  {role}
                </Badge>
              }
            />
            {room?.created_at && (
              <SettingsRow
                label="Created"
                value={parseApiUtcTimestamp(room.created_at).toLocaleString()}
              />
            )}
          </dl>
        </motion.section>

        {isOwner && (
          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Ownership transfer
              </h2>
              <p className="mt-0.5 text-[11.5px] text-[var(--neutral-soft-400)]">
                Move rank 1 ownership to another member in this room.
              </p>
            </div>
            <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                  New owner
                </label>
                <Select
                  value={pendingTransferTo}
                  onChange={(event) => setPendingTransferTo(event.target.value)}
                >
                  <option value="">Select a member</option>
                  {transferTargets.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.username}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  onClick={() => setTransferOpen(true)}
                  disabled={!pendingTransferTo}
                >
                  Transfer ownership
                </Button>
              </div>
            </div>
          </motion.section>
        )}

        <motion.section
          variants={fadeUp}
          className="overflow-hidden rounded-[12px] border border-[var(--error)]/20 bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <div className="border-b border-[var(--error)]/15 bg-[var(--error-lighter)]/40 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--error)]" strokeWidth={2} />
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Danger zone
              </h2>
            </div>
            <p className="mt-0.5 text-[11.5px] text-[var(--neutral-soft-400)]">
              These actions affect access immediately.
            </p>
          </div>
          <div className="divide-y divide-[var(--stroke-soft-200)]">
            {!isOwner && (
              <DangerRow
                title="Leave room"
                description="Remove yourself from this room. You can rejoin later with a valid invite."
                cta="Leave room"
                onClick={() => setLeaveOpen(true)}
              />
            )}
            {isOwner && (
              <DangerRow
                title="Delete room"
                description="Soft-delete this room and disable its shared setup. Existing audit history remains."
                cta="Delete room"
                destructive
                onClick={() => setDeleteOpen(true)}
              />
            )}
          </div>
        </motion.section>

        <motion.div variants={fadeUp} className="flex">
          <Link href="/dashboard/rooms">
            <Button
              variant="secondary"
              leadingIcon={<ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />}
            >
              All rooms
            </Button>
          </Link>
        </motion.div>
      </motion.div>

      <ConfirmDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        title="Transfer ownership?"
        description="You will hand rank 1 ownership to the selected member and step down from the owner role."
        confirmLabel="Transfer ownership"
        loading={working}
        onConfirm={transferOwnership}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave room?"
        description="You will lose access immediately and will need a fresh invite to rejoin."
        confirmLabel="Leave room"
        loading={working}
        onConfirm={leaveRoom}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete room?"
        description="This disables the room and its shared connector setup. Keep going only if the room is no longer needed."
        confirmLabel="Delete room"
        loading={working}
        onConfirm={deleteRoom}
      />
    </div>
  );
}

function SettingsRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {label}
      </dt>
      <dd className="text-[12.5px] text-[var(--neutral-strong-950)]">{value}</dd>
    </div>
  );
}

function DangerRow({
  title,
  description,
  cta,
  destructive,
  onClick,
}: {
  title: string;
  description: string;
  cta: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
          {title}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--neutral-sub-600)]">
          {description}
        </p>
      </div>
      <Button
        size="sm"
        variant={destructive ? 'danger' : 'secondary'}
        onClick={onClick}
      >
        {cta}
      </Button>
    </div>
  );
}
