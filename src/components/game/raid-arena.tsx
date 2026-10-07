"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock3, Crown, Dice5, LoaderCircle, Radio, Shield, Swords, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CharacterAvatar2D } from "./character-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { CREATURE_BY_ID, ELEMENT_META } from "@/game/catalog";
import type { RaidGameplayMode, RaidLogEntry, RaidState } from "@/game/raid";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PixelCreature } from "./pixel-creature";

type RaidRoomPayload = {
  room: {
    id: string;
    eventId: string;
    hostId: string;
    inviteCode: string;
    status: "lobby" | "active" | "victory" | "defeat" | "closed";
    version: number;
    gameplayMode: RaidGameplayMode;
    gameplayVersion: number;
  };
  event: {
    id: string;
    title: string;
    boss_creature_id: string;
    min_players: number;
    max_players: number;
    recommended_level: number;
  };
  gameplayMode: RaidGameplayMode;
  participants: Array<{
    id: string;
    name: string;
    level: number;
    seat: number;
    isReady: boolean;
    presenceStatus: string;
    contribution: Record<string, unknown>;
  }>;
  state: RaidState | null;
  events: Array<{
    sequence: number;
    event_type: string;
    payload: RaidLogEntry;
    created_at: string;
  }>;
  eventReward: {
    obtained: boolean;
    coinsAwarded: number;
    xpAwarded: number;
    grantedAt: string | null;
  };
  historicalRewards?: Array<{
    reward_type: string;
    creature_card_id: string | null;
    ability_card_id: string | null;
    granted_at: string;
  }>;
  error?: string;
};

type RaidActionResponse = {
  state: RaidState;
  events: RaidLogEntry[];
  version: number;
  reward?: {
    coinsGranted?: number;
    xpGranted?: number;
    grantedCount?: number;
  } | null;
  error?: string;
};

function actionId() {
  return crypto.randomUUID();
}

function healthPercent(current: number, max: number) {
  return Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
}

function getRaidLegendAnimation(
  player: RaidState["players"][number],
  event: RaidLogEntry | null,
) {
  if (player.eliminated || player.side.hp <= 0) return "defeat" as const;
  if (!event) return "idle" as const;

  if (event.actorId === player.id) {
    if (event.kind === "ability_used" && event.abilityId) {
      const ability = ARPG_ABILITY_CARD_BY_ID.get(event.abilityId);
      return ability?.behavior === "projectile" || ability?.behavior === "piercing-projectile"
        ? "shoot" as const
        : "attack" as const;
    }
    if (event.kind === "attack_hit" || event.kind === "critical") return "attack" as const;
  }

  const bossHitKinds = new Set(["attack_hit", "critical", "boss_attack", "boss_area_attack"]);
  if (bossHitKinds.has(event.kind) && event.targetIds?.includes(player.id)) return "damage" as const;
  return "idle" as const;
}

export function RaidArena({
  roomId,
  playerId,
  gameplayMode,
  onClose,
}: {
  roomId: string;
  playerId: string;
  gameplayMode: RaidGameplayMode;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState<RaidRoomPayload | null>(null);
  const [state, setState] = useState<RaidState | null>(null);
  const [version, setVersion] = useState(0);
  const [recentEvents, setRecentEvents] = useState<RaidLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/raids/rooms/${roomId}`, { cache: "no-store" });
      const body = (await response.json()) as RaidRoomPayload;
      if (!response.ok) throw new Error(body.error ?? "A Raid não respondeu.");
      setPayload(body);
      setVersion((current) => {
        if (body.room.version < current) return current;
        setState(body.state);
        return body.room.version;
      });
      const nextEvents = (body.events ?? []).map((entry) => entry.payload).filter(Boolean).slice(-10);
      if (nextEvents.length) setRecentEvents(nextEvents);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A Raid não respondeu.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 2200);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    let removeChannel: (() => void) | null = null;
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      const channel = supabase
        .channel(`raid:room:${roomId}`, { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, () => void refresh())
        .on("broadcast", { event: "UPDATE" }, () => void refresh())
        .on("broadcast", { event: "DELETE" }, () => void refresh())
        .subscribe();
      removeChannel = () => void supabase.removeChannel(channel);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      removeChannel?.();
    };
  }, [refresh, roomId]);

  const player = useMemo(
    () => state?.players.find((entry) => entry.id === playerId) ?? null,
    [playerId, state],
  );
  const bossDefinition = state ? CREATURE_BY_ID.get(state.boss.catalogId) ?? null : null;
  const playerTurn = Boolean(state && player && state.status === "active" && state.turn.actorId === playerId);
  const latestEvent = recentEvents.at(-1) ?? state?.log.at(-1) ?? null;

  async function perform(action: { action: "attach"; cardId: string } | { action: "ability"; slot: 0 | 1 } | { action: "pass" }) {
    if (!state || !player) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/raids/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId,
          expectedVersion: version,
          actionId: actionId(),
          ...action,
        }),
      });
      const body = (await response.json()) as RaidActionResponse;
      if (!response.ok) throw new Error(body.error ?? "A ação da Raid foi recusada.");
      setState(body.state);
      setVersion(body.version);
      setRecentEvents(body.events ?? []);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A ação da Raid foi recusada.");
      if (caught instanceof Error && caught.message.includes("avançou")) await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !payload) {
    return (
      <div className="raid-battle raid-battle--loading">
        <LoaderCircle className="animate-spin" />
        <strong>Sincronizando a Raid...</strong>
        {error ? <p>{error}</p> : null}
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
      </div>
    );
  }

  if (gameplayMode === "legacy" || payload.gameplayMode === "legacy") {
    return (
      <section className="raid-battle raid-battle--archive" aria-labelledby="raid-archive-title">
        <div className="raid-battle__topbar">
          <div><Crown /><strong>{payload.event.title}</strong><Badge>Histórico</Badge></div>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
        <div className="raid-archive-note">
          <Shield />
          <div>
            <span className="view-eyebrow">SALA PRESERVADA</span>
            <h2 id="raid-archive-title">Combate antigo arquivado</h2>
            <p>O resultado e os registros históricos continuam salvos. Novas Raids usam a Lenda ativa e os dois ataques próprios dela.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!state || !player || !bossDefinition) {
    return (
      <div className="raid-battle raid-battle--loading">
        <Shield />
        <strong>Esta sala não contém um combate de Lenda ativo.</strong>
        {error ? <p>{error}</p> : null}
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
      </div>
    );
  }

  const bossHp = healthPercent(state.boss.hp, state.boss.maxHp);
  const latestKind = latestEvent?.kind ?? "";
  const statusLabel = state.status === "victory" ? "Vitória" : state.status === "defeat" ? "Derrota" : "Ao vivo";
  const legendAnimations = new Map(state.players.map((entry) => [
    entry.id,
    getRaidLegendAnimation(entry, latestEvent),
  ] as const));

  return (
    <div className={cn("raid-battle", state.boss.enraged && "is-enraged")}>
      <header className="raid-battle__topbar">
        <div>
          <Crown />
          <strong>{payload.event.title}</strong>
          <Badge className={state.status === "active" ? "raid-live-badge is-live" : "raid-live-badge is-waiting"}>
            {state.status === "active" ? <Radio /> : <Trophy />}{statusLabel}
          </Badge>
        </div>
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
      </header>

      <main className="raid-stage raid-avatar-stage">
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {latestEvent?.message ? `${latestEvent.message} ` : ""}
          {playerTurn
            ? "Sua vez. Escolha um dos seus dois ataques próprios."
            : state.turn.actorKind === "boss"
              ? "Turno do chefe."
              : "Aguardando o próximo Cartógrafo."}
        </p>
        <section className="raid-boss-hud" aria-label="Vida do chefe">
          <div className="raid-boss-hud__title">
            <Crown />
            <div><strong>{state.boss.name}</strong><span>Fase {state.boss.phase} · {state.boss.hp.toLocaleString("pt-BR")} / {state.boss.maxHp.toLocaleString("pt-BR")} HP</span></div>
          </div>
          <div className="raid-boss-hud__hp"><div><i style={{ width: `${bossHp}%` }} /></div><strong>{Math.round(bossHp)}%</strong></div>
        </section>

        {state.terrain ? (
          <div className="raid-terrain-banner"><Shield /><span>Terreno de {ELEMENT_META[state.terrain.element].name} · até a rodada {state.terrain.expiresAfterTurn}</span></div>
        ) : null}

        <div className="raid-boss-sprite raid-avatar-boss">
          <span className="raid-mythic-aura" />
          <PixelCreature sprite={bossDefinition.sprite} label={bossDefinition.name} />
        </div>

        <div className="raid-allies raid-avatar-allies" aria-label="Cartógrafos na Raid">
          {state.players.map((entry) => (
            <article
              className={cn("raid-fighter raid-avatar-fighter", entry.id === playerId && "is-you", state.turn.actorId === entry.id && "is-acting", entry.eliminated && "is-defeated")}
              key={entry.id}
            >
              <div className="raid-fighter__sprite"><CharacterAvatar2D
                key={`${entry.id}:${latestEvent?.id ?? "idle"}`}
                config={entry.side.avatarConfig}
                compact
                animation={legendAnimations.get(entry.id) ?? "idle"}
                animationDurationMs={420}
                ariaLabel={entry.id === playerId ? `Sua Lenda ativa, ${entry.name}` : `Lenda ativa de ${entry.name}`}
              /></div>
              <div className="raid-fighter__label"><strong>{entry.name}{entry.id === playerId ? " · você" : ""}</strong><span>{entry.side.hp}/{entry.side.maxHp} HP</span></div>
              <div className="raid-fighter__hp"><div><i style={{ width: `${healthPercent(entry.side.hp, entry.side.maxHp)}%` }} /></div></div>
            </article>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {latestEvent ? (
            <motion.div
              key={latestEvent.id}
              className={cn("raid-event-callout", (latestKind === "critical" || latestKind === "ability_used") && "is-critical", latestKind.includes("boss") && "is-boss")}
              initial={{ opacity: 0, y: 14, scale: .96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {typeof latestEvent.die === "number" ? <Dice5 /> : latestKind.includes("boss") ? <Crown /> : <Swords />}
              <span>{latestEvent.message}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <section className="raid-command-area raid-avatar-command">
        {error ? <div className="raid-command-error" role="alert">{error}</div> : null}

        {state.status === "victory" ? (
          <div className="raid-result raid-result--victory">
            <div className="raid-result__card"><span className="raid-mythic-aura" /><PixelCreature sprite={bossDefinition.sprite} label={bossDefinition.name} /><Trophy /></div>
            <div>
              <span className="view-eyebrow">RAID CONCLUÍDA</span>
              <h2>{bossDefinition.name} foi derrotado!</h2>
              <p>{payload.eventReward.obtained
                ? `Recompensa do evento: ${payload.eventReward.coinsAwarded} moedas e ${payload.eventReward.xpAwarded} XP. Os dois ataques próprios da sua Lenda continuam disponíveis na Guilda.`
                : "A recompensa de moedas e XP está sendo confirmada pelo servidor."}</p>
              <Button variant="game" onClick={() => void refresh()}><Trophy /> Atualizar recompensa</Button>
            </div>
          </div>
        ) : state.status === "defeat" ? (
          <div className="raid-result raid-result--defeat">
            <Crown />
            <div><span className="view-eyebrow">RAID ENCERRADA</span><h2>O grupo foi derrotado.</h2><p>Escolha sua Lenda ativa e use os dois ataques próprios dela ao tentar novamente.</p></div>
            <Button variant="secondary" onClick={onClose}>Voltar</Button>
          </div>
        ) : (
          <div className="raid-avatar-controls">
            <div className="raid-dialogue">
              <span className="view-eyebrow">{playerTurn ? "SEU TURNO" : state.turn.actorKind === "boss" ? "TURNO DO CHEFE" : "AGUARDANDO ALIADO"}</span>
              <strong>{playerTurn ? "Escolha um dos seus dois ataques próprios." : latestEvent?.message ?? "Aguardando uma ação confirmada pelo servidor."}</strong>
              <small>{state.terrain
                ? `Terreno compartilhado: ${ELEMENT_META[state.terrain.element].name}`
                : `Fase ${state.boss.phase} · ${state.players.filter((entry) => !entry.eliminated).length} Cartógrafos ativos`}</small>
            </div>

            <div className="raid-avatar-powers" aria-label="Seus dois ataques próprios">
              {player.side.abilityIds.map((abilityId, slot) => {
                const ability = ARPG_ABILITY_CARD_BY_ID.get(abilityId);
                const cooldown = player.side.abilityCooldowns[slot as 0 | 1];
                if (!ability) return null;
                return (
                  <button
                    type="button"
                    className={cn("raid-avatar-power", `is-${ability.element}`, cooldown > 0 && "is-cooling")}
                    key={abilityId}
                    disabled={!playerTurn || busy || cooldown > 0}
                    onClick={() => void perform({ action: "ability", slot: slot as 0 | 1 })}
                  >
                    <span className="raid-avatar-power__slot">{slot + 1}</span>
                    <span className="raid-avatar-power__element">{ELEMENT_META[ability.element].name}</span>
                    <strong>{ability.name}</strong>
                    <small>{ability.damage} de dano base · D6 · recarga {cooldown > 0 ? `${cooldown} turno(s)` : `${Math.ceil(ability.cooldownMs / 1000)}s`}</small>
                    {cooldown > 0 ? <span className="raid-avatar-power__cooldown"><Clock3 /> Recarregando</span> : <span className="raid-avatar-power__cast"><Swords /> Usar ataque</span>}
                  </button>
                );
              })}
            </div>

            <div className="raid-avatar-energy-row">
              <div><strong>Energia</strong><span>Use uma carta para fortalecer a próxima ação.</span></div>
              <div className="raid-avatar-energy-cards">
                {player.side.energyHand.slice(0, 6).map((card) => (
                  <button
                    type="button"
                    key={card.id}
                    className={cn(`is-${card.element}`)}
                    disabled={!playerTurn || busy || player.side.attachmentsRemaining < 1}
                    onClick={() => void perform({ action: "attach", cardId: card.id })}
                    aria-label={`Vincular Energia de ${ELEMENT_META[card.element].name} à próxima ação`}
                    title={`Vincular Energia de ${ELEMENT_META[card.element].name}`}
                  >
                    <span>{ELEMENT_META[card.element].short}</span>
                    <small>{ELEMENT_META[card.element].name}</small>
                  </button>
                ))}
              </div>
              <Button variant="secondary" disabled={!playerTurn || busy} onClick={() => void perform({ action: "pass"})}>Passar turno</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
