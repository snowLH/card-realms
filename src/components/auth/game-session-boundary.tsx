"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { LoginDialog } from "./login-dialog";

/** Unmount the previous simulation/cache writers before an account refresh resolves. */
export function GameSessionBoundary({ accountId, children }: {
  accountId: string | null;
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    // INITIAL_SESSION can restore a different account without a SIGNED_IN event.
    if (auth.accountId !== undefined && auth.accountId !== accountId) router.refresh();
  }, [accountId, auth.accountId, router]);
  if (auth.accountId === accountId) return children;
  return <main className="battle-loading flex-col gap-4">
    <p role="status" aria-live="polite">Carregando sua jornada...</p>
    <LoginDialog />
    <a href="/offline">Jogar offline</a>
  </main>;
}
