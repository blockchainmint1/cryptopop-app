import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Store, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getRewardBalances } from "@/lib/store-rewards.functions";
import type { RewardBalance } from "@/lib/store-rewards";

export function StoreRewardsCard({ addresses, refreshKey }: { addresses: string[]; refreshKey: number }) {
  const fetchBalances = useServerFn(getRewardBalances);
  const [balances, setBalances] = useState<RewardBalance[] | null>(null);
  const key = addresses.join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetchBalances({ data: { addresses: key.split(",") } })
      .then((r) => !cancelled && setBalances(r.balances))
      .catch(() => !cancelled && setBalances([]));
    return () => {
      cancelled = true;
    };
  }, [key, refreshKey, fetchBalances]);

  if (!balances || balances.length === 0) return null;
  return (
    <Card className="space-y-3 border-white/12 bg-white/5 p-5 backdrop-blur-xl">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Store rewards · $1 each</p>
      <ul className="space-y-2">
        {balances.map((b) => (
          <li key={`${b.kind}:${b.key}`} className="flex items-center gap-3">
            {b.logoUrl ? (
              <img src={b.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                {b.kind === "community" ? <Users className="h-4 w-4 text-primary" /> : <Store className="h-4 w-4 text-primary" />}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium capitalize">{b.label}</p>
              <p className="text-[11px] text-muted-foreground">
                {b.kind === "community" ? "Spend at any approved store" : "Spend at this store"}
              </p>
            </div>
            <p className="font-display text-xl">${b.amount.toFixed(2)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
