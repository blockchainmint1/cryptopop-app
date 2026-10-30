import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowUpRight, Camera, ChevronDown, Loader2, ShieldCheck, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { isValidTxcAddress } from "@/lib/wallet";
import { validateSend } from "@/lib/wallet/transaction-policy";
import { deriveTxcAddress, deriveLegacyTxcAddress } from "@/lib/wallet";
import { signPsbt } from "@/lib/wallet/sign";
import { prepareSend, broadcastSignedTx } from "@/lib/send.functions";
import { claimSendReward, sendRewardMessage } from "@/lib/nectarpay.functions";
import { derivePrivateKey } from "@/lib/wallet/sign";
import { signTxcMessage } from "@/lib/wallet/txc-message";
import confetti from "canvas-confetti";
import { reservedOutpoints, reserveOutpoints } from "@/lib/wallet/spent-outpoints";
import { ASSETS, assetMeta, type AssetId } from "@/lib/wallet/assets";
import { parseScan } from "@/lib/wallet/scan-parse";
import { saveTxLabel } from "@/lib/wallet/tx-labels";
import { QrScanDialog } from "./qr-scan-dialog";

export type SendPrefill = {
  to?: string;
  amount?: number | null;
  asset?: AssetId;
  merchant?: string | null;
  memo?: string | null;
};

/** A spendable address plus its per-asset balance (canonical + legacy paths). */
export type SendSource = {
  address: string;
  balances: Record<AssetId, number | null>;
};

export function SendSheet({
  open,
  onOpenChange,
  address,
  sources,
  mnemonic,
  popBalance,
  tsdBalance,
  txcBalance,
  prefill,
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  address: string | null;
  sources?: SendSource[];
  mnemonic: string | null;
  popBalance: number | null;
  tsdBalance: number | null;
  txcBalance: number | null;
  prefill?: SendPrefill | null;
  onSent: () => void;
}) {

  const prepare = useServerFn(prepareSend);
  const broadcast = useServerFn(broadcastSignedTx);
  const claimReward = useServerFn(claimSendReward);
  const [popEarned, setPopEarned] = useState<number | null>(null);
  const [rewardWaiting, setRewardWaiting] = useState(false);

  /** Ask for POP on a store payment; NectarPay may need a minute to see the sale. */
  async function chaseReward(tx: string, payer: string) {
    if (!mnemonic) return;
    const signature = signTxcMessage(derivePrivateKey(mnemonic), sendRewardMessage(tx));
    setRewardWaiting(true);
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 4000 : 15000));
      try {
        const r = await claimReward({ data: { txid: tx, address: payer, signature } });
        if (r.awarded > 0 || r.status === "awarded" || r.status === "sent") {
          setPopEarned(r.awarded);
          setRewardWaiting(false);
          if (r.awarded > 0) {
            const base = { spread: 90, ticks: 220, colors: ["#FF3DBE", "#00E5FF", "#8B3DFF", "#CCF695"] };
            confetti({ ...base, particleCount: 120, origin: { x: 0.5, y: 0.6 } });
            setTimeout(() => confetti({ ...base, particleCount: 80, angle: 60, origin: { x: 0, y: 0.7 } }), 200);
            setTimeout(() => confetti({ ...base, particleCount: 80, angle: 120, origin: { x: 1, y: 0.7 } }), 350);
            toast.success(`You earned ${r.awarded} POP`);
          }
          return;
        }
        if (r.status === "denied" || r.status === "expired" || r.status === "held") break;
      } catch (e) {
        console.warn("[send] reward", e);
      }
    }
    setRewardWaiting(false);
  }

  // POP / phPOP are scoreboard points for now — not spendable/tradeable.
  const SENDABLE_ASSETS = ASSETS.filter((a) => a.id !== "pop" && a.id !== "phpop");
  // TSD is the native send asset for this wallet. Anything else (TXC) sits
  // behind an "Advanced" disclosure so the screen reads as a TSD wallet first.
  const PRIMARY_ASSETS = SENDABLE_ASSETS.filter((a) => a.id === "tsd");
  const ADVANCED_ASSETS = SENDABLE_ASSETS.filter((a) => a.id !== "tsd");

  const [asset, setAsset] = useState<"tsd" | "txc">("tsd");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [review, setReview] = useState<{ built: Awaited<ReturnType<typeof prepare>>; from: string; to: string; amount: number; asset: "tsd" | "txc"; feeSats: number } | null>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [request, setRequest] = useState<SendPrefill | null>(null);

  const balances: Record<AssetId, number | null> = {
    pop: popBalance,
    phpop: null,
    tsd: tsdBalance,
    txc: txcBalance,
  };
  const available = balances[asset];
  const decimals = assetMeta(asset).decimals;

  // Apply a scanned merchant / payment request when the sheet opens.
  useEffect(() => {
    if (!open || !prefill) return;
    if (prefill.to) setTo(prefill.to);
    if (prefill.asset && prefill.asset !== "pop" && prefill.asset !== "phpop") {
      setAsset(prefill.asset);
      if (prefill.asset !== "tsd") setAdvancedOpen(true);
    }
    if (prefill.amount != null) setAmount(String(prefill.amount));
    setRequest(prefill.merchant || prefill.memo || prefill.amount != null ? prefill : null);
  }, [open, prefill]);

  function reset() {
    setTo("");
    setAmount("");
    setTxid(null);
    setReview(null);
    setRequest(null);
    setPopEarned(null);
    setRewardWaiting(false);
  }

  function applyScan(text: string) {
    const intent = parseScan(text);
    setScanOpen(false);
    if (intent.kind === "payment") {
      setTo(intent.to);
      if (intent.asset !== "tsd" && intent.asset !== "txc") return toast.error("POP rewards cannot be sent or spent");
      setAsset(intent.asset);
      if (intent.asset !== "tsd") setAdvancedOpen(true);
      if (intent.amount != null) setAmount(String(intent.amount));
      setRequest(intent);
      toast.success(intent.merchant ? `Payment request from ${intent.merchant}` : "Payment request loaded");
      return;
    }
    if (intent.kind === "address") {
      setTo(intent.address);
      return;
    }
    toast.error("That code isn't a wallet address or payment request");
  }

  async function submit(confirm = false) {
    if (!address || !mnemonic) return toast.error("Wallet is locked");
    if (confirm && !review) return;
    const dest = to.trim();
    if (!isValidTxcAddress(dest)) return toast.error("That doesn't look like a TXC address");
    if (dest === address || sources?.some((s) => s.address === dest)) {
      return toast.error("That's your own address");
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return toast.error("Enter an amount");
    if (asset !== "tsd" && asset !== "txc") return toast.error("POP rewards cannot be sent or spent");
    if (available !== null && value > available) {
      return toast.error(`You only have ${available} ${asset.toUpperCase()}`);
    }

    // Funds may sit on the canonical path or an older legacy-path address —
    // spend from whichever one covers the amount.
    const from =
      sources?.find((s) => (s.balances[asset] ?? 0) >= value)?.address ?? address;

    setBusy(true);
    try {
      let txidOut: string | null = null;
      // One automatic retry if coins were just spent elsewhere.
      for (let attempt = 0; attempt < 2 && !txidOut; attempt++) {
        setProgress(attempt ? "Picking fresh coins…" : "Checking coins…");
        const built = confirm && review && attempt === 0 ? review.built : await prepare({
          data: { asset, from, to: dest, amount: value, exclude: reservedOutpoints() },
        });
        const intent = { asset, from, to: dest, amount: value };
        const checked = validateSend(built.psbtBase64, intent, [deriveTxcAddress(mnemonic), deriveLegacyTxcAddress(mnemonic)]);
        if (!confirm) { setReview({ built, ...intent, feeSats: checked.feeSats }); return; }
        if (!review || review.asset !== asset || review.to !== dest || review.amount !== value || review.from !== from || checked.feeSats > review.feeSats) {
          setReview({ built, ...intent, feeSats: checked.feeSats });
          throw new Error("Payment or fee changed — review and confirm again");
        }
        setProgress("Signing on this device…");
        const rawHex = signPsbt(built.psbtBase64, mnemonic, intent);
        setProgress(`Sending ${asset.toUpperCase()}…`);
        const res = await broadcast({ data: { rawHex } });
        if (res.ok) {
          reserveOutpoints(built.inputs);
          txidOut = res.txid;
        } else if (res.spent !== undefined && attempt === 0) {
          reserveOutpoints(res.spent ?? built.inputs);
        } else {
          if (res.spent !== undefined) reserveOutpoints(res.spent ?? built.inputs);
          throw new Error(res.error);
        }
      }
      if (!txidOut) throw new Error("Send failed");
      // Vendor name stays on this device only — never sent to the chain.
      saveTxLabel(txidOut, {
        merchant: request?.merchant ?? null,
        memo: request?.memo ?? null,
        address: dest,
      });
      setTxid(txidOut);
      toast.success("Sent — waiting for confirmation");
      // Store payment from the main wallet address: claim POP from NectarPay.
      if (request?.merchant && asset === "tsd" && from === address) void chaseReward(txidOut, from);
      onSent();
    } catch (e) {
      console.error("[send]", e);
      toast.error((e as Error).message || "Send failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display uppercase">Send</SheetTitle>
          <SheetDescription>
            Signed on this device — your recovery phrase never leaves your phone.
          </SheetDescription>
        </SheetHeader>

        {txid ? (
          <div className="space-y-4 pb-6">
            <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2 font-display text-lg font-semibold uppercase">Broadcast</p>
              <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{txid}</p>
            </div>
            {popEarned != null && popEarned > 0 && (
              <p className="text-center font-display text-2xl uppercase text-primary">+{popEarned} POP earned</p>
            )}
            {rewardWaiting && (
              <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Checking for your POP reward…
              </p>
            )}
            {asset !== "txc" && (
              <p className="text-center text-xs text-muted-foreground">
                Token transfers show in balances once the network confirms them, usually within a few
                minutes. Check back shortly rather than sending again.
              </p>
            )}
            <Button className="w-full rounded-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pb-6">
            {request && (
              <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3">
                <p className="flex min-w-0 items-center gap-2 font-display font-semibold uppercase">
                  <Store className="h-5 w-5 shrink-0 text-primary" />
                  <span
                    className="truncate"
                    style={{ fontSize: (() => { const n = (request.merchant ?? "Payment request").length; return n <= 14 ? "1.75rem" : n <= 22 ? "1.4rem" : n <= 32 ? "1.1rem" : "0.95rem"; })() }}
                  >
                    {request.merchant ?? "Payment request"}
                  </span>
                </p>
                {request.memo && (
                  <p className="mt-1 text-xs text-muted-foreground">{request.memo}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2">
                {PRIMARY_ASSETS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAsset(a.id)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      asset === a.id
                        ? "border-primary bg-primary/15"
                        : "border-white/12 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <p className="font-display text-sm font-semibold uppercase">{a.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {balances[a.id] === null ? "—" : balances[a.id]?.toFixed(a.decimals)}
                    </p>
                  </button>
                ))}
              </div>

              {ADVANCED_ASSETS.length > 0 && (
                <>
                  <button
                    type="button"
                    aria-expanded={advancedOpen}
                    onClick={() => {
                      const next = !advancedOpen;
                      setAdvancedOpen(next);
                      // Collapsing must not leave a hidden asset still selected.
                      if (!next && asset !== "tsd") {
                        setAsset("tsd");
                        setReview(null);
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-white/5 px-3 py-2"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Advanced
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        advancedOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {advancedOpen && (
                    <div className="space-y-2 rounded-2xl border border-white/12 bg-white/5 p-2">
                      <p className="px-1 text-xs text-muted-foreground">
                        Send the base coin directly — usually only needed to fund another wallet.
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {ADVANCED_ASSETS.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setAsset(a.id)}
                            className={`rounded-xl border px-3 py-2 text-left transition ${
                              asset === a.id
                                ? "border-primary bg-primary/15"
                                : "border-white/12 bg-white/5 hover:bg-white/10"
                            }`}
                          >
                            <p className="font-display text-sm font-semibold uppercase">{a.name}</p>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                              {balances[a.id] === null ? "—" : balances[a.id]?.toFixed(a.decimals)}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="send-to">Recipient address</Label>
              <div className="flex gap-2">
                <Input
                  id="send-to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="T..."
                  className="h-11 font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => setScanOpen(true)}
                  aria-label="Scan address"
                >
                  <Camera className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="send-amount">Amount</Label>
              <div className="flex gap-2">
                <Input
                  id="send-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={asset === "tsd" ? "0.00" : "0.00000000"}
                  className="h-11 font-mono text-sm"
                />
                {available !== null && (
                  <Button
                    variant="secondary"
                    className="h-11 shrink-0 rounded-xl"
                    onClick={() =>
                      setAmount(
                        asset === "tsd"
                            ? available.toFixed(2)
                            : Math.max(available - 0.001, 0).toFixed(8),
                      )
                    }
                  >
                    Max
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {asset === "txc"
                  ? "Network fee is deducted from your TXC balance."
                  : `${asset.toUpperCase()} transfers ride on TEXITcoin (Omni) — a small TXC balance covers the network fee.`}
              </p>
            </div>

            {review && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="font-display uppercase">Confirm payment</p>
                <p>{review.amount} {review.asset.toUpperCase()}</p>
                <p className="break-all font-mono text-xs">To: {review.to}</p>
                <p className="text-sm">Network fee: {(review.feeSats / 1e8).toFixed(8)} TXC</p>
                <Button className="w-full" disabled={busy} onClick={() => void submit(true)}>Confirm and send</Button>
                <Button variant="ghost" className="w-full" disabled={busy} onClick={() => setReview(null)}>Cancel</Button>
              </div>
            )}
            {!review && (
            <Button className="h-12 w-full rounded-full" onClick={() => void submit()} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpRight className="mr-1.5 h-4 w-4" />
              )}
              {busy ? (progress ?? "Sending…") : `Review ${asset.toUpperCase()} payment`}
            </Button>
            )}
          </div>
        )}

        <QrScanDialog
          open={scanOpen}
          onOpenChange={setScanOpen}
          onResult={applyScan}
          title="Scan to pay"
          description="Point the camera at a wallet address or merchant payment code."
        />
      </SheetContent>
    </Sheet>
  );
}
