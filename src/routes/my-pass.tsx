import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, Sparkles, Coins, Calendar, MapPin } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import { SiteFooter } from "@/components/site-footer";
import { getSignupById } from "@/lib/signups.functions";

const searchSchema = z.object({ id: z.string().uuid().optional() }).partial();

export const Route = createFileRoute("/my-pass")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "My Pass — CryptoPOP" },
      { name: "description", content: "Your CryptoPOP event pass and check-in QR code." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyPassPage,
});

type Signup = {
  id: string;
  full_name: string;
  email: string;
  pop_credits: number;
  status: string;
  signed_up_at: string;
  checked_in_at: string | null;
  completed_activities: string[] | null;
};

function MyPassPage() {
  const { id: idFromUrl } = Route.useSearch();
  const fetchSignup = useServerFn(getSignupById);
  const [id, setId] = useState<string | null>(null);
  const [signup, setSignup] = useState<Signup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("cryptopop_signup_id")
        : null;
    const resolved = idFromUrl ?? stored;
    if (resolved && idFromUrl && idFromUrl !== stored) {
      try {
        localStorage.setItem("cryptopop_signup_id", idFromUrl);
      } catch {
        /* ignore */
      }
    }
    setId(resolved ?? null);
  }, [idFromUrl]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSignup({ data: { id } })
      .then((res) => {
        if (cancelled) return;
        if (!res.signup) setError("We couldn't find that pass.");
        else setSignup(res.signup as Signup);
      })
      .catch(() => !cancelled && setError("Something went wrong loading your pass."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, fetchSignup]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="CryptoPOP" className="h-8 w-auto" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-10">
        {loading ? (
          <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Loading your pass…
          </p>
        ) : !id ? (
          <EmptyPass
            title="No pass on this device"
            message="Open the link from your signup confirmation, or sign up to get a pass."
          />
        ) : error || !signup ? (
          <EmptyPass title="Pass not found" message={error ?? "We couldn't find that pass."} />
        ) : (
          <PassCard signup={signup} />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function PassCard({ signup }: { signup: Signup }) {
  const checkedIn = !!signup.checked_in_at;
  return (
    <div className="space-y-6">
      <div className="text-center">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-3 font-display text-3xl font-bold">You're in!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You've earned your first <span className="font-semibold text-foreground">10 POP credits</span>.
          Show this QR at the marina to check in.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_30px_80px_-30px] shadow-foreground/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              CryptoPOP pass
            </p>
            <p className="mt-1 font-display text-xl font-bold">{signup.full_name}</p>
            <p className="text-xs text-muted-foreground">{signup.email}</p>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
              checkedIn
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-primary/10 text-primary"
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            {checkedIn ? "Checked in" : signup.status}
          </div>
        </div>

        <div className="my-6 flex justify-center rounded-2xl bg-white p-5">
          <QRCodeSVG
            value={signup.id}
            size={224}
            level="M"
            includeMargin={false}
          />
        </div>

        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          ID · {signup.id}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Stat
            icon={<Coins className="h-4 w-4 text-primary" />}
            label="POP credits"
            value={String(signup.pop_credits)}
          />
          <Stat
            icon={<Calendar className="h-4 w-4 text-primary" />}
            label="Signed up"
            value={new Date(signup.signed_up_at).toLocaleDateString()}
          />
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-background p-4 text-xs text-muted-foreground">
          <p className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            ONE°15 Marina, Sentosa Cove · Sat 4 July 2026 · 11am–4pm
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}

function EmptyPass({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-8 text-center">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Link
        to="/events/$slug/rsvp"
        params={{ slug: "july4-marina-bbq" }}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-display font-semibold text-primary-foreground"
      >
        Sign up
      </Link>
    </div>
  );
}
