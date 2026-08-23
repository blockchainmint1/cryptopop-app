import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { findOrder, type LocalOrder } from "@/lib/handoff";

export const Route = createFileRoute("/wallet/order/$id")({
  head: () => ({
    meta: [
      { title: "Order status — CryptoPOP Wallet" },
      {
        name: "description",
        content:
          "Track a CryptoPOP top up or cash out order fulfilled by our licensed payments partner.",
      },
      { property: "og:title", content: "Order status — CryptoPOP Wallet" },
      {
        property: "og:description",
        content: "Track a CryptoPOP top up or cash out order.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<LocalOrder | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setOrder(findOrder(id));
    setLoaded(true);
  }, [id]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-5 px-5 pb-16 pt-6">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          aria-label="Back to wallet"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-3xl uppercase">Order</h1>
      </div>

      <Card className="space-y-3 border-white/12 bg-white/5 p-5">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Ref {id}
        </p>

        {!loaded ? null : order ? (
          <div className="space-y-2 text-sm">
            <Row label="Type" value={order.side === "buy" ? "Top up" : "Cash out"} />
            <Row label="Order" value={`$${order.usd.toFixed(2)}`} />
            <Row label="Service fee (1%)" value={`$${order.feeUsd.toFixed(2)}`} />
            <Row
              label={order.side === "buy" ? "Total from your bank" : "Estimated to your bank"}
              value={`$${order.settlementUsd.toFixed(2)}`}
            />
            <Row label="Asset" value={`${order.asset} · ${order.chain.toUpperCase()}`} />
            {order.address && (
              <div className="space-y-1">
                <p className="text-muted-foreground">Delivery address</p>
                <p className="break-all font-mono text-xs">{order.address}</p>
              </div>
            )}
            <div className="mt-2 flex items-start gap-2.5 rounded-2xl border border-primary/40 bg-primary/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-display uppercase tracking-wide">Order processing</p>
                <p className="text-xs text-muted-foreground">
                  Thanks, your order is processing — we'll let you know as soon as it's done!
                  Bank settlement takes 1–3 business days and your {order.asset} arrives once funds
                  clear.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t find this order on this device — order details are stored privately on
            the phone that placed it. Keep the reference above and email support@cryptopop.org if you
            need help.
          </p>
        )}
      </Card>

      <Button variant="ghost" asChild className="w-full rounded-full">
        <Link to="/">Back to wallet</Link>
      </Button>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
