'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DoorOpen, Link2, Plus, Users } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { RoomSummary, RoomDetails, RoomInvite, RoomMember } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';

const getRoomId = (room: RoomSummary | RoomDetails): string =>
  String(room.id || room.room_id || '');

const getInviteCode = (invite: RoomInvite): string =>
  String(invite.invite_code || invite.code || invite.id || '');

export default function RoomsPage() {
  const { user, isLoading: userLoading } = useUser();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<RoomDetails | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [newRepoId, setNewRepoId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');

  const [loading, setLoading] = useState(true);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getAuthToken = useCallback(() => {
    const token = localStorage.getItem("access_token");
    console.log("[RoomsPage] getAuthToken:", token ? "Token exists" : "No token found");
    return token;
  }, []);

  const fetchRooms = useCallback(async () => {
    const authToken = getAuthToken();
    console.log("[RoomsPage] fetchRooms called, authToken exists:", !!authToken);
    
    if (!authToken) {
      if (!userLoading) {
        console.log("[RoomsPage] Clearing rooms - no auth token and not loading user");
        setRooms([]);
        setSelectedRoomId('');
        setSelectedRoom(null);
        setMembers([]);
        setInvites([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      console.log("[RoomsPage] Fetching rooms from API...");
      const roomsData = await api.getMyRooms(authToken);
      console.log("[RoomsPage] Rooms fetched successfully:", roomsData);
      setRooms(roomsData);

      if (roomsData.length === 0) {
        console.log("[RoomsPage] No rooms returned, clearing selection");
        setSelectedRoomId('');
        setSelectedRoom(null);
        setMembers([]);
        setInvites([]);
      } else {
        const hasSelected = roomsData.some((room) => getRoomId(room) === selectedRoomId);
        if (!selectedRoomId || !hasSelected) {
          const firstRoomId = getRoomId(roomsData[0]);
          console.log("[RoomsPage] Setting first room as selected:", firstRoomId);
          setSelectedRoomId(firstRoomId);
        }
      }

      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[RoomsPage] fetchRooms failed:", errorMsg);
      setError(`Failed to fetch rooms: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, userLoading, selectedRoomId]);

  const loadRoomData = useCallback(async () => {
    const authToken = getAuthToken();
    console.log("[RoomsPage] loadRoomData called, selectedRoomId:", selectedRoomId, "authToken exists:", !!authToken);
    
    if (!authToken || !selectedRoomId) {
      console.log("[RoomsPage] loadRoomData skipped: missing auth token or room selection");
      setSelectedRoom(null);
      setMembers([]);
      setInvites([]);
      return;
    }

    try {
      console.log("[RoomsPage] Loading room details for:", selectedRoomId);
      const [roomData, memberData, inviteData] = await Promise.all([
        api.getRoomDetails(selectedRoomId, authToken),
        api.getRoomMembers(selectedRoomId, authToken),
        api.getRoomInvites(selectedRoomId, authToken),
      ]);
      console.log("[RoomsPage] Room data loaded successfully:", { roomData, memberData, inviteData });
      setSelectedRoom(roomData);
      setMembers(memberData);
      setInvites(inviteData);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[RoomsPage] loadRoomData failed:", errorMsg);
      setError(`Failed to load room details: ${errorMsg}`);
    }
  }, [selectedRoomId, getAuthToken]);

  // Effect: Fetch rooms when component mounts or auth token changes
  useEffect(() => {
    console.log('[RoomsPage] Effect: Fetching initial rooms');
    fetchRooms();
  }, [fetchRooms]);

  // Effect: Load room data when selectedRoomId changes
  useEffect(() => {
    console.log('[RoomsPage] Effect: Loading room data for selectedRoomId:', selectedRoomId);
    loadRoomData();
  }, [loadRoomData, selectedRoomId]);

  const { lastUpdated } = useAutoRefresh(fetchRooms, 30000);

  const selectedRoomLabel = useMemo(() => {
    if (!selectedRoom) return selectedRoomId || 'Room';
    return selectedRoom.repo_id || getRoomId(selectedRoom);
  }, [selectedRoom, selectedRoomId]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const authToken = getAuthToken();
    if (!newRepoId.trim() || !authToken) {
      console.warn("[RoomsPage] handleCreateRoom: missing repo ID or auth token");
      return;
    }

    setSubmittingCreate(true);
    setSuccess(null);
    try {
      console.log("[RoomsPage] Creating room with repo ID:", newRepoId);
      const created = await api.createRoom(newRepoId.trim(), authToken);
      console.log("[RoomsPage] Room created successfully:", created);
      setNewRepoId('');
      setSuccess('Room created successfully');
      await fetchRooms();
      const roomId = getRoomId(created);
      if (roomId) {
        console.log("[RoomsPage] Setting selected room to newly created:", roomId);
        setSelectedRoomId(roomId);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[RoomsPage] handleCreateRoom failed:", errorMsg);
      setError(`Failed to create room: ${errorMsg}`);
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const authToken = getAuthToken();
    if (!joinCode.trim() || !authToken) {
      console.warn("[RoomsPage] handleJoinRoom: missing join code or auth token");
      return;
    }

    setSubmittingJoin(true);
    setSuccess(null);
    try {
      console.log("[RoomsPage] Joining room with code:", joinCode);
      await api.joinRoom(joinCode.trim(), authToken);
      console.log("[RoomsPage] Joined room successfully");
      setJoinCode('');
      setSuccess('Joined room successfully');
      await fetchRooms();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[RoomsPage] handleJoinRoom failed:", errorMsg);
      setError(`Failed to join room: ${errorMsg}`);
    } finally {
      setSubmittingJoin(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const authToken = getAuthToken();
    if (!selectedRoomId || !authToken) {
      console.warn("[RoomsPage] handleCreateInvite: missing room ID or auth token");
      return;
    }

    setSubmittingInvite(true);
    setSuccess(null);
    try {
      const payload: { max_uses?: number; expires_at?: string } = {};

      if (inviteMaxUses.trim()) {
        payload.max_uses = Number(inviteMaxUses);
      }
      if (inviteExpiresAt.trim()) {
        payload.expires_at = new Date(inviteExpiresAt).toISOString();
      }

      console.log("[RoomsPage] Creating invite with payload:", payload);
      await api.createRoomInvite(selectedRoomId, payload, authToken);
      console.log("[RoomsPage] Invite created successfully");
      setInviteMaxUses('');
      setInviteExpiresAt('');
      setSuccess('Invite created successfully');
      await loadRoomData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[RoomsPage] handleCreateInvite failed:", errorMsg);
      setError(`Failed to create invite: ${errorMsg}`);
    } finally {
      setSubmittingInvite(false);
    }
  };

  const copyInviteCode = async (code: string) => {
    try {
      console.log("[RoomsPage] Copying invite code to clipboard");
      await navigator.clipboard.writeText(code);
      setSuccess('Invite code copied');
    } catch (err) {
      console.error("[RoomsPage] Failed to copy invite code:", err);
      setError('Could not copy invite code');
    }
  };

  if (userLoading || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar
        title="Rooms"
        subtitle="Create team rooms, invite collaborators, and track members"
        lastUpdated={lastUpdated}
        onRefresh={fetchRooms}
      />

      <div className="space-y-6 p-6">
        {error && (
          <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchRooms} />
        )}

        {success && (
          <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form onSubmit={handleCreateRoom} className="rounded-md border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Plus className="h-4 w-4" />
              Create Room
            </div>
            <label className="mb-1 block text-xs text-muted-foreground">Repository UUID</label>
            <input
              value={newRepoId}
              onChange={(e) => setNewRepoId(e.target.value)}
              placeholder="Paste repository UUID"
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={submittingCreate || !newRepoId.trim()}
              className="mt-3 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {submittingCreate ? 'Creating...' : 'Create room'}
            </button>
          </form>

          <form onSubmit={handleJoinRoom} className="rounded-md border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <DoorOpen className="h-4 w-4" />
              Join Room
            </div>
            <label className="mb-1 block text-xs text-muted-foreground">Invite Code</label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Paste invite code"
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={submittingJoin || !joinCode.trim()}
              className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {submittingJoin ? 'Joining...' : 'Join room'}
            </button>
          </form>
        </div>

        {rooms.length === 0 ? (
          <div className="rounded-md border border-border bg-card">
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No rooms yet"
              description="Create your first room or join one using an invite code."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
            <div className="rounded-md border border-border bg-card p-3">
              <p className="mb-2 text-xs text-muted-foreground">Your rooms</p>
              <div className="space-y-2">
                {rooms.map((room) => {
                  const roomId = getRoomId(room);
                  const active = roomId === selectedRoomId;
                  return (
                    <button
                      key={roomId}
                      onClick={() => setSelectedRoomId(roomId)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? 'border-foreground bg-muted text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <p className="font-medium">{room.repo_id || roomId}</p>
                      <p className="text-xs opacity-80">{roomId}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-md border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-foreground">{selectedRoomLabel}</h2>
                    <p className="text-xs text-muted-foreground">Room ID: {selectedRoomId}</p>
                  </div>
                </div>

                <form onSubmit={handleCreateInvite} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Max Uses</label>
                    <input
                      type="number"
                      min={1}
                      value={inviteMaxUses}
                      onChange={(e) => setInviteMaxUses(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Expires At</label>
                    <input
                      type="datetime-local"
                      value={inviteExpiresAt}
                      onChange={(e) => setInviteExpiresAt(e.target.value)}
                      className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={submittingInvite || !selectedRoomId}
                      className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
                    >
                      {submittingInvite ? 'Generating...' : 'Generate invite'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                    <Users className="h-4 w-4" />
                    Members ({members.length})
                  </div>

                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {members.map((member, idx) => (
                        <div
                          key={`${member.user_id}-${idx}`}
                          className="rounded-md border border-border bg-muted/30 px-3 py-2"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {member.username || member.user_id}
                          </p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{member.role || 'member'}</span>
                            {member.joined_at && <span>{formatRelativeTime(member.joined_at)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                    <Link2 className="h-4 w-4" />
                    Invites ({invites.length})
                  </div>

                  {invites.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No invites created yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {invites.map((invite, idx) => {
                        const code = getInviteCode(invite);
                        return (
                          <div key={`${code}-${idx}`} className="rounded-md border border-border bg-muted/30 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-mono text-sm text-foreground">{code}</p>
                                <p className="text-xs text-muted-foreground">
                                  Uses: {invite.used_count || 0}
                                  {typeof invite.max_uses === 'number' ? ` / ${invite.max_uses}` : ''}
                                </p>
                                {invite.expires_at && (
                                  <p className="text-xs text-muted-foreground">
                                    Expires: {new Date(invite.expires_at).toLocaleString()}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => copyInviteCode(code)}
                                className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}