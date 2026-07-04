import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Scanner } from "@yudiel/react-qr-scanner";
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { checkInSignup } from "@/lib/signups.functions";

export const Route = createFileRoute("/_authenticated/admin/checkin")({
  head: () => ({
    meta: [
      { title: "Check-in Scanner — CryptoPOP Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckinScannerPage,
});

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

type LastResult =
  | { kind: "success"; name: string; already: boolean }
  | { kind: "error"; message: string };

function CheckinScannerPage() {
  const checkIn = useServerFn(checkInSignup);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<LastResult | null>(null);
  const [count, setCount] = useState(0);
  // Debounce identical scans and lock while a request is in-flight.
  const lockRef = useRef(false);
  const lastValueRef = useRef<{ v: string; at: number } | null>(null);

  const handleScan = useCallback(
    async (raw: string) => {
      if (lockRef.current) return;
      const now = Date.now();
      if (
        lastValueRef.current &&
        lastValueRef.current.v === raw &&
        now - lastValueRef.current.at < 3000
      ) {
        return;
      }
      lastValueRef.current = { v: raw, at: now };

      const match = raw.match(UUID_RE);
      if (!match) {
        setLast({ kind: "error", message: "Not a valid pass QR." });
        return;
      }
      const id = match[0];
      lockRef.current = true;
      setBusy(true);
      try {
        const res = await checkIn({ data: { id } });
        setLast({
          kind: "success",
          name: res.fullName ?? "Attendee",
          already: res.alreadyCheckedIn,
        });
        if (!res.alreadyCheckedIn) setCount((c) => c + 1);
      } catch (e) {
        setLast({
          kind: "error",
          message: e instanceof Error ? e.message : "Check-in failed",
        });
      } finally {
        setBusy(false);
        // Small cooldown so the same QR sitting in frame doesn't re-fire.
        setTimeout(() => {
          lockRef.current = false;
        }, 1500);
      }
    },
    [checkIn],
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black text-white">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-4 py-3 backdrop-blur supports-[padding:max(0px)]:pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Admin
        </Link>
        <div className="text-center">
          <p className="font-display text-sm font-semibold leading-none">Check-in</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-white/60">
            Scan attendee pass
          </p>
        </div>
        <div className="min-w-[3.5rem] text-right">
          <p className="font-display text-lg font-black tabular-nums leading-none">
            {count}
          </p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-white/60">
            in
          </p>
        </div>
      </header>

      {/* Scanner viewport */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <Scanner
          onScan={(codes) => {
            const value = codes[0]?.rawValue;
            if (value) handleScan(value);
          }}
          onError={() => {}}
          constraints={{ facingMode: "environment" }}
          styles={{
            container: { width: "100%", height: "100%" },
            video: { width: "100%", height: "100%", objectFit: "cover" },
          }}
          components={{ finder: false }}
          sound={false}
        />

        {/* Reticle overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-square w-[72vw] max-w-[420px]">
            <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-primary/90" />
            <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-primary/90" />
            <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-primary/90" />
            <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-primary/90" />
          </div>
        </div>

        {busy && (
          <div className="pointer-events-none absolute inset-x-0 bottom-32 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 backdrop-blur">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Checking in…</span>
            </div>
          </div>
        )}
      </div>

      {/* Result banner */}
      <footer className="border-t border-white/10 bg-black/80 px-4 py-4 backdrop-blur supports-[padding:max(0px)]:pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!last ? (
          <p className="text-center text-sm text-white/70">
            Point the camera at an attendee's pass QR.
          </p>
        ) : last.kind === "success" ? (
          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
              last.already
                ? "bg-amber-500/15 text-amber-200"
                : "bg-emerald-500/15 text-emerald-200"
            }`}
          >
            <CheckCircle2 className="h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold leading-tight truncate">
                {last.name}
              </p>
              <p className="font-mono text-[11px] uppercase tracking-widest opacity-80">
                {last.already ? "Already checked in" : "Checked in ✓"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-red-500/15 px-4 py-3 text-red-200">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold leading-tight">
                Couldn't check in
              </p>
              <p className="font-mono text-[11px] uppercase tracking-widest opacity-80 truncate">
                {last.message}
              </p>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
