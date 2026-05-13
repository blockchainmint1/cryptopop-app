import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateMnemonic, deriveTxcAddress, isValidTxcAddress } from "@/lib/wallet";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [loading, session, navigate]);

  // Ensure every authenticated user has a valid TXC wallet address before
  // they can hit any child route (scan, app, etc.). Previously this only
  // happened on /app, so users who deep-linked to /scan got "no_wallet".
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_address")
        .eq("id", user.id)
        .maybeSingle();
      const current = profile?.wallet_address ?? null;
      if (current && isValidTxcAddress(current)) return;
      const mnemonic = getOrCreateMnemonic();
      const addr = deriveTxcAddress(mnemonic);
      await supabase.from("profiles").update({ wallet_address: addr }).eq("id", user.id);
    })();
  }, [user]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}
