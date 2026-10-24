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
import { reservedOutpoints, reserveOutpoints } from "@/lib/wallet/spent-outpoints";
import { validateSend } from "@/lib/wallet/transaction-policy";
import { deriveTxcAddress, deriveLegacyTxcAddress } from "@/lib/wallet";
import { derivePrivateKey, signPsbt } from "@/lib/wallet/sign";
import { signTxcMessage } from "@/lib/wallet/txc-message";
import { saveTxLabel, updateReceipt } from "@/lib/wallet/tx-labels";
import { getCheckoutRewards, payWithRewards } from "@/lib/store-rewards.functions";
import { redeemMessage, type InvoiceRewardOptions, type RewardKind } from "@/lib/store-rewards";
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
  const fetchRewardOpts = useServerFn(getCheckoutRewards);
  const redeem = useServerFn(payWithRewards);
  const [rewardOpts, setRewardOpts] = useState<InvoiceRewardOptions | null>(null);
  const [earned, setEarned] = useState<{ amount: number; storeName: string } | null>(null);
  const [paidWithRewards, setPaidWithRewards] = useState<number | null>(null);

  const [review, setReview] = useState<{ built: Awaited<ReturnType<typeof prepare>>; from: string; to: string; amount: number; feeSats: number } | null>(null);
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
    setReview(null);
    setInv(null);
    setError(null);
    setTxid(null);
    setPop(0);
    setRewardOpts(null);
    setEarned(null);
    setPaidWithRewards(null);
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
      if (r.invoice.storeId) {
        fetchRewardOpts({ data: { storeId: r.invoice.storeId, address } })
          .then((o) => !cancelled && setRewardOpts(o.options))
          .catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request, fetchInvoice, fetchRewardOpts, address]);

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
      if (r.rewards) setEarned({ amount: r.rewards.amount, storeName: r.rewards.storeName });
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

  async function pay(confirm = false) {
    if (!request || !inv) return;
    if (!address || !mnemonic) return toast.error("Unlock your wallet first");
    if (confirm && !review) return;
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
      let res: { txid: string } | null = null;
      for (let attempt = 0; attempt < 2 && !res; attempt++) {
        const built = confirm && review && attempt === 0 ? review.built : await prepare({
          data: { asset: "tsd", from, to: sel.invoice.address, amount, exclude: reservedOutpoints() },
        });
        const intent = { asset: "tsd" as const, from, to: sel.invoice.address, amount };
        const checked = validateSend(built.psbtBase64, intent, [deriveTxcAddress(mnemonic), deriveLegacyTxcAddress(mnemonic)]);
        if (!confirm) { setReview({ built, from, to: sel.invoice.address, amount, feeSats: checked.feeSats }); setStage("review"); return; }
        if (!review || review.to !== sel.invoice.address || review.amount !== amount || review.from !== from || checked.feeSats > review.feeSats) {
          setReview({ built, from, to: sel.invoice.address, amount, feeSats: checked.feeSats });
          throw new Error("Payment or fee changed — review and confirm again");
        }
        const r = await broadcast({ data: { rawHex: signPsbt(built.psbtBase64, mnemonic, intent) } });
        if (r.ok) {
          reserveOutpoints(built.inputs);
          res = { txid: r.txid };
        } else {
          if (r.spent !== undefined) reserveOutpoints(r.spent ?? built.inputs);
          if (r.spent === undefined || attempt === 1) throw new Error(r.error);
        }
      }
      if (!res) throw new Error("Payment failed");
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

  async function payRewards(kind: RewardKind) {
    if (!request || !inv) return;
    if (!address || !mnemonic) return toast.error("Unlock your wallet first");
    setStage("paying");
    try {
      const signature = signTxcMessage(
        derivePrivateKey(mnemonic),
        redeemMessage(inv.id, kind, inv.fiatAmount),
      );
      const r = await redeem({ data: { invoiceId: inv.id, address, kind, signature } });
      setPaidWithRewards(r.spent);
      setStage("paid");
      onPaid();
    } catch (e) {
      toast.error((e as Error).message || "Couldn't pay with rewards");
      setStage("review");
    }
  }

  const usdBill = inv?.currency?.toUpperCase() === "USD" ? inv.fiatAmount : 0;
  const canStore = !!rewardOpts && usdBill > 0 && rewardOpts.storeBalance + 1e-6 >= usdBill;
  const canCommunity =
    !!rewardOpts && usdBill > 0 && rewardOpts.acceptsCommunity && rewardOpts.communityBalance + 1e-6 >= usdBill;

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
                {rewardOpts && rewardOpts.ratePct > 0 && ` + ${rewardOpts.ratePct}% back`}
              </p>
              {(canStore || canCommunity) && (
                <div className="space-y-2">
                  {canStore && (
                    <Button
                      variant="secondary"
                      className="h-12 w-full rounded-full"
                      disabled={stage === "paying"}
                      onClick={() => void payRewards("store")}
                    >
                      Pay with store rewards (${rewardOpts?.storeBalance.toFixed(2)})
                    </Button>
                  )}
                  {canCommunity && (
                    <Button
                      variant="secondary"
                      className="h-12 w-full rounded-full"
                      disabled={stage === "paying"}
                      onClick={() => void payRewards("community")}
                    >
                      Pay with community rewards (${rewardOpts?.communityBalance.toFixed(2)})
                    </Button>
                  )}
                </div>
              )}
              {rewardOpts && !canStore && !canCommunity && rewardOpts.storeBalance + rewardOpts.communityBalance > 0 && (
                <p className="text-center text-[11px] text-muted-foreground">
                  Rewards must cover the whole bill to use them.
                </p>
              )}
              {review && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p>{review.amount.toFixed(2)} TSD</p>
                  <p className="break-all font-mono text-xs">To: {review.to}</p>
                  <p className="text-sm">Network fee: {(review.feeSats / 1e8).toFixed(8)} TXC</p>
                  <Button className="w-full" disabled={stage === "paying"} onClick={() => void pay(true)}>Confirm and pay</Button>
                  <Button variant="ghost" className="w-full" disabled={stage === "paying"} onClick={() => setReview(null)}>Cancel</Button>
                </div>
              )}
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
                  `Review ${money(inv.fiatAmount, inv.currency)} payment`
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
              {paidWithRewards !== null && (
                <p className="mt-2 text-sm">Paid ${paidWithRewards.toFixed(2)} with rewards</p>
              )}
              {earned && (
                <p className="mt-2 text-sm">+${earned.amount.toFixed(2)} rewards at {earned.storeName}</p>
              )}
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
