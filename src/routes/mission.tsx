import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Users, BookOpen, ShieldAlert } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import wellnessBg from "@/assets/wellness-community-bg.jpg";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/mission")({
  head: () => ({
    meta: [
      { title: "Our Mission — CryptoPOP" },
      {
        name: "description",
        content:
          "CryptoPOP is an education-first campaign in Singapore. Connect, experience, learn — about Web3, AI, and the digital future.",
      },
      { property: "og:title", content: "Our Mission — CryptoPOP" },
      {
        property: "og:description",
        content:
          "An education-only campaign helping Singaporeans connect, experience, and learn about Web3, AI and blockchain.",
      },
    ],
  }),
  component: MissionPage,
});

function MissionPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="CryptoPOP" className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition">
              Home
            </Link>
            <Link to="/api" className="hover:text-foreground transition">
              Developer API
            </Link>
            <Link to="/login" className="hover:text-foreground transition">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Education · Singapore
        </p>
        <h1 className="mt-3 font-display text-5xl font-bold tracking-tight md:text-6xl">
          Connect. Experience. Learn.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          CryptoPOP is an <strong className="text-foreground">education-only</strong> campaign
          designed to help Singaporeans — young and not-so-young — make sense of Web3, AI,
          and blockchain by showing up in real life, not by trading.
        </p>

        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          <Pillar
            icon={Users}
            title="Connect"
            body="Meet the people building Singapore's digital future at pop-ups, club nights, food events, and live activations."
          />
          <Pillar
            icon={Sparkles}
            title="Experience"
            body="Feel what on-chain participation is actually like. Scan a QR at the venue, prove you were there, and walk away with a verifiable POP."
          />
          <Pillar
            icon={BookOpen}
            title="Learn"
            body="Plain-English explainers about wallets, AI, and blockchain — woven into events you'd want to attend anyway."
          />
        </div>

        <Section title="Why we're doing this">
          <p>
            Singapore is one of the most digitally advanced societies in the world, but
            when it comes to Web3 and on-chain literacy, everyday Singaporeans have been
            left behind. That's not an accident — the Monetary Authority of Singapore
            (MAS) has rightly imposed strict rules on how digital payment token services
            can be marketed to the public, because cryptocurrency trading is{" "}
            <em>highly risky and not suitable for the general public</em>.
          </p>
          <p>
            We agree with that posture. The result, though, is an education gap: a whole
            generation hears "crypto" and either tunes out or wanders into the riskiest
            corners of the internet for answers. CryptoPOP exists to close that gap the
            safe way — through real-world experiences, not speculation.
          </p>
        </Section>

        <Section title="What CryptoPOP is — and isn't">
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong className="text-foreground">It is</strong> a proof-of-participation
              campaign. You show up at a sanctioned event, scan a QR, and a non-monetary
              POP is minted to your wallet as a record that you were there.
            </li>
            <li>
              <strong className="text-foreground">It is</strong> educational content
              wrapped in lifestyle — parties, pop-ups, food events, club nights,
              activations — because attention follows fun.
            </li>
            <li>
              <strong className="text-foreground">It is not</strong> a digital payment
              token service, an exchange, a brokerage, or an investment product. We do
              not buy, sell, or facilitate the trading of cryptocurrencies for the
              public.
            </li>
            <li>
              <strong className="text-foreground">It is not</strong> investment, tax, or
              legal advice. Nothing on this site is a recommendation to acquire any
              digital asset.
            </li>
            <li>
              <strong className="text-foreground">POP have no monetary value</strong>
              , are not redeemable for currency, and are not securities, e-money, or
              deposits. They are a participation receipt.
            </li>
          </ul>
        </Section>

        <Section title="How we honour MAS guidance">
          <p>
            We've designed CryptoPOP around MAS's{" "}
            <a
              href="https://www.mas.gov.sg/regulation/guidelines/ps-g02-guidelines-on-provision-of-digital-payment-token-services-to-the-public"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Guidelines on Provision of Digital Payment Token Services to the Public
              (PS-G02)
            </a>{" "}
            and the spirit behind them:
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              No promotion of DPT trading in public areas, on public transport, in
              broadcast or print media, or through third-party social media influencers.
            </li>
            <li>
              No portrayal of crypto in a way that trivialises risk. No "get rich" copy,
              no price talk, no testimonials about gains.
            </li>
            <li>
              No physical crypto ATMs, no on-the-spot onboarding to trading services at
              any CryptoPOP event.
            </li>
            <li>
              Our communications about CryptoPOP live on our own channels — this site,
              our app, and our official social accounts — and stay focused on education
              and participation, not on acquiring tokens for speculation.
            </li>
            <li>
              POP is a participation record on TXC. It is not advertised as an
              investment, and is not offered to the public as a DPT service.
            </li>
          </ul>
        </Section>

        <Section title="Who we're here for">
          <p>
            Curious students. Aunties and uncles who want to understand what their kids
            are talking about. Designers, developers, chefs, DJs, dancers, founders, and
            policy folks. If you live in Singapore and you're ready to learn by doing,
            CryptoPOP is for you.
          </p>
        </Section>

        <div className="mt-12 flex items-start gap-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>
            <strong className="text-foreground">Risk reminder.</strong> Trading of digital
            payment tokens is highly risky and not suitable for the general public. You
            may lose all the money you put in. CryptoPOP does not offer DPT services and
            nothing here is an inducement to trade.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="rounded-full bg-primary px-6 py-3 font-display font-semibold text-primary-foreground hover:opacity-90 transition"
          >
            Join the next event
          </Link>
          <Link
            to="/"
            className="rounded-full border border-foreground/20 px-6 py-3 font-display font-semibold hover:bg-foreground/5 transition"
          >
            Back home
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Pillar({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-card p-6">
      <Icon className="h-6 w-6 text-primary" />
      <h3 className="mt-3 font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}
