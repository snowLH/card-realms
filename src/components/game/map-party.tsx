"use client";

import { Copy, Link2, LogIn, LogOut, Radio, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GridPoint } from "@/game/exploration/pathfinding";
import type { AvatarConfig } from "@/game/save/local-progress";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export type MapPartyMember = {
  id: string;
  name: string;
  x: number;
  y: number;
  avatar: AvatarConfig;
  isSelf: boolean;
  presenceStatus: string;
};

export type MapPartySession = {
  id: string;
  hostId: string;
  inviteCode: string;
  regionId: string;
  maxPlayers: number;
};

type PartyPayload = {
  session: MapPartySession | null;
  members: MapPartyMember[];
  error?: string;
};

type LocalMessage = {
  type: "presence" | "join" | "leave" | "full";
  roomCode: string;
  member: MapPartyMember;
  requesterId?: string;
};

function localId() {
  const key = "card-realms:local-party-id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.sessionStorage.setItem(key, id);
  return id;
}

function localCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function useMapParty({
  online,
  regionId,
  playerId,
  playerName,
  avatar,
}: {
  online: boolean;
  regionId: string;
  playerId?: string;
  playerName: string;
  avatar: AvatarConfig;
}) {
  const [session, setSession] = useState<MapPartySession | null>(null);
  const [members, setMembers] = useState<MapPartyMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const localChannel = useRef<BroadcastChannel | null>(null);
  const sessionRef = useRef<MapPartySession | null>(null);
  const membersRef = useRef<MapPartyMember[]>([]);
  const joinTimeoutRef = useRef<number | null>(null);

  const updateMembers = useCallback((next: MapPartyMember[]) => {
    membersRef.current = next;
    setMembers(next);
  }, []);

  useEffect(() => {
    sessionRef.current = session;
    membersRef.current = members;
  }, [members, session]);

  const selfId = useMemo(() => {
    if (online) return playerId ?? "";
    if (typeof window === "undefined") return "local";
    return localId();
  }, [online, playerId]);

  const refresh = useCallback(async () => {
    if (!online) return;
    try {
      const response = await fetch("/api/map-party", { cache: "no-store" });
      const payload = (await response.json()) as PartyPayload;
      if (!response.ok) throw new Error(payload.error ?? "A sessão cooperativa não respondeu.");
      setSession(payload.session);
      setMembers(payload.members ?? []);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A sessão cooperativa não respondeu.");
    }
  }, [online]);

  useEffect(() => {
    if (!online) return;
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [online, refresh]);

  useEffect(() => {
    if (!online || !session) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      const channel = supabase
        .channel("map:room:" + session.id, { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, () => void refresh())
        .on("broadcast", { event: "UPDATE" }, () => void refresh())
        .on("broadcast", { event: "DELETE" }, () => void refresh())
        .subscribe();
      cleanup = () => void supabase.removeChannel(channel);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [online, refresh, session]);

  useEffect(() => {
    if (online) return;
    const channel = new BroadcastChannel("card-realms-map-party-v1");
    localChannel.current = channel;
    channel.onmessage = (event: MessageEvent<LocalMessage>) => {
      const message = event.data;
      const active = sessionRef.current;
      if (!active || message.roomCode !== active.inviteCode) return;
      if (message.type === "full") {
        if (message.requesterId !== selfId) return;
        if (joinTimeoutRef.current !== null) window.clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
        sessionRef.current = null;
        setSession(null);
        updateMembers([]);
        setError("Esta sala já está cheia. O limite é de 4 jogadores.");
        return;
      }
      if (message.type === "leave") {
        updateMembers(membersRef.current.filter((member) => member.id !== message.member.id));
        return;
      }
      if (message.type === "join") {
        if (active.hostId !== selfId) return;
        const current = membersRef.current;
        if (!current.some((member) => member.id === message.member.id) && current.length >= 4) {
          channel.postMessage({
            type: "full",
            roomCode: active.inviteCode,
            member: message.member,
            requesterId: message.member.id,
          } satisfies LocalMessage);
          return;
        }
        const joiningMember = { ...message.member, isSelf: message.member.id === selfId };
        const next = [...current.filter((member) => member.id !== joiningMember.id), joiningMember].slice(0, 4);
        updateMembers(next);
        next.forEach((member) => channel.postMessage({
          type: "presence",
          roomCode: active.inviteCode,
          member,
        } satisfies LocalMessage));
        return;
      }
      const current = membersRef.current;
      const remoteMember = { ...message.member, isSelf: message.member.id === selfId };
      const next = [...current.filter((member) => member.id !== remoteMember.id), remoteMember].slice(0, 4);
      updateMembers(next);
      if (next.some((member) => member.isSelf) && next.length > 1 && joinTimeoutRef.current !== null) {
        window.clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
    };
    return () => {
      channel.close();
      localChannel.current = null;
      if (joinTimeoutRef.current !== null) window.clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    };
  }, [online, selfId, updateMembers]);

  const localSelf = useCallback((point: GridPoint = { x: 4, y: 20 }): MapPartyMember => ({
    id: selfId,
    name: playerName,
    x: point.x,
    y: point.y,
    avatar,
    isSelf: true,
    presenceStatus: "online",
  }), [avatar, playerName, selfId]);

  const action = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/map-party", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { result?: Record<string, unknown>; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar a sessão.");
      await refresh();
      return payload.result ?? null;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a sessão.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  async function create() {
    if (online) {
      await action({ action: "create" });
      return;
    }
    const code = localCode();
    const nextSession: MapPartySession = {
      id: "local:" + code,
      hostId: selfId,
      inviteCode: code,
      regionId,
      maxPlayers: 4,
    };
    const me = localSelf();
    sessionRef.current = nextSession;
    setSession(nextSession);
    updateMembers([me]);
    localChannel.current?.postMessage({ type: "presence", roomCode: code, member: me } satisfies LocalMessage);
  }

  async function join() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    if (online) {
      await action({ action: "join", inviteCode: code });
      return;
    }
    const nextSession: MapPartySession = {
      id: "local:" + code,
      hostId: "",
      inviteCode: code,
      regionId,
      maxPlayers: 4,
    };
    const me = localSelf();
    sessionRef.current = nextSession;
    setSession(nextSession);
    updateMembers([me]);
    setError("");
    localChannel.current?.postMessage({ type: "join", roomCode: code, member: me } satisfies LocalMessage);
    localChannel.current?.postMessage({ type: "presence", roomCode: code, member: me } satisfies LocalMessage);
    if (joinTimeoutRef.current !== null) window.clearTimeout(joinTimeoutRef.current);
    joinTimeoutRef.current = window.setTimeout(() => {
      if (sessionRef.current?.inviteCode !== code || membersRef.current.length > 1) return;
      sessionRef.current = null;
      setSession(null);
      updateMembers([]);
      joinTimeoutRef.current = null;
      setError("Não encontramos uma sala local aberta com esse código.");
    }, 750);
  }

  async function leave() {
    if (!session) return;
    if (online) {
      await action({ action: "leave", sessionId: session.id });
      sessionRef.current = null;
      setSession(null);
      updateMembers([]);
      return;
    }
    const me = members.find((member) => member.isSelf) ?? localSelf();
    localChannel.current?.postMessage({
      type: "leave",
      roomCode: session.inviteCode,
      member: me,
    } satisfies LocalMessage);
    sessionRef.current = null;
    setSession(null);
    updateMembers([]);
  }

  const syncPosition = useCallback(async (point: GridPoint) => {
    if (!session) return;
    if (online) {
      await action({
        action: "position",
        sessionId: session.id,
        x: point.x,
        y: point.y,
      });
      return;
    }
    const me = { ...localSelf(point), x: point.x, y: point.y };
    updateMembers([me, ...membersRef.current.filter((member) => !member.isSelf)].slice(0, 4));
    localChannel.current?.postMessage({
      type: "presence",
      roomCode: session.inviteCode,
      member: me,
    } satisfies LocalMessage);
  }, [action, localSelf, online, session, updateMembers]);

  return {
    session,
    members,
    busy,
    error,
    joinCode,
    setJoinCode,
    create,
    join,
    leave,
    syncPosition,
  };
}

export function MapPartyPanel({
  party,
}: {
  party: ReturnType<typeof useMapParty>;
}) {
  return (
    <aside className="map-party-panel" onPointerDown={(event) => event.stopPropagation()}>
      <div className="map-party-panel__heading">
        <span><Users /> Exploração conjunta</span>
        {party.session ? <small><Radio /> {party.members.length}/{party.session.maxPlayers}</small> : null}
      </div>

      {party.session ? (
        <>
          <div className="map-party-code">
            <span>Código</span>
            <strong>{party.session.inviteCode}</strong>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(party.session?.inviteCode ?? "")}><Copy /></button>
          </div>
          <div className="map-party-members">
            {party.members.map((member) => (
              <span key={member.id}>{member.isSelf ? "Você" : member.name}</span>
            ))}
          </div>
          <Button size="sm" variant="secondary" disabled={party.busy} onClick={() => void party.leave()}>
            <LogOut /> Sair
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="game" disabled={party.busy} onClick={() => void party.create()}>
            <Link2 /> Criar sala
          </Button>
          <div className="map-party-join">
            <input
              value={party.joinCode}
              maxLength={16}
              placeholder="CÓDIGO"
              onChange={(event) => party.setJoinCode(event.target.value.toUpperCase())}
            />
            <button type="button" disabled={party.busy || party.joinCode.trim().length < 4} onClick={() => void party.join()}>
              <LogIn />
            </button>
          </div>
        </>
      )}

      {party.error ? <p role="alert">{party.error}</p> : null}
      {!party.session ? <small>{typeof window !== "undefined" && !getSupabaseBrowserClient() ? "Modo local entre abas" : "2–4 jogadores"}</small> : null}
    </aside>
  );
}
