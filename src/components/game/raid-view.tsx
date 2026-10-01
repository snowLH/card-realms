"use client";

import {
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Crown,
  KeyRound,
  LoaderCircle,
  LogIn,
  Play,
  Radio,
  ShieldAlert,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PlayerBootstrap } from "@/game/player";
import { CREATURE_BY_ID, ELEMENT_META } from "@/game/catalog";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PixelCreature } from "./pixel-creature";

type RaidScheduleItem = {
  id: string;
  slug: string;
  title: string;
  bossCreatureId: string;
  startsAt: string;
  endsAt: string;
  presentationTimezone: string;
  minPlayers: number;
  maxPlayers: number;
  recommendedLevel: number;
  bossConfig: Record<string, unknown>;
  rewards: Record<string, unknown>;
  serverNow: string;
  status: "upcoming" | "active" | "ended";
};

type RaidReward = {
  event_id: string;
  reward_type: string;
  creature_card_id: string | null;
  granted_at: string;
};

type RaidParticipant = {
  id: string;
  name: string;
  level: number;
  seat: number;
  isReady: boolean;
  presenceStatus: string;
  contribution: Record<string, unknown>;
};

type RaidRoomResponse = {
  room: {
    id: string;
    eventId: string;
    hostId: string;
    inviteCode: string;
    status: "lobby" | "active" | "victory" | "defeat" | "closed";
    version: number;
  };
  event: {
    id: string;
    title: string;
    boss_creature_id: string;
    min_players: number;
    max_players: number;
    recommended_level: number;
  };
  participants: RaidParticipant[];
  state: unknown | null;
  mythicalReward?: {
    obtained: boolean;
    creatureCardId: string | null;
    grantedAt: string | null;
  };
  error?: string;
};

function countdown(target: string, serverNow: string) {
  const distance = Math.max(0, new Date(target).getTime() - new Date(serverNow).getTime());
  const hours = Math.floor(distance / 3_600_000);
  const minutes = Math.floor((distance % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function RaidView({
  bootstrap,
  onOpenRaid,
}: {
  bootstrap: PlayerBootstrap;
  onOpenRaid: (roomId: string) => void;
}) {
  const playerId = bootstrap.identity?.id ?? null;
  const [schedule, setSchedule] = useState<RaidScheduleItem[]>([]);
  const [rewards, setRewards] = useState<RaidReward[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<RaidRoomResponse | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(bootstrap.source === "supabase");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refreshSchedule = useCallback(async () => {
    if (bootstrap.source !== "supabase") return;
    try {
      const response = await fetch("/api/raids", { cache: "no-store" });
      const payload = (await response.json()) as {
        schedule?: RaidScheduleItem[];
        rewards?: RaidReward[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "O calendário de Raids não respondeu.");
      setSchedule(payload.schedule ?? []);
      setRewards(payload.rewards ?? []);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "O calendário de Raids não respondeu.");
    } finally {
      setLoading(false);
    }
  }, [bootstrap.source]);

  const refreshRoom = useCallback(async (targetRoomId: string) => {
    try {
      const response = await fetch(`/api/raids/rooms/${targetRoomId}`, { cache: "no-store" });
      const payload = (await response.json()) as RaidRoomResponse;
      if (!response.ok) throw new Error(payload.error ?? "A sala da Raid não respondeu.");
      setRoom(payload);
      setError("");
      if (payload.room.status === "active") onOpenRaid(targetRoomId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A sala da Raid não respondeu.");
    }
  }, [onOpenRaid]);

  useEffect(() => {
    if (bootstrap.source !== "supabase") return;
    const initial = window.setTimeout(() => void refreshSchedule(), 0);
    const timer = window.setInterval(() => void refreshSchedule(), 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [bootstrap.source, refreshSchedule]);

  useEffect(() => {
    if (!roomId) return;
    const initial = window.setTimeout(() => void refreshRoom(roomId), 0);
    const timer = window.setInterval(() => void refreshRoom(roomId), 3_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshRoom, roomId]);

  useEffect(() => {
    if (!roomId || bootstrap.source !== "supabase") return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    let removeChannel: (() => void) | null = null;
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      const channel = supabase
        .channel(`raid:room:${roomId}`, { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, () => void refreshRoom(roomId))
        .on("broadcast", { event: "UPDATE" }, () => void refreshRoom(roomId))
        .on("broadcast", { event: "DELETE" }, () => void refreshRoom(roomId))
        .subscribe();
      removeChannel = () => void supabase.removeChannel(channel);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      removeChannel?.();
    };
  }, [bootstrap.source, refreshRoom, roomId]);

  async function lobbyAction(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/raids", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        result?: { roomId?: string };
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "A ação da Raid não pôde ser concluída.");
      if (payload.result?.roomId) {
        setRoomId(payload.result.roomId);
        await refreshRoom(payload.result.roomId);
      } else if (roomId) {
        await refreshRoom(roomId);
      }
      return payload.result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A ação da Raid não pôde ser concluída.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function startRaid() {
    if (!roomId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/raids/rooms/${roomId}/start`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "A Raid não pôde ser iniciada.");
      onOpenRaid(roomId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A Raid não pôde ser iniciada.");
    } finally {
      setBusy(false);
    }
  }

  if (bootstrap.source !== "supabase" || !playerId) {
    return (
      <section className="content-view raid-view">
        <header className="view-heading">
          <div>
            <span className="view-eyebrow">Evento cooperativo</span>
            <h1>Raids Míticas de sábado</h1>
            <p>Junte de 2 a 5 amigos, enfrente uma criatura Mítica e conquiste a carta do evento.</p>
          </div>
        </header>
        <div className="raid-empty">
          <ShieldAlert />
          <div>
            <strong>Entre para participar das Raids</strong>
            <p>Salas, recompensas e progresso da Raid são confirmados pelo servidor.</p>
            <LoginDialog prominent label="Entrar com Google" />
          </div>
        </div>
      </section>
    );
  }

  const activeEvent = schedule.find((event) => event.status === "active");
  const nextEvent = schedule.find((event) => event.status === "upcoming");
  const roomPlayer = room?.participants.find((participant) => participant.id === playerId);
  const everyoneReady = Boolean(
    room
    && room.participants.length >= room.event.min_players
    && room.participants.every((participant) => participant.isReady),
  );

  return (
    <section className="content-view raid-view">
      <header className="view-heading raid-heading">
        <div>
          <span className="view-eyebrow">Evento cooperativo semanal</span>
          <h1>Raids Míticas</h1>
          <p>Boss central, HP compartilhado, três fases e até cinco Cartógrafos lutando juntos.</p>
        </div>
        <Badge className={cn(
          "raid-live-badge",
          activeEvent ? "is-live" : "is-waiting",
        )}>
          {activeEvent ? <Radio /> : <CalendarDays />}
          {activeEvent ? "Raid ativa" : "Próxima Raid programada"}
        </Badge>
      </header>

      {error ? <div className="pvp-error raid-error" role="alert">{error}</div> : null}
      {loading ? (
        <div className="raid-empty">
          <LoaderCircle className="animate-spin" />
          <strong>Consultando o calendário do servidor...</strong>
        </div>
      ) : null}

      {!loading && room ? (
        <div className="raid-lobby-shell">
          <article className="raid-boss-card">
            {(() => {
              const definition = CREATURE_BY_ID.get(room.event.boss_creature_id);
              return definition ? (
                <>
                  <div className="raid-boss-card__art">
                    <span className="raid-mythic-aura" />
                    <PixelCreature sprite={definition.sprite} label={definition.name} />
                  </div>
                  <div className="raid-boss-card__body">
                    <span className="view-eyebrow">RAID MÍTICA</span>
                    <h2>{room.event.title}</h2>
                    <p>{definition.title}</p>
                    <div className="raid-boss-card__meta">
                      <span><Crown /> Mítica</span>
                      <span>{ELEMENT_META[definition.element].name}</span>
                      <span>Nível recomendado {room.event.recommended_level}+</span>
                    </div>
                  </div>
                </>
              ) : null;
            })()}
          </article>

          <article className="raid-lobby-panel">
            <div className="raid-lobby-panel__heading">
              <div>
                <span className="view-eyebrow">SALA DA RAID</span>
                <strong>Código {room.room.inviteCode}</strong>
              </div>
              <button
                type="button"
                className="raid-copy-code"
                onClick={() => void navigator.clipboard?.writeText(room.room.inviteCode)}
              >
                <Copy /> Copiar
              </button>
            </div>

            <div className="raid-player-list">
              {Array.from({ length: room.event.max_players }, (_, index) => {
                const participant = room.participants.find((entry) => entry.seat === index + 1);
                return (
                  <div className={cn("raid-player-row", participant?.isReady && "is-ready")} key={index}>
                    <span className="raid-player-row__seat">{index + 1}</span>
                    {participant ? (
                      <>
                        <div>
                          <strong>{participant.name}{participant.id === playerId ? " · você" : ""}</strong>
                          <small>Nv. {participant.level} · {participant.presenceStatus}</small>
                        </div>
                        <span className="raid-ready-state">
                          {participant.isReady ? <><Check /> Pronto</> : <><Clock3 /> Preparando</>}
                        </span>
                      </>
                    ) : (
                      <>
                        <div><strong>Espaço livre</strong><small>Compartilhe o código da sala</small></div>
                        <span className="raid-ready-state is-empty">Livre</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="raid-lobby-actions">
              <Button
                variant={roomPlayer?.isReady ? "secondary" : "game"}
                disabled={busy}
                onClick={() => void lobbyAction({
                  action: "ready",
                  roomId: room.room.id,
                  ready: !roomPlayer?.isReady,
                })}
              >
                {roomPlayer?.isReady ? <X /> : <Check />}
                {roomPlayer?.isReady ? "Cancelar pronto" : "PRONTO"}
              </Button>

              {room.room.hostId === playerId ? (
                <Button
                  variant="game"
                  disabled={busy || !everyoneReady}
                  onClick={() => void startRaid()}
                >
                  <Play /> INICIAR RAID
                </Button>
              ) : (
                <Button variant="secondary" disabled>
                  <Clock3 /> Aguardando líder
                </Button>
              )}

              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void lobbyAction({ action: "leave", roomId: room.room.id }).then(() => {
                  setRoom(null);
                  setRoomId(null);
                })}
              >
                Sair da sala
              </Button>
            </div>

            <p className="raid-lobby-note">
              A Raid começa com {room.event.min_players}–{room.event.max_players} jogadores. Cada conta leva sua própria equipe ativa de seis cartas.
            </p>
          </article>
        </div>
      ) : null}

      {!loading && !room ? (
        <>
          {activeEvent ? (
            <article className="raid-event-hero">
              <div className="raid-event-hero__content">
                <span className="raid-event-live"><Radio /> RAID MÍTICA ATIVA</span>
                <h2>{activeEvent.title}</h2>
                <p>O evento termina em {countdown(activeEvent.endsAt, activeEvent.serverNow)}.</p>
                <div className="raid-event-actions">
                  <Button variant="game" disabled={busy} onClick={() => void lobbyAction({ action: "create", eventId: activeEvent.id })}>
                    <Users /> CRIAR SALA
                  </Button>
                  <div className="raid-code-join">
                    <KeyRound />
                    <input
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                      placeholder="CÓDIGO DA SALA"
                      maxLength={16}
                    />
                    <Button
                      variant="secondary"
                      disabled={busy || inviteCode.trim().length < 4}
                      onClick={() => void lobbyAction({ action: "join", inviteCode: inviteCode.trim() })}
                    >
                      <LogIn /> Entrar
                    </Button>
                  </div>
                </div>
              </div>
              {(() => {
                const boss = CREATURE_BY_ID.get(activeEvent.bossCreatureId);
                return boss ? (
                  <div className="raid-event-hero__boss">
                    <span className="raid-mythic-aura" />
                    <PixelCreature sprite={boss.sprite} label={boss.name} />
                    <strong>{boss.name}</strong>
                    <small>{boss.title}</small>
                  </div>
                ) : null;
              })()}
            </article>
          ) : nextEvent ? (
            <article className="raid-next-card">
              <div>
                <span className="view-eyebrow">PRÓXIMA RAID</span>
                <h2>{nextEvent.title}</h2>
                <p>Começa em <strong>{countdown(nextEvent.startsAt, nextEvent.serverNow)}</strong>.</p>
              </div>
              <div className="raid-next-card__time">
                <CalendarDays />
                <span>{new Date(nextEvent.startsAt).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  timeZone: nextEvent.presentationTimezone,
                })}</span>
                <strong>{new Date(nextEvent.startsAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: nextEvent.presentationTimezone,
                })}</strong>
              </div>
            </article>
          ) : (
            <div className="raid-empty">
              <CalendarDays />
              <div><strong>Nenhuma Raid publicada</strong><p>O próximo evento aparecerá aqui quando for programado.</p></div>
            </div>
          )}

          <div className="raid-calendar-grid">
            <article className="raid-calendar-panel">
              <div className="raid-calendar-panel__heading">
                <CalendarDays />
                <div><strong>Calendário de eventos</strong><span>Horários oficiais do servidor</span></div>
              </div>
              {schedule.map((event) => {
                const boss = CREATURE_BY_ID.get(event.bossCreatureId);
                const obtained = rewards.some((reward) => reward.event_id === event.id && reward.reward_type === "mythical_reward");
                return (
                  <div className="raid-calendar-row" key={event.id}>
                    <div className="raid-calendar-row__date">
                      <strong>{new Date(event.startsAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        timeZone: event.presentationTimezone,
                      })}</strong>
                      <small>{new Date(event.startsAt).toLocaleDateString("pt-BR", {
                        weekday: "short",
                        timeZone: event.presentationTimezone,
                      })}</small>
                    </div>
                    <div>
                      <strong>{event.title}</strong>
                      <span>{boss ? `${ELEMENT_META[boss.element].name} · ${boss.rarity.toUpperCase()}` : "Boss secreto"}</span>
                    </div>
                    <span className={cn("raid-calendar-status", `is-${event.status}`)}>
                      {obtained ? <><Trophy /> Obtida</> : event.status === "active" ? "ATIVA" : event.status === "upcoming" ? "Em breve" : "Encerrada"}
                    </span>
                  </div>
                );
              })}
            </article>

            <article className="raid-rules-panel">
              <div className="raid-calendar-panel__heading">
                <Sparkles />
                <div><strong>Como funciona</strong><span>Evento de grupo, não PvP ampliado</span></div>
              </div>
              <div className="raid-rule">
                <span>01</span><div><strong>Junte 2–5 amigos</strong><p>Crie uma sala e compartilhe o código.</p></div>
              </div>
              <div className="raid-rule">
                <span>02</span><div><strong>Leve suas seis cartas</strong><p>Energia, Poderes e Evoluções continuam sendo cartas reais.</p></div>
              </div>
              <div className="raid-rule">
                <span>03</span><div><strong>Derrote o Mítico</strong><p>Todos atacam o mesmo HP e atravessam três fases.</p></div>
              </div>
              <div className="raid-rule">
                <span>04</span><div><strong>Conquiste a carta</strong><p>A primeira vitória elegível garante 1 Mítica por conta naquele evento.</p></div>
              </div>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
