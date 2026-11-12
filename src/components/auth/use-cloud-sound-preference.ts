"use client";
import { useEffect } from "react";
import { PreferencesReceiptSchema, PlayerPreferencesSchema } from "@/lib/player-preferences";
import { PreferencesSyncController } from "@/lib/preferences-sync-controller";
import { getSoundEnabledSnapshot, setSoundEnabledPreference, SOUND_PREFERENCE_EVENT } from "@/game/arpg/runtime/sound-preference";

const GUEST_SOUND_KEY = "arpg.soundEnabled:guest";
const endpoint = "/api/player/progress?handler=preferences";
export function useCloudSoundPreference(accountId: string | null | undefined) {
  useEffect(() => {
    if (accountId === undefined) return;
    if (!accountId) {
      try {
        const saved = window.localStorage.getItem(GUEST_SOUND_KEY);
        if (saved === "true" || saved === "false") setSoundEnabledPreference(saved === "true");
        else window.localStorage.setItem(GUEST_SOUND_KEY, String(getSoundEnabledSnapshot()));
      } catch { /* Blocked storage leaves the current session playable. */ }
      const saveGuest = () => { try { window.localStorage.setItem(GUEST_SOUND_KEY, String(getSoundEnabledSnapshot())); } catch {} };
      window.addEventListener(SOUND_PREFERENCE_EVENT, saveGuest);
      return () => window.removeEventListener(SOUND_PREFERENCE_EVENT, saveGuest);
    }
    const controller = new PreferencesSyncController(window.localStorage, accountId, {
      read: async () => {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) throw new Error("Preferences unavailable");
        return PlayerPreferencesSchema.parse((await response.json()).snapshot);
      },
      write: async (soundEnabled, expectedRevision) => {
        const response = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" },
          body: JSON.stringify({ soundEnabled, expectedRevision }) });
        if (!response.ok && response.status !== 409) throw new Error("Preferences unavailable");
        const receipt = await response.json();
        return PreferencesReceiptSchema.parse({ confirmed: receipt.confirmed, snapshot: receipt.snapshot });
      },
    }, setSoundEnabledPreference);
    const changed = () => { try { controller.change(getSoundEnabledSnapshot()); } catch { /* Keep session setting. */ } };
    const refresh = () => { void controller.refresh(); };
    const foreground = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener(SOUND_PREFERENCE_EVENT, changed);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", foreground);
    void controller.start();
    return () => {
      controller.stop(); window.removeEventListener(SOUND_PREFERENCE_EVENT, changed); window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", foreground);
    };
  }, [accountId]);
}
