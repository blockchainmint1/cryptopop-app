import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, CalendarDays, MapPin, Anchor } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import yachts from "@/assets/marina-yachts.jpg";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type EventInfo = {
  slug: string;
  name: string;
  date: string;
  location: string;
  mapUrl: string;
  blurb: string;
};

const EVENTS: Record<string, EventInfo> = {
  "july4-marina-bbq": {
    slug: "july4-marina-bbq",
    name: "Red, White & Barbecue — USA 250",
    date: "Saturday, 4 July 2026 · 11am – 4pm",
    location: "ONE°15 Marina, Sentosa Cove",
    mapUrl:
      "https://www.google.com/maps/place/ONE%C2%B015+Marina+Sentosa+Cove,+Singapore/@1.2462,103.8378,17z",
    blurb:
      "Education-only event. POP are a participation record.",
  },
};

export const Route = createFileRoute("/events/$slug/rsvp")({
  head: ({ params }) => {
    const ev = EVENTS[params.slug];
    const title = ev ? `Sign up — ${ev.name}` : "Sign up — CryptoPOP";
    const desc = ev
      ? `Reserve your spot at ${ev.name} on ${ev.date}. Free, family-friendly, education-only.`
      : "Sign up to the next CryptoPOP event.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: SignupPage,
});

const signupSchema = z.object({
  full_name: z.string().trim().min(1, "Your name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(254),
  mobile_number: z
    .string()
    .trim()
    .min(3, "Mobile number is too short")
    .max(32, "Mobile number is too long"),
  instagram_handle: z.string().trim().max(64).optional().or(z.literal("")),
  telegram_handle: z.string().trim().max(64).optional().or(z.literal("")),
  is_friend: z.enum(["yes", "no"]),
});

function SignupPage() {
  const { slug } = Route.useParams();
  const ev = EVENTS[slug];
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  if (!ev) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="font-display text-3xl font-bold">Event not found</h1>
          <p className="mt-3 text-muted-foreground">
            We couldn't find that event.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-foreground/20 px-5 py-2.5 font-display"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ev) return;
    const form = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      full_name: form.get("full_name"),
      email: form.get("email"),
      mobile_number: form.get("mobile_number"),
      instagram_handle: form.get("instagram_handle"),
      telegram_handle: form.get("telegram_handle"),
      is_friend: form.get("is_friend"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setSubmitting(true);
    const ig = parsed.data.instagram_handle?.replace(/^@/, "").trim();
    const tg = parsed.data.telegram_handle?.replace(/^@/, "").trim();
    const { data: inserted, error } = await supabase
      .from("event_signups")
      .insert({
        full_name: parsed.data.full_name,
        email: parsed.data.email.toLowerCase(),
        mobile_number: parsed.data.mobile_number,
        instagram_handle: ig ? ig : null,
        telegram_handle: tg ? tg : null,
        is_friend: parsed.data.is_friend === "yes",
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !inserted) {
      if (error?.code === "23505") {
        const msg = /mobile/i.test(error.message)
          ? "That mobile number is already signed up."
          : "That email is already signed up.";
        toast.error(msg);
        return;
      }
      toast.error("Couldn't save your signup. Please try again.");
      return;
    }
    try {
      localStorage.setItem("cryptopop_signup_id", inserted.id);
    } catch {
      // ignore storage failures
    }
    toast.success("You're in! 10 POP added.");
    navigate({ to: "/my-pass", search: { id: inserted.id } });
  }

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

      <main className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[1fr_1.1fr]">
        <aside>
          <div className="mb-6 overflow-hidden rounded-3xl border border-border">
            <img
              src={yachts}
              alt="Superyachts moored at ONE°15 Marina, Sentosa Cove"
              width={1536}
              height={1024}
              className="h-48 w-full object-cover md:h-64"
            />
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            CryptoPOP event
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
            {ev.slug === "july4-marina-bbq" ? (
              <>
                <span className="text-red-500">Red</span>, White & <span className="text-blue-400">Barbecue</span> — USA 250
              </>
            ) : (
              ev.name
            )}
          </h1>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <Anchor className="h-3.5 w-3.5 text-primary" />
            Complimentary exploratory yacht charters
          </p>
          <div className="mt-6 space-y-3 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              {ev.date}
            </p>
            <a
              href={ev.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <MapPin className="h-4 w-4 text-primary" />
              {ev.location} — open in Google Maps
            </a>
          </div>
          <p className="mt-6 text-muted-foreground">{ev.blurb}</p>
          <p className="mt-6 rounded-2xl border border-border bg-card p-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Education-only event. POP are a participation record and have
            no monetary value. No DPT trading on site.
          </p>
        </aside>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-[0_30px_80px_-30px] shadow-foreground/20 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <header>
                <h2 className="font-display text-2xl font-bold">Sign up</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Free signup. You'll earn <span className="font-semibold text-foreground">10 POP</span> the moment you join.
                </p>
              </header>

              <Field label="Full name" htmlFor="full_name">
                <input
                  id="full_name"
                  name="full_name"
                  required
                  maxLength={120}
                  autoComplete="name"
                  className={inputCls}
                  placeholder="Jane Tan"
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Email" htmlFor="email">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    className={inputCls}
                    placeholder="jane@example.com"
                  />
                </Field>
                <Field label="Mobile number" htmlFor="mobile_number">
                  <input
                    id="mobile_number"
                    name="mobile_number"
                    required
                    maxLength={32}
                    autoComplete="tel"
                    inputMode="tel"
                    className={inputCls}
                    placeholder="+65 9123 4567"
                  />
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Instagram handle (optional)" htmlFor="instagram_handle">
                  <input
                    id="instagram_handle"
                    name="instagram_handle"
                    maxLength={64}
                    className={inputCls}
                    placeholder="@cryptopop"
                  />
                </Field>
                <Field label="Telegram handle (optional)" htmlFor="telegram_handle">
                  <input
                    id="telegram_handle"
                    name="telegram_handle"
                    maxLength={64}
                    className={inputCls}
                    placeholder="@cryptopop"
                  />
                </Field>
              </div>

              <fieldset>
                <legend className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Bringing a friend?
                </legend>
                <div className="flex gap-2">
                  {(["yes", "no"] as const).map((v) => (
                    <label
                      key={v}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm capitalize transition has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-foreground"
                    >
                      <input
                        type="radio"
                        name="is_friend"
                        value={v}
                        required
                        defaultChecked={v === "no"}
                        className="sr-only"
                      />
                      {v}
                    </label>
                  ))}
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Signing you up…" : "Sign up & claim 10 POP"}
              </button>
              <p className="text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                We'll only use your details to confirm this signup.
              </p>
            </form>

        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
