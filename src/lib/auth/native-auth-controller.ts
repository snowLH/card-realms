import { parseNativeAuthCallback } from "./native-callback";

export const NATIVE_AUTH_PENDING_KEY = "folklard:auth:pending:v1";
export const NATIVE_AUTH_TIMEOUT_MS = 10 * 60 * 1000;
type PendingAuth = { startedAt: number; origin: string; flowId?: string };
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Exchange = (code: string, options?: { flowId: string }) => Promise<{
  data: { session: unknown }; error: unknown;
}>;
export type NativeAuthResult = "ignored" | "expired" | "provider-error" | "exchange-error" | "signed-in";

/** PKCE verifier/session stay in the Supabase client's first-party storage. */
export class NativeAuthController {
  private inFlight = new Set<string>();
  private completed = new Set<string>();
  constructor(private readonly storage: StoragePort, private readonly origin: string,
    private readonly exchange: Exchange, private readonly now = Date.now) {}

  begin() {
    if (this.inFlight.size) throw new Error("Aguarde a conclusão do acesso antes de tentar novamente.");
    this.storage.setItem(NATIVE_AUTH_PENDING_KEY, JSON.stringify({ startedAt: this.now(), origin: this.origin }));
  }
  cancel() {
    if (this.inFlight.size) throw new Error("Aguarde a conclusão do acesso antes de sair.");
    this.storage.removeItem(NATIVE_AUTH_PENDING_KEY);
  }
  trackOAuthRedirect(authorizationUrl: string) {
    const pending = this.pending();
    if (!pending) return;
    const redirect = new URL(authorizationUrl).searchParams.get("redirect_to");
    if (!redirect) return;
    const flowId = new URL(redirect).searchParams.get("sb_flow_id");
    if (flowId && /^[a-zA-Z0-9_-]{8,64}$/.test(flowId)) {
      this.storage.setItem(NATIVE_AUTH_PENDING_KEY, JSON.stringify({ ...pending, flowId }));
    }
  }
  private pending(): PendingAuth | null {
    try {
      const raw = this.storage.getItem(NATIVE_AUTH_PENDING_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as PendingAuth;
      return typeof value.startedAt === "number" && Number.isFinite(value.startedAt)
        && value.origin === this.origin ? value : null;
    } catch { return null; }
  }
  async accept(raw: string): Promise<NativeAuthResult> {
    const callback = parseNativeAuthCallback(raw);
    const pending = this.pending();
    if (!callback || !pending || this.inFlight.size) return "ignored";
    const age = this.now() - pending.startedAt;
    if (age < 0 || age > NATIVE_AUTH_TIMEOUT_MS) { this.cancel(); return "expired"; }
    if (pending.flowId && callback.flowId !== pending.flowId) return "ignored";
    if (callback.kind === "error") { this.cancel(); return "provider-error"; }
    if (this.inFlight.size || this.completed.has(callback.code)) return "ignored";
    this.inFlight.add(callback.code);
    try {
      const result = await this.exchange(callback.code, callback.flowId ? { flowId: callback.flowId } : undefined);
      if (result.error || !result.data.session) return "exchange-error";
      this.completed.add(callback.code);
      // A successful exchange is one-shot, even across a renderer/app restart.
      this.storage.removeItem(NATIVE_AUTH_PENDING_KEY);
      return "signed-in";
    } catch { return "exchange-error"; }
    finally { this.inFlight.delete(callback.code); }
  }
}
