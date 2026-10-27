import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/lib/wallet/wallet-context";
import { derivePrivateKey } from "@/lib/wallet/sign";
import { signTxcMessage } from "@/lib/wallet/txc-message";
import { openHmeLogin } from "@/lib/hme";
import { linkTsdBridge, tsdLinkMessage } from "@/lib/tsd-partner.functions";
import { TOPUP_DEPOSITS_ENABLED } from "@/lib/tsd-topup";
import type { PartnerAccount } from "@/lib/tsd-partner.server";

/**
 * One-tap TSD Bridge setup: Honest Money sign-in, then the wallet signs its
 * TSD address on-device and CryptoPOP asks the bridge for a deposit address.
 */
export function AutoTopupPanel({ address }: { address: string | null }) {
  const { user } = useAuth();
  const wallet = useWallet();
  const link = useServerFn(linkTsdBridge);
  const member = user?.app_metadata?.["hme_member_id"];
  const memberId = typeof member === "string" ? member : null;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [account, setAccount] = useState<PartnerAccount | null>(null);

  async function setup() {
    if (!memberId || !address || !wallet.mnemonic || wallet.status !== "unlocked" || wallet.address !== address) {
      setNote("Unlock your wallet first."); return;
    }
    setBusy(true); setNote(null);
    let key: Uint8Array | null = null;
    try {
      const issuedAt = new Date().toISOString();
      key = derivePrivateKey(wallet.mnemonic);
      const signature = signTxcMessage(key, tsdLinkMessage(memberId, address, issuedAt));
      const r = await link({ data: { address, issuedAt, signature } });
      if (r.status === "ready") setAccount(r);
      else setNote(r.reason);
    } catch {
      setNote("Something went wrong. Try again.");
    } finally { key?.fill(0); setBusy(false); }
  }

  if (account && TOPUP_DEPOSITS_ENABLED) {
    const net = account.networks[0];
    return <div className="space-y-3 rounded-2xl border border-primary/40 bg-card p-4">
      <p className="font-display text-xl uppercase">Your TSD deposit address</p>
      <p className="text-muted-foreground">Send {net.tokens.map(t => t.symbol).join(" or ")} on {account.networks.map(n => n.label).join(", ")}. TSD lands in this wallet.</p>
      <div className="flex justify-center rounded-xl bg-foreground p-3"><QRCodeSVG value={account.depositAddress} size={168} /></div>
      <button type="button" className="w-full break-all rounded-xl border border-border p-3 text-left font-mono text-sm"
        onClick={() => { void navigator.clipboard.writeText(account.depositAddress); toast.success("Address copied"); }}>
        {account.depositAddress} <Copy className="ml-1 inline h-3 w-3" />
      </button>
    </div>;
  }

  return <div className="space-y-3 rounded-2xl border border-primary/40 bg-card p-4">
    <p className="flex items-center gap-2 font-display text-xl uppercase"><Sparkles className="h-4 w-4 text-primary" /> Instant setup</p>
    <p className="text-muted-foreground">
      {memberId ? "We'll create your TSD Bridge account and send TSD straight to this wallet. Nothing to copy except your deposit address."
        : "Sign in with Honest Money once and we'll set up your TSD Bridge account for you."}
    </p>
    {account && !TOPUP_DEPOSITS_ENABLED && <p className="text-muted-foreground">Your account is ready. Deposit addresses switch on after final testing.</p>}
    {note && <p role="status" className="rounded-lg bg-muted p-3 text-muted-foreground">{note}</p>}
    {memberId
      ? <Button className="min-h-12 w-full rounded-full" disabled={busy} onClick={setup}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? "Setting up…" : "Set up my TSD account"}
        </Button>
      : <Button className="min-h-12 w-full rounded-full" onClick={openHmeLogin}>Sign in with Honest Money</Button>}
  </div>;
}
