"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, Mail, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function LoginDialog({
  prominent = false,
  label,
  className,
}: {
  prominent?: boolean;
  label?: string;
  className?: string;
} = {}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState<{ email: string; name: string } | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setIdentity({
        email: data.user.email ?? "Conta conectada",
        name: data.user.email?.split("@")[0] ?? "Viajante",
      });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setIdentity(user ? {
        email: user.email ?? "Conta conectada",
        name: user.email?.split("@")[0] ?? "Viajante",
      } : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMessage(error ? error.message : "Link de acesso enviado. Verifique seu e-mail.");
    setBusy(false);
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setMessage(error?.message ?? "Sessão encerrada neste dispositivo.");
    setBusy(false);
    if (!error) router.refresh();
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className={className} variant={prominent ? "default" : "secondary"} size={prominent ? "lg" : "sm"}>
          {identity ? <UserRound /> : <LogIn />} {identity?.name ?? label ?? "Entrar"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Continuar sua jornada</DialogTitle>
          <DialogDescription>
            Sua coleção, equipes e conquistas ficam vinculadas à sua conta.
          </DialogDescription>
        </DialogHeader>

        {configured && identity ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted p-4">
              <strong className="block">{identity.name}</strong>
              <span className="text-sm text-muted-foreground">{identity.email}</span>
            </div>
            <Button variant="secondary" className="w-full" onClick={signOut} disabled={busy}>
              <LogOut /> Sair desta conta
            </Button>
            {message ? <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{message}</p> : null}
          </div>
        ) : configured ? (
          <div className="space-y-4">
            <Button className="w-full" size="lg" onClick={signInWithGoogle} disabled={busy}>
              <span className="google-mark" aria-hidden>G</span>
              Entrar com Google
            </Button>
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> ou por e-mail <span className="h-px flex-1 bg-border" />
            </div>
            <form className="space-y-3" onSubmit={sendMagicLink}>
              <label className="block text-sm font-bold" htmlFor="email">E-mail</label>
              <div className="flex min-h-12 items-center gap-2 rounded-xl border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                <Mail className="size-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@exemplo.com"
                  className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Button type="submit" variant="secondary" className="w-full" disabled={busy}>
                Receber link de acesso
              </Button>
            </form>
            {message ? <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{message}</p> : null}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100">
            O modo de conta será ativado assim que o projeto Supabase for conectado. A versão atual permite testar o ciclo de jogo localmente sem fingir que o progresso já está salvo na nuvem.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

