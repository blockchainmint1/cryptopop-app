import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/manifesto")({
  head: () => ({
    meta: [
      { title: "Manifesto — CryptoPOP" },
      {
        name: "description",
        content:
          "Why CryptoPOP exists: honest money, real-world participation, and rewards that belong to the people who show up.",
      },
      { property: "og:title", content: "Manifesto — CryptoPOP" },
      {
        property: "og:description",
        content:
          "Honest money, real-world participation, and rewards owned by the people who show up.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManifestoPage,
});

const PRINCIPLES: { title: string; body: string }[] = [
  {
    title: "Money should be honest",
    body: "Value you hold should be yours — not a balance someone can freeze, inflate, or quietly rewrite. CryptoPOP is built on open chains and non-custodial keys, because honest money starts with real ownership.",
  },
  {
    title: "Show up, get rewarded",
    body: "POP is proof of participation. You earn it by being somewhere, doing something, supporting someone — not by trading, farming, or gambling. Presence is the product.",
  },
  {
    title: "Small business first",
    body: "Every POP spent in attention, every scan at a door, points back to local merchants and community builders. The scoreboard exists to send real people to real places.",
  },
  {
    title: "Your keys, your device",
    body: "Your recovery phrase is generated on your phone and stays there, protected by biometrics. We never hold it. If we vanished tomorrow, your wallet would still work.",
  },
  {
    title: "Privacy by default",
    body: "We collect the minimum needed to run events and rewards. Vendor names and transaction labels stay on your device. We do not sell your data — ever.",
  },
  {
    title: "Built in the open",
    body: "TEXITcoin and the Omni layer are public infrastructure. Anyone can verify balances, audit transfers, and build alongside us.",
  },
];

function ManifestoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-5 pb-2 pt-6">
        <Link
          to="/"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-3xl uppercase tracking-wide">Manifesto</h1>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-16">
        <p className="mt-4 text-base text-muted-foreground">
          CryptoPOP is a proof-of-participation wallet for people who leave the house. Connect.
          Experience. Learn.
        </p>

        <div className="mt-8 space-y-4">
          {PRINCIPLES.map((p) => (
            <section
              key={p.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <h2 className="font-display text-xl uppercase tracking-wide">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-8 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Part of the{" "}
          <a
            href="https://honest.money"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            honest.money
          </a>{" "}
          ecosystem
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
