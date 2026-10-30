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
  claimSendReward,
  sendRewardMessage,
  getNectarInvoice,
  selectNectarTsd,
} from "@/lib/nectarpay.functions";
import { isPaidStatus, nectarReceiptUrl, type NectarInvoice } from "@/lib/nectarpay";
import { prepareSend, prepareSplitSend, broadcastSignedTx } from "@/lib/send.functions";
import { giveSplitFor } from "@/lib/give/split-rule";
import { CHOSEN_CHARITY_KEY } from "@/lib/give/charities";
import { reservedOutpoints, reserveOutpoints } from "@/lib/wallet/spent-outpoints";
import { validateSend, validateSplitSend } from "@/lib/wallet/transaction-policy";
import { deriveTxcAddress, deriveLegacyTxcAddress } from "@/lib/wallet";
import { derivePrivateKey, signPsbt, signSplitPsbt } from "@/lib/wallet/sign";
import { signTxcMessage } from "@/lib/wallet/txc-message";
import { saveTxLabel, updateReceipt } from "@/lib/wallet/tx-labels";
import { getCheckoutRewards, payWithRewards } from "@/lib/store-rewards.functions";
import { redeemMessage, type InvoiceRewardOptions, type RewardKind } from "@/lib/store-rewards";
import type { SendSource } from "./send-sheet";
import { popFireworks, shopNameSize } from "@/lib/wallet/fireworks";

/** A store checkout: a NectarPay invoice link, or a store's plain pay code (address + amount + name). */
export type StoreRequest =
  | { invoiceId: string; nonce: string | null }
  | { direct: { to: string; amount: number | null; merchant: string | null; memo: string | null } };

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
  request: StoreRequest | null;
  onClose: () => void;
  address: string | null;
  sources: SendSource[];
  mnemonic: string | null;
  tsdBalance: number | null;
  onPaid: () => void;
}) {
  const fetchInvoice = useServerFn(getNectarInvoice);
  const selectTsd = useServerFn(selectNectarTsd);
  const claimByTx = useServerFn(claimSendReward);
  const [amountInput, setAmountInput] = useState("");
  const [rewardWaiting, setRewardWaiting] = useState(false);
  const prepare = useServerFn(prepareSend);
  const prepareSplit = useServerFn(prepareSplitSend);
  const broadcast = useServerFn(broadcastSignedTx);
  const fetchRewardOpts = useServerFn(getCheckoutRewards);
  const redeem = useServerFn(payWithRewards);
  const [rewardOpts, setRewardOpts] = useState<InvoiceRewardOptions | null>(null);
  const [earned, setEarned] = useState<{ amount: number; storeName: string } | null>(null);
  const [paidWithRewards, setPaidWithRewards] = useState<number | null>(null);

  const [review, setReview] = useState<{ built: Awaited<ReturnType<typeof prepare>>; from: string; to: string; amount: number; feeSats: number; split: ReturnType<typeof giveSplitFor> } | null>(null);
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
    setRewardWaiting(false);
    if ("direct" in request) {
      const d = request.direct;
      setAmountInput(d.amount != null ? String(d.amount) : "");
      setInv({
        id: "", status: "new", fiatAmount: d.amount ?? 0, currency: "USD", acceptsTsd: true,
        description: d.memo, merchant: { name: d.merchant ?? "Store", logoUrl: null },
      } as unknown as NectarInvoice);
      setStage("review");
      return;
    }
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

  /** Every store payment: ask NectarPay by transaction until it has seen the sale, then show POP + rewards. */
  async function chaseReward(tx: string, payer: string) {
    if (!mnemonic) return;
    const signature = signTxcMessage(derivePrivateKey(mnemonic), sendRewardMessage(tx));
    setRewardWaiting(true);
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 4000 : 15000));
      try {
        const r = await claimByTx({ data: { txid: tx, address: payer, signature } });
        if (r.awarded > 0 || r.status === "awarded" || r.status === "sent") {
          if (r.awarded > 0) {
            setPop(r.awarded);
            updateReceipt(tx, { popEarned: r.awarded });
            popFireworks();
          }
          if (r.rewards) setEarned({ amount: r.rewards.amount, storeName: r.rewards.storeName });
          break;
        }
        if (r.status === "denied" || r.status === "expired" || r.status === "held") break;
      } catch (e) {
        console.warn("[store] reward", e);
      }
    }
    setRewardWaiting(false);
  }

  async function pay(confirm = false) {
    if (!request || !inv) return;
    if (!address || !mnemonic) return toast.error("Unlock your wallet first");
    if (confirm && !review) return;
    setStage("paying");
    try {
      const direct = "direct" in request ? request.direct : null;
      const directAmount = Number(amountInput);
      if (direct && (!Number.isFinite(directAmount) || directAmount <= 0)) throw new Error("Enter an amount");
      const sel = direct
        ? { invoice: { address: direct.to, tsdAmount: Math.round(directAmount * 100) / 100, merchant: inv.merchant } as Partial<NectarInvoice> & { address: string; tsdAmount: number }, error: null as string | null }
        : "invoiceId" in request ? await selectTsd({ data: { id: request.invoiceId, nonce: request.nonce } }) : { invoice: null, error: "Unknown checkout" };
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
        // Give: split only if this store is in Give AND the payer picked a recipient.
        const split = direct ? null : giveSplitFor({
          egiving: (sel.invoice as Partial<NectarInvoice>).egiving ?? inv.egiving,
          recipientCode: localStorage.getItem(CHOSEN_CHARITY_KEY),
          total: amount,
          merchant: sel.invoice.address,
        });
        const splitIntent = split ? { from, recipients: split.recipients } : null;
        const intent = { asset: "tsd" as const, from, to: sel.invoice.address, amount };
        const owned = [deriveTxcAddress(mnemonic), deriveLegacyTxcAddress(mnemonic)];
        const sameSplit = (a: typeof split, b: typeof split) => JSON.stringify(a?.recipients ?? null) === JSON.stringify(b?.recipients ?? null);
        const built = confirm && review && attempt === 0 && sameSplit(review.split, split) ? review.built
          : splitIntent ? await prepareSplit({ data: { ...splitIntent, exclude: reservedOutpoints() } })
          : await prepare({ data: { asset: "tsd", from, to: sel.invoice.address, amount, exclude: reservedOutpoints() } });
        const checked = splitIntent ? validateSplitSend(built.psbtBase64, splitIntent, owned) : validateSend(built.psbtBase64, intent, owned);
        const next = { built, from, to: sel.invoice.address, amount, feeSats: checked.feeSats, split };
        if (!confirm) { setReview(next); setStage("review"); return; }
        if (!review || review.to !== sel.invoice.address || review.amount !== amount || review.from !== from || !sameSplit(review.split, split) || checked.feeSats > review.feeSats) {
          setReview(next);
          throw new Error("Payment or fee changed — review and confirm again");
        }
        const rawHex = splitIntent ? signSplitPsbt(built.psbtBase64, mnemonic, splitIntent) : signPsbt(built.psbtBase64, mnemonic, intent);
        const r = await broadcast({ data: { rawHex } });
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
        receipt: direct ? undefined : {
          invoiceId: inv.id,
          fiatAmount: inv.fiatAmount,
          currency: inv.currency,
          url: nectarReceiptUrl(inv.id),
          logoUrl: inv.merchant?.logoUrl ?? null,
        },
      });
      setInv({ ...inv, ...sel.invoice, merchant: inv.merchant ?? sel.invoice.merchant ?? null } as NectarInvoice);
      setTxid(res.txid);
      if (direct) setInv({ ...inv, fiatAmount: amount });
      setStage("paid");
      onPaid();
      if (from === address) void chaseReward(res.txid, from);
    } catch (e) {
      console.error("[nectarpay] pay", e);
      toast.error((e as Error).message || "Payment failed");
      setStage("review");
    }
  }

  async function payRewards(kind: RewardKind) {
    if (!request || !inv || "direct" in request) return;
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
  const isDirect = !!request && "direct" in request;

  return (
    <Sheet
      open={!!request}
      onOpenChange={(v) => {
        if (!v) {
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
                <p className="truncate font-display font-semibold uppercase" style={{ fontSize: shopNameSize(name) }}>{name}</p>
                {inv.description && (
                  <p className="truncate text-xs text-muted-foreground">{inv.description}</p>
                )}
              </div>
              {(!isDirect || inv.fiatAmount > 0) && (
                <p className="shrink-0 font-display text-2xl font-bold">{money(inv.fiatAmount, inv.currency)}</p>
              )}
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
              {isDirect && request && "direct" in request && request.direct.amount == null && (
                <input
                  inputMode="decimal"
                  placeholder="Amount in TSD"
                  value={amountInput}
                  onChange={(e) => { setAmountInput(e.target.value); setReview(null); }}
                  className="h-12 w-full rounded-xl border border-border bg-background px-4 text-center font-mono text-lg"
                />
              )}
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
                  {review.split && (
                    <p className="text-sm">
                      💛 Store {review.split.merchant.toFixed(2)} · {review.split.recipientName} {review.split.church.toFixed(2)} · Give program {review.split.platform.toFixed(2)}
                    </p>
                  )}
                  <p className="text-sm">Network fee: {(review.feeSats / 1e8).toFixed(8)} TXC</p>
                  <Button className="w-full" disabled={stage === "paying"} onClick={() => void pay(true)}>Confirm and pay</Button>
                  <Button variant="ghost" className="w-full" disabled={stage === "paying"} onClick={() => setReview(null)}>Cancel</Button>
                </div>
              )}
              {!review && <Button
                className="h-12 w-full rounded-full"
                disabled={stage === "paying"}
                onClick={() => void pay()}
              >
                {stage === "paying" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Paying…
                  </>
                ) : (
                  isDirect ? "Review payment" : `Review ${money(inv.fiatAmount, inv.currency)} payment`
                )}
              </Button>}
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
                <p className="mt-2 flex items-center justify-center gap-2 font-display text-2xl uppercase text-primary">
                  <img src={coin} alt="" className="h-7 w-7" /> +{pop} POP earned
                </p>
              )}
              {rewardWaiting && (
                <p className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking for your POP reward…
                </p>
              )}
              {inv && !isDirect && (
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
