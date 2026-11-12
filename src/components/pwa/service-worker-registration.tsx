"use client";

import { useEffect } from "react";

export function isFolklardWorker(scriptURL: string | undefined, origin: string) {
  if (!scriptURL) return false;
  try {
    const url = new URL(scriptURL);
    return url.origin === origin && url.pathname === "/sw.js";
  } catch { return false; }
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      let cancelled = false;
      const releaseDevelopmentCache = async () => {
        try {
          const hadController = isFolklardWorker(navigator.serviceWorker.controller?.scriptURL, window.location.origin);
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations
            .filter((registration) => [registration.active, registration.waiting, registration.installing]
              .some((worker) => isFolklardWorker(worker?.scriptURL, window.location.origin)))
            .map((registration) => registration.unregister()));
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.filter((key) => (key.startsWith("card-realms-") || key.startsWith("folklard-"))).map((key) => caches.delete(key)));
          }
          // Unregistering only releases existing controlled pages on their next navigation.
          if (hadController && !cancelled) window.location.reload();
        } catch (error) {
          console.warn("O cache local de desenvolvimento de Folklard não pôde ser atualizado.", error);
        }
      };
      void releaseDevelopmentCache();
      return () => { cancelled = true; };
    }

    const register = async () => {
      try {
        // Production builds on loopback need real offline QA. Development still
        // unregisters our workers/caches, including this explicit opt-in URL.
        const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
        const registration = await navigator.serviceWorker.register(loopback ? "/sw.js?offline=1" : "/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        await registration.update();
      } catch (error) {
        console.warn("O service worker de Folklard não pôde ser registrado.", error);
      }
    };

    if (document.readyState === "complete") {
      void register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
