import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import coin from "@/assets/cryptopop-coin.png";
import {
  claimNectarReward,
  getNectarInvoice,
  getNectarInvoiceStatus,
  selectNectarTsd,
} from "@/lib/nectarpay.functions";
import { isPaidStatus, nectarReceiptUrl, rewardMessage, type NectarInvoice } from "@/lib/nectarpay";
import { prepareSend, broadcastSignedTx } from "@/lib/send.functions";
import { derivePrivateKey, signPsbt } from "@/lib/wallet/sign";
import { signTxcMessage } from "@/lib/wallet/txc-message";
import { saveTxLabel, updateReceipt } from "@/lib/wallet/tx-labels";
import type { SendSource } from "./send-sheet";

type Stage = "loading" | "review" | "paying" | "waiting" | "paid" | "error";

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function NectarPaySheet({
  request,
  onClose,
  address,
  sources,
  mnemonic,
  tsdBalance,
  onPaid,
}: {
  request: { invoiceId: string; nonce: string | null } | null;
  onClose: () => void;
  address: string | null;
  sources: SendSource[];
  mnemonic: string | null;
  tsdBalance: number | null;
  onPaid: () => void;
}) {
  const fetchInvoice = useServerFn(getNectarInvoice);
  const selectTsd = useServerFn(selectNectarTsd);
  const pollStatus = useServerFn(getNectarInvoiceStatus);
  const claim = useServerFn(claimNectarReward);
  const prepare = useServerFn(prepareSend);
  const broadcast = useServerFn(broadcastSignedTx);

  const [stage, setStage] = useState<Stage>("loading");
  const [inv, setInv] = useState<NectarInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [pop, setPop] = useState(0);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    setStage("loading");
    setInv(null);
    setError(null);
    setTxid(null);
    setPop(0);
    (async () => {
      const r = await fetchInvoice({ data: { id: request.invoiceId, nonce: request.nonce } });
      if (cancelled) return;
      if (!r.invoice) {
        setError(r.error ?? "Couldn't load this checkout.");
        setStage("error");
        return;
      }
      if (isPaidStatus(r.invoice.status)) {
        setInv(r.invoice);
        setStage("paid");
        return;
      }
      if (!r.invoice.acceptsTsd) {
        setInv(r.invoice);
        setError("This store doesn't accept Texas Stable Dollar yet.");
        setStage("error");
        return;
      }
      setInv(r.invoice);
      setStage("review");
    })();
    return () => {
      cancelled = true;
    };
  }, [request, fetchInvoice]);

  useEffect(() => () => stopPoll(), []);

  function stopPoll() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
  }

  async function claimReward(invoiceId: string, tx: string) {
    if (!mnemonic || !address) return;
    try {
      const signature = signTxcMessage(derivePrivateKey(mnemonic), rewardMessage(invoiceId, tx));
      const r = await claim({ data: { invoiceId, txid: tx, address, signature } });
      if (r.awarded > 0) {
        setPop(r.awarded);
        updateReceipt(tx, { popEarned: r.awarded });
      }
    } catch (e) {
      console.warn("[nectarpay] reward", e);
    }
  }

  function startPoll(invoiceId: string, tx: string) {
    stopPoll();
    let tries = 0;
    pollRef.current = window.setInterval(async () => {
      tries += 1;
      const r = await pollStatus({ data: { id: invoiceId } }).catch(() => ({ status: null }));
      if (isPaidStatus(r.status)) {
        stopPoll();
        setStage("paid");
        onPaid();
        void claimReward(invoiceId, tx);
      } else if (tries > 100) {
        stopPoll(); // ~5 min — keep "waiting" copy, merchant will still see it
      }
    }, 3000);
  }

  async function pay() {
    if (!request || !inv) return;
    if (!address || !mnemonic) return toast.error("Unlock your wallet first");
    setStage("paying");
    try {
      const sel = await selectTsd({ data: { id: request.invoiceId, nonce: request.nonce } });
      if (!sel.invoice?.address || !sel.invoice.tsdAmount) {
        throw new Error(sel.error ?? "This store isn't accepting TSD right now.");
      }
      const amount = sel.invoice.tsdAmount;
      if (tsdBalance !== null && amount > tsdBalance) {
        throw new Error(`You need ${amount.toFixed(2)} TSD — you have ${tsdBalance.toFixed(2)}.`);
      }
      const from = sources.find((s) => (s.balances.tsd ?? 0) >= amount)?.address ?? address;
      const built = await prepare({
        data: { asset: "tsd", from, to: sel.invoice.address, amount },
      });
      const res = await broadcast({ data: { rawHex: signPsbt(built.psbtBase64, mnemonic) } });
      saveTxLabel(res.txid, {
        merchant: inv.merchant?.name ?? "NectarPay store",
        memo: inv.description,
        address: sel.invoice.address,
        receipt: {
          invoiceId: inv.id,
          fiatAmount: inv.fiatAmount,
          currency: inv.currency,
          url: nectarReceiptUrl(inv.id),
          logoUrl: inv.merchant?.logoUrl ?? null,
        },
      });
      setInv({ ...inv, ...sel.invoice, merchant: inv.merchant ?? sel.invoice.merchant });
      setTxid(res.txid);
      setStage("waiting");
      startPoll(inv.id, res.txid);
    } catch (e) {
      console.error("[nectarpay] pay", e);
      toast.error((e as Error).message || "Payment failed");
      setStage("review");
    }
  }

  const name = inv?.merchant?.name ?? "NectarPay store";

  return (
    <Sheet
      open={!!request}
      onOpenChange={(v) => {
        if (!v) {
          stopPoll();
          onClose();
        }
      }}
    >
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display uppercase">Pay with TSD</SheetTitle>
          <SheetDescription>NectarPay checkout · signed on this device</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pb-6 pt-2">
          {inv && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              {inv.merchant?.logoUrl ? (
                <img
                  src={inv.merchant.logoUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                  <Store className="h-6 w-6 text-primary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-semibold uppercase">{name}</p>
                {inv.description && (
                  <p className="truncate text-xs text-muted-foreground">{inv.description}</p>
                )}
              </div>
              <p className="font-display text-2xl font-bold">{money(inv.fiatAmount, inv.currency)}</p>
            </div>
          )}

          {stage === "loading" && (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading checkout…
            </p>
          )}

          {stage === "error" && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              {error}
            </div>
          )}

          {(stage === "review" || stage === "paying") && inv && (
            <>
              <p className="text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Paying in TSD · you have {tsdBalance === null ? "—" : tsdBalance.toFixed(2)} TSD
              </p>
              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <img src={coin} alt="" className="h-4 w-4" /> Earn POP on every NectarPay purchase
              </p>
              <Button
                className="h-12 w-full rounded-full"
                disabled={stage === "paying"}
                onClick={() => void pay()}
              >
                {stage === "paying" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Paying…
                  </>
                ) : (
                  `Pay ${money(inv.fiatAmount, inv.currency)}`
                )}
              </Button>
            </>
          )}

          {stage === "waiting" && (
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 font-display text-lg font-semibold uppercase">Sent</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Waiting for {name} to confirm…
              </p>
              {txid && (
                <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{txid}</p>
              )}
            </div>
          )}

          {stage === "paid" && (
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-3 font-display text-2xl font-bold uppercase">Paid at {name}</p>
              {pop > 0 && (
                <p className="mt-2 flex items-center justify-center gap-2 text-sm">
                  <img src={coin} alt="" className="h-5 w-5" /> +{pop} POP earned
                </p>
              )}
              {inv && (
                <a
                  href={nectarReceiptUrl(inv.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs text-muted-foreground underline"
                >
                  View receipt
                </a>
              )}
            </div>
          )}

          {(stage === "paid" || stage === "error" || stage === "waiting") && (
            <Button
              variant="secondary"
              className="w-full rounded-full"
              onClick={() => {
                stopPoll();
                onClose();
              }}
            >
              Done
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
