import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, Ticket, QrCode, Sparkles, Store, ArrowRight } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — CryptoPOP" },
      { name: "description", content: "Small business support, gamified. Show up, scan, support local, earn POP." },
      { property: "og:title", content: "How CryptoPOP works" },
      { property: "og:description", content: "Show up. Support local. Earn POP. The five-step user journey from discovery to reward." },
    ],
  }),
  component: HowPage,
});

const steps = [
  {
    icon: Compass,
    title: "Discover",
    body: "Find a POPup event, party, or participating merchant in your city. Every market runs on a curated calendar.",
  },
  {
    icon: Ticket,
    title: "Show up",
    body: "RSVP gets you a digital pass. We mint a wallet for you on the spot — no apps, no jargon, no friction.",
  },
  {
    icon: QrCode,
    title: "Scan",
    body: "Scan the QR at the venue. Geofence + time window confirms you're really there, then POP is minted to your wallet.",
  },
  {
    icon: Sparkles,
    title: "Earn more",
    body: "Bring a friend. Share the event. Complete activities. Every interaction stacks more POP on your record.",
  },
  {
    icon: Store,
    title: "Support local",
    body: "Spend time and attention at participating merchants. CryptoPOP rewards real-world humans for showing up to real places.",
  },
];

function HowPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/"><img src={logo} alt="CryptoPOP" className="h-8 w-auto" /></Link>
          <nav className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <Link to="/earn" className="hover:text-foreground">Earn</Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Small business support, gamified
          </p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-tight md:text-7xl">
            Show up.<br />Support local.<br />Earn POP.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            CryptoPOP is a participation engine for real-world community. No trading, no speculation —
            just rewards for being there, in person, supporting the places and people that make a city worth living in.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="space-y-12">
          {steps.map((s, i) => (
            <div key={s.title} className="grid items-start gap-6 md:grid-cols-[120px_1fr]">
              <div className="flex items-center gap-4">
                <span className="font-display text-6xl font-bold text-primary/30">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <s.icon className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-3xl font-bold tracking-tight">{s.title}</h2>
                <p className="mt-2 text-lg text-muted-foreground">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="font-display text-3xl font-bold tracking-tight">What is POP, really?</h2>
          <div className="mt-5 space-y-4 text-muted-foreground">
            <p>
              POP is a participation record. Every POP you earn is minted on the TEXITcoin blockchain (Omni layer 2)
              and tied to your wallet. It proves you showed up — to an event, a merchant, a moment.
            </p>
            <p>
              POP has no monetary value. It's not a payment token. It's the receipt for the time and attention you
              gave a community. Climb leaderboards, unlock perks, get into the next thing first.
            </p>
            <p className="font-mono text-xs uppercase tracking-widest text-foreground">
              Connect · Experience · Support · Learn
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="font-display text-4xl font-bold tracking-tight">Ready to earn?</h2>
        <p className="mt-3 text-muted-foreground">See the full list of ways to rack up POP.</p>
        <Link
          to="/earn"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-display font-semibold text-primary-foreground hover:opacity-90"
        >
          See ways to earn <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}
