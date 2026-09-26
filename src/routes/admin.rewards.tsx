import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { listRewardPrograms, updateRewardProgram } from "@/lib/store-rewards.functions";

export const Route = createFileRoute("/admin/rewards")({
  head: () => ({
    meta: [
      { title: "Store rewards — POP manager" },
      { name: "description", content: "Approve stores for community rewards and set their credit lines." },
      { property: "og:title", content: "Store rewards — POP manager" },
      { property: "og:description", content: "Approve stores and manage community reward credit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RewardsAdmin,
});

type Program = {
  id: string;
  store_name: string;
  market_slug: string | null;
  rate_bps: number;
  issue_type: string;
  enabled: boolean;
  community_status: string;
  community_credit_limit: number;
  community_balance: number;
};

function RewardsAdmin() {
  const { isAdmin, loading } = useIsAdmin();
  const list = useServerFn(listRewardPrograms);
  const update = useServerFn(updateRewardProgram);
  const [programs, setPrograms] = useState<Program[] | null>(null);

  const load = useCallback(() => {
    list()
      .then((r) => setPrograms(r.programs as Program[]))
      .catch((e) => toast.error((e as Error).message));
  }, [list]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  async function save(id: string, patch: Record<string, unknown>) {
    try {
      await update({ data: { id, ...patch } as never });
      toast.success("Saved");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl space-y-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-3xl uppercase">Store rewards</h1>
      </header>
      <p className="text-sm text-muted-foreground">
        Approve stores to issue community rewards. Their starting credit line is how much they can hand out before
        they need to accept some back. Balance below zero = rewards they've issued; above zero = rewards they've taken in.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Checking access…</p>
      ) : !isAdmin ? (
        <p className="text-sm text-muted-foreground">Sign in as a POP manager to see this page.</p>
      ) : !programs ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : programs.length === 0 ? (
        <Card className="p-5 text-sm text-muted-foreground">
          No stores yet. They'll appear here once a NectarPay merchant turns on rewards.
        </Card>
      ) : (
        programs.map((p) => <ProgramRow key={p.id} p={p} onSave={save} />)
      )}
    </div>
  );
}

function ProgramRow({ p, onSave }: { p: Program; onSave: (id: string, patch: Record<string, unknown>) => void }) {
  const [limit, setLimit] = useState(String(p.community_credit_limit));
  const [market, setMarket] = useState(p.market_slug ?? "");
  const balance = Number(p.community_balance);
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <Store className="h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg uppercase">{p.store_name}</p>
          <p className="font-mono text-[11px] uppercase text-muted-foreground">
            {(p.rate_bps / 100).toFixed(2)}% · issues {p.issue_type} · {p.enabled ? "on" : "off"}
          </p>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase">
          {p.community_status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Market
          <Input value={market} onChange={(e) => setMarket(e.target.value)} placeholder="dallas" />
        </label>
        <label className="text-xs text-muted-foreground">
          Credit line ($)
          <Input type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Community balance: <span className="font-mono">{balance >= 0 ? "+" : "−"}${Math.abs(balance).toFixed(2)}</span>
        {" · "}can still issue ${Math.max(0, balance + Number(p.community_credit_limit)).toFixed(2)}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() =>
            onSave(p.id, {
              community_status: "approved",
              community_credit_limit: Number(limit) || 0,
              market_slug: market.trim() || null,
            })
          }
        >
          {p.community_status === "approved" ? "Save" : "Approve"}
        </Button>
        {p.community_status === "approved" && (
          <Button size="sm" variant="secondary" onClick={() => onSave(p.id, { community_status: "paused" })}>
            Pause
          </Button>
        )}
        {p.community_status === "pending" && (
          <Button size="sm" variant="secondary" onClick={() => onSave(p.id, { community_status: "declined" })}>
            Decline
          </Button>
        )}
      </div>
    </Card>
  );
}
