import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowUpRight, Camera, Loader2, ShieldCheck, Store } from "lucide-react";
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
import { signPsbt } from "@/lib/wallet/sign";
import { prepareSend, broadcastSignedTx } from "@/lib/send.functions";
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

  // POP is a scoreboard token for now — not spendable/tradeable.
  const SENDABLE_ASSETS = ASSETS.filter((a) => a.id !== "pop");

  const [asset, setAsset] = useState<AssetId>("tsd");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [request, setRequest] = useState<SendPrefill | null>(null);

  const balances: Record<AssetId, number | null> = {
    pop: popBalance,
    tsd: tsdBalance,
    txc: txcBalance,
  };
  const available = balances[asset];
  const decimals = assetMeta(asset).decimals;

  // Apply a scanned merchant / payment request when the sheet opens.
  useEffect(() => {
    if (!open || !prefill) return;
    if (prefill.to) setTo(prefill.to);
    if (prefill.asset && prefill.asset !== "pop") setAsset(prefill.asset);
    if (prefill.amount != null) setAmount(String(prefill.amount));
    setRequest(prefill.merchant || prefill.memo || prefill.amount != null ? prefill : null);
  }, [open, prefill]);

  function reset() {
    setTo("");
    setAmount("");
    setTxid(null);
    setRequest(null);
  }

  function applyScan(text: string) {
    const intent = parseScan(text);
    setScanOpen(false);
    if (intent.kind === "payment") {
      setTo(intent.to);
      if (intent.asset !== "pop") setAsset(intent.asset);
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

  async function submit() {
    if (!address || !mnemonic) return toast.error("Wallet is locked");
    const dest = to.trim();
    if (!isValidTxcAddress(dest)) return toast.error("That doesn't look like a TXC address");
    if (dest === address || sources?.some((s) => s.address === dest)) {
      return toast.error("That's your own address");
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return toast.error("Enter an amount");
    if (asset === "pop" && !Number.isInteger(value)) {
      return toast.error("POP is sent in whole tokens");
    }
    if (available !== null && value > available) {
      return toast.error(`You only have ${available} ${asset.toUpperCase()}`);
    }

    // Funds may sit on the canonical path or an older legacy-path address —
    // spend from whichever one covers the amount.
    const from =
      sources?.find((s) => (s.balances[asset] ?? 0) >= value)?.address ?? address;

    setBusy(true);
    try {
      const built = await prepare({ data: { asset, from, to: dest, amount: value } });

      const rawHex = signPsbt(built.psbtBase64, mnemonic);
      const res = await broadcast({ data: { rawHex } });
      // Vendor name stays on this device only — never sent to the chain.
      saveTxLabel(res.txid, {
        merchant: request?.merchant ?? null,
        memo: request?.memo ?? null,
        address: dest,
      });
      setTxid(res.txid);
      toast.success("Sent — waiting for confirmation");
      onSent();
    } catch (e) {
      console.error("[send]", e);
      toast.error((e as Error).message || "Send failed");
    } finally {
      setBusy(false);
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
            <Button className="w-full rounded-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pb-6">
            {request && (
              <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3">
                <p className="flex items-center gap-2 font-display text-sm font-semibold uppercase">
                  <Store className="h-4 w-4 text-primary" />
                  {request.merchant ?? "Payment request"}
                </p>
                {request.memo && (
                  <p className="mt-1 text-xs text-muted-foreground">{request.memo}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {SENDABLE_ASSETS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAsset(a.id)}
                  className={`rounded-2xl border px-2 py-3 text-center transition ${
                    asset === a.id
                      ? "border-primary bg-primary/15"
                      : "border-white/12 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <p className="font-display text-sm font-semibold uppercase">{a.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {balances[a.id] === null ? "—" : balances[a.id]!.toFixed(a.decimals)}
                  </p>
                </button>
              ))}
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
                  placeholder={asset === "pop" ? "100" : asset === "tsd" ? "0.00" : "0.00000000"}
                  className="h-11 font-mono text-sm"
                />
                {available !== null && (
                  <Button
                    variant="secondary"
                    className="h-11 shrink-0 rounded-xl"
                    onClick={() =>
                      setAmount(
                        asset === "pop"
                          ? String(Math.floor(available))
                          : asset === "tsd"
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

            <Button className="h-12 w-full rounded-full" onClick={submit} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpRight className="mr-1.5 h-4 w-4" />
              )}
              {busy ? "Signing & sending…" : `Send ${asset.toUpperCase()}`}
            </Button>
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
