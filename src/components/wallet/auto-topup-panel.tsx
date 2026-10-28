import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Copy, Loader2, MailCheck, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/lib/wallet/wallet-context";
import { derivePrivateKey } from "@/lib/wallet/sign";
import { signTxcMessage } from "@/lib/wallet/txc-message";
import { openHmeLogin } from "@/lib/hme";
import { getTsdBridgeNonce, linkTsdBridge } from "@/lib/tsd-partner.functions";
import { tsdLinkMessage, TSD_TICKET_LOGIN_URL } from "@/lib/tsd-link-message";
import { TOPUP_DEPOSITS_ENABLED } from "@/lib/tsd-topup";

type LinkResult = Awaited<ReturnType<typeof linkTsdBridge>>;
type PartnerAccount = Extract<LinkResult, { status: "ready" }>;

/** Fresh random `state` for one setup attempt; Honest Money signs it into the ticket and TSD matches it. */
function newHandoffState(): string {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Opens the Honest Money approval popup and resolves with a one-time ticket for TSD Bridge plus its `state`. */
function getTsdTicket(): Promise<{ ticket: string; state: string }> {
  return new Promise((resolve, reject) => {
    if (!TSD_TICKET_LOGIN_URL) { reject(new Error("ticket_unavailable")); return; }
    const state = newHandoffState();
    const w = window.open(TSD_TICKET_LOGIN_URL(`${window.location.origin}/sso-tsd`, state), "hme-tsd", "width=460,height=680");
    if (!w) { reject(new Error("popup_blocked")); return; }
    const timer = window.setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 3 * 60_000);
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin || e.source !== w) return;
      const d = e.data as { type?: string; token?: unknown };
      if (d?.type !== "tsd-ticket" || typeof d.token !== "string") return;
      cleanup(); resolve({ ticket: d.token, state });
    }
    function cleanup() { window.clearTimeout(timer); window.removeEventListener("message", onMsg); }
    window.addEventListener("message", onMsg);
  });
}

/**
 * One-tap TSD Bridge setup: Honest Money approval for TSD, a one-time nonce from
 * the bridge, then the wallet signs its TSD address on-device.
 */
export function AutoTopupPanel({ address }: { address: string | null }) {
  const { user } = useAuth();
  const wallet = useWallet();
  const link = useServerFn(linkTsdBridge);
  const nonceFn = useServerFn(getTsdBridgeNonce);
  const member = user?.app_metadata?.["hme_member_id"];
  const memberId = typeof member === "string" ? member : null;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [account, setAccount] = useState<PartnerAccount | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function setup() {
    if (!memberId || !address || !wallet.mnemonic || wallet.status !== "unlocked" || wallet.address !== address) {
      setNote("Unlock your wallet first."); return;
    }
    if (!TSD_TICKET_LOGIN_URL) { setNote("Instant setup is almost ready. Use Connect to TSD below for now."); return; }
    setBusy(true); setNote(null); setPending(null);
    let key: Uint8Array | null = null;
    try {
      const n = await nonceFn();
      if (!("nonce" in n)) { setNote(n.reason); return; }
      const { ticket: ssoTicket, state } = await getTsdTicket();
      const issuedAt = new Date().toISOString();
      key = derivePrivateKey(wallet.mnemonic);
      const signature = signTxcMessage(key, tsdLinkMessage(memberId, address, n.nonce, issuedAt));
      const r = await link({ data: { address, issuedAt, nonce: n.nonce, signature, ssoTicket, state } });
      if (r.status === "ready") setAccount(r);
      else if (r.status === "pending_confirmation") setPending(r.onFile);
      else setNote(r.reason);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setNote(m === "popup_blocked" ? "Allow pop-ups so Honest Money can approve this." : m === "timeout" ? "The approval window timed out. Try again." : "Something went wrong. Try again.");
    } finally { key?.fill(0); setBusy(false); }
  }

  if (pending !== null) {
    return <div className="space-y-3 rounded-2xl border border-primary/40 bg-card p-4">
      <p className="flex items-center gap-2 font-display text-xl uppercase"><MailCheck className="h-4 w-4 text-primary" /> Check your email</p>
      <p className="text-muted-foreground">You already have a different payout address saved with TSD Bridge. To protect you, they emailed a link to confirm the change to this wallet.</p>
      <p className="text-muted-foreground"><strong>Until you click that link, TSD keeps going to your old address</strong>{pending ? <> (<span className="break-all font-mono text-xs">{pending}</span>)</> : null}. Don't send money yet.</p>
      <Button variant="outline" className="min-h-12 w-full rounded-full" disabled={busy} onClick={setup}>I confirmed it — check again</Button>
    </div>;
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
      {memberId ? "We'll create your TSD Bridge account and send TSD straight to this wallet. Honest Money will ask you to approve it once."
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
