import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowUpRight, Camera, Loader2, ShieldCheck } from "lucide-react";
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
import { QrScanDialog } from "./qr-scan-dialog";

type Asset = "pop" | "txc";

export function SendSheet({
  open,
  onOpenChange,
  address,
  mnemonic,
  popBalance,
  txcBalance,
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  address: string | null;
  mnemonic: string | null;
  popBalance: number | null;
  txcBalance: number | null;
  onSent: () => void;
}) {
  const prepare = useServerFn(prepareSend);
  const broadcast = useServerFn(broadcastSignedTx);

  const [asset, setAsset] = useState<Asset>("pop");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);

  const available = asset === "pop" ? popBalance : txcBalance;

  function reset() {
    setTo("");
    setAmount("");
    setTxid(null);
  }

  async function submit() {
    if (!address || !mnemonic) return toast.error("Wallet is locked");
    const dest = to.trim();
    if (!isValidTxcAddress(dest)) return toast.error("That doesn't look like a TXC address");
    if (dest === address) return toast.error("That's your own address");
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return toast.error("Enter an amount");
    if (asset === "pop" && !Number.isInteger(value)) {
      return toast.error("POP is sent in whole tokens");
    }
    if (available !== null && value > available) {
      return toast.error(`You only have ${available} ${asset.toUpperCase()}`);
    }

    setBusy(true);
    try {
      const built = await prepare({ data: { asset, from: address, to: dest, amount: value } });
      const rawHex = signPsbt(built.psbtBase64, mnemonic);
      const res = await broadcast({ data: { rawHex } });
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
            <div className="grid grid-cols-2 gap-2">
              {(["pop", "txc"] as Asset[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAsset(a)}
                  className={`rounded-2xl border px-3 py-3 text-center transition ${
                    asset === a
                      ? "border-primary bg-primary/15"
                      : "border-white/12 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <p className="font-display text-sm font-semibold uppercase">{a}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {a === "pop"
                      ? popBalance === null
                        ? "—"
                        : popBalance.toLocaleString()
                      : txcBalance === null
                        ? "—"
                        : txcBalance.toFixed(8)}
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
                  placeholder={asset === "pop" ? "100" : "0.00000000"}
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
                          : Math.max(available - 0.001, 0).toFixed(8),
                      )
                    }
                  >
                    Max
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {asset === "pop"
                  ? "POP transfers ride on TEXITcoin — a small TXC balance covers the network fee."
                  : "Network fee is deducted from your TXC balance."}
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
          onResult={(text) => {
            const t = text.trim().replace(/^texitcoin:/i, "").split("?")[0];
            setTo(t);
            setScanOpen(false);
          }}
          title="Scan address"
          description="Point the camera at a TXC wallet QR code."
        />
      </SheetContent>
    </Sheet>
  );
}
