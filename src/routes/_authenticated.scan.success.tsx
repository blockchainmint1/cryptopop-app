import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import confetti from "canvas-confetti";
import { Wallet, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/cryptopop-logo.png";

const searchSchema = z.object({
  event: z.string().catch("Event"),
  reward: z.coerce.number().catch(0),
  balance: z.coerce.number().catch(0),
});

export const Route = createFileRoute("/_authenticated/scan/success")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "YOU GOT POP! — CryptoPOP" }] }),
  component: ScanSuccess,
});

const REDIRECT_SECONDS = 5;
const POP_COLORS = ["#ff3ea5", "#ff8a00", "#ffd400", "#3ad29f", "#3ec1ff", "#a855f7"];

function fireConfetti() {
  const base = { spread: 90, startVelocity: 55, scalar: 1.1, colors: POP_COLORS };
  confetti({ ...base, particleCount: 120, origin: { x: 0.5, y: 0.6 } });
  setTimeout(() => confetti({ ...base, particleCount: 80, angle: 60, origin: { x: 0, y: 0.7 } }), 200);
  setTimeout(() => confetti({ ...base, particleCount: 80, angle: 120, origin: { x: 1, y: 0.7 } }), 350);
  setTimeout(() => confetti({ ...base, particleCount: 100, spread: 160, origin: { x: 0.5, y: 0.4 } }), 600);
}

function ScanSuccess() {
  const { event, reward, balance } = Route.useSearch();
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const [cancelled, setCancelled] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) fireConfetti();
  }, []);

  useEffect(() => {
    if (cancelled) return;
    if (secondsLeft <= 0) {
      navigate({ to: "/app" });
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, cancelled, navigate]);

  const cancel = () => {
    cancelledRef.current = true;
    setCancelled(true);
  };

  const headline = "YOU GOT POP!";

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      {/* Animated rainbow gradient background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #ff3ea5, #ff8a00, #ffd400, #3ad29f, #3ec1ff, #a855f7)",
          backgroundSize: "300% 300%",
          animation: "pop-gradient 8s ease infinite",
        }}
      />
      <div className="absolute inset-0 -z-10 bg-background/30 backdrop-blur-[2px]" />

      {/* Floating sparkles */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => {
          const left = (i * 37) % 100;
          const delay = (i % 7) * 0.7;
          const dur = 6 + (i % 5);
          const emoji = ["✨", "🎉", "💥", "⭐️", "🪙", "🎊"][i % 6];
          return (
            <span
              key={i}
              className="absolute text-3xl opacity-80"
              style={{
                left: `${left}%`,
                bottom: "-10%",
                animation: `pop-float ${dur}s linear ${delay}s infinite`,
              }}
            >
              {emoji}
            </span>
          );
        })}
      </div>

      {/* Dismiss / cancel auto-redirect */}
      <button
        onClick={cancel}
        aria-label="Stay on this page"
        className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 text-foreground shadow-lg backdrop-blur transition hover:scale-110"
      >
        <X className="h-5 w-5" />
      </button>

      <main className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        {/* Bouncy logo */}
        <div
          className="mb-6"
          style={{ animation: "pop-in 0.6s cubic-bezier(.34,1.56,.64,1) both, pop-wobble 3s ease-in-out 0.6s infinite" }}
        >
          <img
            src={logo}
            alt="CryptoPOP"
            className="h-32 w-32 drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          />
        </div>

        {/* Staggered rainbow headline */}
        <h1 className="font-display text-5xl font-black tracking-tight drop-shadow-[0_4px_0_rgba(0,0,0,0.15)] sm:text-6xl">
          {headline.split("").map((ch, i) => (
            <span
              key={i}
              className="inline-block"
              style={{
                color: POP_COLORS[i % POP_COLORS.length],
                animation: `pop-letter 0.5s cubic-bezier(.34,1.56,.64,1) both`,
                animationDelay: `${0.3 + i * 0.05}s`,
                WebkitTextStroke: "2px rgba(0,0,0,0.85)",
              }}
            >
              {ch === " " ? "\u00A0" : ch}
            </span>
          ))}
        </h1>

        {/* Reward chip */}
        <div
          className="mt-8 inline-flex items-baseline gap-2 rounded-full bg-background px-8 py-4 shadow-2xl ring-4 ring-foreground/10"
          style={{ animation: "pop-in 0.55s cubic-bezier(.34,1.56,.64,1) 0.9s both" }}
        >
          <span className="font-display text-5xl font-black tabular-nums text-foreground">+{reward}</span>
          <span className="text-xl font-semibold text-muted-foreground">POP</span>
        </div>

        <p
          className="mt-4 max-w-xs font-display text-lg font-semibold text-foreground/90"
          style={{ animation: "pop-in 0.5s ease-out 1.1s both" }}
        >
          {event}
        </p>
        <p
          className="mt-1 text-sm text-foreground/80"
          style={{ animation: "pop-in 0.5s ease-out 1.2s both" }}
        >
          New balance · <span className="font-bold">{balance.toLocaleString()} POP</span>
        </p>

        {/* CTAs */}
        <div className="mt-10 grid w-full grid-cols-2 gap-3">
          <Button asChild variant="secondary" size="lg" onClick={cancel}>
            <Link to="/scan">
              <ScanLine className="mr-2 h-4 w-4" /> Scan another
            </Link>
          </Button>
          <Button asChild size="lg" onClick={cancel}>
            <Link to="/app">
              <Wallet className="mr-2 h-4 w-4" /> Wallet
            </Link>
          </Button>
        </div>

        {/* Auto-redirect indicator */}
        <p className="mt-6 h-5 text-xs uppercase tracking-widest text-foreground/70">
          {cancelled
            ? "Take your time"
            : `Returning to wallet in ${secondsLeft}…`}
        </p>
      </main>
    </div>
  );
}
