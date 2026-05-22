import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Users, BookOpen } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import glowBg from "@/assets/mission-glow-bg.jpg";
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
          style={{ backgroundImage: `url(${glowBg})` }}
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-6 py-20 md:py-28 border-none border-0">
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
            <p className="font-sans font-normal">
              Explore Web3, culture, and emerging trends in a fun, approachable, and community-driven way without the complicated jargon.
            </p>
            <p>
              From yacht parties and wellness activations to BBQs, nightlife, fitness, creators, and social experiences — CryptoPOP is designed to make people connect in real life while discovering the future of digital communities together.
            </p>
            <div className="space-y-1 text-foreground">
              <p>No complicated jargon.</p>
              <p>No hard selling.</p>
              <p></p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-6 py-14">

        <div className="mt-2 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          <Pillar
            icon={Users}
            title="Connect"
            body="Meet new people, discover communities, and be part of experiences designed to bring people together in real life."
          />
          <Pillar
            icon={Sparkles}
            title="Experience"
            body="From wellness activations and yacht socials to BBQs, nightlife, games, and pop-ups — CryptoPOP is all about memorable moments."
          />
          <Pillar
            icon={BookOpen}
            title="Learn"
            body="Explore Web3, culture, and emerging trends in a fun, approachable, and community-driven way without the complicated jargon."
          />
        </div>

        <Section title="OUR MISSION">
          <p>
            To make Web3 feel human, social, and accessible through real-world experiences, community, and culture. We believe the future of community starts offline first — through conversations, events, creativity, and shared experiences that bring people together.
          </p>
        </Section>

        <Section className="border-0 rounded-xl">
          <p>
          </p>
          
          <h2 className="pt-6 font-display text-2xl font-bold tracking-tight text-foreground">
            WHAT WE ARE NOT
          </h2>
          <p>
            CryptoPOP is not an exchange, brokerage, investment platform, or digital payment token service. CryptoPOP is built around real-world experiences, community participation, and culture.

            POP rewards are designed as digital participation rewards that users can collect through events, activities, activations, and community experiences within the CryptoPOP ecosystem.

            Rather than focusing on trading or financial services, CryptoPOP focuses on creating fun, social, and memorable experiences that bring people together through culture, entertainment, wellness, and Web3 education.
          </p>
        </Section>

        <Section title="WHO WE HERE FOR?">
          <p>
            Curious students. Aunties and uncles who want to understand what their kids
            are talking about. Designers, developers, chefs, DJs, dancers, founders, and
            policy folks. If you live in Singapore and you're ready to learn by doing,
            CryptoPOP is for you.
          </p>
        </Section>


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
