import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWallet } from "@/lib/wallet/wallet-context";
import { useAuth } from "@/hooks/use-auth";
import { derivePrivateKey } from "@/lib/wallet/sign";
import { signTxcMessage, verifyTxcMessage } from "@/lib/wallet/txc-message";
import {
  TSD_ORIGIN, TOPUP_PROTOCOL, TOPUP_REFRESH_MS, TOPUP_DEPOSITS_ENABLED,
  topupMessage, trustedTopupEvent, validateTopupChallenge, validateTopupConnection,
  topupError, topupTransactionUrl,
  type TopupRequest, type TopupChallenge, type TopupConnection,
} from "@/lib/tsd-topup";

export const TSD_BRIDGE_URL = TSD_ORIGIN;
type Attempt = { popup: Window; request: TopupRequest; signed: boolean; memberId: string | null; lastSeen: number };

export function BridgeTopUpSheet({ open, onOpenChange, address }: {
  open: boolean; onOpenChange: (v: boolean) => void; address: string | null;
}) {
  const wallet = useWallet();
  const { user, loading } = useAuth();
  const member = user?.app_metadata?.["hme_member_id"];
  const memberId = typeof member === "string" ? member : null;
  const attempt = useRef<Attempt | null>(null);
  const used = useRef(new Set<string>());
  const approving = useRef(false);
  const [challenge, setChallenge] = useState<TopupChallenge | null>(null);
  const [connection, setConnection] = useState<TopupConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chain, setChain] = useState("ethereum");
  const [contract, setContract] = useState("");

  function disconnect(message?: string) {
    attempt.current?.popup.close();
    attempt.current = null;
    setChallenge(null); setConnection(null); setWaiting(false); setBusy(false);
    setError(message ?? null);
  }

  // Teardown on panel closure, wallet lock/change, or signed-in member change.
  useEffect(() => {
    disconnect();
    return () => { attempt.current?.popup.close(); attempt.current = null; };
  }, [open, address, wallet.address, wallet.status, memberId]);

  useEffect(() => {
    if (!open) return;
    const listener = (event: MessageEvent) => {
      const active = attempt.current;
      if (!active || !trustedTopupEvent(event, active.popup, active.request.requestId)) return;
      try {
        if (event.data.type === "tsd-topup-challenge") {
          if (active.signed || approving.current || challenge) throw new Error("Repeated wallet verification. Please reconnect.");
          setChallenge(validateTopupChallenge(event.data, active.request, active.memberId, used.current));
          setWaiting(false);
          window.focus();
        } else if (event.data.type === "tsd-topup-connected" || event.data.type === "tsd-topup-progress") {
          if (!active.signed) throw new Error("The bridge replied before wallet approval. Please reconnect.");
          if (event.data.type === "tsd-topup-progress" && !connection) return;
          const updated = validateTopupConnection(event.data, active.request);
          if (connection && updated.depositAddress !== connection.depositAddress) throw new Error("The bridge deposit address changed. Please reconnect.");
          active.lastSeen = Date.now();
          setConnection(updated); setChallenge(null); setWaiting(false); setError(null);
          if (!updated.networks.some(n => n.chain === chain)) setChain(updated.networks[0]?.chain ?? "ethereum");
        } else if (event.data.type === "tsd-topup-error") {
          disconnect(topupError(event.data));
        }
      } catch (e) {
        disconnect(e instanceof Error && e.name !== "ZodError" ? e.message : "The bridge returned invalid details. Nothing was connected. Please reconnect.");
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [open, challenge, connection, chain]);

  useEffect(() => {
    if (!challenge) return;
    const timeout = window.setTimeout(() => disconnect("Wallet verification expired. Please reconnect."), Math.max(0, Date.parse(challenge.expiresAt) - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [challenge]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      const active = attempt.current;
      if (!active) return;
      if (active.popup.closed) { disconnect("The TSD window closed. Reconnect to get current deposit details."); return; }
      if (connection && Date.now() - active.lastSeen > 95_000) disconnect("The bridge connection was lost. Reconnect before sending stablecoins.");
      else if (!connection && Date.now() - active.lastSeen > (active.signed ? 60_000 : 10 * 60_000)) disconnect("The connection timed out. Please reconnect.");
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, connection]);

  useEffect(() => {
    if (!open || !connection) return;
    const timer = window.setInterval(() => {
      const active = attempt.current;
      if (document.visibilityState !== "visible" || !active || active.popup.closed) return;
      active.popup.postMessage({ type: "tsd-topup-refresh", protocol: TOPUP_PROTOCOL, requestId: active.request.requestId }, TSD_ORIGIN);
    }, TOPUP_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [open, Boolean(connection)]);

  function connect() {
    disconnect();
    if (!address || wallet.status !== "unlocked" || wallet.address !== address || loading) {
      setError("Unlock your wallet first, then connect again."); return;
    }
    const request = { origin: window.location.origin, address, requestId: crypto.randomUUID() };
    const url = new URL("/connect", TSD_ORIGIN);
    for (const [key, value] of Object.entries(request)) url.searchParams.set(key, value);
    // Do not use noopener: the protocol requires the retained popup reference.
    const popup = window.open(url.href, "_blank", "popup,width=480,height=720");
    if (!popup) { setError("Your browser blocked the TSD window. Allow popups and reconnect."); return; }
    attempt.current = { popup, request, signed: false, memberId, lastSeen: Date.now() };
    setWaiting(true);
  }

  function approve() {
    const active = attempt.current;
    if (!active || !challenge || approving.current) return;
    let key: Uint8Array | null = null;
    approving.current = true; setBusy(true);
    try {
      if (!wallet.mnemonic || wallet.status !== "unlocked" || wallet.address !== active.request.address || address !== active.request.address || memberId !== active.memberId || active.popup.closed) throw new Error("Unlock this wallet and reconnect before approving.");
      const checked = validateTopupChallenge(challenge, active.request, memberId, used.current);
      const message = topupMessage(checked);
      used.current.add(checked.challengeId);
      key = derivePrivateKey(wallet.mnemonic);
      const signature = signTxcMessage(key, message);
      if (!verifyTxcMessage(active.request.address, message, signature)) throw new Error("This signature does not match your receiving wallet.");
      active.signed = true; active.lastSeen = Date.now();
      active.popup.postMessage({ type: "tsd-topup-signature", protocol: TOPUP_PROTOCOL, requestId: active.request.requestId, challengeId: checked.challengeId, signature }, TSD_ORIGIN);
      setChallenge(null); setWaiting(true);
    } catch (e) { disconnect(e instanceof Error ? e.message : "Wallet verification failed. Please reconnect."); }
    finally { key?.fill(0); approving.current = false; setBusy(false); }
  }

  const network = connection?.networks.find(n => n.chain === chain) ?? connection?.networks[0];
  const token = network?.tokens.find(t => t.contract === contract) ?? network?.tokens[0];
  const canDeposit = Boolean(connection?.available && TOPUP_DEPOSITS_ENABLED);

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl">
      <SheetHeader className="text-left">
        <SheetTitle className="font-display uppercase">Stablecoins → TSD</SheetTitle>
        <SheetDescription>Receive TSD in this wallet from supported stablecoins.</SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-5 pb-8 text-sm">
        {error && <p role="alert" className="break-words rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive">{error}</p>}
        {!connection && !challenge && <>
          <p className="text-muted-foreground">Connect with Honest Money in the TSD window. Your recovery phrase stays on this device.</p>
          <Button className="min-h-12 w-full rounded-full" disabled={loading || waiting} onClick={connect}>
            {waiting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            {waiting ? "Waiting for TSD…" : error ? "Reconnect to TSD" : "Connect to TSD"}
          </Button>
          {waiting && <Button variant="outline" className="w-full" onClick={() => disconnect()}>Cancel connection</Button>}
        </>}
        {challenge && <div className="space-y-4">
          <ShieldCheck className="h-8 w-8 text-neon-cyan" />
          <h2 className="font-display text-2xl uppercase">Connect for receiving only?</h2>
          <p>TSD Bridge can deliver TSD to this wallet. It cannot spend your funds or cash out.</p>
          <dl className="space-y-3 border-y border-border py-4">
            <div><dt className="text-xs text-muted-foreground">Honest Money member</dt><dd className="break-all font-mono text-xs">{challenge.hmeMemberId}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Your TSD receiving address</dt><dd className="break-all font-mono text-xs">{challenge.address}</dd></div>
          </dl>
          {!memberId && <p className="text-muted-foreground">Only approve if you signed in to your own Honest Money account in the TSD window.</p>}
          <Button className="min-h-12 w-full rounded-full" disabled={busy} onClick={approve}>Approve receiving-only connection</Button>
          <Button variant="outline" className="w-full" onClick={() => disconnect()}>Cancel</Button>
        </div>}
        {connection && <>
          {!connection.available && <p role="status" className="rounded-lg border border-border bg-muted p-3">TSD top-ups are paused. No deposit address is available while the bridge is paused.</p>}
          {connection.available && !TOPUP_DEPOSITS_ENABLED && <p role="status" className="rounded-lg border border-border bg-muted p-3">Wallet connected. Deposits are not enabled yet while we finish the bridge connection checks.</p>}
          {canDeposit && network && token && <>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1 block text-xs text-muted-foreground">Network</label><Select value={network.chain} onValueChange={v => { setChain(v); setContract(""); }}><SelectTrigger aria-label="Deposit network"><SelectValue /></SelectTrigger><SelectContent>{connection.networks.map(n => <SelectItem key={n.chain} value={n.chain}>{n.name}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">Stablecoin</label><Select value={token.contract} onValueChange={setContract}><SelectTrigger aria-label="Deposit stablecoin"><SelectValue /></SelectTrigger><SelectContent>{network.tokens.map(t => <SelectItem key={t.contract} value={t.contract}>{t.symbol}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-4 border-y border-border py-5">
              <p className="font-display text-xl uppercase">Send {token.symbol} on {network.name}</p>
              <div className="mx-auto w-fit rounded-lg bg-bone p-3"><QRCodeSVG value={connection.depositAddress} size={184} /></div>
              <p className="break-all font-mono text-lg leading-relaxed" data-testid="tsd-deposit-address">{connection.depositAddress}</p>
              <Button className="min-h-12 w-full rounded-full" onClick={async () => { try { await navigator.clipboard.writeText(connection.depositAddress); toast.success("Deposit address copied"); } catch { toast.error("Couldn't copy. Select and copy the address above."); } }}><Copy className="mr-2 h-4 w-4" />Copy deposit address</Button>
              <p className="text-xs text-muted-foreground">Minimum ${connection.minUsd} · Maximum ${connection.maxUsd}</p>
              <p className="text-destructive">Use exactly {network.name} and {token.symbol}. Other coins or networks may not be recoverable.</p>
              <details className="text-xs text-muted-foreground"><summary>Token details</summary><p className="mt-2 break-all font-mono">{token.contract}</p><p className="mt-1">{token.decimals} decimals</p></details>
              <p className="break-all text-xs text-muted-foreground">TSD destination: {connection.receivingAddress}</p>
            </div>
          </>}
          <section className="space-y-3">
            <h2 className="font-display text-xl uppercase">Top-up progress</h2>
            {connection.orders.length === 0 && <p className="text-muted-foreground">Waiting for a stablecoin transfer.</p>}
            {connection.orders.map(order => <article key={order.id} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs">{order.orderNumber}</span><span>{order.amount ?? "—"} {order.token} · {order.chain === "base" ? "Base" : "Ethereum"}</span></div>
              <p className={order.complete ? "text-neon-lime" : "text-neon-cyan"}>{order.complete ? "Complete" : `Step ${order.progress.number} of ${order.progress.total} · ${order.progress.steps[order.progress.index]?.label}`}</p>
              {!order.complete && <p className="text-xs text-muted-foreground">{order.progress.steps[order.progress.index]?.detail}</p>}
              {order.error && <p className="break-words text-destructive">{order.error}</p>}{order.note && <p className="break-words text-muted-foreground">{order.note}</p>}
              <div className="flex flex-wrap gap-3">{([ ["Deposit transaction", order.chain, order.depositTx], ["TSD delivery", "txc", order.payoutTx] ] as const).map(([label, txChain, hash]) => {
                const url = hash ? topupTransactionUrl(txChain, hash) : null;
                return url ? <Button key={label} variant="link" asChild className="h-auto px-0 text-xs"><a href={url} target="_blank" rel="noopener noreferrer">{label}<ExternalLink className="ml-1 h-3 w-3" /></a></Button> : null;
              })}</div>
            </article>)}
          </section>
          <Button variant="outline" className="w-full" onClick={connect}>Reconnect to TSD</Button>
        </>}
      </div>
    </SheetContent>
  </Sheet>;
}
