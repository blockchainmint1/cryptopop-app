import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import logo from "@/assets/cryptopop-logo.png";
import { SiteFooter } from "@/components/site-footer";
import { requestMarket } from "@/lib/markets.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/markets/request")({
  head: () => ({
    meta: [
      { title: "Bring POP to your city — CryptoPOP" },
      { name: "description", content: "Request a CryptoPOP launch in your city." },
    ],
  }),
  component: RequestPage,
});

function RequestPage() {
  const submit = useServerFn(requestMarket);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await submit({
        data: {
          city: String(fd.get("city") ?? ""),
          region: (fd.get("region") as string) || null,
          country: (fd.get("country") as string) || null,
          name: String(fd.get("name") ?? ""),
          email: String(fd.get("email") ?? ""),
          why: (fd.get("why") as string) || null,
        },
      });
      setSent(true);
      toast.success("Request received. We'll be in touch.");
    } catch (err) {
      toast.error((err as Error).message || "Couldn't submit. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/"><img src={logo} alt="CryptoPOP" className="h-8 w-auto" /></Link>
          <Link to="/markets" className="font-mono text-xs text-muted-foreground hover:text-foreground">
            ← All markets
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          New market request
        </p>
        <h1 className="mt-2 font-display text-5xl font-bold tracking-tight">
          Bring POP to your city.
        </h1>
        <p className="mt-4 text-muted-foreground">
          We curate every market to keep the community real. Tell us where you are and why CryptoPOP belongs there.
        </p>

        {sent ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center">
            <h2 className="font-display text-2xl font-bold">Thanks — we got it.</h2>
            <p className="mt-2 text-sm text-muted-foreground">We review every request personally.</p>
            <Link to="/markets" className="mt-6 inline-block text-sm underline">Back to markets</Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input id="city" name="city" required maxLength={80} placeholder="Austin" />
              </div>
              <div>
                <Label htmlFor="region">State / region</Label>
                <Input id="region" name="region" maxLength={80} placeholder="TX" />
              </div>
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" maxLength={80} placeholder="USA" defaultValue="USA" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Your name *</Label>
                <Input id="name" name="name" required maxLength={100} placeholder="John Smith" />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" required maxLength={255} placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <Label htmlFor="why">Why this city?</Label>
              <Textarea id="why" name="why" rows={5} maxLength={2000} placeholder="The community, the merchants, the events that make it the right fit." />
            </div>
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy ? "Sending…" : "Send request"}
            </Button>
          </form>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
