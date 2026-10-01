"use client";

import {
  BookOpen,
  Check,
  ChevronLeft,
  Crown,
  Dice5,
  Info,
  Layers3,
  LoaderCircle,
  Radio,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CREATURE_BY_ID, ELEMENT_META } from "@/game/catalog";
import {
  type RaidLogEntry,
  type RaidState,
} from "@/game/raid";
import {
  canPayCost,
  getActive,
  getAttackById,
} from "@/game/engine";
import type { Element } from "@/game/types";
import { Button } from "@/components/ui/button";
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
  };
  event: {
    id: string;
    title: string;
    boss_creature_id: string;
    min_players: number;
    max_players: number;
    recommended_level: number;
  };
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
  mythicalReward: {
    obtained: boolean;
    creatureCardId: string | null;
    grantedAt: string | null;
  };
  error?: string;
};

type RaidActionResponse = {
  state: RaidState;
  events: RaidLogEntry[];
  version: number;
  reward?: {
    grantedCount?: number;
    creatureCardId?: string;
  } | null;
  error?: string;
};

function actionId() {
  return crypto.randomUUID();
}

export function RaidArena({
  roomId,
  playerId,
  onClose,
}: {
  roomId: string;
  playerId: string;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState<RaidRoomPayload | null>(null);
  const [state, setState] = useState<RaidState | null>(null);
  const [version, setVersion] = useState(0);
  const [panel, setPanel] = useState<"menu" | "attack" | "cards" | "team" | "info">("menu");
  const [selectedAttackId, setSelectedAttackId] = useState<string | null>(null);
  const [selectedEnergyId, setSelectedEnergyId] = useState<string | null>(null);
  const [energyTarget, setEnergyTarget] = useState<number | null>(null);
  const [selectedPowerId, setSelectedPowerId] = useState<string | null>(null);
  const [powerTarget, setPowerTarget] = useState<number | null>(null);
  const [switchTarget, setSwitchTarget] = useState<number | null>(null);
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
      if (body.state) {
        setState((current) => {
          if (!current || body.room.version >= version) return body.state;
          return current;
        });
        setVersion(body.room.version);
      }
      const nextEvents = (body.events ?? [])
        .map((entry) => entry.payload)
        .filter(Boolean)
        .slice(-12);
      if (nextEvents.length) setRecentEvents(nextEvents);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A Raid não respondeu.");
    } finally {
      setLoading(false);
    }
  }, [roomId, version]);

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
  const activeCreature = player ? getActive(player.side) : null;
  const activeDefinition = activeCreature ? CREATURE_BY_ID.get(activeCreature.catalogId) ?? null : null;
  const bossDefinition = state ? CREATURE_BY_ID.get(state.boss.catalogId) ?? null : null;
  const playerTurn = Boolean(state && player && state.status === "active" && state.turn.actorId === playerId);
  const forcedSwitch = Boolean(playerTurn && player?.needsSwitch);
  const activePanel = forcedSwitch ? "team" : panel;

  const equippedAttacks = useMemo(() => {
    if (!activeCreature || !activeDefinition) return [];
    const ids = activeCreature.equippedPowerIds.length > 0
      ? activeCreature.equippedPowerIds
      : [activeDefinition.attacks[0].id];
    return ids
      .map((id) => getAttackById(id))
      .filter((attack): attack is NonNullable<typeof attack> => Boolean(attack));
  }, [activeCreature, activeDefinition]);

  async function perform(action: Record<string, unknown>) {
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
      setSelectedAttackId(null);
      setSelectedEnergyId(null);
      setEnergyTarget(null);
      setSelectedPowerId(null);
      setPowerTarget(null);
      setSwitchTarget(null);
      setPanel("menu");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A ação da Raid foi recusada.");
      if (caught instanceof Error && caught.message.includes("avançou")) await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !state || !player || !activeCreature || !activeDefinition || !bossDefinition) {
    return (
      <div className="raid-battle raid-battle--loading">
        <LoaderCircle className="animate-spin" />
        <strong>Sincronizando a Raid...</strong>
        {error ? <p>{error}</p> : null}
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
      </div>
    );
  }

  const bossHp = Math.max(0, Math.min(100, (state.boss.hp / state.boss.maxHp) * 100));
  const selectedAttack = selectedAttackId ? getAttackById(selectedAttackId) : null;
  const selectedEnergy = selectedEnergyId
    ? player.side.energyHand.find((card) => card.id === selectedEnergyId) ?? null
    : null;
  const selectedPower = selectedPowerId
    ? player.side.powerHand.find((card) => card.id === selectedPowerId) ?? null
    : null;
  const selectedPowerAttack = selectedPower ? getAttackById(selectedPower.attackId) : null;
  const canEvolve = state.turn.round >= 2
    && (activeCreature.evolutionStage ?? 0) === 0
    && activeCreature.attachedEnergy.filter((card) => card.element === activeDefinition.element).length >= 2;
  const latestEvent = recentEvents.at(-1) ?? state.log.at(-1);

  return (
    <div className={cn(
      "raid-battle",
      state.terrain && `is-terrain-${state.terrain.element}`,
      state.boss.phase === 3 && "is-enraged",
    )}>
      <header className="raid-battle__topbar">
        <div>
          <span className="view-eyebrow">RAID MÍTICA · RODADA {state.turn.round}</span>
          <strong>{payload?.event.title ?? bossDefinition.name}</strong>
        </div>
        <div className="raid-battle__connection">
          <Radio /> servidor · v{version}
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar tela da Raid"><X /></button>
      </header>

      <main className="raid-stage">
        <div className="raid-boss-hud">
          <div className="raid-boss-hud__title">
            <Crown />
            <div>
              <strong>{state.boss.name}</strong>
              <span>MÍTICO · {ELEMENT_META[state.boss.element].name} · FASE {state.boss.phase}</span>
            </div>
          </div>
          <div className="raid-boss-hud__hp">
            <span>HP</span>
            <div><motion.i animate={{ width: `${bossHp}%` }} /></div>
            <strong>{state.boss.hp.toLocaleString("pt-BR")} / {state.boss.maxHp.toLocaleString("pt-BR")}</strong>
          </div>
        </div>

        {state.terrain ? (
          <div className={cn("raid-terrain-banner", `is-${state.terrain.element}`)}>
            <Sparkles />
            Terreno de {ELEMENT_META[state.terrain.element].name}
          </div>
        ) : null}

        <motion.div
          className={cn("raid-boss-sprite", state.boss.phase === 3 && "is-phase-three")}
          animate={{
            y: [0, -8, 0],
            rotate: state.boss.phase === 3 ? [0, -1.5, 1.5, 0] : 0,
            scale: state.boss.phase === 3 ? 1.08 : 1,
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="raid-mythic-aura" />
          <PixelCreature sprite={bossDefinition.sprite} label={bossDefinition.name} />
          <span className="raid-boss-shadow" />
        </motion.div>

        <div className="raid-allies" aria-label="Criaturas dos jogadores">
          {state.players.map((ally) => {
            const creature = getActive(ally.side);
            const definition = CREATURE_BY_ID.get(creature.catalogId)!;
            const hp = Math.max(0, Math.min(100, (creature.hp / creature.maxHp) * 100));
            const isYou = ally.id === playerId;
            const isActing = state.turn.actorId === ally.id;
            return (
              <motion.article
                key={ally.id}
                className={cn(
                  "raid-fighter",
                  `raid-fighter--seat-${ally.seat}`,
                  isYou && "is-you",
                  isActing && "is-acting",
                  ally.eliminated && "is-eliminated",
                )}
                animate={ally.eliminated ? { opacity: .35, scale: .86 } : { y: [0, -4, 0] }}
                transition={{ duration: 2 + ally.seat * .13, repeat: ally.eliminated ? 0 : Infinity, ease: "easeInOut" }}
              >
                <div className="raid-fighter__label">
                  <strong>{isYou ? "VOCÊ" : ally.name}</strong>
                  <span>{definition.name}</span>
                </div>
                <div className="raid-fighter__sprite">
                  <PixelCreature sprite={definition.sprite} label={definition.name} />
                </div>
                <div className="raid-fighter__hp">
                  <div><i style={{ width: `${hp}%` }} /></div>
                  <span>{creature.hp}/{creature.maxHp}</span>
                </div>
                <div className="raid-fighter__resources">
                  <span>{creature.attachedEnergy.length} EN</span>
                  <span>{creature.equippedPowerIds.length}/4 POD</span>
                </div>
              </motion.article>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {latestEvent ? (
            <motion.div
              key={latestEvent.id}
              className={cn(
                "raid-event-callout",
                latestEvent.kind === "critical" && "is-critical",
                latestEvent.kind === "phase_changed" && "is-phase",
                latestEvent.kind === "boss_area_attack" && "is-boss",
              )}
              initial={{ opacity: 0, y: 18, scale: .94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
            >
              {typeof latestEvent.die === "number" ? <Dice5 /> : latestEvent.kind.includes("boss") ? <Crown /> : <Swords />}
              <span>{latestEvent.message}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <section className="raid-command-area">
        {error ? <div className="raid-command-error">{error}</div> : null}

        {state.status === "victory" ? (
          <div className="raid-result raid-result--victory">
            <div className="raid-result__card">
              <span className="raid-mythic-aura" />
              <PixelCreature sprite={bossDefinition.sprite} label={bossDefinition.name} />
              <Crown />
            </div>
            <div>
              <span className="view-eyebrow">RAID CONCLUÍDA</span>
              <h2>{bossDefinition.name} foi derrotado!</h2>
              <p>
                {payload?.mythicalReward.obtained
                  ? "✓ RECOMPENSA MÍTICA OBTIDA — a carta já está na sua coleção."
                  : "A recompensa está sendo confirmada pelo servidor."}
              </p>
              <Button variant="game" onClick={() => void refresh()}><Trophy /> Atualizar recompensa</Button>
            </div>
          </div>
        ) : state.status === "defeat" ? (
          <div className="raid-result raid-result--defeat">
            <Crown />
            <div><span className="view-eyebrow">RAID ENCERRADA</span><h2>O grupo foi derrotado.</h2><p>Reorganize a equipe e tente novamente enquanto o evento estiver ativo.</p></div>
            <Button variant="secondary" onClick={onClose}>Voltar</Button>
          </div>
        ) : activePanel === "menu" ? (
          <div className="raid-command-root">
            <div className="raid-dialogue">
              <span className="view-eyebrow">
                {playerTurn ? "SEU TURNO" : state.turn.actorKind === "boss" ? "TURNO DO BOSS" : "AGUARDANDO ALIADO"}
              </span>
              <strong>
                {forcedSwitch
                  ? "Escolha sua próxima criatura."
                  : playerTurn
                    ? `O que ${activeDefinition.name} fará?`
                    : latestEvent?.message ?? "Aguardando a próxima ação confirmada pelo servidor."}
              </strong>
              <small>
                {state.terrain
                  ? `Terreno compartilhado: ${ELEMENT_META[state.terrain.element].name}`
                  : `Fase ${state.boss.phase} · ${state.players.filter((entry) => !entry.eliminated).length} Cartógrafos ativos`}
              </small>
            </div>
            <div className="raid-command-grid">
              <button disabled={!playerTurn || forcedSwitch || busy} onClick={() => setPanel("attack")}><Swords /><span>ATACAR</span></button>
              <button disabled={!playerTurn || forcedSwitch || busy} onClick={() => setPanel("cards")}><BookOpen /><span>CARTAS</span></button>
              <button disabled={!playerTurn || busy} onClick={() => setPanel("team")}><Users /><span>EQUIPE</span></button>
              <button disabled={busy} onClick={() => setPanel("info")}><Info /><span>INFO</span></button>
            </div>
          </div>
        ) : (
          <div className={cn("raid-submenu", `raid-submenu--${activePanel}`)}>
            <div className="raid-submenu__top">
              <button type="button" onClick={() => setPanel("menu")}><ChevronLeft /> VOLTAR</button>
              <strong>{activePanel === "attack" ? "ATAQUES" : activePanel === "cards" ? "CARTAS" : activePanel === "team" ? "EQUIPE" : "INFO DA RAID"}</strong>
              <small>{playerTurn ? "Seu turno" : "Somente leitura"}</small>
            </div>

            {activePanel === "attack" ? (
              <div className="raid-attack-layout">
                <div className="raid-attack-list">
                  {equippedAttacks.map((attack, index) => (
                    <button
                      type="button"
                      key={attack.id}
                      disabled={!playerTurn || busy || !canPayCost(activeCreature.attachedEnergy, attack.cost)}
                      className={cn(selectedAttackId === attack.id && "is-selected")}
                      onClick={() => setSelectedAttackId(attack.id)}
                    >
                      <span>{index + 1}</span>
                      <div><strong>{attack.name}</strong><small>{attack.damage} DMG · D6 {attack.minRoll}+</small></div>
                    </button>
                  ))}
                </div>
                <div className="raid-attack-preview">
                  {selectedAttack ? (
                    <>
                      <span className="view-eyebrow">ALVO: {state.boss.name}</span>
                      <strong>{selectedAttack.name}</strong>
                      <p>{selectedAttack.description}</p>
                      <div className="raid-energy-cost">
                        {Object.entries(selectedAttack.cost).map(([element, amount]) => (
                          <span key={element}>{amount} {ELEMENT_META[element as Element].short}</span>
                        ))}
                      </div>
                      <Button
                        variant="game"
                        disabled={busy || !playerTurn || !canPayCost(activeCreature.attachedEnergy, selectedAttack.cost)}
                        onClick={() => void perform({ action: "attack", attackId: selectedAttack.id })}
                      >
                        <Swords /> ATACAR O BOSS
                      </Button>
                    </>
                  ) : <p>Escolha um poder equipado para ver seus detalhes.</p>}
                </div>
              </div>
            ) : null}

            {activePanel === "cards" ? (
              <div className="raid-cards-layout">
                <div className="raid-card-decks">
                  <div><span>ENERGIA</span><strong>{player.side.energyDeck.length}</strong><small>no baralho</small></div>
                  <button
                    type="button"
                    disabled={!playerTurn || busy || player.side.powerDrawsRemaining < 1}
                    onClick={() => void perform({ action: "draw_power" })}
                  >
                    <span>PODER</span><strong>{player.side.powerDeck.length}</strong><small>comprar 1</small>
                  </button>
                </div>
                <div className="raid-hand">
                  {player.side.energyHand.map((card) => (
                    <button
                      type="button"
                      key={card.id}
                      className={cn("raid-hand-card", `is-${card.element}`, selectedEnergyId === card.id && "is-selected")}
                      onClick={() => {
                        setSelectedEnergyId(card.id);
                        setSelectedPowerId(null);
                        setEnergyTarget(null);
                      }}
                    >
                      <span>{ELEMENT_META[card.element].short}</span>
                      <strong>Energia</strong>
                      <small>{ELEMENT_META[card.element].name}</small>
                    </button>
                  ))}
                  {player.side.powerHand.map((card) => {
                    const attack = getAttackById(card.attackId);
                    return attack ? (
                      <button
                        type="button"
                        key={card.id}
                        className={cn("raid-hand-card is-power", selectedPowerId === card.id && "is-selected")}
                        onClick={() => {
                          setSelectedPowerId(card.id);
                          setSelectedEnergyId(null);
                          setPowerTarget(null);
                        }}
                      >
                        <span>{ELEMENT_META[card.element].short}</span>
                        <strong>{attack.name}</strong>
                        <small>{attack.damage} DMG</small>
                      </button>
                    ) : null;
                  })}
                </div>
                <div className="raid-card-target">
                  {selectedEnergy ? (
                    <>
                      <strong>Vincular Energia de {ELEMENT_META[selectedEnergy.element].name}</strong>
                      <div className="raid-mini-team">
                        {player.side.team.map((creature, index) => {
                          const definition = CREATURE_BY_ID.get(creature.catalogId)!;
                          return (
                            <button
                              key={creature.instanceId}
                              type="button"
                              disabled={creature.defeated}
                              className={cn(energyTarget === index && "is-selected")}
                              onClick={() => setEnergyTarget(index)}
                            >
                              <PixelCreature sprite={definition.sprite} label={definition.name} />
                              <span>{definition.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      <Button
                        variant="game"
                        disabled={!playerTurn || busy || energyTarget === null || player.side.attachmentsRemaining < 1}
                        onClick={() => void perform({ action: "attach", creatureIndex: energyTarget, cardId: selectedEnergy.id })}
                      >
                        Vincular
                      </Button>
                    </>
                  ) : selectedPower && selectedPowerAttack ? (
                    <>
                      <strong>Equipar {selectedPowerAttack.name}</strong>
                      <div className="raid-mini-team">
                        {player.side.team.map((creature, index) => {
                          const definition = CREATURE_BY_ID.get(creature.catalogId)!;
                          const compatible = definition.element === selectedPower.element && !creature.defeated;
                          return (
                            <button
                              key={creature.instanceId}
                              type="button"
                              disabled={!compatible}
                              className={cn(powerTarget === index && "is-selected")}
                              onClick={() => setPowerTarget(index)}
                            >
                              <PixelCreature sprite={definition.sprite} label={definition.name} />
                              <span>{definition.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      {powerTarget !== null ? (
                        <div className="raid-power-slots">
                          {player.side.team[powerTarget].equippedPowerIds.length < 4 ? (
                            <Button
                              variant="game"
                              disabled={!playerTurn || busy}
                              onClick={() => void perform({
                                action: "equip_power",
                                creatureIndex: powerTarget,
                                cardId: selectedPower.id,
                              })}
                            >
                              Equipar poder
                            </Button>
                          ) : player.side.team[powerTarget].equippedPowerIds.map((id, slot) => (
                            <button
                              type="button"
                              key={`${id}:${slot}`}
                              onClick={() => void perform({
                                action: "equip_power",
                                creatureIndex: powerTarget,
                                cardId: selectedPower.id,
                                slot,
                              })}
                            >
                              Substituir {slot + 1}. {getAttackById(id)?.name ?? "Poder"}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="raid-card-help">
                      <BookOpen />
                      <p>Escolha uma Energia ou Carta de Poder da sua mão.</p>
                      <Button
                        variant="secondary"
                        disabled={!playerTurn || busy || !canEvolve}
                        onClick={() => void perform({ action: "evolve" })}
                      >
                        <Sparkles /> EVOLUIR ATIVA
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {activePanel === "team" ? (
              <div className="raid-team-layout">
                {player.side.team.map((creature, index) => {
                  const definition = CREATURE_BY_ID.get(creature.catalogId)!;
                  const isActive = index === player.side.activeIndex;
                  return (
                    <article key={creature.instanceId} className={cn("raid-team-card", isActive && "is-active", creature.defeated && "is-defeated")}>
                      <PixelCreature sprite={definition.sprite} label={definition.name} />
                      <div>
                        <strong>{definition.name}</strong>
                        <span>{creature.hp}/{creature.maxHp} HP</span>
                        <small>{creature.attachedEnergy.length} EN · {creature.equippedPowerIds.length}/4 POD</small>
                      </div>
                      <Button
                        size="sm"
                        variant={switchTarget === index ? "game" : "secondary"}
                        disabled={!playerTurn || busy || isActive || creature.defeated}
                        onClick={() => setSwitchTarget(index)}
                      >
                        {forcedSwitch ? "ESCOLHER" : "TROCAR"}
                      </Button>
                    </article>
                  );
                })}
                {switchTarget !== null ? (
                  <div className="raid-team-confirm">
                    <strong>Enviar {CREATURE_BY_ID.get(player.side.team[switchTarget].catalogId)?.name}?</strong>
                    <Button variant="game" disabled={busy || !playerTurn} onClick={() => void perform({ action: "switch", creatureIndex: switchTarget })}>
                      <Check /> Confirmar troca
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activePanel === "info" ? (
              <div className="raid-info-layout">
                <article>
                  <Crown />
                  <div><span>Boss</span><strong>{state.boss.name}</strong><small>{state.boss.hp}/{state.boss.maxHp} HP · Fase {state.boss.phase}</small></div>
                </article>
                <article>
                  <Layers3 />
                  <div><span>Terreno</span><strong>{state.terrain ? ELEMENT_META[state.terrain.element].name : "Nenhum"}</strong><small>{state.terrain ? `até a rodada ${state.terrain.expiresAfterTurn}` : "Pode mudar durante a luta"}</small></div>
                </article>
                <article>
                  <Users />
                  <div><span>Aliados</span><strong>{state.players.filter((entry) => !entry.eliminated).length}/{state.players.length} ativos</strong><small>{state.players.map((entry) => entry.name).join(" · ")}</small></div>
                </article>
                <article>
                  <Shield />
                  <div><span>Sua contribuição</span><strong>{player.contribution.actions} ações válidas</strong><small>{player.contribution.damage} dano · {player.contribution.shield} escudo · {player.contribution.terrain} Terrenos</small></div>
                </article>
                <div className="raid-turn-order">
                  <span className="view-eyebrow">ORDEM DA RODADA</span>
                  {state.turnOrder.map((id, index) => (
                    <span key={id} className={cn(index === state.turn.index && "is-current")}>
                      {id === "raid-boss" ? state.boss.name : state.players.find((entry) => entry.id === id)?.name ?? "Cartógrafo"}
                    </span>
                  ))}
                </div>
                <Button variant="secondary" onClick={onClose}>Fechar tela — a Raid continua no servidor</Button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
