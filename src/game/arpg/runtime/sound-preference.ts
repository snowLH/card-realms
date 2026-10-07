export const SOUND_PREFERENCE_EVENT = "arpg:sound-preference";

let soundEnabledInMemory = true;

export function getSoundEnabledSnapshot() {
  try {
    const saved = window.localStorage.getItem("arpg.soundEnabled");
    if (saved === "true" || saved === "false") return saved === "true";
  } catch {
    // Keep the current-session preference when storage is blocked.
  }
  return soundEnabledInMemory;
}

export function subscribeSoundPreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SOUND_PREFERENCE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SOUND_PREFERENCE_EVENT, onChange);
  };
}

export function setSoundEnabledPreference(enabled: boolean) {
  soundEnabledInMemory = enabled;
  try {
    window.localStorage.setItem("arpg.soundEnabled", String(enabled));
  } catch {
    // The preference remains active for this session if storage is blocked.
  }
  window.dispatchEvent(new Event(SOUND_PREFERENCE_EVENT));
}
