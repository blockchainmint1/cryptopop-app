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

      <section className="relative overflow-hidden border-b border-border/60">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${wellnessBg})` }}
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/80 to-background"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-6 py-20 md:py-28">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Education · Singapore
          </p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-tight md:text-6xl">
            <span className="text-neon-cyan">Connect.</span>{" "}
            <span className="text-neon-lime">Experience.</span>{" "}
            <span className="text-neon-pink">Learn.</span>
          </h1>
          <div className="mt-8 space-y-6 text-lg text-muted-foreground">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              WHAT IS CRYPTOPOP?
            </h2>
            <p>
              CryptoPOP is a community-first lifestyle platform that brings together culture, experiences, wellness, entertainment, and Web3 in a fun and approachable way.
            </p>
            <p>
              From yacht parties and wellness activations to BBQs, nightlife, fitness, creators, and social experiences — CryptoPOP is designed to make people connect in real life while discovering the future of digital communities together.
            </p>
            <div className="space-y-1 text-foreground">
              <p>No complicated jargon.</p>
              <p>No hard selling.</p>
              <p>Feel what on-chain participation is actually like. Scan a QR at the venue, prove you were there, and walk away with POP.</p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-6 py-14">

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
            body="CRYPTOPOP IS — AND ISN’T"
          />
        </div>

        <Section title="OUR MISSION">
          <p>
            To make Web3 feel human, social, and accessible through real-world experiences, community, and culture. We believe the future of community starts offline first — through conversations, events, creativity, and shared experiences that bring people together.
          </p>
        </Section>

        <Section className="border-0 rounded-xl">
          <p>
            CryptoPOP is a community-first lifestyle platform built around real-world experiences, culture, and participation. From wellness activations and food events to yacht socials, nightlife, pop-ups, and community gatherings — CryptoPOP creates fun, social experiences where people can connect, explore, and be part of the moment together.
          </p>
          <p>
            By participating in selected events and activities, users may collect POP rewards as a digital record of participation and community engagement. CryptoPOP is designed to make experiences more interactive, memorable, and community-driven.
          </p>
          
          <h2 className="pt-6 font-display text-2xl font-bold tracking-tight text-foreground">
            WHAT WE ARE NOT
          </h2>
          <p>
            CryptoPOP is not an exchange, brokerage, investment platform, or digital payment token service.
          </p>
          <p>
            We do not facilitate the buying, selling, or trading of cryptocurrencies to the public.
          </p>
          <p>
            POP rewards are non-monetary community participation rewards designed for experiences, engagement, and activations within the CryptoPOP ecosystem.
          </p>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">POP rewards:</p>
            <ul className="list-inside space-y-1">
              <li>• have no monetary value</li>
              <li>• are not redeemable for currency</li>
              <li>• are not investment products</li>
              <li>• are not securities, e-money, or deposits</li>
            </ul>
          </div>
          <p>
            Nothing on this platform should be considered financial, investment, legal, or tax advice.
          </p>
          <p>
            CryptoPOP is about community, culture, and experiences first.
          </p>
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

function Section({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mt-10 font-serif ${className || ""}`}>
      {title && <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>}
      <div className={`${title ? "mt-3" : ""} space-y-3 text-muted-foreground font-sans`}>{children}</div>
    </section>
  );
}
