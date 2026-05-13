import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, MapPin, Coins, Users } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <img src={logo} alt="CryptoPOP" width={160} height={40} className="h-9 w-auto" />
        <nav className="flex items-center gap-3 font-mono text-xs">
          <Link
            to="/login"
            className="rounded-full border border-foreground/15 px-4 py-2 hover:bg-foreground/5 transition"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-12 pb-24">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Singapore · Built on TXC
        </p>
        <h1 className="font-display text-6xl md:text-8xl font-bold leading-[0.9]">
          Show up.<br />
          <span className="text-primary">Get POP.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          CryptoPOP is the proof-of-participation wallet for real-world events.
          Scan a QR at the venue, answer a couple of questions, and POP tokens
          land in your wallet — verifiable on-chain.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="rounded-full bg-primary px-7 py-3.5 font-display font-semibold text-primary-foreground hover:opacity-90 transition shadow-[0_8px_30px_-8px] shadow-primary/60"
          >
            Open the wallet
          </Link>
          <a
            href="#how"
            className="rounded-full border border-foreground/15 px-7 py-3.5 font-display font-semibold hover:bg-foreground/5 transition"
          >
            How it works
          </a>
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

      <footer className="mx-auto max-w-6xl px-6 py-10 font-mono text-xs text-muted-foreground">
        © {new Date().getFullYear()} CryptoPOP · Proof of Participation on TXC
      </footer>
    </div>
  );
}
