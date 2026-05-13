import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, LogOut, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getOrCreateMnemonic, deriveTxcAddress } from "@/lib/wallet";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Wallet — CryptoPOP" }] }),
  component: WalletHome,
});

function WalletHome() {
  const { user, signOut } = useAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [eventsAttended, setEventsAttended] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);

  // Provision wallet on first login
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_address")
        .eq("id", user.id)
        .maybeSingle();

      let addr = profile?.wallet_address ?? null;
      if (!addr) {
        const mnemonic = getOrCreateMnemonic();
        addr = deriveTxcAddress(mnemonic);
        await supabase.from("profiles").update({ wallet_address: addr }).eq("id", user.id);
      } else {
        // Ensure local mnemonic exists for future signing
        getOrCreateMnemonic();
      }
      setAddress(addr);

      const { data: bal } = await supabase
        .from("pop_balance_mirror")
        .select("balance, events_attended")
        .eq("user_id", user.id)
        .maybeSingle();
      if (bal) {
        setBalance(Number(bal.balance));
        setEventsAttended(bal.events_attended);
      }
    })();
  }, [user]);

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-4">
          <span className="font-display text-lg font-semibold tracking-tight">CryptoPOP</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-6 py-8">
        {/* Balance */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/15 via-primary/5 to-background p-8 text-center shadow-lg">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">POP Balance</p>
          <div className="mt-3 flex items-baseline justify-center gap-2">
            <span className="font-display text-5xl font-bold tabular-nums">
              {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span className="text-lg font-medium text-muted-foreground">POP</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {eventsAttended} {eventsAttended === 1 ? "event" : "events"} attended
          </p>
        </Card>

        {/* Receive */}
        <Card className="p-6">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Receive TXC
          </h2>
          {address ? (
            <>
              <div className="mt-4 flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={address} size={180} level="M" />
              </div>
              <button
                onClick={copy}
                className="mt-4 flex w-full items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-left font-mono text-xs transition hover:bg-muted"
              >
                <span className="truncate">{address}</span>
                {copied ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            </>
          ) : (
            <div className="mt-4 h-48 animate-pulse rounded-lg bg-muted" />
          )}
        </Card>

        {/* Recovery phrase */}
        <Card className="border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Back up your recovery phrase</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                This phrase is the only way to restore your wallet. Store it offline.
              </p>
              {showMnemonic ? (
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-background/60 p-3 font-mono text-xs">
                  {getOrCreateMnemonic().split(" ").map((w, i) => (
                    <div key={i} className="flex items-baseline gap-1.5">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowMnemonic(true)}
                >
                  Reveal phrase
                </Button>
              )}
            </div>
          </div>
        </Card>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Signed in as {user?.email}
        </p>
      </main>
    </div>
  );
}
