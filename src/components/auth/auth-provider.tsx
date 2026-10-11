"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isGoogleOAuthEnabled } from "@/lib/supabase/provider-settings";
import { NATIVE_AUTH_CALLBACK } from "@/lib/auth/native-callback";
import { NativeAuthController } from "@/lib/auth/native-auth-controller";
import { closeNativeAuth, connectNativeAuth, nativeAuthPlatform, openNativeAuth, supportsNativeAuth } from "@/lib/auth/native-auth-bridge";
import { useCloudSoundPreference } from "./use-cloud-sound-preference";

type Identity = { email: string; name: string } | null;
type AuthContextValue = {
  accountId: string | null | undefined;
  identity: Identity; busy: boolean; message: string;
  signInWithGoogle: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity>(null);
  const [accountId, setAccountId] = useState<string | null | undefined>(() => isSupabaseConfigured() ? undefined : null);
  useCloudSoundPreference(accountId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef<NativeAuthController | null>(null);
  const operation = useRef(false);
  const identityId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let disposed = false;
    try {
      controller.current = new NativeAuthController(window.localStorage, window.location.origin,
        (code, options) => supabase.auth.exchangeCodeForSession(code, options));
    } catch { controller.current = null; }
    const update = (user: { id: string; email?: string } | null) => {
      if (disposed) return;
      setAccountId(user?.id ?? null);
      setIdentity(user ? { email: user.email ?? "Conta conectada", name: user.email?.split("@")[0] ?? "Viajante" } : null);
    };
    void supabase.auth.getUser().then(({ data }) => {
      // A late initial lookup must not put the previous account back on screen.
      if (identityId.current === undefined || identityId.current === (data.user?.id ?? null)) update(data.user);
    }).catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (disposed) return;
      const nextId = session?.user.id ?? null;
      const changed = identityId.current !== nextId;
      identityId.current = nextId;
      update(session?.user ?? null);
      if ((event === "SIGNED_IN" && changed) || event === "SIGNED_OUT") {
        // Run outside Supabase's auth callback/lock. Server cookies are already persisted.
        queueMicrotask(() => { if (!disposed) router.refresh(); });
      }
    });
    const disconnect = connectNativeAuth((url) => {
      void (async () => {
        const result = await controller.current?.accept(url);
        if (disposed || !result || result === "ignored") return;
        await closeNativeAuth();
        if (disposed) return;
        setMessage(result === "signed-in" ? "Conta conectada. Carregando sua jornada..."
          : result === "expired" ? "O acesso expirou. Entre novamente."
          : result === "provider-error" ? "O acesso foi cancelado. Você pode tentar novamente."
          : "Não foi possível concluir o acesso. Verifique a conexão e tente novamente.");
      })();
    });
    return () => { disposed = true; disconnect(); data.subscription.unsubscribe(); controller.current = null; };
  }, [router]);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true; setBusy(true); setMessage("");
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível entrar. Tente novamente."); }
    finally { operation.current = false; setBusy(false); }
  }, []);

  const redirect = () => nativeAuthPlatform() === "web"
    ? `${window.location.origin}/auth/callback` : NATIVE_AUTH_CALLBACK;
  const prepareNative = () => {
    if (nativeAuthPlatform() === "web") return;
    if (!supportsNativeAuth() || !controller.current) {
      throw new Error("Atualize o aplicativo para entrar com sua conta.");
    }
    controller.current.begin();
  };
  const signInWithGoogle = () => run(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("O acesso à conta está indisponível no momento.");
    const enabled = await isGoogleOAuthEnabled(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    if (!enabled) throw new Error("O login com Google ainda não está ativado. Use o acesso por e-mail.");
    prepareNative();
    try {
      const native = nativeAuthPlatform() !== "web";
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: {
        redirectTo: redirect(), skipBrowserRedirect: native,
      } });
      if (error) throw error;
      if (native) {
        if (!data.url) throw new Error("O endereço de acesso está indisponível.");
        controller.current?.trackOAuthRedirect(data.url);
        await openNativeAuth(data.url);
        setMessage("Conclua o acesso no navegador para voltar ao Folklard.");
      }
    } catch (error) { controller.current?.cancel(); throw error; }
  });
  const sendMagicLink = (email: string) => run(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("O acesso à conta está indisponível no momento.");
    prepareNative();
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } });
      if (error) throw error;
    } catch (error) { controller.current?.cancel(); throw error; }
    setMessage("Link de acesso enviado. Abra-o neste dispositivo para continuar.");
  });
  const signOut = () => run(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    controller.current?.cancel();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    setMessage("Sessão encerrada neste dispositivo.");
  });
  return <AuthContext.Provider value={{ accountId, identity, busy, message, signInWithGoogle, sendMagicLink, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
