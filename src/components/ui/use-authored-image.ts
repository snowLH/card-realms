"use client";

import { useEffect, useState } from "react";
import { FOLKLARD_ART_MANIFEST } from "@/game/arpg/art/manifest";

const requests = new Map<string, Promise<void>>();
export function verifyAuthoredImage(path: string) {
  let request = requests.get(path);
  if (!request) {
    request = new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => {
        const error = new Error(`Missing authored image: ${path}`);
        console.error(error);
        reject(error);
      };
      image.src = path;
    });
    requests.set(path, request);
  }
  return request;
}

/** CSS sprites need the same image placeholder/error policy as canvas actors. */
export function useAuthoredImage(path: string | null, actor = false) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const fallback = actor ? FOLKLARD_ART_MANIFEST.missingActor.path : FOLKLARD_ART_MANIFEST.missing.path;
  useEffect(() => {
    if (!path) { console.error("Missing authored image definition"); return; }
    let active = true;
    verifyAuthoredImage(path).catch(() => {
      if (active) setFailedPath(path);
    });
    return () => { active = false; };
  }, [path]);
  return !path || path === failedPath ? fallback : path;
}
