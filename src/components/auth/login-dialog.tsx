"use client";

import { useState } from "react";
import { LogIn, LogOut, Mail, UserRound } from "@/components/ui/pixel-icon";
import { useAuth } from "./auth-provider";

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
  const [email, setEmail] = useState("");
  const { identity, busy, message, signInWithGoogle, sendMagicLink, signOut } = useAuth();
  const configured = isSupabaseConfigured();
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
            Suas Lendas, equipamentos e conquistas ficam vinculados à sua conta.
          </DialogDescription>
        </DialogHeader>

        {configured && identity ? (
          <div className="space-y-4">
            <div className="authored-panel p-4">
              <strong className="block">{identity.name}</strong>
              <span className="text-sm text-muted-foreground">{identity.email}</span>
            </div>
            <Button variant="secondary" className="w-full" onClick={signOut} disabled={busy}>
              <LogOut /> Sair desta conta
            </Button>
            {message ? <p role="status" aria-live="polite" className="authored-panel p-3 text-sm text-muted-foreground">{message}</p> : null}
          </div>
        ) : configured ? (
          <div className="space-y-4">
            <Button className="w-full" size="lg" onClick={signInWithGoogle} disabled={busy}>
              <span className="google-mark" aria-hidden>G</span>
              Entrar com Google
            </Button>
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span className="authored-separator h-px flex-1" /> ou por e-mail <span className="authored-separator h-px flex-1" />
            </div>
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void sendMagicLink(email); }}>
              <label className="block text-sm font-bold" htmlFor="email">E-mail</label>
              <div className="authored-panel flex min-h-12 items-center gap-2 border px-3 ">
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
            {message ? <p role="status" aria-live="polite" className="authored-panel p-3 text-sm text-muted-foreground">{message}</p> : null}
          </div>
        ) : (
          <div className="authored-panel p-4 text-sm leading-relaxed text-amber-100">
            O acesso à conta está indisponível no momento. Você pode jogar como visitante; sua jornada será salva neste aparelho.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
