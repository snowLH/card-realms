"use client";

import { useEffect, useRef } from "react";
import { NATIVE_BACK_EVENT } from "@/lib/native-events";

/** Decisions cannot be dismissed: keep keyboard/native navigation in the choice. */
export function useChoiceFocus(active: boolean, preferPrimary = false) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = ref.current;
    if (!active || !panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const buttons = () => [...panel.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const preferred = preferPrimary ? panel.querySelector<HTMLButtonElement>("button.is-primary:not(:disabled)") : null;
    (preferred ?? buttons()[0])?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (event.key === "Tab") {
        const actions = buttons();
        if (!actions.length) return;
        const index = actions.indexOf(document.activeElement as HTMLButtonElement);
        const next = index < 0 ? (event.shiftKey ? actions.length - 1 : 0)
          : (index + (event.shiftKey ? -1 : 1) + actions.length) % actions.length;
        event.preventDefault();
        actions[next].focus({ preventScroll: true });
      } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        const actions = buttons();
        if (!actions.length) return;
        const index = actions.indexOf(document.activeElement as HTMLButtonElement);
        const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        const next = event.key === "Home" ? 0 : event.key === "End" ? actions.length - 1
          : (Math.max(0, index) + step + actions.length) % actions.length;
        event.preventDefault();
        event.stopImmediatePropagation();
        actions[next].focus({ preventScroll: true });
      }
    };
    const keepChoice = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener(NATIVE_BACK_EVENT, keepChoice, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener(NATIVE_BACK_EVENT, keepChoice, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [active, preferPrimary]);
  return ref;
}
