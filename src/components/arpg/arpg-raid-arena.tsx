"use client";

import {
  Crosshair,
  Heart,
  Radio,
  Shield,
  Sparkles,
  Swords,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CREATURE_BY_ID } from "@/game/catalog";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import type { ArpgRaidState } from "@/game/arpg/raid";
import { readBrowserGamepad } from "@/game/arpg/runtime/gamepad";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { CharacterAvatar2D } from "@/components/game/character-avatar";
import { PixelCreature } from "@/components/game/pixel-creature";

type RaidPayload = {
  room: { id: string; status: string; version: number };
  event: { id: string; title: string; boss_creature_id: string };
  state: ArpgRaidState | null;
  eventReward?: {
    obtained: boolean;
    coinsAwarded: number;
    xpAwarded: number;
  };
  error?: string;
};

type RaidAction =
  | { action: "input"; clientSeq: number; moveX: number; moveY: number; aimX: number; aimY: number }
  | { action: "attack" | "dash" }
  | { action: "ability"; slot: 0 | 1 };

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 720;
const GAMEPAD_ABILITY_HINTS = ["↑", "↓"] as const;

function percent(value: number, max: number) {
  return `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
}

export function ArpgRaidArena({
  roomId,
  playerId,
  onClose,
}: {
  roomId: string;
  playerId: string;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState<RaidPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const stateRef = useRef<ArpgRaidState | null>(null);
  const versionRef = useRef(1);
  const actionBusyRef = useRef(false);
  const inputBusyRef = useRef(false);
  const inputSeqRef = useRef(0);
  const movementRef = useRef({ x: 0, y: 0, aimX: 0, aimY: 0 });
  const keysRef = useRef(new Set<string>());
  const gamepadPressedRef = useRef(new Set<number>());
  const gamepadAttackHeldRef = useRef(false);
  const gamepadWasMovingRef = useRef(false);
  const lastInputRef = useRef({
    x: Number.NaN,
    y: Number.NaN,
    aimX: Number.NaN,
    aimY: Number.NaN,
    at: 0,
  });

  const applyPayload = useCallback((next: RaidPayload) => {
    const currentVersion = versionRef.current;
    const hasCurrentState = stateRef.current !== null;
    if (hasCurrentState && next.room.version < currentVersion) {
      return next;
    }
    setPayload(next);
    if (next.state) stateRef.current = next.state;
    versionRef.current = next.room.version;
    setLoading(false);
    setError("");
    return next;
  }, []);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/arpg/raids/rooms/${roomId}`, { cache: "no-store" });
    const next = (await response.json()) as RaidPayload;
    if (!response.ok) throw new Error(next.error ?? "A Raid ARPG não respondeu.");
    return applyPayload(next);
  }, [applyPayload, roomId]);

  const sendAction = useCallback(async (action: RaidAction) => {
    const inputAction = action.action === "input";
    const busy = inputAction ? inputBusyRef : actionBusyRef;
    if (busy.current || !stateRef.current || stateRef.current.status !== "active") return false;
    busy.current = true;
    if (!inputAction) setSending(true);
    const actionId = crypto.randomUUID();
    const attempts = inputAction ? 1 : 3;

    try {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const response = await fetch("/api/arpg/raids/actions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...action,
            roomId,
            expectedVersion: versionRef.current,
            actionId,
          }),
        });
        const result = (await response.json()) as {
          state?: ArpgRaidState;
          version?: number;
          error?: string;
        };

        if (response.status === 409 && attempt + 1 < attempts) {
          await refresh();
          continue;
        }
        if (!response.ok || !result.state || typeof result.version !== "number") {
          if (response.status !== 409) setError(result.error ?? "A ação da Raid não foi confirmada.");
          return false;
        }

        stateRef.current = result.state;
        versionRef.current = result.version;
        setPayload((current) => current ? {
          ...current,
          room: { ...current.room, status: result.state!.status, version: result.version! },
          state: result.state!,
        } : current);
        setError("");
        if (result.state.status !== "active") void refresh();
        return true;
      }
      return false;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A conexão com a Raid foi interrompida.");
      return false;
    } finally {
      busy.current = false;
      if (!inputAction) setSending(false);
    }
  }, [refresh, roomId]);

  useEffect(() => {
    let cancelled = false;
    const initial = window.setTimeout(() => {
      void refresh().catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "A Raid ARPG não respondeu.");
          setLoading(false);
        }
      });
    }, 0);
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 1_000);
    return () => {
      cancelled = true;
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
        .on("broadcast", { event: "INSERT" }, () => void refresh().catch(() => undefined))
        .on("broadcast", { event: "UPDATE" }, () => void refresh().catch(() => undefined))
        .subscribe();
      removeChannel = () => void supabase.removeChannel(channel);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      removeChannel?.();
    };
  }, [refresh, roomId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const movement = movementRef.current;
      const now = performance.now();
      const last = lastInputRef.current;
      const changed = movement.x !== last.x
        || movement.y !== last.y
        || movement.aimX !== last.aimX
        || movement.aimY !== last.aimY;
      if (!changed && now - last.at < 900) return;
      inputSeqRef.current += 1;
      lastInputRef.current = { ...movement, at: now };
      void sendAction({
        action: "input",
        clientSeq: inputSeqRef.current,
        moveX: movement.x,
        moveY: movement.y,
        aimX: movement.aimX,
        aimY: movement.aimY,
      });
    }, 300);
    return () => window.clearInterval(timer);
  }, [sendAction]);

  useEffect(() => {
    const updateMovement = () => {
      const keys = keysRef.current;
      const x = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0)
        - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
      const y = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0)
        - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
      movementRef.current = { ...movementRef.current, x, y };
    };

    const down = (event: KeyboardEvent) => {
      keysRef.current.add(event.code);
      updateMovement();
      if (event.repeat) return;
      if (["Space", "ShiftLeft", "ShiftRight", "Digit1", "Digit2"].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === "Space") void sendAction({ action: "attack" });
      else if (event.code === "ShiftLeft" || event.code === "ShiftRight") void sendAction({ action: "dash" });
      else if (event.code.startsWith("Digit")) {
        const slot = Number(event.code.slice(-1)) - 1;
        if (slot >= 0 && slot <= 1) void sendAction({ action: "ability", slot: slot as 0 | 1 });
      }
    };

    const up = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
      updateMovement();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      movementRef.current = { x: 0, y: 0, aimX: 0, aimY: 0 };
    };
  }, [sendAction]);

  useEffect(() => {
    let frameId = 0;
    const pollGamepad = () => {
      const result = readBrowserGamepad(gamepadPressedRef.current);
      gamepadPressedRef.current = result.pressedButtons;
      const frame = result.frame;
      if (frame.connected) {
        const hasAxes = Math.abs(frame.moveX) + Math.abs(frame.moveY)
          + Math.abs(frame.aimX) + Math.abs(frame.aimY) > 0.05;
        if (hasAxes || gamepadWasMovingRef.current) {
          movementRef.current = {
            x: frame.moveX,
            y: frame.moveY,
            aimX: frame.aimX,
            aimY: frame.aimY,
          };
          gamepadWasMovingRef.current = hasAxes;
        }
        const attackPressed = frame.attack && !gamepadAttackHeldRef.current;
        gamepadAttackHeldRef.current = frame.attack;
        if (attackPressed) void sendAction({ action: "attack" });
        if (frame.dashPressed) void sendAction({ action: "dash" });
        const abilitySlot = frame.abilityPressed.findIndex(Boolean);
        if (abilitySlot >= 0) {
          void sendAction({ action: "ability", slot: abilitySlot as 0 | 1 });
        }
      } else {
        gamepadAttackHeldRef.current = false;
        if (gamepadWasMovingRef.current) {
          movementRef.current = { x: 0, y: 0, aimX: 0, aimY: 0 };
          gamepadWasMovingRef.current = false;
        }
      }
      frameId = window.requestAnimationFrame(pollGamepad);
    };
    frameId = window.requestAnimationFrame(pollGamepad);
    return () => window.cancelAnimationFrame(frameId);
  }, [sendAction]);

  const state = payload?.state ?? null;
  const player = useMemo(
    () => state?.players.find((entry) => entry.id === playerId) ?? null,
    [playerId, state],
  );
  const bossDefinition = state ? CREATURE_BY_ID.get(state.boss.catalogId) ?? null : null;
  const abilities = player
    ? player.loadout.abilityIds.map((id) => ARPG_ABILITY_CARD_BY_ID.get(id) ?? null)
    : [];
  const recentLog = state?.log.slice(-4).reverse() ?? [];

  const setTouchMovement = (x: number, y: number) => {
    movementRef.current = { ...movementRef.current, x, y };
  };
  const clearTouchMovement = () => {
    movementRef.current = { ...movementRef.current, x: 0, y: 0 };
  };

  if (loading || !payload || !state || !player || !bossDefinition) {
    return (
      <div className="arpg-raid-arena arpg-raid-arena--loading">
        <Radio />
        <strong>Sincronizando a Raid ARPG...</strong>
        {error ? <p>{error}</p> : null}
        <button type="button" onClick={onClose}>Fechar</button>
      </div>
    );
  }

  const bossHpPercent = state.boss.maxHp > 0 ? (state.boss.hp / state.boss.maxHp) * 100 : 0;
  const playerHpPercent = player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0;

  return (
    <div className={cn("arpg-raid-arena", state.boss.phase === 3 && "is-enraged")}>
      <header className="arpg-raid-arena__topbar">
        <div>
          <span><Radio /> SERVIDOR · v{payload.room.version}</span>
          <strong>{payload.event.title}</strong>
        </div>
        <div className="arpg-raid-arena__status">
          <span><Users /> {state.players.filter((entry) => entry.alive).length}/{state.players.length}</span>
          <span>Fase {state.boss.phase}/3</span>
          {sending ? <em>sincronizando…</em> : null}
          <button type="button" onClick={onClose} aria-label="Fechar Raid"><X /></button>
        </div>
      </header>

      <section className="arpg-raid-arena__boss-hud">
        <div className="arpg-raid-arena__boss-title">
          <Sparkles />
          <span><small>RAID MÍTICA</small><strong>{state.boss.name}</strong></span>
        </div>
        <div className="arpg-raid-bar arpg-raid-bar--boss">
          <i style={{ width: `${bossHpPercent}%` }} />
        </div>
        <span>{state.boss.hp.toLocaleString("pt-BR")} / {state.boss.maxHp.toLocaleString("pt-BR")} HP</span>
      </section>
      <section className="arpg-raid-world" aria-label="Arena cooperativa">
        <div
          className="arpg-raid-boss"
          style={{ left: percent(state.boss.x, WORLD_WIDTH), top: percent(state.boss.y, WORLD_HEIGHT) }}
        >
          <span className="arpg-raid-boss__aura" />
          <PixelCreature sprite={bossDefinition.sprite} label={bossDefinition.name} />
          <strong>{state.boss.name}</strong>
          <small>Fase {state.boss.phase}</small>
        </div>

        {state.players.map((entry) => (
          <div
            className={cn(
              "arpg-raid-player",
              entry.id === playerId && "is-self",
              !entry.alive && "is-defeated",
            )}
            key={entry.id}
            style={{ left: percent(entry.x, WORLD_WIDTH), top: percent(entry.y, WORLD_HEIGHT) }}
          >
            <div className="arpg-raid-player__avatar" data-seat={entry.seat}>
              <CharacterAvatar2D config={entry.avatarConfig} compact />
            </div>
            <strong>{entry.name}{entry.id === playerId ? " · você" : ""}</strong>
            <div className="arpg-raid-bar"><i style={{ width: `${entry.maxHp > 0 ? (entry.hp / entry.maxHp) * 100 : 0}%` }} /></div>
            <small>{entry.hp}/{entry.maxHp}</small>
          </div>
        ))}
      </section>

      <section className="arpg-raid-hud">
        <div className="arpg-raid-hud__player">
          <div className="arpg-raid-hud__identity">
            <Heart />
            <span><strong>{player.name}</strong><small>{player.alive ? "Em combate" : "Espectador"}</small></span>
          </div>
          <div className="arpg-raid-bar arpg-raid-bar--player"><i style={{ width: `${playerHpPercent}%` }} /></div>
          <span>{player.hp}/{player.maxHp} HP</span>
          <div className="arpg-raid-hud__loadout">
            <span><Shield /> {player.loadout.armorId}</span>
            <span><Swords /> {player.loadout.weaponId}</span>
            <span><Sparkles /> Relíquia: {player.loadout.relicId}</span>
          </div>
        </div>

        <div className="arpg-raid-log" aria-live="polite">
          {error ? <p className="is-error">{error}</p> : null}
          {recentLog.map((entry) => <p key={entry.id}>{entry.message}</p>)}
        </div>
      </section>

      <section className="arpg-raid-controls" aria-label="Controles da Raid ARPG">
        <div className="arpg-raid-dpad">
          <button type="button" onPointerDown={() => setTouchMovement(0, -1)} onPointerUp={clearTouchMovement} onPointerCancel={clearTouchMovement}>▲</button>
          <button type="button" onPointerDown={() => setTouchMovement(-1, 0)} onPointerUp={clearTouchMovement} onPointerCancel={clearTouchMovement}>◀</button>
          <button type="button" onPointerDown={() => setTouchMovement(0, 1)} onPointerUp={clearTouchMovement} onPointerCancel={clearTouchMovement}>▼</button>
          <button type="button" onPointerDown={() => setTouchMovement(1, 0)} onPointerUp={clearTouchMovement} onPointerCancel={clearTouchMovement}>▶</button>
        </div>

        <div className="arpg-raid-actions">
          <button type="button" disabled={!player.alive || state.status !== "active"} onClick={() => void sendAction({ action: "attack" })}>
            <Crosshair /><strong>ATACAR</strong><small>Espaço · A</small>
          </button>
          <button type="button" disabled={!player.alive || state.status !== "active"} onClick={() => void sendAction({ action: "dash" })}>
            <Zap /><strong>DASH</strong><small>Shift · B</small>
          </button>
        </div>

        <div className="arpg-raid-abilities">
          {abilities.map((card, index) => {
            const readyAt = card ? player.abilityReadyAtMs[card.id] ?? 0 : 0;
            const remaining = Math.max(0, Math.ceil((readyAt - state.serverTimeMs) / 1000));
            return (
              <button
                type="button"
                key={card?.id ?? index}
                disabled={!card || !player.alive || state.status !== "active" || remaining > 0}
                onClick={() => void sendAction({ action: "ability", slot: index as 0 | 1 })}
              >
                <span>{index + 1}</span>
                <strong>{card?.name ?? "Habilidade"}</strong>
                <small>{remaining > 0 ? `${remaining}s` : `PRONTA · ${GAMEPAD_ABILITY_HINTS[index]}`}</small>
              </button>
            );
          })}
        </div>
      </section>

      {state.status !== "active" ? (
        <div className={cn("arpg-raid-result", state.status === "victory" ? "is-victory" : "is-defeat")}>
          <Sparkles />
          <span className="view-eyebrow">RAID ARPG ENCERRADA</span>
          <h2>{state.status === "victory" ? `${state.boss.name} derrotado` : "O grupo foi derrotado"}</h2>
          <p>
            {state.status === "victory"
              ? "O servidor confirmou a vitória e processou as moedas e o XP do evento para os participantes elegíveis."
              : "Revise seus ataques e equipamentos e tente novamente enquanto o evento estiver ativo."}
          </p>
          {state.status === "victory" && payload.eventReward?.obtained ? (
            <strong>✓ {payload.eventReward.coinsAwarded} moedas · {payload.eventReward.xpAwarded} XP</strong>
          ) : null}
          <button type="button" onClick={onClose}>Voltar ao Atlas</button>
        </div>
      ) : null}
    </div>
  );
}
