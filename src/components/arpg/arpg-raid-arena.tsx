"use client";
import { BossEncounterView, ForgottenLegendActor, RoundTableWardView } from "./boss-encounter-view";
import { BOSS_ROOM_ART } from "@/game/arpg/bosses/boss-room-art";
import { isBossInputLocked } from "@/game/arpg/bosses/cinematic-input-lock";
import { BossProgressSchema, bossProgressInventory, type BossProgress } from "@/game/arpg/bosses/boss-unlocks";
import { getLegendSignatureAbilityIds } from "@/game/arpg/content/legends";

import {
  Crosshair,
  Heart,
  Radio,
  Sparkles,
  Swords,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CREATURE_BY_ID } from "@/game/catalog";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { ARPG_WEAPON_BY_ID } from "@/game/arpg/content/equipment";
import { ARPG_RELIC_BY_ID } from "@/game/arpg/content/relics";
import { PLAYABLE_LEGENDS, getLegendAppearance } from "@/game/arpg/content/legends";
import { ARPG_RAID_PLAYER_MARGIN, type ArpgRaidPlayerState, type ArpgRaidState } from "@/game/arpg/raid";
import { readBrowserGamepad } from "@/game/arpg/runtime/gamepad";
import { DEFAULT_AVATAR_CONFIG, loadLocalProgress, type AvatarConfig } from "@/game/save/local-progress";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { SpriteDefinition } from "@/game/types";
import { CharacterAvatar2D } from "@/components/game/character-avatar";
import { PixelCreature } from "@/components/game/pixel-creature";

type RaidPayload = {
  room: { id: string; status: string; version: number };
  event: { id: string; title: string; boss_creature_id: string };
  participants?: Array<{ id: string; presenceStatus: string }>;
  state: ArpgRaidState | null;
  eventReward?: {
    obtained: boolean;
    coinsAwarded: number;
    xpAwarded: number;
  };
  error?: string;
  bossProgress?: BossProgress;
};

type RaidAction =
  | { action: "input"; clientSeq: number; moveX: number; moveY: number; aimX: number; aimY: number }
  | { action: "attack" | "dash" | "skip_intro" }
  | { action: "ability"; slot: 0 | 1 }
  | { action: "revive"; targetPlayerId: string };

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 720;
const GAMEPAD_ABILITY_HINTS = ["↑", "↓"] as const;
const RAID_ROC_SPRITE_SHEET = "/art/monster-roc-boss-spritesheet-v5.webp";
const RAID_BOSS_ANIMATION_ROWS = {
  idle: 0,
  walk: 1,
  attack: 2,
  shoot: 3,
  damage: 4,
  defeat: 5,
} as const;

type RaidBossAnimation = keyof typeof RAID_BOSS_ANIMATION_ROWS;

function percent(value: number, max: number) {
  return `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
}

function avatarForRaidPlayer(player: ArpgRaidPlayerState, playerId: string, localAvatar: AvatarConfig) {
  if (player.id === playerId) return localAvatar;
  const equippedAbilities = new Set(player.loadout.abilityIds);
  const matchingLegend = PLAYABLE_LEGENDS.find((legend) => (
    legend.signatureAbilityIds.every((abilityId) => equippedAbilities.has(abilityId))
  ));
  return matchingLegend
    ? { ...DEFAULT_AVATAR_CONFIG, ...getLegendAppearance(matchingLegend.id), favoriteLegendId: matchingLegend.id }
    : DEFAULT_AVATAR_CONFIG;
}

function getRaidPlayerAnimation(state: ArpgRaidState, player: ArpgRaidPlayerState) {
  if (!player.alive) return { animation: "defeat" as const, eventId: "defeat" };
  if (state.status !== "active") return { animation: "idle" as const, eventId: "settled" };

  const recentAction = [...state.log].reverse().find((event) => (
    state.serverTimeMs - event.atMs <= 1_000
    && (
      (event.actorId === player.id && ["player_attack", "player_dash", "ability_cast"].includes(event.kind))
      || (event.kind === "player_damaged" && event.targetIds?.includes(player.id))
    )
  ));

  if (recentAction?.kind === "player_damaged") {
    return { animation: "damage" as const, eventId: recentAction.id };
  }
  if (recentAction?.kind === "player_dash") {
    return { animation: "walk" as const, eventId: recentAction.id };
  }
  if (recentAction?.kind === "ability_cast") {
    const abilityId = player.loadout.abilityIds.find((id) => {
      const card = ARPG_ABILITY_CARD_BY_ID.get(id);
      return card ? recentAction.message.includes(card.name) : false;
    });
    const ability = abilityId ? ARPG_ABILITY_CARD_BY_ID.get(abilityId) : null;
    const animation = ability?.behavior === "projectile" || ability?.behavior === "piercing-projectile"
      ? "shoot" as const
      : "attack" as const;
    return { animation, eventId: recentAction.id };
  }
  if (recentAction?.kind === "player_attack") {
    const weapon = ARPG_WEAPON_BY_ID.get(player.loadout.weaponId);
    return { animation: weapon && weapon.kind !== "sword" ? "shoot" as const : "attack" as const, eventId: recentAction.id };
  }
  if (Math.abs(player.input.moveX) + Math.abs(player.input.moveY) > 0.08 || player.dashingUntilMs > state.serverTimeMs) {
    return { animation: "walk" as const, eventId: "moving" };
  }
  return { animation: "idle" as const, eventId: "idle" };
}

function getRaidBossAction(state: ArpgRaidState | null) {
  if (!state) return null;
  if (state.status !== "active") return { animation: "defeat" as const, eventId: "ended" };
  const recentEvent = [...state.log].reverse().find((event) => (
    state.serverTimeMs - event.atMs <= 1_200
    && (
      event.kind === "boss_attack"
      || (event.kind === "player_attack" && event.targetIds?.includes("raid-boss"))
    )
  ));
  if (!recentEvent) return null;
  if (recentEvent.kind === "player_attack") {
    return { animation: "damage" as const, eventId: recentEvent.id };
  }
  return {
    animation: state.boss.phase === 1 ? "attack" as const : "shoot" as const,
    eventId: recentEvent.id,
  };
}

function RaidBossSprite({
  action,
  active,
  x,
  y,
  label,
  fallbackSprite,
}: {
  action: ReturnType<typeof getRaidBossAction>;
  active: boolean;
  x: number;
  y: number;
  label: string;
  fallbackSprite: SpriteDefinition;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frames, setFrames] = useState<HTMLCanvasElement[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [playback, setPlayback] = useState<{ animation: RaidBossAnimation; eventId: string }>({
    animation: "idle",
    eventId: "idle",
  });
  const previousPosition = useRef<{ x: number; y: number } | null>(null);
  const playbackRef = useRef(playback);

  const changePlayback = useCallback((animation: RaidBossAnimation, eventId: string) => {
    playbackRef.current = { animation, eventId };
    setPlayback(playbackRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled) return;
      const columns = 4;
      const rows = 6;
      const cellWidth = Math.floor(image.naturalWidth / columns);
      const cellHeight = Math.floor(image.naturalHeight / rows);
      if (!cellWidth || !cellHeight) {
        setFailed(true);
        return;
      }

      const preparedFrames: HTMLCanvasElement[] = [];
      for (let index = 0; index < columns * rows; index += 1) {
        const frameCanvas = document.createElement("canvas");
        frameCanvas.width = cellWidth;
        frameCanvas.height = cellHeight;
        const frameContext = frameCanvas.getContext("2d", { willReadFrequently: true });
        if (!frameContext) {
          setFailed(true);
          return;
        }
        frameContext.imageSmoothingEnabled = false;
        frameContext.drawImage(
          image,
          (index % columns) * cellWidth,
          Math.floor(index / columns) * cellHeight,
          cellWidth,
          cellHeight,
          0,
          0,
          cellWidth,
          cellHeight,
        );
        const pixels = frameContext.getImageData(0, 0, cellWidth, cellHeight);
        for (let pixel = 3; pixel < pixels.data.length; pixel += 4) {
          if (pixels.data[pixel] < 96) {
            pixels.data[pixel - 3] = 0;
            pixels.data[pixel - 2] = 0;
            pixels.data[pixel - 1] = 0;
            pixels.data[pixel] = 0;
          }
        }
        frameContext.putImageData(pixels, 0, 0);
        preparedFrames.push(frameCanvas);
      }
      setFailed(false);
      setFrames(preparedFrames);
    };
    image.onerror = () => {
      if (!cancelled) setFailed(true);
    };
    image.src = RAID_ROC_SPRITE_SHEET;
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  useEffect(() => {
    const actionAnimation = action?.animation;
    const actionEventId = action?.eventId;
    if (!active) {
      changePlayback("defeat", "ended");
      return;
    }
    if (actionAnimation && actionAnimation !== "defeat") {
      changePlayback(actionAnimation, actionEventId ?? "action");
      return;
    }
    changePlayback("idle", "idle");
  }, [action, active, changePlayback]);

  useEffect(() => {
    const previous = previousPosition.current;
    const moved = previous !== null && (previous.x !== x || previous.y !== y);
    previousPosition.current = { x, y };
    if (!active || action || !moved) return;
    changePlayback("walk", "moving");
    const currentId = playbackRef.current.eventId;
    const timer = window.setTimeout(() => {
      if (playbackRef.current.eventId === currentId) changePlayback("idle", "idle");
    }, 520);
    return () => window.clearTimeout(timer);
  }, [action, active, changePlayback, x, y]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !frames) return;
    const animation = playback.animation;
    const row = RAID_BOSS_ANIMATION_ROWS[animation];
    const firstFrame = row * 4;
    const isLooping = animation === "idle" || animation === "walk";
    const frameDuration = animation === "defeat" ? 140 : animation === "idle" ? 220 : 105;
    const startedAt = performance.now();
    let frameId = 0;
    const finishTimer = !isLooping && animation !== "defeat"
      ? window.setTimeout(() => {
        if (playbackRef.current.eventId === playback.eventId) changePlayback("idle", "idle");
      }, frameDuration * 4)
      : null;
    context.imageSmoothingEnabled = false;

    const drawFrame = (now: number) => {
      const elapsedFrame = Math.floor((now - startedAt) / frameDuration);
      const localFrame = isLooping ? elapsedFrame % 4 : Math.min(3, elapsedFrame);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(frames[firstFrame + localFrame], 0, 0, canvas.width, canvas.height);
      frameId = window.requestAnimationFrame(drawFrame);
    };
    frameId = window.requestAnimationFrame(drawFrame);
    return () => {
      window.cancelAnimationFrame(frameId);
      if (finishTimer !== null) window.clearTimeout(finishTimer);
    };
  }, [changePlayback, frames, playback.animation, playback.eventId]);

  if (failed) return <PixelCreature sprite={fallbackSprite} label={label} />;
  return <canvas ref={canvasRef} className="arpg-raid-boss__sprite" width={256} height={256} aria-hidden="true" />;
}

export function ArpgRaidArena({
  roomId,
  playerId,
  onClose,
  onBossProgress,
}: {
  roomId: string;
  playerId: string;
  onClose: () => void;
  onBossProgress?: (progress: BossProgress, inventory: string[]) => void;
}) {
  const [payload, setPayload] = useState<RaidPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const progressCallbackRef = useRef(onBossProgress);
  useEffect(() => { progressCallbackRef.current = onBossProgress; }, [onBossProgress]);
  const applyBossProgress = useCallback((value: unknown) => {
    const parsed = BossProgressSchema.safeParse(value);
    if (parsed.success) progressCallbackRef.current?.(parsed.data, [...bossProgressInventory(parsed.data), ...parsed.data.unlockedLegendIds.flatMap(getLegendSignatureAbilityIds)]);
  }, []);
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
    if (next.bossProgress) applyBossProgress(next.bossProgress);
    if (next.state) stateRef.current = next.state;
    versionRef.current = next.room.version;
    setLoading(false);
    setError("");
    return next;
  }, [applyBossProgress]);

  const localAvatar = useMemo(
    () => typeof window === "undefined"
      ? DEFAULT_AVATAR_CONFIG
      : loadLocalProgress(window.localStorage, playerId).avatar,
    [playerId],
  );

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/arpg/raids/rooms/${roomId}`, { cache: "no-store" });
    const next = (await response.json()) as RaidPayload;
    if (!response.ok) throw new Error(next.error ?? "A Raid ARPG não respondeu.");
    return applyPayload(next);
  }, [applyPayload, roomId]);

  const sendAction = useCallback(async (action: RaidAction) => {
    const inputAction = action.action === "input";
    const busy = inputAction ? inputBusyRef : actionBusyRef;
    const currentState = stateRef.current;
    if (isBossInputLocked(currentState?.bossEncounter?.state) && action.action !== "input" && action.action !== "skip_intro") return false;
    if (busy.current || !currentState || currentState.status !== "active"
      || !currentState.players.some((entry) => entry.id === playerId && entry.alive)) return false;
    busy.current = true;
    if (!inputAction) setSending(true);
    const actionId = crypto.randomUUID();
    const attempts = 3;

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
          bossProgress?: BossProgress;
          restorationError?: string;
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
        if (result.bossProgress) applyBossProgress(result.bossProgress);
        versionRef.current = result.version;
        setPayload((current) => current ? {
          ...current,
          room: { ...current.room, status: result.state!.status, version: result.version! },
          state: result.state!,
        } : current);
        setError(result.restorationError ?? "");
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
  }, [applyBossProgress, playerId, refresh, roomId]);

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
    const stopMovement = () => {
      keysRef.current.clear();
      gamepadPressedRef.current.clear();
      gamepadAttackHeldRef.current = false;
      gamepadWasMovingRef.current = false;
      const current = movementRef.current;
      movementRef.current = { ...current, x: 0, y: 0 };
      lastInputRef.current = { ...lastInputRef.current, x: Number.NaN, y: Number.NaN, at: 0 };
      if (stateRef.current?.status === "active") {
        inputSeqRef.current += 1;
        void sendAction({
          action: "input",
          clientSeq: inputSeqRef.current,
          moveX: 0,
          moveY: 0,
          aimX: current.aimX,
          aimY: current.aimY,
        });
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stopMovement();
    };
    window.addEventListener("blur", stopMovement);
    window.addEventListener("pagehide", stopMovement);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", stopMovement);
      window.removeEventListener("pagehide", stopMovement);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [sendAction]);

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
      movementRef.current = {
        ...movementRef.current,
        x,
        y,
        ...(Math.abs(x) + Math.abs(y) > 0.05 ? { aimX: x, aimY: y } : {}),
      };
    };

    const down = (event: KeyboardEvent) => {
      keysRef.current.add(event.code);
      updateMovement();
      if (event.repeat) return;
      if (["Space", "ShiftLeft", "ShiftRight", "Digit1", "Digit2", "KeyR"].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === "Space") void sendAction({ action: "attack" });
      else if (event.code === "ShiftLeft" || event.code === "ShiftRight") void sendAction({ action: "dash" });
      else if (event.code === "KeyR") {
        const state = stateRef.current;
        const downed = state?.players.find((entry) => entry.id !== playerId && !entry.alive && entry.downedUntilMs > state.serverTimeMs);
        if (downed) void sendAction({ action: "revive", targetPlayerId: downed.id });
      }
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
  }, [playerId, sendAction]);

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
  const bossLocked = isBossInputLocked(state?.bossEncounter?.state);
  const currentDungeonRoom = state?.dungeon?.rooms[state.dungeon.roomIndex] ?? null;
  const worldWidth = currentDungeonRoom?.worldWidth ?? WORLD_WIDTH;
  const worldHeight = currentDungeonRoom?.worldHeight ?? WORLD_HEIGHT;
  const player = useMemo(
    () => state?.players.find((entry) => entry.id === playerId) ?? null,
    [playerId, state],
  );
  const bossDefinition = state ? CREATURE_BY_ID.get(state.boss.catalogId) ?? null : null;
  const bossAction = getRaidBossAction(state);
  const abilities = player
    ? player.loadout.abilityIds.map((id) => ARPG_ABILITY_CARD_BY_ID.get(id) ?? null)
    : [];
  const weapon = player ? ARPG_WEAPON_BY_ID.get(player.loadout.weaponId) : null;
  const relic = player ? ARPG_RELIC_BY_ID.get(player.loadout.relicId) : null;
  const recentLog = state?.log.slice(-4).reverse() ?? [];

  const setTouchMovement = (x: number, y: number) => {
    if (bossLocked) { movementRef.current.x = 0; movementRef.current.y = 0; return; }
    movementRef.current = {
      ...movementRef.current,
      x,
      y,
      ...(Math.abs(x) + Math.abs(y) > 0.05 ? { aimX: x, aimY: y } : {}),
    };
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
  const downedTeammates = state.players.filter((entry) => (
    entry.id !== playerId && !entry.alive && entry.downedUntilMs > state.serverTimeMs
  ));
  const isBossRoom = !currentDungeonRoom || currentDungeonRoom.type === "boss";
  const hasDungeonCorridor = Boolean(currentDungeonRoom && currentDungeonRoom.type !== "boss" && currentDungeonRoom.corridorWidth > 0);
  const exitX = currentDungeonRoom
    ? currentDungeonRoom.roomWidth + currentDungeonRoom.corridorWidth - ARPG_RAID_PLAYER_MARGIN
    : 0;
  const livingPlayers = state.players.filter((entry) => entry.alive);
  const playersAtExit = livingPlayers.filter((entry) => entry.x >= exitX).length;
  const corridorOpen = currentDungeonRoom?.state === "awaiting_exit";
  const bossRoomArt = state.bossEncounter ? BOSS_ROOM_ART[state.bossEncounter.bossId] : null;

  return (
    <div className={cn("arpg-raid-arena", state.boss.phase === 3 && "is-enraged")}>
      <header className="arpg-raid-arena__topbar">
        <div>
          <span><Radio /> SERVIDOR · v{payload.room.version}</span>
          <strong>{payload.event.title}</strong>
        </div>
        <div className="arpg-raid-arena__status">
          <span><Users /> {state.players.filter((entry) => entry.alive).length}/{state.players.length}</span>
          {currentDungeonRoom
            ? <span>Sala {state.dungeon!.roomIndex + 1}/{state.dungeon!.rooms.length} · {currentDungeonRoom.label}</span>
            : <span>Fase {state.boss.phase}/3</span>}
          {sending ? <em>sincronizando…</em> : null}
          <button type="button" onClick={onClose} aria-label="Fechar Raid ARPG"><X /></button>
        </div>
      </header>

      {isBossRoom && !state.bossEncounter ? (
        <section className="arpg-raid-arena__boss-hud">
          <div className="arpg-raid-arena__boss-title">
            <Sparkles />
            <span><small>CHEFE FINAL</small><strong>{state.boss.name}</strong></span>
          </div>
          <div className="arpg-raid-bar arpg-raid-bar--boss"><i style={{ width: `${bossHpPercent}%` }} /></div>
          <span>{state.boss.hp.toLocaleString("pt-BR")} / {state.boss.maxHp.toLocaleString("pt-BR")} HP</span>
        </section>
      ) : null}
      <section className="arpg-raid-world" aria-label={currentDungeonRoom ? `${currentDungeonRoom.label}, dungeon cooperativa` : "Arena cooperativa"}>
        {bossRoomArt ? <div className={`forgotten-legend-arena${["RESTORED", "UNLOCK", "CLEARED"].includes(state.bossEncounter!.state) ? " is-restored" : ""}`} style={{ backgroundImage: `url(${bossRoomArt.background.path})` }} aria-hidden="true" /> : null}
        {state.bossEncounter ? <BossEncounterView encounter={state.bossEncounter} width={worldWidth} height={worldHeight} players={state.players} onSkip={() => void sendAction({ action: "skip_intro" })} /> : null}
        <RoundTableWardView players={state.players} width={worldWidth} height={worldHeight} nowMs={state.serverTimeMs} />
        {hasDungeonCorridor && currentDungeonRoom ? (
          <>
            <div
              className="arpg-raid-dungeon-room"
              style={{ width: percent(currentDungeonRoom.roomWidth, worldWidth) }}
              aria-hidden="true"
            />
            <div
              className={cn("arpg-raid-dungeon-corridor", corridorOpen ? "is-open" : "is-locked")}
              style={{
                left: percent(currentDungeonRoom.roomWidth, worldWidth),
                width: percent(currentDungeonRoom.corridorWidth, worldWidth),
              }}
              aria-hidden="true"
            >
              <span className="arpg-raid-dungeon-corridor__path" />
              <span className="arpg-raid-dungeon-corridor__exit">SAÍDA</span>
            </div>
            <div className={cn("arpg-raid-room-transition", corridorOpen && "is-open")} role="status" aria-live="polite">
              <strong>{corridorOpen ? "PASSAGEM ABERTA" : "PORTA TRANCADA"}</strong>
              <span>{corridorOpen
                ? `Atravessem juntos · ${playersAtExit}/${livingPlayers.length} na saída`
                : "Derrotem a onda para abrir o corredor"}</span>
            </div>
          </>
        ) : null}
        {currentDungeonRoom?.type === "boss" && state.bossEncounter?.state !== "CLEARED" ? (
          <div
            className="arpg-raid-boss"
            style={{ left: percent(state.boss.x, worldWidth), top: percent(state.boss.y, worldHeight) }}
          >
            <span className="arpg-raid-boss__aura" />
            {state.bossEncounter ? <ForgottenLegendActor encounter={state.bossEncounter} /> : <RaidBossSprite
              action={bossAction}
              active={state.status === "active"}
              x={state.boss.x}
              y={state.boss.y}
              label={bossDefinition.name}
              fallbackSprite={bossDefinition.sprite}
            />}
            <strong>{state.boss.name}</strong>
            <small>Fase {state.boss.phase}</small>
          </div>
        ) : null}

        {currentDungeonRoom?.enemies.filter((enemy) => enemy.alive && enemy.waveIndex === currentDungeonRoom.waveIndex).map((enemy) => (
          <div
            className="arpg-raid-enemy"
            key={enemy.id}
            style={{ left: percent(enemy.x, worldWidth), top: percent(enemy.y, worldHeight) }}
          >
            <span className="arpg-raid-enemy__token" aria-hidden="true">✦</span>
            <strong>{enemy.name}</strong>
            <div className="arpg-raid-bar"><i style={{ width: `${enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) * 100 : 0}%` }} /></div>
            <small>{enemy.hp}/{enemy.maxHp} HP</small>
          </div>
        ))}

        {state.players.map((entry) => {
          const sprite = getRaidPlayerAnimation(state, entry);
          const avatar = avatarForRaidPlayer(entry, playerId, localAvatar);
          const presence = payload.participants?.find((participant) => participant.id === entry.id)?.presenceStatus ?? "online";
          const presenceLabel = presence === "disconnected"
            ? "desconectado"
            : presence === "reconnecting"
              ? "reconectando"
              : presence === "spectator" ? "espectador" : "conectado";
          return (
            <div
              className={cn(
                "arpg-raid-player",
                entry.id === playerId && "is-self",
                !entry.alive && "is-defeated",
              )}
              key={entry.id}
              style={{ left: percent(entry.x, worldWidth), top: percent(entry.y, worldHeight) }}
            >
              <div className="arpg-raid-player__avatar">
                <CharacterAvatar2D
                  key={`${entry.id}:${sprite.animation}:${sprite.eventId}`}
                  config={avatar}
                  compact
                  ariaLabel={`Lenda de ${entry.name}`}
                  animation={sprite.animation}
                />
              </div>
              <strong>{entry.name}{entry.id === playerId ? " · você" : ""}</strong>
              <small className={cn("arpg-raid-player__presence", `is-${presence}`)}>{presenceLabel}</small>
              <div className="arpg-raid-bar"><i style={{ width: `${entry.maxHp > 0 ? (entry.hp / entry.maxHp) * 100 : 0}%` }} /></div>
              <small>{entry.hp}/{entry.maxHp}</small>
            </div>
          );
        })}
      </section>

      <section className="arpg-raid-hud">
        <div className="arpg-raid-hud__player">
          <div className="arpg-raid-hud__identity">
            <Heart />
            <span><strong>{player.name}</strong><small>{player.alive ? "Em combate" : "Espectador"}</small></span>
          </div>
          <div className="arpg-raid-bar arpg-raid-bar--player"><i style={{ width: `${playerHpPercent}%` }} /></div>
          <span>{player.hp}/{player.maxHp} HP</span>
          <small className="arpg-raid-revive-count">Reanimações do grupo: {state.reviveCharges}</small>
          <div className="arpg-raid-hud__loadout" role="group" aria-label="Arma e relíquia desta Raid">
            <span role="img" aria-label={`Arma equipada: ${weapon?.name ?? player.loadout.weaponId}`} title={`Arma: ${weapon?.name ?? player.loadout.weaponId}`}>
              <Swords aria-hidden="true" /> {weapon?.name ?? player.loadout.weaponId}
            </span>
            <span role="img" aria-label={`Relíquia equipada: ${relic?.name ?? player.loadout.relicId}`} title={`Relíquia: ${relic?.name ?? player.loadout.relicId}`}>
              <Sparkles aria-hidden="true" /> {relic?.name ?? player.loadout.relicId}
            </span>
          </div>
        </div>

        <div className="arpg-raid-log" aria-live="polite">
          {error ? <p className="is-error">{error}</p> : null}
          {recentLog.map((entry) => <p key={entry.id}>{entry.message}</p>)}
        </div>
      </section>

      <section className="arpg-raid-controls" aria-label="Controles da Raid ARPG">
        <div className="arpg-raid-dpad">
          <button type="button" aria-label="Mover para cima" onPointerDown={() => setTouchMovement(0, -1)} onPointerUp={clearTouchMovement} onPointerCancel={clearTouchMovement}>▲</button>
          <button type="button" aria-label="Mover para a esquerda" onPointerDown={() => setTouchMovement(-1, 0)} onPointerUp={clearTouchMovement} onPointerCancel={clearTouchMovement}>◀</button>
          <button type="button" aria-label="Mover para baixo" onPointerDown={() => setTouchMovement(0, 1)} onPointerUp={clearTouchMovement} onPointerCancel={clearTouchMovement}>▼</button>
          <button type="button" aria-label="Mover para a direita" onPointerDown={() => setTouchMovement(1, 0)} onPointerUp={clearTouchMovement} onPointerCancel={clearTouchMovement}>▶</button>
        </div>

        <div className="arpg-raid-actions">
          <button type="button" disabled={bossLocked || !player.alive || state.status !== "active"} onClick={() => void sendAction({ action: "attack" })}>
            <Crosshair /><strong>ATACAR</strong><small>Espaço · A</small>
          </button>
          <button type="button" disabled={bossLocked || !player.alive || state.status !== "active"} onClick={() => void sendAction({ action: "dash" })}>
            <Zap /><strong>DASH</strong><small>Shift · B</small>
          </button>
          {downedTeammates.map((ally) => (
            <button
              type="button"
              className="arpg-raid-revive-button"
              key={ally.id}
              disabled={!player.alive || state.status !== "active" || state.reviveCharges <= 0}
              onClick={() => void sendAction({ action: "revive", targetPlayerId: ally.id })}
              title="Chegue perto para reerguer; o servidor confirma a distância."
            >
              <Heart /><strong>REERGUER {ally.name}</strong><small>R · {state.reviveCharges} restantes</small>
            </button>
          ))}
        </div>

        <div className="arpg-raid-abilities">
          {abilities.map((card, index) => {
            const readyAt = card ? player.abilityReadyAtMs[card.id] ?? 0 : 0;
            const remaining = Math.max(0, Math.ceil((readyAt - state.serverTimeMs) / 1000));
            return (
              <button
                type="button"
                key={card?.id ?? index}
                disabled={bossLocked || !card || !player.alive || state.status !== "active" || remaining > 0}
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
          <h2>{state.status === "victory" ? state.bossEncounter ? "Lenda restaurada — " + state.boss.name : `${state.boss.name} derrotado` : "O grupo foi derrotado"}</h2>
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
