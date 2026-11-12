export const NATIVE_AUTH_CALLBACK = "folklard://auth/callback";

export type NativeAuthCallback =
  | { kind: "code"; code: string; flowId?: string }
  | { kind: "error"; flowId?: string };

/** Never accept a bearer token, redirect destination or arbitrary scheme from IPC. */
export function parseNativeAuthCallback(raw: string): NativeAuthCallback | null {
  if (typeof raw !== "string" || raw.length > 4096) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "folklard:" || url.hostname !== "auth" || url.pathname !== "/callback"
      || url.username || url.password || url.port) return null;
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (url.searchParams.has("access_token") || fragment.has("access_token")
      || url.searchParams.has("refresh_token") || fragment.has("refresh_token")) return null;
    const flowIds = url.searchParams.getAll("sb_flow_id");
    if (flowIds.length > 1) return null;
    const flowId = flowIds[0];
    if (flowId !== undefined && !/^[a-zA-Z0-9_-]{8,64}$/.test(flowId)) return null;
    if (url.searchParams.has("error") || fragment.has("error")) return { kind: "error", ...(flowId ? { flowId } : {}) };
    const codes = url.searchParams.getAll("code");
    if (codes.length !== 1 || !/^[a-zA-Z0-9_-]{8,512}$/.test(codes[0])) return null;
    return { kind: "code", code: codes[0], ...(flowId ? { flowId } : {}) };
  } catch { return null; }
}
