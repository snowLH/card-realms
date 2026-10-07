"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, LoaderCircle, Swords, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { PVP_DUEL_HEIGHT, PVP_DUEL_WIDTH, type PvpRealtimeActionRequest, type PvpRealtimeEvent, type PvpRealtimeState } from "@/game/pvp/realtime";
import { CharacterAvatar2D } from "./character-avatar";

type PvpSession = { battleId: string; playerId: string };
type PvpCommand =
  | { action: "input"; moveX: number; moveY: number; aimX: number; aimY: number }
  | { action: "attack" }
  | { action: "dash" }
  | { action: "ability"; slot: 0 | 1 }
  | { action: "concede" };

type PvpResponse = {
  state: PvpRealtimeState;
  events: PvpRealtimeEvent[];
  version: number;
  error?: string;
  currentVersion?: number;
  conflict?: boolean;
};

function actionId() {
  return crypto.randomUUID();
}

function normalizedAxis(value: number) {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalize(x: number, y: number) {
  const moveX = normalizedAxis(x);
  const moveY = normalizedAxis(y);
  const length = Math.hypot(moveX, moveY);
  if (length <= 1 || length < 0.001) return { x: moveX, y: moveY };
  return { x: moveX / length, y: moveY / length };
}

function healthPercent(current: number, maximum: number) {
  return Math.max(0, Math.min(100, current / Math.max(1, maximum) * 100));
}

function playerAnimation(state: PvpRealtimeState, playerId: string, player: PvpRealtimeState["players"][number]) {
  if (player.hp <= 0) return "defeat" as const;
  if (player.dashingUntilMs > state.serverTimeMs) return "walk" as const;
  if (Math.abs(player.input.moveX) + Math.abs(player.input.moveY) > .05) return "walk" as const;
  const latest = state.log.at(-1);
  if (latest?.actorId === playerId && latest.kind === "ability_cast") {
    const card = latest.abilityId ? ARPG_ABILITY_CARD_BY_ID.get(latest.abilityId) : null;
    return card?.behavior === "projectile" || card?.behavior === "piercing-projectile" ? "shoot" as const : "attack" as const;
  }
  if (latest?.kind === "player_hit" && latest.targetIds?.includes(playerId)) return "damage" as const;
  if (latest?.actorId === playerId && latest.kind === "player_attack") return "attack" as const;
  return "idle" as const;
}

export function PvpRealtimeArena({
  open,
  onClose,
  pvp,
}: {
  open: boolean;
  onClose: () => void;
  pvp: PvpSession;
}) {
  const [state, setState] = useState<PvpRealtimeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmConcede, setConfirmConcede] = useState(false);
  const stateRef = useRef<PvpRealtimeState | null>(null);
  const versionRef = useRef(0);
  const inputRef = useRef({ moveX: 0, moveY: 0, aimX: 1, aimY: 0 });
  const heldKeysRef = useRef(new Set<string>());
  const inputPendingRef = useRef(false);
  const actionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const dialogRef = useRef<HTMLDivElement>(null);

  const acceptResponse = useCallback((response: PvpResponse) => {
    if (typeof response.version !== "number" || response.version < versionRef.current) return;
    versionRef.current = response.version;
    stateRef.current = response.state;
    setState(response.state);
  }, []);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/pvp/battles/${pvp.battleId}`, { cache: "no-store" });
    const payload = (await response.json()) as PvpResponse;
    if (!response.ok) throw new Error(payload.error ?? "O duelo não respondeu.");
    acceptResponse(payload);
    setError("");
    return payload;
  }, [acceptResponse, pvp.battleId]);

  const sendCommand = useCallback(async (command: PvpCommand, retryOnConflict = true): Promise<void> => {
    async function post(retry: boolean): Promise<void> {
      const body: PvpRealtimeActionRequest = {
        ...command,
        battleId: pvp.battleId,
        expectedVersion: versionRef.current,
        actionId: actionId(),
      } as PvpRealtimeActionRequest;
      const response = await fetch("/api/pvp/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as PvpResponse;
      if (!response.ok) {
        if (response.status === 409 && retry && (payload.conflict || typeof payload.currentVersion === "number")) {
          await refresh();
          return post(false);
        }
        throw new Error(payload.error ?? "A ação não foi confirmada.");
      }
      acceptResponse(payload);
    }
    return post(retryOnConflict);
  }, [acceptResponse, pvp.battleId, refresh]);

  const enqueueCommand = useCallback((command: PvpCommand, showError = true) => {
    const queued = actionQueueRef.current.catch(() => undefined).then(async () => {
      await sendCommand(command);
    });
    actionQueueRef.current = queued.catch(() => undefined);
    void queued.catch((caught: unknown) => {
      if (showError) setError(caught instanceof Error ? caught.message : "A ação não foi confirmada.");
    });
    return queued;
  }, [sendCommand]);

  useEffect(() => {
    if (!open) return;
    const initial = window.setTimeout(() => {
      void refresh().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "O duelo não respondeu."))
        .catch(() => undefined);
    }, 0);
    const polling = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 900);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(polling);
    };
  }, [open, pvp.battleId, refresh]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let removeChannel: (() => void) | null = null;
    void import("@/lib/supabase/client").then(({ getSupabaseBrowserClient }) => {
      if (cancelled) return;
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      void supabase.realtime.setAuth().then(() => {
        if (cancelled) return;
        const channel = supabase
          .channel(`pvp:battle:${pvp.battleId}`, { config: { private: true } })
          .on("broadcast", { event: "INSERT" }, () => void refresh().catch(() => undefined))
          .subscribe();
        removeChannel = () => void supabase.removeChannel(channel);
      }).catch(() => undefined);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      removeChannel?.();
    };
  }, [open, pvp.battleId, refresh]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      if (stateRef.current?.status !== "active") return;
      if (inputPendingRef.current) return;
      inputPendingRef.current = true;
      void enqueueCommand({ action: "input", ...inputRef.current }, false)
        .catch(() => undefined)
        .finally(() => { inputPendingRef.current = false; });
    }, 240);
    return () => window.clearInterval(timer);
  }, [enqueueCommand, open]);

  const ownPlayer = useMemo(
    () => state?.players.find((player) => player.id === pvp.playerId) ?? null,
    [pvp.playerId, state],
  );
  const opponent = useMemo(
    () => state?.players.find((player) => player.id !== pvp.playerId) ?? null,
    [pvp.playerId, state],
  );

  useEffect(() => {
    if (!open || !ownPlayer || !opponent) return;
    inputRef.current = {
      ...inputRef.current,
      aimX: ownPlayer.input.aimX || Math.sign(opponent.x - ownPlayer.x),
      aimY: ownPlayer.input.aimY || Math.sign(opponent.y - ownPlayer.y),
    };
  }, [open, ownPlayer, opponent]);

  const moveFromHeldKeys = useCallback(() => {
    const keys = heldKeysRef.current;
    const x = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
    const y = Number(keys.has("s") || keys.has("arrowdown")) - Number(keys.has("w") || keys.has("arrowup"));
    const movement = normalize(x, y);
    inputRef.current = {
      ...inputRef.current,
      moveX: movement.x,
      moveY: movement.y,
      ...(Math.abs(movement.x) + Math.abs(movement.y) > .05
        ? { aimX: movement.x, aimY: movement.y }
        : {}),
    };
  }, []);

  const fireAction = useCallback((command: PvpCommand) => {
    if (!stateRef.current || stateRef.current.status !== "active") return;
    setBusy(true);
    setError("");
    const queued = command.action === "input"
      ? enqueueCommand(command)
      : enqueueCommand({ action: "input", ...inputRef.current }, false).then(() => enqueueCommand(command));
    void queued.catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "A ação não foi confirmada.");
    }).finally(() => setBusy(false));
  }, [enqueueCommand]);

  useEffect(() => {
    if (!open) return;
    const heldKeys = heldKeysRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      if (heldKeys.has(key)) return;
      heldKeys.add(key);
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        moveFromHeldKeys();
        return;
      }
      if (key === "enter" || key === " ") fireAction(key === " " ? { action: "dash" } : { action: "attack" });
      if (key === "q") fireAction({ action: "ability", slot: 0 });
      if (key === "e") fireAction({ action: "ability", slot: 1 });
      if (key === "escape") onClose();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      heldKeys.delete(key);
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) moveFromHeldKeys();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      heldKeys.clear();
      inputRef.current.moveX = 0;
      inputRef.current.moveY = 0;
    };
  }, [fireAction, moveFromHeldKeys, onClose, open]);

  const updateAim = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!stateRef.current) return;
    const localPlayer = stateRef.current.players.find((player) => player.id === pvp.playerId);
    if (!localPlayer) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const targetX = ((event.clientX - bounds.left) / bounds.width) * PVP_DUEL_WIDTH;
    const targetY = ((event.clientY - bounds.top) / bounds.height) * PVP_DUEL_HEIGHT;
    const aim = normalize(targetX - localPlayer.x, targetY - localPlayer.y);
    if (Math.hypot(aim.x, aim.y) > .05) inputRef.current = { ...inputRef.current, aimX: aim.x, aimY: aim.y };
  }, [pvp.playerId]);

  function setTouchMovement(x: number, y: number) {
    const movement = normalize(x, y);
    inputRef.current = {
      ...inputRef.current,
      moveX: movement.x,
      moveY: movement.y,
      ...(Math.abs(movement.x) + Math.abs(movement.y) > .05
        ? { aimX: movement.x, aimY: movement.y }
        : {}),
    };
  }

  if (!open) return null;
  if (state?.id !== pvp.battleId || !state || !ownPlayer || !opponent) {
    return (
      <div className="battle-screen battle-screen--loading pvp-realtime" role="dialog" aria-modal="true" aria-label="Duelo em tempo real">
        {!error ? <LoaderCircle className="size-8 animate-spin text-primary" /> : null}
        <strong>{error ? "O duelo não pôde ser carregado." : "Conectando ao duelo..."}</strong>
        {error ? <p role="alert">{error}</p> : null}
        <div><Button onClick={() => void refresh().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "O duelo não respondeu."))}>Tentar novamente</Button><Button variant="secondary" onClick={onClose}>Fechar</Button></div>
      </div>
    );
  }

  const localAbilities = ownPlayer.abilityIds.map((id) => ARPG_ABILITY_CARD_BY_ID.get(id)!);
  const finished = state.status === "finished";
  const latestEvent = state.log.at(-1);
  const localAnimation = playerAnimation(state, ownPlayer.id, ownPlayer);
  const opponentAnimation = playerAnimation(state, opponent.id, opponent);

  return (
    <div className="battle-screen pvp-realtime" role="dialog" aria-modal="true" aria-label="Duelo em tempo real" tabIndex={-1} ref={dialogRef}>
      <header className="pvp-realtime__header">
        <div><span className="view-eyebrow">CONFRONTO ENTRE AMIGOS</span><h1>Duelo em tempo real</h1></div>
        <div className="pvp-realtime__connection"><i /> ONLINE · {Math.max(0, Math.ceil((state.startedAtMs + 180_000 - state.serverTimeMs) / 1000))}s</div>
        <button type="button" className="pvp-realtime__close" aria-label="Fechar duelo" onClick={onClose}><X /></button>
      </header>

      <section className="pvp-realtime__scoreboard" aria-label="Vida dos duelistas">
        {[ownPlayer, opponent].map((player) => {
          const own = player.id === ownPlayer.id;
          return (
            <div className={`pvp-realtime__player-card${own ? " is-local" : ""}`} key={player.id}>
              <CharacterAvatar2D config={player.avatarConfig} compact ariaLabel={`Avatar de ${player.name}`} animation={own ? localAnimation : opponentAnimation} />
              <div className="pvp-realtime__player-info"><div><strong>{player.name}</strong><span>{own ? "VOCÊ" : "ADVERSÁRIO"}</span></div><div className="pvp-realtime__health"><i style={{ width: `${healthPercent(player.hp, player.maxHp)}%` }} /></div><small>{player.hp} / {player.maxHp} PV</small></div>
            </div>
          );
        })}
      </section>

      <section className="pvp-realtime__field-shell" aria-label="Arena de combate">
        <div className="pvp-realtime__field" onPointerMove={updateAim} onPointerDown={(event) => { updateAim(event); if (event.button === 0 && !finished) fireAction({ action: "attack" }); }}>
          <div className="pvp-realtime__arena-glow" />
          <div className="pvp-realtime__center-rune" aria-hidden="true">✦</div>
          {state.players.map((player) => {
            const own = player.id === ownPlayer.id;
            const x = player.x / PVP_DUEL_WIDTH * 100;
            const y = player.y / PVP_DUEL_HEIGHT * 100;
            const abilityName = latestEvent?.actorId === player.id && latestEvent.kind === "ability_cast"
              ? ARPG_ABILITY_CARD_BY_ID.get(latestEvent.abilityId ?? "")?.name
              : null;
            return (
              <motion.div
                className={`pvp-realtime__combatant${own ? " is-local" : " is-opponent"}${player.rootedUntilMs > state.serverTimeMs ? " is-rooted" : ""}${player.dashingUntilMs > state.serverTimeMs ? " is-dashing" : ""}`}
                key={player.id}
                animate={{ left: `${x}%`, top: `${y}%` }}
                transition={{ duration: .15, ease: "linear" }}
                aria-label={`${player.name}, ${player.hp} de vida`}
              >
                <span className="pvp-realtime__nameplate">{player.name}</span>
                <CharacterAvatar2D config={player.avatarConfig} compact ariaLabel={`Avatar de ${player.name}`} animation={own ? localAnimation : opponentAnimation} />
                {abilityName ? <span className="pvp-realtime__cast-label">{abilityName}</span> : null}
                {player.rootedUntilMs > state.serverTimeMs ? <span className="pvp-realtime__status-label">PRESO</span> : null}
              </motion.div>
            );
          })}
          <AnimatePresence>
            {latestEvent && ["player_hit", "player_rooted", "duel_finished"].includes(latestEvent.kind) ? (
              <motion.div key={latestEvent.id} className="pvp-realtime__event-callout" initial={{ opacity: 0, y: 12, scale: .85 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}>
                {latestEvent.damage ? `−${latestEvent.damage} PV` : latestEvent.kind === "duel_finished" ? "FIM DO DUELO" : "PRESO"}
              </motion.div>
            ) : null}
          </AnimatePresence>
          <span className="pvp-realtime__world-size" aria-hidden="true">{PVP_DUEL_WIDTH} × {PVP_DUEL_HEIGHT}</span>
        </div>
      </section>

      <section className="pvp-realtime__controls" aria-label="Controles do duelo">
        <div className="pvp-realtime__control-hint"><strong>WASD / setas</strong> mover <span>·</span> <strong>mouse / toque na arena</strong> mirar <span>·</span> <strong>Enter</strong> atacar <span>·</span> <strong>Espaço</strong> esquivar <span>·</span> <strong>Q / E</strong> poderes</div>
        <div className="pvp-realtime__power-row">
          {localAbilities.map((card, slot) => {
            const remainingMs = Math.max(0, ownPlayer.abilityReadyAtMs[slot] - state.serverTimeMs);
            return (
              <Button key={card.id} variant="game" className={`pvp-realtime__power is-${card.element}`} disabled={busy || finished || remainingMs > 0} onClick={() => fireAction({ action: "ability", slot: slot as 0 | 1 })}>
                <span><small>PODER {slot + 1} · {slot === 0 ? "Q" : "E"}</small><strong>{card.name}</strong></span>
                <span className="pvp-realtime__cooldown">{remainingMs > 0 ? `${(remainingMs / 1000).toFixed(1)}s` : "PRONTO"}</span>
              </Button>
            );
          })}
          <Button variant="secondary" disabled={busy || finished || ownPlayer.nextDashAtMs > state.serverTimeMs} onClick={() => fireAction({ action: "dash" })}><ArrowRight /> Dash · Espaço</Button>
          <Button variant="secondary" disabled={busy || finished || ownPlayer.nextAttackAtMs > state.serverTimeMs} onClick={() => fireAction({ action: "attack" })}><Swords /> Atacar · Enter</Button>
        </div>
        <div className="pvp-realtime__mobile-pad" aria-label="Movimento por toque">
          <button aria-label="Mover para cima" onPointerDown={() => setTouchMovement(0, -1)} onPointerUp={() => setTouchMovement(0, 0)} onPointerLeave={() => setTouchMovement(0, 0)}><ArrowUp /></button>
          <button aria-label="Mover para esquerda" onPointerDown={() => setTouchMovement(-1, 0)} onPointerUp={() => setTouchMovement(0, 0)} onPointerLeave={() => setTouchMovement(0, 0)}><ArrowLeft /></button>
          <button aria-label="Mover para baixo" onPointerDown={() => setTouchMovement(0, 1)} onPointerUp={() => setTouchMovement(0, 0)} onPointerLeave={() => setTouchMovement(0, 0)}><ArrowDown /></button>
          <button aria-label="Mover para direita" onPointerDown={() => setTouchMovement(1, 0)} onPointerUp={() => setTouchMovement(0, 0)} onPointerLeave={() => setTouchMovement(0, 0)}><ArrowRight /></button>
        </div>
        {error ? <p className="pvp-realtime__error" role="alert">{error}</p> : null}
        {finished ? (
          <div className="pvp-realtime__result" role="status">
            <strong>{state.winnerId === ownPlayer.id ? "Você venceu!" : state.winnerId === opponent.id ? `${opponent.name} venceu.` : "O duelo terminou empatado."}</strong>
            <span>{state.finishReason === "timeout" ? "Tempo encerrado" : state.finishReason === "concede" ? "Desistência registrada" : "Nocaute"}</span>
            <Button variant="secondary" onClick={onClose}>Voltar ao mapa</Button>
          </div>
        ) : (
          <div className="pvp-realtime__footer">
            <p aria-live="polite">{latestEvent?.message ?? "O duelo começou. Aproxime-se, mire e use seus poderes."}</p>
            {confirmConcede ? <div className="pvp-realtime__confirm"><strong>Desistir do duelo?</strong><Button size="sm" variant="danger" disabled={busy} onClick={() => { setConfirmConcede(false); fireAction({ action: "concede" }); }}>Confirmar</Button><Button size="sm" variant="secondary" onClick={() => setConfirmConcede(false)}>Cancelar</Button></div> : <Button variant="ghost" disabled={busy} onClick={() => setConfirmConcede(true)}>Desistir</Button>}
          </div>
        )}
      </section>
    </div>
  );
}
