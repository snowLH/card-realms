import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id");
  const requestedNext = searchParams.get("next") ?? "/";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\")
    ? requestedNext
    : "/";

  if (isSupabaseConfigured() && code && searchParams.getAll("code").length === 1
    && searchParams.getAll("sb_flow_id").length <= 1
    && (!flowId || /^[a-zA-Z0-9_-]{8,64}$/.test(flowId))) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    } catch { /* Keep the failure on the game's origin without exposing auth codes. */ }
  }

  return NextResponse.redirect(`${origin}/?auth=erro`);
}
