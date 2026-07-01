import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  Camera,
  CameraOff,
  Users,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { searchSignups, checkInSignup } from "@/lib/signups.functions";

type Signup = {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string;
  instagram_handle: string | null;
  telegram_handle: string | null;
  is_friend: boolean;
  pop_credits: number;
  completed_activities: string[] | null;
  signup_source: string;
  status: string;
  signed_up_at: string;
  checked_in_at: string | null;
};

export const Route = createFileRoute("/_authenticated/admin/signups")({
  head: () => ({ meta: [{ title: "Signups — CryptoPOP Admin" }] }),
  component: AdminSignups,
});

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function AdminSignups() {
  const search = useServerFn(searchSignups);
  const checkIn = useServerFn(checkInSignup);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  async function runSearch(query: string) {
    setLoading(true);
    try {
      const res = await search({ data: { q: query || undefined } });
      setRows(res.signups as Signup[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCheckIn(id: string) {
    try {
      const res = await checkIn({ data: { id } });
      if (res.alreadyCheckedIn) toast.message("Already checked in earlier.");
      else toast.success("Checked in!");
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, checked_in_at: res.checkedInAt } : r,
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    }
  }

  const total = rows.length;
  const checkedInCount = rows.filter((r) => r.checked_in_at).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link
            to="/app"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <h1 className="font-display text-lg font-bold">Signups</h1>
          <nav className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest">
            <Link
              to="/admin/rewards"
              className="text-muted-foreground hover:text-foreground"
            >
              Rewards
            </Link>
            <Link
              to="/admin/pop-awards"
              className="text-muted-foreground hover:text-foreground"
            >
              POP Log
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <StatCard icon={<Users className="h-4 w-4" />} label="Signups" value={total} />
          <StatCard
            icon={<UserCheck className="h-4 w-4" />}
            label="Checked in"
            value={checkedInCount}
          />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(q);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email or phone"
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              maxLength={120}
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-foreground px-4 py-2.5 font-display text-sm font-semibold text-background hover:opacity-90"
          >
            {loading ? "…" : "Search"}
          </button>
          <button
            type="button"
            onClick={() => setScanning((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 font-display text-sm hover:bg-background"
          >
            {scanning ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {scanning ? "Stop" : "Scan QR"}
          </button>
        </form>

        {scanning && (
          <QrScanner
            onResult={(id) => {
              setScanning(false);
              handleCheckIn(id);
            }}
            onClose={() => setScanning(false)}
          />
        )}

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {loading ? "Loading…" : "No signups found."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-display font-semibold">{s.full_name}</p>
                      {s.is_friend && (s.guest_count ?? 0) > 0 && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                          +{s.guest_count}
                        </span>
                      )}
                      {s.is_friend && !(s.guest_count ?? 0) && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                          +1
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.email} · {s.mobile_number}
                    </p>
                    {(s.instagram_handle || s.telegram_handle) && (
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {s.instagram_handle && <>IG @{s.instagram_handle} </>}
                        {s.telegram_handle && <>· TG @{s.telegram_handle}</>}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {s.pop_credits} POP · {new Date(s.signed_up_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.checked_in_at ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Checked in
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCheckIn(s.id)}
                        className="rounded-full bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground hover:opacity-90"
                      >
                        Check in
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function QrScanner({
  onResult,
  onClose,
}: {
  onResult: (id: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let detector: { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } | null = null;
    let raf = 0;
    let cancelled = false;

    async function start() {
      try {
        // BarcodeDetector is available in modern Chromium / Safari 17+
        const BD = (globalThis as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => typeof detector }).BarcodeDetector;
        if (!BD) {
          setError("Camera scanning isn't supported on this browser. Paste the ID below.");
          return;
        }
        detector = new (BD as unknown as new (opts: { formats: string[] }) => NonNullable<typeof detector>)({
          formats: ["qr_code"],
        });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const tick = async () => {
          if (cancelled || !videoRef.current || !detector) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const match = codes.map((c) => c.rawValue).find((v) => UUID_RE.test(v));
            if (match) {
              const id = match.match(UUID_RE)![0];
              onResult(id);
              return;
            }
          } catch {
            /* ignore frame errors */
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't access camera");
      }
    }

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="overflow-hidden rounded-xl bg-black">
        {error ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{error}</p>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-square w-full object-cover"
          />
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const m = manual.match(UUID_RE);
          if (!m) {
            toast.error("Paste a valid pass ID");
            return;
          }
          onResult(m[0]);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or paste pass ID"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground"
        >
          Check in
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-border px-3 py-2 font-display text-sm"
        >
          Close
        </button>
      </form>
    </div>
  );
}
