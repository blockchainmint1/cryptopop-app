import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Sparkles, Wallet, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const searchSchema = z.object({
  event: z.string(),
  reward: z.coerce.number(),
  balance: z.coerce.number(),
});

export const Route = createFileRoute("/_authenticated/scan/success")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "POP Earned — CryptoPOP" }] }),
  component: ScanSuccess,
});

function ScanSuccess() {
  const { event, reward, balance } = Route.useSearch();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/20 via-primary/5 to-background p-10 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">
            Proof of Presence claimed
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">{event}</h1>
          <div className="mt-8 flex items-baseline justify-center gap-2">
            <span className="font-display text-6xl font-bold tabular-nums">+{reward}</span>
            <span className="text-xl font-medium text-muted-foreground">POP</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            New balance · <span className="font-semibold text-foreground">{balance.toLocaleString()} POP</span>
          </p>
        </Card>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button asChild variant="outline">
            <Link to="/scan">
              <ScanLine className="h-4 w-4 mr-2" /> Scan another
            </Link>
          </Button>
          <Button asChild>
            <Link to="/app">
              <Wallet className="h-4 w-4 mr-2" /> Wallet
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
