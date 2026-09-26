"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Dice5,
  Flame,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Swords,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CREATURE_BY_ID, ELEMENT_META } from "@/game/catalog";
import { canPayCost, getActive, getSide } from "@/game/engine";
import { ELEMENTS, type BattleLogEntry, type BattleState, type Element } from "@/game/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreatureCard } from "./creature-card";
import { PixelCreature } from "./pixel-creature";

type BattleResponse = {
  state: BattleState;
  events: BattleLogEntry[];
  token: string;
  authority: "server";
};

function actionId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function callBattleApi(body: Record<string, unknown>): Promise<BattleResponse> {
  const response = await fetch("/api/battle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as BattleResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "A ação não pôde ser concluída.");
  return payload;
}

export function BattleArena({
  open,
  onClose,
  onVictory,
}: {
  open: boolean;
  onClose: () => void;
  onVictory: () => void;
}) {
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [die, setDie] = useState<number | null>(null);
  const [effect, setEffect] = useState<string | null>(null);
  const npcQueuedToken = useRef<string | null>(null);
  const victoryReported = useRef(false);

  const startBattle = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await callBattleApi({ action: "start" });
      setBattle(response.state);
      setToken(response.token);
      victoryReported.current = false;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível iniciar a batalha.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!open || battle || busy) return;
    const timer = window.setTimeout(() => void startBattle(), 0);
    return () => window.clearTimeout(timer);
  }, [battle, busy, open, startBattle]);

  useEffect(() => {
    if (!battle || !token) return;
    localStorage.setItem("card-realms:demo-battle:v1", JSON.stringify({ version: 1, battle, token }));
  }, [battle, token]);

  const perform = useCallback(
    async (payload: Record<string, unknown>, animateRoll = false) => {
      if (!token || busy) return;
      setBusy(true);
      setError("");
      try {
        const response = await callBattleApi({ ...payload, token });
        const rollEvent = response.events.find((entry) => typeof entry.die === "number");
        if (animateRoll && rollEvent?.die) {
          setDie(rollEvent.die);
          const attackId = rollEvent.attackId;
          const currentSide = battle ? getSide(battle, battle.currentSideId) : null;
          const active = currentSide ? getActive(currentSide) : null;
          const definition = active ? CREATURE_BY_ID.get(active.catalogId) : null;
          setEffect(definition?.attacks.find((attack) => attack.id === attackId)?.animation ?? "strike");
          await new Promise((resolve) => window.setTimeout(resolve, 850));
          setDie(null);
          window.setTimeout(() => setEffect(null), 550);
        }
        setBattle(response.state);
        setToken(response.token);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "A ação falhou.");
      } finally {
        setBusy(false);
      }
    },
    [battle, busy, token],
  );

  useEffect(() => {
    if (!battle || !token || busy || battle.status !== "active") return;
    const current = getSide(battle, battle.currentSideId);
    if (current.kind !== "npc" || npcQueuedToken.current === token) return;
    npcQueuedToken.current = token;
    const timer = window.setTimeout(() => {
      void perform({ action: "npc", actionId: actionId("npc") }, true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [battle, busy, perform, token]);

  useEffect(() => {
    if (battle?.status === "finished" && battle.winnerId === "player-one" && !victoryReported.current) {
      victoryReported.current = true;
      onVictory();
    }
  }, [battle, onVictory]);

  const data = useMemo(() => {
    if (!battle) return null;
    const player = getSide(battle, "player-one");
    const opponent = battle.sides.find((side) => side.id !== "player-one")!;
    const playerActive = getActive(player);
    const opponentActive = getActive(opponent);
    return {
      player,
      opponent,
      playerActive,
      opponentActive,
      playerDefinition: CREATURE_BY_ID.get(playerActive.catalogId)!,
      opponentDefinition: CREATURE_BY_ID.get(opponentActive.catalogId)!,
    };
  }, [battle]);

  if (!open) return null;

  if (!battle || !data) {
    return (
      <div className="battle-screen battle-screen--loading">
        <LoaderCircle className="size-8 animate-spin text-primary" />
        <strong>Preparando as seis cartas...</strong>
        {error ? <p>{error}</p> : null}
        {error ? <Button onClick={startBattle}>Tentar novamente</Button> : null}
      </div>
    );
  }

  const playerTurn = battle.currentSideId === data.player.id && battle.status === "active";
  return (
    <div className="battle-screen">
      <header className="battle-topbar">
        <div>
          <span className="battle-eyebrow">Provação das Raízes</span>
          <strong>Rodada {battle.round}</strong>
        </div>
        <div className="battle-turn">
          <span className={cn("battle-turn__dot", playerTurn && "battle-turn__dot--active")} />
          {battle.status === "finished"
            ? "Batalha concluída"
            : playerTurn
              ? "Seu turno"
              : `Turno de ${data.opponent.name}`}
        </div>
        <button type="button" className="battle-close" onClick={onClose} aria-label="Sair da batalha">
          <X />
        </button>
      </header>

      <section className="battle-stage" aria-label="Arena de batalha em pixel art">
        <div className="battle-stage__background" />
        <div className="battle-combatant battle-combatant--opponent">
          <div className="battle-nameplate">
            <div>
              <span>{data.opponent.name}</span>
              <strong>{data.opponentDefinition.name}</strong>
            </div>
            <Badge style={{ color: ELEMENT_META[data.opponentDefinition.element].color }}>
              {ELEMENT_META[data.opponentDefinition.element].name}
            </Badge>
            <span className="battle-hp">{data.opponentActive.hp}/{data.opponentActive.maxHp}</span>
            <Progress value={(data.opponentActive.hp / data.opponentActive.maxHp) * 100} className="col-span-full" indicatorClassName="bg-red-400" />
          </div>
          <PixelCreature
            slot={data.opponentDefinition.artSlot}
            label={data.opponentDefinition.name}
            mirrored
            className="battle-sprite battle-sprite--opponent"
          />
        </div>

        <div className="battle-combatant battle-combatant--player">
          <PixelCreature
            slot={data.playerDefinition.artSlot}
            label={data.playerDefinition.name}
            className="battle-sprite battle-sprite--player"
          />
          <div className="battle-nameplate battle-nameplate--player">
            <div>
              <span>Sua carta ativa</span>
              <strong>{data.playerDefinition.name}</strong>
            </div>
            <Badge style={{ color: ELEMENT_META[data.playerDefinition.element].color }}>
              {ELEMENT_META[data.playerDefinition.element].name}
            </Badge>
            <span className="battle-hp">{data.playerActive.hp}/{data.playerActive.maxHp}</span>
            <Progress value={(data.playerActive.hp / data.playerActive.maxHp) * 100} className="col-span-full" />
          </div>
        </div>

        <AnimatePresence>
          {effect ? (
            <motion.div
              key={effect}
              className={`attack-effect attack-effect--${effect}`}
              initial={{ opacity: 0, scale: 0.3, x: "-35%" }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.2, 0.8], x: ["-35%", "30%", "42%"] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
            >
              <Sparkles />
            </motion.div>
          ) : null}
          {die ? (
            <motion.div
              className={cn("dice-result", die === 1 && "dice-result--miss", die === 6 && "dice-result--critical")}
              initial={{ rotate: -520, scale: 0.1, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 13 }}
            >
              <Dice5 />
              <strong>{die}</strong>
              <span>{die === 1 ? "Falha crítica" : die === 6 ? "Acerto crítico" : "Ataque certeiro"}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      <section className="battle-hand" aria-label="Suas seis cartas de criaturas">
        <div className="battle-hand__label">
          <span>Suas seis cartas</span>
          <small>1 ativa · 5 para substituição</small>
        </div>
        <div className="battle-hand__rail">
          {data.player.team.map((card, index) => {
            const definition = CREATURE_BY_ID.get(card.catalogId)!;
            return (
              <CreatureCard
                key={card.instanceId}
                creature={definition}
                battle={card}
                compact
                active={index === data.player.activeIndex}
                disabled={!playerTurn || busy || card.defeated}
                onClick={() => {
                  if (index !== data.player.activeIndex && !card.defeated) {
                    void perform({ action: "switch", creatureIndex: index, actionId: actionId("switch") });
                  }
                }}
              />
            );
          })}
        </div>
      </section>

      <section className="battle-controls">
        <div className="energy-tray">
          <div className="battle-section-title">
            <span>Cartas de energia</span>
            <small>Escolha até 2 da reserva e vincule até 2 por turno</small>
          </div>
          <div className="energy-tray__rail">
            {ELEMENTS.map((element) => {
              const meta = ELEMENT_META[element];
              const attached = data.playerActive.attachedEnergy[element];
              return (
                <div className="energy-card" key={element} style={{ "--energy": meta.color } as React.CSSProperties}>
                  <span className="energy-card__sigil">{meta.short}</span>
                  <strong>{meta.name}</strong>
                  <span>Disponível {data.player.energyAvailable[element]}</span>
                  <span>Reserva {data.player.energyReserve[element]}</span>
                  <span>Na ativa {attached}</span>
                  <div className="energy-card__actions">
                    <button
                      type="button"
                      disabled={!playerTurn || busy || data.player.acquiredThisTurn >= 2 || data.player.energyReserve[element] < 1}
                      onClick={() => void perform({ action: "acquire", choices: [element], actionId: actionId("acquire") })}
                    >
                      + Reserva
                    </button>
                    <button
                      type="button"
                      disabled={!playerTurn || busy || data.player.attachmentsThisTurn >= 2 || data.player.energyAvailable[element] < 1}
                      onClick={() => void perform({ action: "attach", creatureIndex: data.player.activeIndex, element, actionId: actionId("attach") })}
                    >
                      Vincular
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="attack-panel">
          <div className="battle-section-title">
            <span>Ataques de {data.playerDefinition.name}</span>
            <small>O servidor sorteia o dado após a confirmação</small>
          </div>
          <div className="attack-list">
            {data.playerDefinition.attacks.map((attack) => {
              const affordable = canPayCost(data.playerActive.attachedEnergy, attack.cost);
              const chance = Math.round(((7 - attack.minRoll) / 6) * 100);
              return (
                <button
                  key={attack.id}
                  type="button"
                  className="attack-button"
                  disabled={!playerTurn || busy || !affordable || data.playerActive.defeated}
                  onClick={() => void perform({ action: "attack", attackId: attack.id, actionId: actionId("attack") }, true)}
                >
                  <span className="attack-button__icon"><Swords /></span>
                  <span>
                    <strong>{attack.name}</strong>
                    <small>
                      {Object.entries(attack.cost).map(([element, amount]) => `${amount} ${ELEMENT_META[element as Element].short}`).join(" · ")}
                    </small>
                  </span>
                  <span className="attack-button__stats">
                    <strong>{attack.damage}</strong>
                    <small>{chance}%</small>
                  </span>
                  <ChevronRight />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="battle-log">
        <div className="battle-section-title">
          <span>Crônica da batalha</span>
          <ShieldCheck />
        </div>
        <div className="battle-log__entries">
          {battle.log.slice(-5).reverse().map((entry) => (
            <p key={entry.id}>
              {entry.die ? <strong>D{entry.die}</strong> : null} {entry.message}
            </p>
          ))}
        </div>
      </aside>

      {error ? <div className="battle-error">{error}</div> : null}
      {busy ? <div className="battle-busy"><LoaderCircle className="animate-spin" /> Validando ação...</div> : null}

      {battle.status === "finished" ? (
        <div className="battle-victory">
          <div className="battle-victory__mark"><Flame /></div>
          <span>Provação concluída</span>
          <h2>{battle.winnerId === "player-one" ? "Sua equipe venceu" : "A guardiã venceu desta vez"}</h2>
          <p>
            {battle.winnerId === "player-one"
              ? "Você conquistou 120 moedas, experiência e um fragmento de vínculo."
              : "Revise suas energias, troque a carta ativa e tente novamente."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="game" size="lg" onClick={onClose}>
              Voltar ao mapa
            </Button>
            <Button variant="secondary" size="lg" onClick={startBattle}>
              <RotateCcw /> Nova batalha
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
