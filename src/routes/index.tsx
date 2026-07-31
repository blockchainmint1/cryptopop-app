import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, MapPin, Coins, Users, ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import bbqHero from "@/assets/usa-250-bbq.png";
import nectarpayHero from "@/assets/nectarpay-training.jpg";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session } = useAuth();
  const { isAdmin } = useIsAdmin();
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Cinematic fullscreen hero */}
      <section className="relative h-screen min-h-[640px] w-full overflow-hidden">
        {/* Background image (swap to <video> when uploaded) */}
        <img
          src={bbqHero}
          alt="CryptoPOP — 4th of July at Bobby's"
          className="absolute inset-0 h-full w-full object-cover hero-zoom"
        />

        {/* Dark cinematic overlay */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(8,5,20,0.55) 0%, rgba(8,5,20,0.65) 40%, rgba(8,5,20,0.92) 100%)",
          }}
        />

        {/* Animated aurora gradients */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-1/3 -left-1/4 h-[120vh] w-[120vh] rounded-full blur-3xl opacity-60 hero-aurora-a"
          style={{
            background:
              "radial-gradient(circle, rgba(255,122,40,0.55), rgba(255,61,190,0.25) 45%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-1/3 -right-1/4 h-[110vh] w-[110vh] rounded-full blur-3xl opacity-50 hero-aurora-b"
          style={{
            background:
              "radial-gradient(circle, rgba(139,61,255,0.55), rgba(0,229,255,0.18) 50%, transparent 75%)",
          }}
        />

        {/* Orange glow accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[60vh] w-[60vh] rounded-full blur-3xl hero-glow"
          style={{
            background:
              "radial-gradient(circle, rgba(255,140,50,0.45), transparent 65%)",
          }}
        />

        {/* QR dot grain */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />

        {/* Subtle scanline sweep */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-40 hero-scanline opacity-[0.06]"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(255,255,255,0.6), transparent)",
          }}
        />

        {/* Floating ambient embers */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 18 }).map((_, i) => {
            const left = (i * 53) % 100;
            const size = 4 + ((i * 7) % 10);
            const delay = (i * 0.9) % 14;
            const dur = 12 + ((i * 3) % 10);
            const orange = i % 3 !== 0;
            return (
              <span
                key={i}
                className="absolute rounded-full blur-[1px]"
                style={{
                  left: `${left}%`,
                  bottom: `-${size}px`,
                  width: `${size}px`,
                  height: `${size}px`,
                  background: orange
                    ? "radial-gradient(circle, rgba(255,160,70,0.95), rgba(255,90,30,0.2))"
                    : "radial-gradient(circle, rgba(255,255,255,0.9), rgba(255,255,255,0.1))",
                  boxShadow: orange
                    ? "0 0 18px rgba(255,140,50,0.85)"
                    : "0 0 10px rgba(255,255,255,0.6)",
                  animation: `hero-float ${dur}s linear ${delay}s infinite`,
                }}
              />
            );
          })}
        </div>

        {/* Nav */}
        <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 hero-fade">
          <img src={logo} alt="CryptoPOP" width={200} height={48} className="h-14 w-auto" />
          <nav className="flex items-center gap-3 font-mono text-xs">
            <Link to="/markets" className="hidden sm:inline rounded-full px-4 py-2 text-white/70 hover:text-white transition">
              Markets
            </Link>
            <Link to="/how-it-works" className="hidden sm:inline rounded-full px-4 py-2 text-white/70 hover:text-white transition">
              How it works
            </Link>
            <Link to="/earn" className="hidden sm:inline rounded-full px-4 py-2 text-white/70 hover:text-white transition">
              Earn
            </Link>
            {session && isAdmin && (
              <Link to="/admin" className="hidden sm:inline rounded-full px-4 py-2 text-white/70 hover:text-white transition">
                Admin
              </Link>
            )}
            {session ? (
              <Link to="/app" className="rounded-full border border-white/25 px-4 py-2 text-white hover:bg-white/10 transition">
                My POP
              </Link>
            ) : (
              <Link to="/login" className="rounded-full border border-white/25 px-4 py-2 text-white hover:bg-white/10 transition">
                Sign in
              </Link>
            )}
          </nav>
        </header>

        {/* Hero content */}
        <div className="relative z-10 mx-auto flex h-[calc(100vh-104px)] min-h-[520px] max-w-6xl flex-col items-start justify-center px-6 pb-20">
          <p
            className="hero-fade-up mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-white/80 backdrop-blur-md"
            style={{ animationDelay: "0.15s" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff8c32] shadow-[0_0_12px_rgba(255,140,50,0.9)] animate-pulse" />
            Connect · Experience · Support · Learn
          </p>

          <h1
            className="hero-fade-up max-w-5xl font-display uppercase leading-[0.88] tracking-tight text-white text-8xl font-semibold"
            style={{ animationDelay: "0.35s" }}
          >
            Show up.
            <br />
            Get{" "}
            <span
              className="inline-block bg-clip-text text-transparent pr-[0.08em] pb-[0.08em]"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #ffb066 0%, #ff7a28 45%, #ff3dbe 100%)",
                filter: "drop-shadow(0 0 30px rgba(255,140,50,0.55))",
              }}
            >
              POP
            </span>
            .
          </h1>

          <p
            className="hero-fade-up mt-7 max-w-xl text-lg text-white/75 font-normal"
            style={{ animationDelay: "0.55s" }}
          >
            Small business support, gamified. Show up at events and local merchants,
            scan a QR, and earn POP for every real-world interaction.
          </p>

          <div
            className="hero-fade-up mt-10 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "0.75s" }}
          >
            <Link
              to="/markets"
              className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-display font-semibold text-white transition hover:opacity-95"
              style={{
                background: "linear-gradient(90deg, #ff7a28, #ff3dbe)",
                boxShadow:
                  "0 18px 50px -12px rgba(255,122,40,0.7), 0 0 0 1px rgba(255,255,255,0.08) inset",
              }}
            >
              Explore POP Markets
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/how-it-works"
              className="rounded-full border border-white/25 px-7 py-3.5 font-display font-semibold text-white backdrop-blur-md hover:bg-white/10 transition"
            >
              How it works
            </Link>
          </div>

          <div
            className="hero-fade-up mt-14 flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.22em] text-white/60"
            style={{ animationDelay: "0.95s" }}
          >
            <Stat label="On-chain" value="100%" />
            <Divider />
            <Stat label="Geo-verified" value="±100m" />
            <Divider />
            <Stat label="Network" value="TXC OMNI" />
          </div>
        </div>

        {/* Bottom fade into next section */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
          style={{
            background:
              "linear-gradient(180deg, transparent, var(--background))",
          }}
        />
      </section>



      {/* Featured event */}
      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="overflow-hidden rounded-3xl border border-border shadow-[0_30px_80px_-30px] shadow-foreground/30">
              <img
                src={nectarpayHero}
                alt="Training room set up for the NectarPay full-day session in McKinney, Texas"
                loading="lazy"
                width={1536}
                height={1024}
                className="h-64 w-full object-cover md:h-96"
              />
            </div>
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                RSVPs open · 40 spots
              </p>
              <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
                NectarPay Training with Tim Blake
              </h2>
              <p className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                Wednesday, August 5, 2026 · 9am–5pm ·{" "}
                <a
                  href="https://www.google.com/maps/search/?api=1&query=SpringHill%20Suites%20McKinney%20TX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-primary/50 underline-offset-4 transition hover:text-foreground"
                >
                  Springhill Suites, McKinney TX
                  <span className="sr-only"> — open in Google Maps</span>
                </a>
              </p>

              <p className="mt-5 text-lg text-muted-foreground">
                A full day of NectarPay training with Tim Blake. Only 40 spots
                available — earn 10 POP for registering and 25 POP when you show up.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/events/$slug/rsvp"
                  params={{ slug: "nectarpay-training-mckinney" }}
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-display font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  RSVP & get POP
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to="/events"
                  className="group inline-flex items-center gap-2 rounded-full border border-border px-7 py-3.5 font-display font-semibold text-foreground transition hover:bg-muted"
                >
                  All upcoming events
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-px bg-border md:grid-cols-4">
          {[
            { icon: QrCode, title: "Scan", body: "Scan QR codes at CryptoPOP events and participating merchants." },
            { icon: MapPin, title: "Verify", body: "Geofence + time window confirms you're really there." },
            { icon: Coins, title: "Earn POP", body: "POP unlocks experiences, perks, and community rewards along the way." },
            { icon: Users, title: "Climb", body: "Build your POP score. Invite friends for bonuses." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-card p-8">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-base font-bold text-foreground normal-case tracking-normal">
        {value}
      </p>
      <p>{label}</p>
    </div>
  );
}

function Divider() {
  return <span className="h-8 w-px bg-border" />;
}

/** QR-style decorative pattern with corner finder squares — matches the logo's O. */
function QrPattern({ variant = "small" }: { variant?: "small" | "large" }) {
  const cells = variant === "large" ? 13 : 9;
  // Deterministic pseudo-random fill so SSR + client match.
  const filled = (i: number, j: number) => {
    const n = (i * 928371 + j * 12345 + i * j * 7 + 31) % 100;
    return n < 48;
  };
  const isFinder = (i: number, j: number) => {
    const inBox = (a: number, b: number, size = 3) =>
      i >= a && i < a + size && j >= b && j < b + size;
    return (
      inBox(0, 0) ||
      inBox(0, cells - 3) ||
      inBox(cells - 3, 0)
    );
  };
  const isFinderRing = (i: number, j: number) => {
    const onRing = (a: number, b: number) => {
      const di = i - a;
      const dj = j - b;
      if (di < 0 || di > 2 || dj < 0 || dj > 2) return false;
      return di === 0 || di === 2 || dj === 0 || dj === 2;
    };
    return onRing(0, 0) || onRing(0, cells - 3) || onRing(cells - 3, 0);
  };

  return (
    <div
      className="grid h-full w-full"
      style={{
        gridTemplateColumns: `repeat(${cells}, 1fr)`,
        gridTemplateRows: `repeat(${cells}, 1fr)`,
        gap: "6%",
      }}
    >
      {Array.from({ length: cells * cells }).map((_, idx) => {
        const i = Math.floor(idx / cells);
        const j = idx % cells;
        const finder = isFinder(i, j);
        const ring = isFinderRing(i, j);
        const on = finder ? ring || (i % 2 === 1 && j % 2 === 1) : filled(i, j);
        return (
          <span
            key={idx}
            className="block rounded-[15%]"
            style={{
              background: on
                ? variant === "large"
                  ? "var(--ink)"
                  : "var(--bone)"
                : "transparent",
            }}
          />
        );
      })}
    </div>
  );
}
