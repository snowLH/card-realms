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
    const revealChoice = (button: HTMLButtonElement) => {
      const scroller = button.closest<HTMLElement>(".arpg-room-choice__options");
      if (!scroller) return;
      const option = button.getBoundingClientRect();
      const viewport = scroller.getBoundingClientRect();
      if (option.bottom > viewport.bottom) scroller.scrollTop += option.bottom - viewport.bottom;
      else if (option.top < viewport.top) scroller.scrollTop += option.top - viewport.top;
    };
    const focusChoice = (button: HTMLButtonElement | null | undefined) => {
      if (!button) return;
      button.focus({ preventScroll: true });
      revealChoice(button);
    };
    const revealFocusedChoice = () => {
      const button = document.activeElement;
      if (button instanceof HTMLButtonElement && panel.contains(button)) revealChoice(button);
    };
    const preferred = preferPrimary ? panel.querySelector<HTMLButtonElement>("button.is-primary:not(:disabled)") : null;
    focusChoice(preferred ?? buttons()[0]);
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
        focusChoice(actions[next]);
      } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        const actions = buttons();
        if (!actions.length) return;
        const index = actions.indexOf(document.activeElement as HTMLButtonElement);
        const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        const next = event.key === "Home" ? 0 : event.key === "End" ? actions.length - 1
          : (Math.max(0, index) + step + actions.length) % actions.length;
        event.preventDefault();
        event.stopImmediatePropagation();
        focusChoice(actions[next]);
      }
    };
    const keepChoice = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener(NATIVE_BACK_EVENT, keepChoice, true);
    window.addEventListener("resize", revealFocusedChoice);
    const scroller = panel.querySelector(".arpg-room-choice__options");
    const resizeObserver = scroller && typeof ResizeObserver !== "undefined" ? new ResizeObserver(revealFocusedChoice) : null;
    if (scroller) resizeObserver?.observe(scroller);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener(NATIVE_BACK_EVENT, keepChoice, true);
      window.removeEventListener("resize", revealFocusedChoice);
      resizeObserver?.disconnect();
      if (previous?.isConnected) previous.focus();
    };
  }, [active, preferPrimary]);
  return ref;
}
