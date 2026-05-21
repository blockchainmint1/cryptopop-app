import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, MapPin, Coins, Users, ArrowRight, CalendarDays, Music, Flame, Anchor, Sailboat } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import yachts from "@/assets/marina-yachts.jpg";
import { SiteFooter } from "@/components/site-footer";

const VENUE_MAP_URL =
  "https://www.google.com/maps/place/ONE%C2%B015+Marina+Sentosa+Cove,+Singapore/@1.2462,103.8378,17z";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Cinematic fullscreen hero */}
      <section className="relative h-screen min-h-[640px] w-full overflow-hidden">
        {/* Background image (swap to <video> when uploaded) */}
        <img
          src={yachts}
          alt="CryptoPOP at ONE°15 Marina"
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
          <img src={logo} alt="CryptoPOP" width={200} height={48} className="h-10 w-auto" />
          <nav className="flex items-center gap-3 font-mono text-xs">
            <Link to="/mission" className="hidden sm:inline rounded-full px-4 py-2 text-white/70 hover:text-white transition">
              Mission
            </Link>
            <a href="#how" className="hidden sm:inline rounded-full px-4 py-2 text-white/70 hover:text-white transition">
              How it works
            </a>
            <Link to="/my-pop" className="rounded-full px-4 py-2 text-white/70 hover:text-white transition">
              My POP
            </Link>
            <Link to="/login" className="rounded-full border border-white/25 px-4 py-2 text-white hover:bg-white/10 transition">
              Sign in
            </Link>
          </nav>
        </header>

        {/* Hero content */}
        <div className="relative z-10 mx-auto flex h-[calc(100vh-104px)] min-h-[520px] max-w-6xl flex-col items-start justify-center px-6 pb-20">
          <p
            className="hero-fade-up mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-white/80 backdrop-blur-md"
            style={{ animationDelay: "0.15s" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff8c32] shadow-[0_0_12px_rgba(255,140,50,0.9)] animate-pulse" />
            Connect · Experience · Learn
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
            The proof-of-participation wallet for real-world events. Scan a QR
            at the venue, answer a couple of questions, and POP tokens land in
            your wallet — verifiable on-chain.
          </p>

          <div
            className="hero-fade-up mt-10 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "0.75s" }}
          >
            <Link
              to="/events/$slug/rsvp"
              params={{ slug: "july4-marina-bbq" }}
              className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-display font-semibold text-white transition hover:opacity-95"
              style={{
                background: "linear-gradient(90deg, #ff7a28, #ff3dbe)",
                boxShadow:
                  "0 18px 50px -12px rgba(255,122,40,0.7), 0 0 0 1px rgba(255,255,255,0.08) inset",
              }}
            >
              RSVP — it's free
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how"
              className="rounded-full border border-white/25 px-7 py-3.5 font-display font-semibold text-white backdrop-blur-md hover:bg-white/10 transition"
            >
              How it works
            </a>
          </div>

          <div
            className="hero-fade-up mt-14 flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.22em] text-white/60"
            style={{ animationDelay: "0.95s" }}
          >
            <Stat label="On-chain" value="100%" />
            <Divider />
            <Stat label="Geo-verified" value="±100m" />
            <Divider />
            <Stat label="Network" value="TXC L2" />
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


      {/* How */}
      <section id="how" className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-px bg-border md:grid-cols-4">
          {[
            { icon: QrCode, title: "Scan", body: "Point your camera at the event QR code." },
            { icon: MapPin, title: "Verify", body: "Geofence + time window confirms you're really there." },
            { icon: Coins, title: "Earn POP", body: "Tokens minted to your TXC wallet, anchored on-chain." },
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

      {/* Next event */}
      <section className="relative border-t border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, var(--ink) 0 2px, transparent 2px 14px)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Next event · 4 July 2026 · 11am–4pm
            </p>
            <h2 className="mt-5 font-display text-[clamp(2.25rem,6vw,4.5rem)] font-bold leading-[0.95] tracking-tight">
              Red, white &<br />
              <span className="text-primary">barbecue.</span>
            </h2>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              CryptoPOP takes over{" "}
              <a
                href={VENUE_MAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground underline-offset-4 hover:underline"
              >
                ONE°15 Marina, Sentosa Cove
              </a>{" "}
              for a 250th USA anniversary block party — live music, face painting,
              low-and-slow BBQ, pop-up demos, and complimentary exploratory
              superyacht charters around the marina. Family-friendly. Scan the
              event QR on the day to collect your commemorative POP.
            </p>

            <div className="mt-7 flex flex-wrap gap-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Sat · 4 Jul · 11am–4pm
              </span>
              <a
                href={VENUE_MAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                <MapPin className="h-4 w-4 text-primary" /> ONE°15 Marina
              </a>
              <span className="inline-flex items-center gap-2">
                <Sailboat className="h-4 w-4 text-primary" /> Yacht charters
              </span>
              <span className="inline-flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" /> Live music
              </span>
              <span className="inline-flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" /> BBQ + face painting
              </span>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/events/$slug/rsvp"
                params={{ slug: "july4-marina-bbq" }}
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-display font-semibold text-primary-foreground hover:opacity-90 transition shadow-[0_12px_40px_-10px] shadow-primary/60 text-[#8b3dff]"
              >
                RSVP — it's free
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/mission"
                className="rounded-full border border-foreground/20 px-7 py-3.5 font-display font-semibold hover:bg-foreground/5 transition"
              >
                Why we're doing this
              </Link>
            </div>
            <p className="mt-4 max-w-md font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Education event · POP has no monetary value · No DPT trading
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-2xl"
            />
            <div className="relative overflow-hidden rounded-[2rem] border border-foreground/10 bg-card shadow-[0_30px_80px_-30px] shadow-foreground/30">
              <div className="relative h-56 w-full overflow-hidden">
                <img
                  src={yachts}
                  alt="Superyachts moored at ONE°15 Marina at golden hour"
                  width={1536}
                  height={1024}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%)",
                  }}
                />
                <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between text-white">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest opacity-80">
                      CryptoPOP × July 4
                    </p>
                    <p className="font-display text-3xl font-bold leading-none">
                      USA 250
                    </p>
                  </div>
                  <span className="rounded-full bg-black/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur">
                    Free entry
                  </span>
                </div>
              </div>
              <div className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      When
                    </p>
                    <p className="font-display text-base font-semibold">
                      Sat · 4 Jul · 11am – 4pm
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Where
                    </p>
                    <a
                      href={VENUE_MAP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-display text-base font-semibold hover:underline"
                    >
                      ONE°15 Marina
                    </a>
                  </div>
                </div>
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Anchor className="h-4 w-4 text-primary" />
                  Complimentary exploratory yacht charters all afternoon.
                </p>
                <Link
                  to="/events/$slug/rsvp"
                  params={{ slug: "july4-marina-bbq" }}
                  className="block w-full rounded-xl bg-foreground px-4 py-3 text-center font-display font-semibold text-background hover:opacity-90 transition"
                >
                  Reserve my spot →
                </Link>
              </div>
            </div>
          </div>
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
