import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, CalendarDays, MapPin, CheckCircle2, Anchor } from "lucide-react";
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
      "A family-friendly CryptoPOP block party for the 250th USA anniversary. Live music, face painting, low-and-slow BBQ, complimentary exploratory superyacht charters around the marina, and a commemorative POP for everyone who scans on the day.",
  },
};

const HEARD_OPTIONS = [
  "Friend or family",
  "Instagram",
  "TikTok",
  "LinkedIn",
  "Telegram / WhatsApp group",
  "At a CryptoPOP event",
  "News article or blog",
  "Search engine",
  "Other",
];

export const Route = createFileRoute("/events/$slug/rsvp")({
  head: ({ params }) => {
    const ev = EVENTS[params.slug];
    const title = ev ? `RSVP — ${ev.name}` : "RSVP — CryptoPOP";
    const desc = ev
      ? `Reserve your spot at ${ev.name} on ${ev.date}. Free, family-friendly, education-only.`
      : "RSVP to the next CryptoPOP event.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: RsvpPage,
});

const rsvpSchema = z.object({
  full_name: z.string().trim().min(1, "Your name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(254),
  contact_number: z
    .string()
    .trim()
    .min(3, "Contact number is too short")
    .max(32, "Contact number is too long"),
  party_size: z.coerce.number().int().min(1, "At least 1").max(20, "Max 20 per RSVP"),
  heard_from: z.string().trim().min(1, "Let us know how you heard about us").max(120),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

function RsvpPage() {
  const { slug } = Route.useParams();
  const ev = EVENTS[slug];
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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
    const parsed = rsvpSchema.safeParse({
      full_name: form.get("full_name"),
      email: form.get("email"),
      contact_number: form.get("contact_number"),
      party_size: form.get("party_size"),
      heard_from: form.get("heard_from"),
      notes: form.get("notes"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("event_rsvps").insert({
      event_slug: ev.slug,
      event_name: ev.name,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      contact_number: parsed.data.contact_number,
      party_size: parsed.data.party_size,
      heard_from: parsed.data.heard_from,
      notes: parsed.data.notes || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't save your RSVP. Please try again.");
      return;
    }
    setDone(true);
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
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            CryptoPOP event
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
            {ev.name}
          </h1>
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
            Education-only event. POP tokens are a participation record and have
            no monetary value. No DPT trading on site.
          </p>
        </aside>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-[0_30px_80px_-30px] shadow-foreground/20 md:p-8">
          {done ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <h2 className="mt-4 font-display text-2xl font-bold">You're on the list!</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                We've saved your RSVP for {ev.name}. A confirmation email will
                land in your inbox shortly. See you at ONE°15 Marina on 4 July,
                11am–4pm.
              </p>
              <Link
                to="/"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-display font-semibold text-primary-foreground"
              >
                Back home
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <header>
                <h2 className="font-display text-2xl font-bold">RSVP</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Free, no payment. We just want to know how much brisket to order.
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
                <Field label="Contact number" htmlFor="contact_number">
                  <input
                    id="contact_number"
                    name="contact_number"
                    required
                    maxLength={32}
                    autoComplete="tel"
                    inputMode="tel"
                    className={inputCls}
                    placeholder="+65 9123 4567"
                  />
                </Field>
              </div>

              <Field label="How many people are coming?" htmlFor="party_size">
                <input
                  id="party_size"
                  name="party_size"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={1}
                  required
                  className={inputCls}
                />
              </Field>

              <Field label="Anything we should know? (optional)" htmlFor="notes">
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  maxLength={1000}
                  className={inputCls}
                  placeholder="Dietary preferences, kids' ages, etc."
                />
              </Field>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Reserving…" : "Reserve my spot"}
              </button>
              <p className="text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                We'll only use your details to confirm this RSVP.
              </p>
            </form>
          )}
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
