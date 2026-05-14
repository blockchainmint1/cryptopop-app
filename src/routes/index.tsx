import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, MapPin, Coins, Users, ArrowRight } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <img src={logo} alt="CryptoPOP" width={200} height={48} className="h-10 w-auto" />
        <nav className="flex items-center gap-3 font-mono text-xs">
          <a
            href="#how"
            className="hidden sm:inline rounded-full px-4 py-2 text-muted-foreground hover:text-foreground transition"
          >
            How it works
          </a>
          <Link
            to="/login"
            className="rounded-full border border-foreground/20 px-4 py-2 hover:bg-foreground/5 transition"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative">
        {/* QR-grid background motif (echoes the O in the logo) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(var(--ink) 1.5px, transparent 1.5px)",
            backgroundSize: "14px 14px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 70% 30%, black 30%, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 60% at 70% 30%, black 30%, transparent 70%)",
          }}
        />
        {/* Coral wash behind the headline */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-[-10%] h-[600px] w-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--pop) 35%, transparent), transparent 65%)",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 pt-12 pb-28 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-card/70 backdrop-blur px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Singapore · Built on TXC
            </p>

            <h1 className="font-display text-[clamp(3rem,9vw,7.5rem)] font-bold leading-[0.88] tracking-tight">
              Show up.<br />
              Get{" "}
              <span className="relative inline-block">
                <span className="text-primary">P</span>
                <span className="text-primary relative inline-block">
                  {/* QR-as-O — mirrors the logo */}
                  <span className="invisible">O</span>
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="relative inline-block rounded-full bg-primary p-[0.08em] aspect-square h-[0.85em]">
                      <QrPattern />
                    </span>
                  </span>
                </span>
                <span className="text-primary">P</span>
                <span className="absolute -bottom-2 left-0 right-0 h-[0.08em] rounded-full bg-primary/30" />
              </span>
              .
            </h1>

            <p className="mt-7 max-w-xl text-lg text-muted-foreground">
              The proof-of-participation wallet for real-world events. Scan a QR
              at the venue, answer a couple of questions, and POP tokens land in
              your wallet — verifiable on-chain.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-display font-semibold text-primary-foreground hover:opacity-90 transition shadow-[0_12px_40px_-10px] shadow-primary/60"
              >
                Open the wallet
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#how"
                className="rounded-full border border-foreground/20 px-7 py-3.5 font-display font-semibold hover:bg-foreground/5 transition"
              >
                How it works
              </a>
            </div>

            <div className="mt-12 flex items-center gap-6 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              <Stat label="On-chain" value="100%" />
              <Divider />
              <Stat label="Geo-verified" value="±100m" />
              <Divider />
              <Stat label="Network" value="TXC L2" />
            </div>
          </div>

          {/* Hero card — giant QR badge echoing the logo's POP-O */}
          <div className="relative mx-auto w-full max-w-md">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-2xl"
            />
            <div className="relative rounded-[2rem] border border-foreground/10 bg-card p-8 shadow-[0_30px_80px_-30px] shadow-foreground/30">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Event QR · Live
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Active
                </span>
              </div>

              <div className="mt-6 mx-auto aspect-square w-full max-w-[280px] rounded-2xl bg-primary p-5 shadow-inner">
                <div className="h-full w-full rounded-xl bg-bone p-3">
                  <QrPattern variant="large" />
                </div>
              </div>

              <div className="mt-6 flex items-end justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Reward
                  </p>
                  <p className="font-display text-3xl font-bold text-foreground">
                    +100 <span className="text-primary">POP</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Venue
                  </p>
                  <p className="font-display text-sm font-semibold">Marina Bay</p>
                </div>
              </div>
            </div>
          </div>
        </div>
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
