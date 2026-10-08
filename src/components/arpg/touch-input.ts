"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import type { ArpgBridge } from "@/game/arpg/runtime/bridge";

/** Release ownership as well as input: browsers can omit pointerup on suspension. */
function useInputRelease(release: () => void) {
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) release(); };
    window.addEventListener("blur", release);
    window.addEventListener("pagehide", release);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", release);
      window.removeEventListener("pagehide", release);
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [release]);
}

function releaseCapture(element: HTMLElement | null, pointerId: number | null) {
  if (element && pointerId !== null && element.hasPointerCapture?.(pointerId)) {
    element.releasePointerCapture?.(pointerId);
  }
}

export function useVirtualJoystick(bridge: ArpgBridge) {
  const stickRef = useRef<HTMLDivElement>(null);
  const owner = useRef<number | null>(null);
  const reset = useCallback(() => {
    const previous = owner.current;
    owner.current = null;
    bridge.setMove(0, 0);
    const nub = stickRef.current?.querySelector<HTMLElement>("span");
    nub?.style.setProperty("--stick-x", "0px");
    nub?.style.setProperty("--stick-y", "0px");
    releaseCapture(stickRef.current, previous);
  }, [bridge]);
  useInputRelease(reset);

  const update = (event: PointerEvent<HTMLDivElement>) => {
    if (owner.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.42);
    const scale = Math.min(1, radius / (Math.hypot(x, y) || 1));
    const nub = stickRef.current?.querySelector<HTMLElement>("span");
    nub?.style.setProperty("--stick-x", `${x * scale}px`);
    nub?.style.setProperty("--stick-y", `${y * scale}px`);
    bridge.setMove(x * scale / radius, y * scale / radius);
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (owner.current === event.pointerId) reset();
  };
  return {
    ref: stickRef,
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (owner.current !== null || event.button > 0) return;
      owner.current = event.pointerId;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      update(event);
    },
    onPointerMove: update,
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  };
}

/** A press queues once; the compatibility click must not queue a second action. */
export function useTouchAction(action: () => void) {
  const owner = useRef<number | null>(null);
  const target = useRef<HTMLButtonElement | null>(null);
  const reset = useCallback(() => {
    const previous = owner.current;
    owner.current = null;
    releaseCapture(target.current, previous);
    target.current = null;
  }, []);
  useInputRelease(reset);
  const end = (event: PointerEvent<HTMLButtonElement>) => {
    if (owner.current === event.pointerId) reset();
  };
  return {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (owner.current !== null || event.button > 0) return;
      owner.current = event.pointerId;
      target.current = event.currentTarget;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      action();
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) action();
    },
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  };
}

export function useHeldAttack(bridge: ArpgBridge) {
  const pointers = useRef(new Set<number>());
  const keyboard = useRef(false);
  const target = useRef<HTMLButtonElement | null>(null);
  const reset = useCallback(() => {
    const previous = [...pointers.current];
    pointers.current.clear();
    keyboard.current = false;
    bridge.setAttack(false);
    for (const id of previous) releaseCapture(target.current, id);
  }, [bridge]);
  useInputRelease(reset);
  const end = (event: PointerEvent<HTMLButtonElement>) => {
    pointers.current.delete(event.pointerId);
    bridge.setAttack(keyboard.current || pointers.current.size > 0);
    releaseCapture(event.currentTarget, event.pointerId);
  };
  return {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (event.button > 0) return;
      target.current = event.currentTarget;
      pointers.current.add(event.pointerId);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      bridge.setAttack(true);
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
    onBlur: reset,
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.code !== "Space" && event.code !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      keyboard.current = true;
      bridge.setAttack(true);
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.code !== "Space" && event.code !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      keyboard.current = false;
      bridge.setAttack(pointers.current.size > 0);
    },
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  };
}
