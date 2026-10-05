"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, LoaderCircle, ShieldCheck, SkipForward, Sparkles, Swords, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { ELEMENT_META } from "@/game/domain/elements";
import type { GuestBattleSetup } from "@/game/battle/guest-setup";
import type { BattleBoardId } from "@/game/battle/presentation";
import { presentationDuration, toBattlePresentationEvents, type BattlePresentationEvent } from "@/game/battle/presentation-events";
import { getOpponent, getSide } from "@/game/engine";
import type { BattleEncounter, BattleLogEntry, BattleReward, BattleState, EnergyPool } from "@/game/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BattleBoardScene } from "./battle-board-scene";
import { BattleDiceRoll } from "./battle-dice-roll";
import { BattleLogSheet } from "./battle-log-sheet";
import { BattleTopbar, type BattleAnimationSpeed } from "./battle-topbar";
import { CharacterAvatar2D } from "./character-avatar";
import { playBattleSfx, startBattleMusic, stopBattleMusic, unlockBattleAudio } from "@/game/battle/audio";

type BattleResponse = {
  state: BattleState;
  events: BattleLogEntry[];
  reward?: BattleReward;
  token?: string;
  version?: number;
  boardId?: BattleBoardId;
  authority: "server";
};

type PvpSession = { battleId: string; playerId: string };

function newActionId() {
  return crypto.randomUUID();
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

async function loadPvpBattle(battleId: string): Promise<BattleResponse> {
  const response = await fetch(`/api/pvp/battles/${battleId}`, { cache: "no-store" });
  const payload = (await response.json()) as BattleResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "O duelo não pôde ser carregado.");
  return payload;
}

async function callPvpActionApi(body: Record<string, unknown>): Promise<BattleResponse> {
  const response = await fetch("/api/pvp/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as BattleResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "A ação PVP não pôde ser confirmada.");
  return payload;
}

export function BattleArena({
  open,
  onClose,
  onVictory,
  pvp,
  encounter,
  playerEnergy,
  guestSetup,
  battleBoard = "cartographer",
}: {
  open: boolean;
  onClose: () => void;
  onVictory: (reward?: BattleReward) => void;
  pvp?: PvpSession;
  encounter?: BattleEncounter;
  playerEnergy?: EnergyPool;
  guestSetup?: GuestBattleSetup;
  battleBoard?: BattleBoardId;
}) {
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [serverVersion, setServerVersion] = useState<number | null>(null);
  const [serverBattleBoard, setServerBattleBoard] = useState<BattleBoardId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [die, setDie] = useState<number | null>(null);
  const [effect, setEffect] = useState(false);
  const [presentationEvent, setPresentationEvent] = useState<BattlePresentationEvent | null>(null);
  const [animationSpeed, setAnimationSpeed] = useState<BattleAnimationSpeed>("normal");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [turnBannerVisible, setTurnBannerVisible] = useState(false);
  const [selectedAbilitySlot, setSelectedAbilitySlot] = useState<0 | 1>(0);
  const [concedeConfirm, setConcedeConfirm] = useState(false);
  const [reward, setReward] = useState<BattleReward | null>(null);
  const victoryReported = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const pvpBattleId = pvp?.battleId ?? null;

  const startBattle = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = pvp
        ? await loadPvpBattle(pvp.battleId)
        : await callBattleApi({ action: "start", encounter, playerEnergy, guestSetup });
      setBattle(response.state);
      setToken(response.token ?? null);
      setServerVersion(response.version ?? null);
      setServerBattleBoard(response.boardId ?? null);
      setReward(response.reward ?? null);
      setSelectedAbilitySlot(0);
      victoryReported.current = false;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível iniciar a batalha.");
    } finally {
      setBusy(false);
    }
  }, [encounter, guestSetup, playerEnergy, pvp]);

  useEffect(() => {
    if (!open) return;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || battle || busy || error) return;
    const timer = window.setTimeout(() => void startBattle(), 0);
    return () => window.clearTimeout(timer);
  }, [battle, busy, error, open, startBattle]);

  useEffect(() => {
    if (!open || !pvpBattleId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    let removeChannel: (() => void) | null = null;
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      const channel = supabase
        .channel(`pvp:battle:${pvpBattleId}`, { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, () => void startBattle())
        .subscribe();
      removeChannel = () => void supabase.removeChannel(channel);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      removeChannel?.();
    };
  }, [open, pvpBattleId, startBattle]);

  const data = useMemo(() => {
    if (!battle) return null;
    const playerId = pvp?.playerId ?? "player-one";
    return { player: getSide(battle, playerId), opponent: getOpponent(battle, playerId) };
  }, [battle, pvp?.playerId]);
  const battleReady = Boolean(battle && data);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    dialog?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const currentDialog = dialogRef.current;
      if (!currentDialog) return;
      const focusable = currentDialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      if (!first || !last) {
        event.preventDefault();
        currentDialog.focus();
      } else if (!currentDialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [battleReady, open]);

  const playerTurn = Boolean(battle && data && battle.turn.sideId === data.player.id && battle.status === "active");
  const terrain = battle?.terrain;
  const latestBattleStatus = battle?.status;
  const latestTurn = battle?.turn.number;
  const latestTurnSide = battle?.turn.sideId;

  useEffect(() => {
    if (latestBattleStatus !== "active") return;
    const show = window.setTimeout(() => setTurnBannerVisible(true), 0);
    const hide = window.setTimeout(() => setTurnBannerVisible(false), 1100);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [latestBattleStatus, latestTurn, latestTurnSide]);

  useEffect(() => {
    if (!open || !soundEnabled) {
      stopBattleMusic();
      return;
    }
    return () => stopBattleMusic();
  }, [open, soundEnabled]);

  useEffect(() => {
    const playerId = pvp?.playerId ?? "player-one";
    if (battle?.status === "finished" && battle.winnerId === playerId && !victoryReported.current) {
      victoryReported.current = true;
      onVictory(reward ?? undefined);
    }
  }, [battle, onVictory, pvp?.playerId, reward]);

  const perform = useCallback(async (payload: Record<string, unknown>) => {
    if ((!pvp && !token) || (pvp && serverVersion === null) || busy) return;
    if (soundEnabled) {
      unlockBattleAudio();
      startBattleMusic(pvp ? serverBattleBoard ?? battleBoard : battleBoard);
    }
    setBusy(true);
    setError("");
    setConcedeConfirm(false);
    try {
      const response = pvp
        ? await callPvpActionApi({ ...payload, battleId: pvp.battleId, expectedVersion: serverVersion })
        : await callBattleApi({ ...payload, token });
      const sequence = toBattlePresentationEvents(response.events);
      for (const event of sequence) {
        setPresentationEvent(event);
        if (soundEnabled) playBattleSfx(event.kind);
        if (typeof event.die === "number") setDie(event.die);
        if (["attack", "miss", "critical"].includes(event.kind)) {
          setEffect(event.kind !== "miss");
          const duration = presentationDuration(event.kind, animationSpeed);
          await new Promise((resolve) => window.setTimeout(resolve, Math.round(duration * 0.42)));
          setBattle(response.state);
          await new Promise((resolve) => window.setTimeout(resolve, Math.round(duration * 0.58)));
          setDie(null);
          setEffect(false);
          continue;
        }
        if (["ko", "terrainOn", "terrainOff"].includes(event.kind)) setBattle(response.state);
        await new Promise((resolve) => window.setTimeout(resolve, presentationDuration(event.kind, animationSpeed)));
        if (event.kind === "roll") setDie(null);
      }
      setBattle(response.state);
      setPresentationEvent(null);
      setDie(null);
      setEffect(false);
      setToken(response.token ?? null);
      setServerVersion(response.version ?? null);
      if (response.boardId) setServerBattleBoard(response.boardId);
      if (response.reward) setReward(response.reward);
    } catch (caught) {
      setPresentationEvent(null);
      setDie(null);
      setEffect(false);
      setError(caught instanceof Error ? caught.message : "A ação falhou.");
    } finally {
      setBusy(false);
    }
  }, [animationSpeed, battleBoard, busy, pvp, serverBattleBoard, serverVersion, soundEnabled, token]);

  useEffect(() => {
    if (!open || !pvp || !battle || battle.status !== "active" || battle.turn.sideId === pvp.playerId) return;
    const timer = window.setInterval(() => void startBattle(), 5000);
    return () => window.clearInterval(timer);
  }, [battle, open, pvp, startBattle]);

  if (!open) return null;
  if (!battle || !data) {
    return (
      <div
        ref={dialogRef}
        className="battle-screen battle-screen--loading"
        role="dialog"
        aria-modal="true"
        aria-label={pvp ? "Duelo entre cartógrafos" : "Batalha"}
        tabIndex={-1}
      >
        {!error ? <LoaderCircle className="size-8 animate-spin text-primary" /> : null}
        <strong>{error ? "O duelo não pôde ser carregado." : "Preparando a batalha..."}</strong>
        {error ? <p>{error}</p> : null}
        {error ? <><Button onClick={startBattle}>Tentar novamente</Button><Button variant="secondary" onClick={onClose}>Fechar</Button></> : null}
      </div>
    );
  }

  const ownAbilities = data.player.abilityIds.map((id) => ARPG_ABILITY_CARD_BY_ID.get(id)!);
  const activeAbility = ownAbilities[selectedAbilitySlot];
  const opponentAbilities = data.opponent.abilityIds.map((id) => ARPG_ABILITY_CARD_BY_ID.get(id)!);
  const opponentTurn = battle.turn.sideId === data.opponent.id && battle.status === "active";
  const terrainMeta = terrain ? ELEMENT_META[terrain.element] : null;
  const playerIsActor = presentationEvent?.actorId === data.player.id;
  const opponentIsActor = presentationEvent?.actorId === data.opponent.id;
  const playerHit = opponentIsActor && ["attack", "critical"].includes(presentationEvent?.kind ?? "");
  const opponentHit = playerIsActor && ["attack", "critical"].includes(presentationEvent?.kind ?? "");
  const cinematic = Boolean(presentationEvent && ["ability", "attack", "critical", "miss", "ko", "terrainOn"].includes(presentationEvent.kind));
  const effectiveBattleBoard = pvp ? serverBattleBoard ?? battleBoard : battleBoard;
  const playerHpPercent = Math.max(0, Math.min(100, data.player.hp / data.player.maxHp * 100));
  const opponentHpPercent = Math.max(0, Math.min(100, data.opponent.hp / data.opponent.maxHp * 100));

  return (
    <div
      ref={dialogRef}
      className="battle-screen avatar-battle"
      role="dialog"
      aria-modal="true"
      aria-label={pvp ? "Duelo entre cartógrafos" : "Batalha"}
      tabIndex={-1}
    >
      <BattleTopbar
        mode={battle.mode}
        pvp={Boolean(pvp)}
        round={battle.turn.round}
        status={battle.status}
        playerTurn={playerTurn}
        opponentName={data.opponent.name}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          setSoundEnabled((current) => {
            const next = !current;
            if (next) {
              unlockBattleAudio();
              startBattleMusic(effectiveBattleBoard);
            } else stopBattleMusic();
            return next;
          });
        }}
        animationSpeed={animationSpeed}
        onAnimationSpeedChange={setAnimationSpeed}
        busy={busy}
        onClose={() => {
          stopBattleMusic();
          onClose();
        }}
      />

      <section className="card-table avatar-battle-table" aria-label="Mesa de batalha de cartas">
        <BattleBoardScene boardId={effectiveBattleBoard} cinematic={cinematic} terrainElement={terrain?.element}>
          <div className="avatar-battle-field">
            <article className={cn("avatar-battle-profile avatar-battle-profile--opponent", opponentIsActor && "is-commanding", opponentHit && "is-reacting")}>
              <div className="avatar-battle-status">
                <div className="avatar-battle-status__heading"><strong>{data.opponent.name}</strong><span>{ELEMENT_META[data.opponent.element].name} · adversário</span></div>
                <div className="avatar-battle-status__hp"><span>PV</span><div><i style={{ width: `${opponentHpPercent}%` }} /></div><small>{data.opponent.hp}/{data.opponent.maxHp}</small></div>
                <div className="avatar-battle-status__meta"><span>{data.opponent.shield > 0 ? `${data.opponent.shield} escudo` : "Sem escudo"}</span><span>{data.opponent.statuses.map((status) => status.effect).join(" · ") || "Normal"}</span></div>
              </div>
              <CharacterAvatar2D config={data.opponent.avatarConfig} compact />
              <div className="avatar-battle-card-pair" aria-label="Poderes do adversário">
                {opponentAbilities.map((card) => <span key={card.id} title={card.name}>{card.name}</span>)}
              </div>
            </article>

            <AnimatePresence>
              {turnBannerVisible ? (
                <motion.div key={`${battle.turn.number}:${battle.turn.sideId}`} className={cn("battle-turn-banner", playerTurn && "is-player")} initial={{ opacity: 0, scaleX: .72, y: -8 }} animate={{ opacity: 1, scaleX: 1, y: 0 }} exit={{ opacity: 0, scaleX: 1.08, y: 8 }} transition={{ duration: .24 }}>
                  <span>{playerTurn ? "SUA VEZ" : `VEZ DE ${data.opponent.name.toUpperCase()}`}</span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {terrain && terrainMeta ? (
              <motion.div className={cn("battle-terrain-status", `is-${terrain.element}`)} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                <Sparkles /><span><strong>Terreno de {terrainMeta.name}</strong><small>+15% de dano · até o turno {terrain.expiresAfterTurn}</small></span>
              </motion.div>
            ) : null}

            <div className="avatar-battle-centerline"><Swords /><div><strong>{playerTurn ? "Sua jogada" : opponentTurn ? "Jogada adversária" : "Batalha concluída"}</strong><small>Rodada {battle.turn.round} · turno {battle.turn.number}</small></div><span>2 PODERES</span></div>

            <article className={cn("avatar-battle-profile avatar-battle-profile--player", playerIsActor && "is-commanding", playerHit && "is-reacting")}>
              <CharacterAvatar2D config={data.player.avatarConfig} compact />
              <div className="avatar-battle-status">
                <div className="avatar-battle-status__heading"><strong>{data.player.name}</strong><span>{ELEMENT_META[data.player.element].name} · seu personagem</span></div>
                <div className="avatar-battle-status__hp"><span>PV</span><div><i style={{ width: `${playerHpPercent}%` }} /></div><small>{data.player.hp}/{data.player.maxHp}</small></div>
                <div className="avatar-battle-status__meta"><span>{data.player.shield > 0 ? `${data.player.shield} escudo` : "Sem escudo"}</span><span>{data.player.statuses.map((status) => status.effect).join(" · ") || "Normal"}</span></div>
              </div>
              <div className="avatar-battle-card-pair" aria-label="Seus dois poderes">
                {ownAbilities.map((card, slot) => <span className={selectedAbilitySlot === slot ? "is-selected" : ""} key={card.id}>{card.name}</span>)}
              </div>
            </article>
          </div>
        </BattleBoardScene>

        <AnimatePresence>
          {effect ? <motion.div className="attack-effect attack-effect--strike" initial={{ opacity: 0, scale: .3, x: "-35%" }} animate={{ opacity: [0, 1, 1, 0], scale: [.3, 1.2, .8], x: ["-35%", "30%", "42%"] }} exit={{ opacity: 0 }} transition={{ duration: .9 }}><Sparkles /></motion.div> : null}
          {die ? <BattleDiceRoll value={die} /> : null}
          {presentationEvent?.kind === "terrainOn" && presentationEvent.terrainElement ? <motion.div className={cn("battle-terrain-callout", `is-${presentationEvent.terrainElement}`)} initial={{ opacity: 0, scale: .6 }} animate={{ opacity: 1, scale: [1.15, 1] }} exit={{ opacity: 0 }}><Sparkles /><strong>TERRENO: {ELEMENT_META[presentationEvent.terrainElement].name.toUpperCase()}</strong><small>O campo inteiro foi transformado.</small></motion.div> : null}
          {presentationEvent && ["miss", "critical", "ko"].includes(presentationEvent.kind) ? <motion.div key={`${presentationEvent.id}:callout`} className={cn("battle-impact-callout", `is-${presentationEvent.kind}`)} initial={{ opacity: 0, scale: .55 }} animate={{ opacity: 1, scale: [1.25, 1] }} exit={{ opacity: 0, scale: 1.15 }}>{presentationEvent.kind === "miss" ? "FALHOU!" : presentationEvent.kind === "critical" ? "CRÍTICO!" : "NOCAUTE!"}</motion.div> : null}
        </AnimatePresence>
      </section>

      <section className="avatar-battle-commands" aria-label="Seus dois poderes">
        <header><div><span className="view-eyebrow">PERSONAGEM</span><h2>Escolha um dos seus dois poderes</h2></div><span className="avatar-battle-turn-state">{battle.status === "finished" ? "BATALHA ENCERRADA" : playerTurn ? "SEU TURNO" : `VEZ DE ${data.opponent.name.toUpperCase()}`}</span></header>
        <div className="avatar-battle-power-grid">
          {ownAbilities.map((card, slot) => {
            const cooldown = data.player.abilityCooldowns[slot] ?? 0;
            const selected = selectedAbilitySlot === slot;
            return (
              <button type="button" key={card.id} className={cn("avatar-battle-power-card", `is-${card.element}`, selected && "is-selected")} aria-pressed={selected} disabled={busy || !playerTurn || cooldown > 0} onClick={() => setSelectedAbilitySlot(slot as 0 | 1)}>
                <span className="avatar-battle-power-card__slot">PODER {slot + 1}</span><strong>{card.name}</strong><p>{card.description}</p><span className="avatar-battle-power-card__meta">{card.damage > 0 ? `${card.damage} dano` : `Recupera ${card.restoreHp ?? 0} PV`} · {ELEMENT_META[card.element].name}</span><small>{cooldown > 0 ? `Recarga: ${cooldown} turno(s)` : "Pronto para usar"}</small>
              </button>
            );
          })}
        </div>
        <div className="avatar-battle-action-row">
          <div className="avatar-battle-energy-hand" aria-label="Energias disponíveis">
            <span>ENERGIA</span>
            {data.player.energyHand.slice(0, 6).map((card) => (
              <button type="button" key={card.id} title={`Vincular Energia de ${ELEMENT_META[card.element].name}`} disabled={!playerTurn || busy || data.player.attachmentsRemaining < 1} onClick={() => void perform({ action: "attach", cardId: card.id, actionId: newActionId() })} style={{ "--energy-color": ELEMENT_META[card.element].color } as CSSProperties}>{ELEMENT_META[card.element].short}</button>
            ))}
            {data.player.energyHand.length === 0 ? <small>Sem cartas na mão</small> : null}
          </div>
          <div className="avatar-battle-actions">
            <Button variant="game" disabled={!playerTurn || busy || data.player.abilityCooldowns[selectedAbilitySlot] > 0} onClick={() => void perform({ action: "ability", slot: selectedAbilitySlot, actionId: newActionId() })}><Swords /> Usar {activeAbility.name}</Button>
            <Button variant="secondary" disabled={!playerTurn || busy} onClick={() => void perform({ action: "pass", actionId: newActionId() })}><SkipForward /> Encerrar turno</Button>
            {pvp ? <Button variant="ghost" disabled={busy || battle.status !== "active"} onClick={() => setConcedeConfirm(true)}><X /> Desistir</Button> : null}
          </div>
        </div>
        {concedeConfirm ? <div className="avatar-battle-confirm" role="alert"><strong>Desistir deste duelo?</strong><span>A desistência será registrada pelo servidor.</span><Button size="sm" variant="danger" disabled={busy} onClick={() => void perform({ action: "concede", actionId: newActionId() })}>Confirmar</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => setConcedeConfirm(false)}>Cancelar</Button></div> : null}
        {error ? <p className="avatar-battle-error" role="alert">{error}</p> : null}
        {battle.status === "finished" ? <div className="avatar-battle-result"><ShieldCheck /><strong>{battle.winnerId === data.player.id ? "Vitória!" : "A batalha terminou."}</strong>{reward ? <span>+{reward.coins} moedas · +{reward.xp} XP</span> : null}<Button variant="secondary" onClick={onClose}>Voltar ao mapa</Button></div> : null}
      </section>

      <div className="avatar-battle-log-toggle"><Button variant="ghost" onClick={() => setLogOpen((current) => !current)}><BookOpen /> Histórico de batalha</Button></div>
      <BattleLogSheet entries={battle.log} open={logOpen} onToggle={() => setLogOpen((current) => !current)} />
      <button type="button" className="avatar-battle-mobile-close" onClick={onClose} aria-label="Sair da batalha"><X /></button>
    </div>
  );
}
