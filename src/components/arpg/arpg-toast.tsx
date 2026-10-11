"use client";

import { useEffect, useState } from "react";

/** Parent keys by notification ID so even a repeated message restarts the toast. */
export function ArpgToast({ text, durationMs = 2500 }: { text: string; durationMs?: number }) {
  const [visible, setVisible] = useState(true);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), durationMs);
    const expiry = window.setTimeout(() => setExpired(true), durationMs + 180);
    return () => { window.clearTimeout(timer); window.clearTimeout(expiry); };
  }, [durationMs]);
  return <div className={`arpg-toast${visible ? " arpg-toast--visible" : ""}`} aria-live="polite" aria-atomic="true">
    <span>{expired ? "" : text}</span>
  </div>;
}
