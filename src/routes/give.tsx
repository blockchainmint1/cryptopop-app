import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Heart, Search } from "lucide-react";
import { toast } from "sonner";
import { BottomNav, BottomNavSpacer } from "@/components/bottom-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHARITIES, CHOSEN_CHARITY_KEY, findByCode, parseSignedCauses, searchCharities, type Charity } from "@/lib/give/charities";
import { getSignedCauses } from "@/lib/give/causes.functions";
import { getGiveRecipient, setGiveRecipient } from "@/lib/give/recipient.functions";
import { pinnedRecipient } from "@/lib/give/split-rule";
import { ownerEnvelope } from "@/lib/wallet/nfc-cards";
import { useWallet } from "@/lib/wallet/wallet-context";

export const Route = createFileRoute("/give")({
  head: () => ({
    meta: [
      { title: "Give — Choose a cause | CryptoPOP" },
      { name: "description", content: "Pick a church or charity to support. A share of every eGiving purchase goes to them." },
      { property: "og:title", content: "Give — Choose a cause | CryptoPOP" },
      { property: "og:description", content: "Pick a church or charity to support with your everyday spending." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GivePage,
});

function GivePage() {
  const [chosen, setChosen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [code, setCode] = useState("");

  const [list, setList] = useState<Charity[]>(CHARITIES);
  const { mnemonic } = useWallet();
  const [saving, setSaving] = useState(false);

  // The saved choice (used by card taps too) wins over this phone's copy.
  useEffect(() => {
    if (!mnemonic) return;
    getGiveRecipient({ data: ownerEnvelope(mnemonic, "give-get", {}) })
      .then((r) => {
        if (r.code) localStorage.setItem(CHOSEN_CHARITY_KEY, r.code);
        else localStorage.removeItem(CHOSEN_CHARITY_KEY);
        setChosen(r.code);
      })
      .catch(() => {});
  }, [mnemonic]);

  useEffect(() => {
    setChosen(localStorage.getItem(CHOSEN_CHARITY_KEY));
    getSignedCauses()
      .then((r) => {
        const verified = parseSignedCauses(r);
        if (verified && verified.length) setList(verified);
      })
      .catch(() => {});
  }, []);

  const results = useMemo(() => searchCharities(q, list), [q, list]);
  const suggestions = list.filter((c) => c.featured);
  const current = list.find((c) => c.code === chosen) ?? null;

  async function save(c: Charity | null) {
    if (!mnemonic) return toast.error("Unlock your wallet first to save your Give choice");
    if (c && !pinnedRecipient(c.code)) return toast.error(`${c.name} can't receive Give payments yet`);
    setSaving(true);
    try {
      const r = await setGiveRecipient({ data: ownerEnvelope(mnemonic, "give-set", { code: c?.code ?? null }) });
      if (r.code) localStorage.setItem(CHOSEN_CHARITY_KEY, r.code);
      else localStorage.removeItem(CHOSEN_CHARITY_KEY);
      setChosen(r.code);
      toast.success(c ? `You're supporting ${c.name}` : "Give is off. Store payments go fully to the store.");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }
  const choose = (c: Charity) => void save(c);

  function applyCode() {
    const c = findByCode(code, list);
    if (!c) return toast.error("We couldn't find that code. Check it and try again.");
    setCode("");
    choose(c);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-md space-y-6 px-4 pb-6 pt-5">
        <div className="flex items-center gap-3">
          <Link to="/leaderboard" aria-label="Back" className="rounded-full p-2 hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-3xl uppercase tracking-wide">Give</h1>
        </div>

        <Card className="border-white/12 bg-white/5 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">You're supporting</p>
          {current ? (
            <div className="mt-2 flex items-center gap-3">
              <Heart className="h-5 w-5 text-primary" />
              <span className="font-display text-lg uppercase tracking-wide">{current.name}</span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No cause picked yet. Choose one below.</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            When you pay at a store in the giving program, 8% goes to your cause, 2% supports the program, and the store gets 90%. It's paid in full.
            With no cause picked, your payments go fully to the store.
          </p>
          {current && (
            <Button size="sm" variant="ghost" className="mt-2 px-0" disabled={saving} onClick={() => void save(null)}>
              Stop giving
            </Button>
          )}
        </Card>

        <section className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Have a code?</p>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CCV" className="uppercase" onKeyDown={(e) => e.key === "Enter" && applyCode()} />
            <Button onClick={applyCode} disabled={!code.trim()}>Use code</Button>
          </div>
        </section>

        <section className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Suggested</p>
          {suggestions.map((c) => <CharityRow key={c.code} c={c} chosen={chosen === c.code} onChoose={choose} />)}
        </section>

        <section className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Search</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Church or charity name" className="pl-9" />
          </div>
          {results.length ? (
            results.map((c) => <CharityRow key={c.code} c={c} chosen={chosen === c.code} onChoose={choose} />)
          ) : (
            <p className="text-sm text-muted-foreground">No matches yet. More causes are on the way.</p>
          )}
        </section>
      </main>
      <BottomNavSpacer />
      <BottomNav />
    </div>
  );
}

function CharityRow({ c, chosen, onChoose }: { c: Charity; chosen: boolean; onChoose: (c: Charity) => void }) {
  return (
    <Card className="flex items-center gap-3 border-white/12 bg-white/5 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Heart className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base uppercase tracking-wide">{c.name}</span>
        <span className="block text-xs text-muted-foreground">{c.city} · code {c.code}</span>
      </span>
      {chosen ? (
        <span className="flex items-center gap-1 text-xs text-primary"><Check className="h-4 w-4" />Chosen</span>
      ) : (
        <Button size="sm" variant="outline" onClick={() => onChoose(c)}>Choose</Button>
      )}
    </Card>
  );
}
