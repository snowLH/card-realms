"use client";

import { useEffect } from "react";
import { CSS_ART_VARIABLES, FOLKLARD_ART_MANIFEST } from "@/game/arpg/art/manifest";
import { verifyAuthoredImage } from "./use-authored-image";

/** Verify only CSS images the browser actually requests, without preloading unused packs. */
export function AuthoredCssAssets() {
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    const variablesByPath = new Map<string, string[]>();
    for (const [name, path] of Object.entries(CSS_ART_VARIABLES)) {
      const names = variablesByPath.get(path) ?? [];
      names.push(name);
      variablesByPath.set(path, names);
    }
    const checked = new Set<string>();
    let active = true;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const url = new URL(entry.name, location.origin);
        if (url.origin !== location.origin || checked.has(url.pathname)) continue;
        const names = variablesByPath.get(url.pathname);
        if (!names) continue;
        checked.add(url.pathname);
        void verifyAuthoredImage(url.pathname).catch(() => {
          if (!active) return;
          for (const name of names) document.documentElement.style.setProperty(
            `--art-${name}`, `url("${FOLKLARD_ART_MANIFEST.missing.path}")`,
          );
        });
      }
    });
    observer.observe({ type: "resource", buffered: true });
    return () => { active = false; observer.disconnect(); };
  }, []);
  return null;
}
