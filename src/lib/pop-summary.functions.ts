// Authoritative POP summary for the signed-in user.
// Reads the user's email from the verified JWT claims and aggregates
// pop_awards + event_signups server-side so the UI doesn't depend on RLS
// edge cases or on-chain confirmation timing.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

export type PopSummaryAward = {
  id: string;
  amount: number;
  source: string;
  status: "pending" | "sent" | "failed";
  tx_hash: string | null;
  created_at: string;
};

export type PopSummary = {
  balance: number;
  eventsAttended: number;
  awards: PopSummaryAward[];
};

export const getMyPopSummary = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<PopSummary> => {
    const email = (context.claims?.email as string | undefined)?.toLowerCase();
    if (!email) return { balance: 0, eventsAttended: 0, awards: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [awardsRes, signupsRes] = await Promise.all([
      supabaseAdmin
        .from("pop_awards")
        .select("id, amount, source, status, tx_hash, created_at")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("event_signups")
        .select("checked_in_at")
        .eq("email", email),
    ]);

    if (awardsRes.error) console.error("[getMyPopSummary] awards", awardsRes.error);
    if (signupsRes.error) console.error("[getMyPopSummary] signups", signupsRes.error);

    const awards = (awardsRes.data ?? []) as PopSummaryAward[];

    // Balance = sum of awards that have been sent or are pending broadcast.
    // Failed awards are excluded. This is the "what we owe / have minted to
    // you" number; once on-chain confirms it matches the chain balance.
    const balance = awards
      .filter((a) => a.status === "sent" || a.status === "pending")
      .reduce((acc, a) => acc + Number(a.amount), 0);

    const eventsAttended = (signupsRes.data ?? []).filter(
      (r) => r.checked_in_at != null,
    ).length;

    return { balance, eventsAttended, awards };
  });
