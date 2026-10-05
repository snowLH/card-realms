"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const standalone = typeof window !== "undefined"
    && window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);
  if (standalone || installed || !promptEvent) return null;

  const install = async () => {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setPromptEvent(null);
  };

  return (
    <button type="button" className="pwa-install-button" onClick={() => void install()}>
      <Download />
      <span>
        <strong>Instalar Card Realms</strong>
        <small>Adicionar como aplicativo</small>
      </span>
    </button>
  );
}
