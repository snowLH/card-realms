import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import type { PluginListenerHandle } from "@capacitor/core";

export type DesktopAuthBridge = {
  version: 1;
  openAuth: (url: string) => Promise<void>;
  onAuthCallback: (listener: (url: string) => void) => () => void;
};
declare global { interface Window { folklardDesktop?: DesktopAuthBridge } }

export function nativeAuthPlatform(): "mobile" | "desktop" | "unsupported-desktop" | "web" {
  if (typeof window === "undefined") return "web";
  if (Capacitor.isNativePlatform()) return "mobile";
  if (window.folklardDesktop?.version === 1) return "desktop";
  return navigator.userAgent.includes("Electron/") ? "unsupported-desktop" : "web";
}

export function supportsNativeAuth() {
  const platform = nativeAuthPlatform();
  return platform === "desktop" || platform === "web"
    || (platform === "mobile" && Capacitor.isPluginAvailable("App") && Capacitor.isPluginAvailable("Browser"));
}

export async function openNativeAuth(url: string) {
  if (new URL(url).protocol !== "https:") throw new Error("Endereço de autenticação inválido.");
  if (nativeAuthPlatform() === "desktop") return window.folklardDesktop!.openAuth(url);
  if (nativeAuthPlatform() === "mobile" && Capacitor.isPluginAvailable("Browser")) {
    return Browser.open({ url, toolbarColor: "#0b211e" });
  }
  throw new Error("Atualize o aplicativo para entrar com sua conta.");
}

/** Register before reading launch URL so a warm callback cannot fall into the gap. */
export function connectNativeAuth(listener: (url: string) => void) {
  if (nativeAuthPlatform() === "desktop") return window.folklardDesktop!.onAuthCallback(listener);
  if (nativeAuthPlatform() !== "mobile" || !Capacitor.isPluginAvailable("App")) return () => {};
  let disposed = false;
  let handle: PluginListenerHandle | undefined;
  void (async () => {
    try {
      const registered = await App.addListener("appUrlOpen", ({ url }) => { if (!disposed) listener(url); });
      if (disposed) { await registered.remove(); return; }
      handle = registered;
      const launch = await App.getLaunchUrl();
      if (!disposed && launch?.url) listener(launch.url);
    } catch { /* Missing bridge in older installed clients is reported when starting auth. */ }
  })();
  return () => { disposed = true; void handle?.remove().catch(() => {}); };
}

export async function closeNativeAuth() {
  if (nativeAuthPlatform() === "mobile" && Capacitor.isPluginAvailable("Browser")) {
    await Browser.close().catch(() => {}); // Android Custom Tabs return via the intent; close is iOS-only.
  }
}
