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
import type { RaidGameplayMode } from "@/game/raid";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { readJsonResponse } from "@/lib/http/read-json-response";
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
  ability_card_id: string | null;
  coins_awarded: number;
  xp_awarded: number;
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
    gameplayMode?: RaidGameplayMode;
    gameplayVersion?: number;
  };
  event: {
    id: string;
    title: string;
    boss_creature_id: string;
    min_players: number;
    max_players: number;
    recommended_level: number;
    boss_config?: Record<string, unknown>;
  };
  gameplayMode?: RaidGameplayMode;
  participants: RaidParticipant[];
  state: unknown | null;
  eventReward?: {
    obtained: boolean;
    coinsAwarded: number;
    xpAwarded: number;
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

function isArpgDungeonEvent(event: RaidScheduleItem) {
  return event.bossConfig?.gameplayMode === "arpg";
}

export function RaidView({
  bootstrap,
  dismissedRoomId = null,
  onDismissRaid,
  onOpenRaid,
}: {
  bootstrap: PlayerBootstrap;
  dismissedRoomId?: string | null;
  onDismissRaid?: (roomId: string | null) => void;
  onOpenRaid: (roomId: string, mode: RaidGameplayMode) => void;
}) {
  const playerId = bootstrap.identity?.id ?? null;
  const [schedule, setSchedule] = useState<RaidScheduleItem[]>([]);
  const [rewards, setRewards] = useState<RaidReward[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomMode, setRoomMode] = useState<RaidGameplayMode>("arpg");
  const [room, setRoom] = useState<RaidRoomResponse | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(bootstrap.source === "supabase");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refreshSchedule = useCallback(async () => {
    if (bootstrap.source !== "supabase") return;
    try {
      const response = await fetch("/api/raids", { cache: "no-store" });
      const payload = await readJsonResponse<{
        schedule?: RaidScheduleItem[];
        rewards?: RaidReward[];
        activeRoom?: {
          roomId: string;
          eventId: string;
          status: "lobby" | "active";
          version: number;
          gameplayMode: RaidGameplayMode;
        } | null;
        error?: string;
      }>(response, "O calendário das dungeons não respondeu.");
      if (!response.ok) throw new Error(payload.error ?? "O calendário das dungeons não respondeu.");
      setSchedule((payload.schedule ?? []).filter(isArpgDungeonEvent));
      setRewards(payload.rewards ?? []);
      if (payload.activeRoom?.gameplayMode === "arpg" && !roomId) {
        setRoomMode(payload.activeRoom.gameplayMode);
        setRoomId(payload.activeRoom.roomId);
      }
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "O calendário de Raids não respondeu.");
    } finally {
      setLoading(false);
    }
  }, [bootstrap.source, roomId]);

  const refreshRoom = useCallback(async (targetRoomId: string, targetMode: RaidGameplayMode) => {
    try {
      const prefix = targetMode === "arpg" ? "/api/arpg/raids" : "/api/raids";
      const response = await fetch(`${prefix}/rooms/${targetRoomId}`, { cache: "no-store" });
      const payload = await readJsonResponse<RaidRoomResponse>(response, "A sala da dungeon não respondeu.");
      if (!response.ok) throw new Error(payload.error ?? "A sala da Raid não respondeu.");
      const resolvedMode = payload.gameplayMode ?? targetMode;
      if (resolvedMode !== "arpg") {
        throw new Error("Este código pertence a uma sala antiga. Peça um código de dungeon cooperativa atualizado.");
      }
      setRoomMode(resolvedMode);
      setRoom(payload);
      setError("");
      if (payload.room.status === "active" && dismissedRoomId !== targetRoomId) {
        onOpenRaid(targetRoomId, resolvedMode);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A sala da Raid não respondeu.");
    }
  }, [dismissedRoomId, onOpenRaid]);

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
    const initial = window.setTimeout(() => void refreshRoom(roomId, roomMode), 0);
    const timer = window.setInterval(() => void refreshRoom(roomId, roomMode), 3_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshRoom, roomId, roomMode]);

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
        .on("broadcast", { event: "INSERT" }, () => void refreshRoom(roomId, roomMode))
        .on("broadcast", { event: "UPDATE" }, () => void refreshRoom(roomId, roomMode))
        .on("broadcast", { event: "DELETE" }, () => void refreshRoom(roomId, roomMode))
        .subscribe();
      removeChannel = () => void supabase.removeChannel(channel);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      removeChannel?.();
    };
  }, [bootstrap.source, refreshRoom, roomId, roomMode]);

  async function lobbyAction(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/raids", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await readJsonResponse<{
        result?: { roomId?: string; gameplayMode?: RaidGameplayMode };
        error?: string;
      }>(response, "A ação da sala não recebeu uma resposta válida do servidor.");
      if (!response.ok) throw new Error(payload.error ?? "A ação da Raid não pôde ser concluída.");
      if (payload.result?.roomId) {
        const nextMode = payload.result.gameplayMode ?? "arpg";
        setRoomMode(nextMode);
        setRoomId(payload.result.roomId);
        await refreshRoom(payload.result.roomId, nextMode);
      } else if (roomId) {
        await refreshRoom(roomId, roomMode);
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
      const response = await fetch(`/api/arpg/raids/rooms/${roomId}/start`, { method: "POST" });
      const payload = await readJsonResponse<{ error?: string }>(response, "A dungeon não recebeu uma resposta válida do servidor.");
      if (!response.ok) throw new Error(payload.error ?? "A expedição cooperativa não pôde ser iniciada.");
      onDismissRaid?.(null);
      onOpenRaid(roomId, roomMode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A expedição cooperativa não pôde ser iniciada.");
    } finally {
      setBusy(false);
    }
  }

  if (bootstrap.source !== "supabase" || !playerId) {
    return (
      <section className="content-view raid-view">
        <header className="view-heading">
          <div>
            <span className="view-eyebrow">Dungeons cooperativas</span>
            <h1>Expedições com amigos</h1>
            <p>Forme um grupo, atravesse salas juntos e conquiste moedas e XP ao concluir a expedição.</p>
          </div>
        </header>
        <div className="raid-empty">
          <ShieldAlert />
          <div>
            <strong>Entre para explorar dungeons cooperativas</strong>
            <p>Salas, recompensas e progresso do grupo são confirmados pelo servidor.</p>
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
          <span className="view-eyebrow">Dungeon cooperativa online</span>
          <h1>Jogue dungeons com amigos</h1>
          <p>Crie uma sala ou entre com um código. Reúnam suas Lendas e avancem juntos pelas salas.</p>
        </div>
        <Badge className={cn(
          "raid-live-badge",
          activeEvent ? "is-live" : "is-waiting",
        )}>
          {activeEvent ? <Radio /> : <CalendarDays />}
          {activeEvent ? "Dungeon disponível" : "Próxima dungeon"}
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
                    <span className="view-eyebrow">DUNGEON COOPERATIVA</span>
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
                <span className="view-eyebrow">SALA DA EXPEDIÇÃO</span>
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
              {room.room.status === "active" ? (
                <Button
                  variant="game"
                  disabled={busy}
                  onClick={() => {
                    onDismissRaid?.(null);
                    onOpenRaid(room.room.id, roomMode);
                  }}
                >
                  <Play /> RETOMAR EXPEDIÇÃO
                </Button>
              ) : <>
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
                  <Play /> INICIAR EXPEDIÇÃO
                  </Button>
                ) : (
                  <Button variant="secondary" disabled>
                    <Clock3 /> Aguardando líder
                  </Button>
                )}
              </>}

              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void lobbyAction({ action: "leave", roomId: room.room.id }).then(() => {
                  onDismissRaid?.(room.room.id);
                  setRoom(null);
                  setRoomId(null);
                })}
              >
                Sair da sala
              </Button>
            </div>

            <p className="raid-lobby-note">
              A dungeon começa com {room.event.min_players}–{room.event.max_players} jogadores. O grupo atravessa salas compartilhadas, derrota ondas e avança até o chefe final. O servidor salva ações, inimigos e progresso para todos.
            </p>
          </article>
        </div>
      ) : null}

      {!loading && !room ? (
        <>
          {activeEvent ? (
            <article className="raid-event-hero">
              <div className="raid-event-hero__content">
                <span className="raid-event-live"><Radio /> DUNGEON DISPONÍVEL</span>
                <h2>Expedição cooperativa</h2>
                <p>Reúna de 2 a 4 jogadores, compartilhe o código e explore uma masmorra juntos.</p>
                <div className="raid-event-actions">
                  <Button variant="game" disabled={busy} onClick={() => void lobbyAction({ action: "create", eventId: activeEvent.id })}>
                    <Users /> CRIAR SALA DA DUNGEON
                  </Button>
                  <div className="raid-code-join">
                    <KeyRound />
                    <input
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                      placeholder="CÓDIGO DA SALA"
                      aria-label="Código da sala"
                      maxLength={16}
                    />
                    <Button
                      variant="secondary"
                      disabled={busy || inviteCode.trim().length < 4}
                      onClick={() => void lobbyAction({ action: "join", inviteCode: inviteCode.trim() })}
                    >
                        <LogIn /> Entrar na dungeon
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
                <span className="view-eyebrow">DUNGEON COOPERATIVA</span>
                <h2>Próxima dungeon</h2>
                <p>As salas cooperativas estarão disponíveis em <strong>{countdown(nextEvent.startsAt, nextEvent.serverNow)}</strong>.</p>
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
              <div><strong>Dungeon cooperativa indisponível</strong><p>Não há uma dungeon ARPG ativa no momento. Tente novamente mais tarde.</p></div>
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
                const obtained = rewards.some((reward) => reward.event_id === event.id && reward.reward_type === "currency_reward");
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
                      <span>
                        {boss ? `${ELEMENT_META[boss.element].name} · ${boss.rarity.toUpperCase()}` : "Chefe secreto"}
                        {typeof event.rewards.coins === "number" ? ` · ${event.rewards.coins} moedas` : ""}
                        {typeof event.rewards.xp === "number" ? ` · ${event.rewards.xp} XP` : ""}
                      </span>
                    </div>
                    <span className={cn("raid-calendar-status", `is-${event.status}`)}>
                      {obtained
                        ? <><Trophy /> Recompensa recebida</>
                        : event.status === "active"
                          ? "ATIVA"
                          : event.status === "upcoming" ? "Em breve" : "Encerrada"}
                    </span>
                  </div>
                );
              })}
            </article>

            <article className="raid-rules-panel">
              <div className="raid-calendar-panel__heading">
                <Sparkles />
                <div><strong>Como funciona</strong><span>Uma dungeon compartilhada para o grupo</span></div>
              </div>
              <div className="raid-rule">
                <span>01</span><div><strong>Junte 2–4 amigos</strong><p>Crie uma sala e compartilhe o código.</p></div>
              </div>
              <div className="raid-rule">
                <span>02</span><div><strong>Leve sua Lenda ativa</strong><p>Ela entra com dois ataques próprios; armas e relíquias são conquistadas nas masmorras.</p></div>
              </div>
              <div className="raid-rule">
                <span>03</span><div><strong>Avancem pelas salas</strong><p>O grupo limpa encontros, abre baús e enfrenta o chefe da expedição.</p></div>
              </div>
              <div className="raid-rule">
                <span>04</span><div><strong>Receba moedas e XP</strong><p>Participantes elegíveis recebem a recompensa do evento uma única vez.</p></div>
              </div>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
