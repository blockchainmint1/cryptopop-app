import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/admin")({
  head: () => ({
    meta: [
      { title: "Admin guide — CryptoPOP" },
      {
        name: "description",
        content:
          "How to run CryptoPOP events: create events, generate QR codes, manage signups, send email blasts, and reconcile POP awards.",
      },
    ],
  }),
  component: AdminDocs,
});

function AdminDocs() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Docs · For admins
      </p>
      <h1 className="mt-3 font-display text-5xl font-bold tracking-tight">Admin guide</h1>
      <p className="mt-4 text-muted-foreground">
        Everything you need to run a CryptoPOP event end-to-end — from creating the event to
        reconciling POP after the fact.
      </p>

      <Section title="The mental model">
        <p>
          Every event in CryptoPOP has three layers:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>The event row</strong> — name, description, dates, geofence, and POP rewards.
          </li>
          <li>
            <strong>The signup page</strong> — public RSVP form people use ahead of time. Each
            signup mints 10 POP as a welcome.
          </li>
          <li>
            <strong>The QR poster</strong> — printed at the venue, scanned during the event to
            claim the main POP reward. Claims only succeed inside the geofence and inside the time
            window.
          </li>
        </ul>
      </Section>

      <Section title="1. Create an event">
        <p>
          <strong>Admin → Events → New event.</strong> The important fields:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Name & description</strong> — these show on the RSVP page (read live from the
            database, so you can edit them any time and the page updates).
          </li>
          <li>
            <strong>Cover URL</strong> — optional hero image for the RSVP page.
          </li>
          <li>
            <strong>Starts / Ends</strong> — the time window claims are accepted in. There's a USA
            preview underneath each input so you can sanity-check the date.
          </li>
          <li>
            <strong>Location & geofence</strong> — drag the pin to the venue. The radius (meters)
            sets how far from the pin a phone can be and still claim. 100–300m is typical for a
            building, 500m+ for a park.
          </li>
          <li>
            <strong>QR active before start (minutes)</strong> — lets early arrivals claim. 60 is
            common.
          </li>
          <li>
            <strong>Base POP reward</strong> — what each attendee gets for claiming at the event.
          </li>
          <li>
            <strong>Referral POP reward</strong> — bonus POP for inviting someone who signs up
            through your referral link.
          </li>
        </ul>
      </Section>

      <Section title="2. QR codes — when and how to use them">
        <p>
          Open the event from <strong>Admin → Events</strong> and hit <strong>QR poster</strong>.
          You get a printable poster with the event QR. A few rules of thumb:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>One poster per event</strong>. The QR encodes a signed token tied to the
            event — don't reuse one event's poster for another.
          </li>
          <li>
            <strong>Print it big</strong>. A4 minimum. Phones need a clean scan from 1–2m away.
          </li>
          <li>
            <strong>Place it where people congregate</strong>: registration desk, food line, near
            the speakers. Multiple copies is fine; same QR on each.
          </li>
          <li>
            <strong>QR + geofence + time window</strong> all have to match for a claim to succeed.
            If guests get "out of range" errors, widen the geofence radius in the event settings.
          </li>
          <li>
            <strong>Standalone codes</strong> — the <em>Admin → Codes</em> section is for ad-hoc
            single-use POP codes (gifts, prizes, raffle wins) that aren't tied to a specific
            event. Generate one per recipient.
          </li>
        </ul>
      </Section>

      <Section title="3. Signups & CRM">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Admin → Signups</strong> — every RSVP across every event. Use this on the day
            to check in guests.
          </li>
          <li>
            <strong>Admin → CRM</strong> — unified contact view (email, phone, socials, history).
            Tags drive blast audiences.
          </li>
          <li>
            <strong>Admin → Wallets</strong> — TXC wallets we've spun up for guests who didn't
            bring their own. You can look up a wallet by email/address; the recovery flow lives at{" "}
            <code>/recover-wallet</code> for the guest themselves.
          </li>
        </ul>
      </Section>

      <Section title="4. POP awards & reconciliation">
        <p>
          Every POP we owe — signup bonuses, claims, referrals, manual gifts — sits in{" "}
          <strong>Admin → POP awards</strong> as a row with a status:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Pending</strong> — recorded in our database, not yet on the TXC chain.
          </li>
          <li>
            <strong>Sent</strong> — the on-chain mint succeeded; the recipient sees it in their
            wallet.
          </li>
          <li>
            <strong>Failed</strong> — the chain rejected it (bad address, fee issue). Retry from
            the row or fix the recipient's wallet and re-queue.
          </li>
        </ul>
        <p>
          The dashboard shows totals for sent and pending so you can keep an eye on whether the
          mint queue is keeping up.
        </p>
      </Section>

      <Section title="5. Reward rules">
        <p>
          <strong>Admin → Rewards</strong> is where you set up activity-based rewards beyond the
          default signup/claim/referral. E.g. "follow on Instagram → 5 POP". Rules are
          self-serve — users complete the action in the app and POP is queued automatically.
        </p>
      </Section>

      <Section title="6. Email blasts">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Admin → Blast</strong> composes and sends a campaign. Pick the audience by
            event, tag, or "everyone".
          </li>
          <li>
            <strong>Admin → Blast → History</strong> shows past sends, open/click counts, and
            bounces.
          </li>
          <li>
            <strong>Admin → Email templates</strong> manages the transactional emails (welcome,
            event confirmation, recovery). Edits go live immediately.
          </li>
          <li>
            All email sends use the verified <code>notify.cryptopop.org</code> domain. Replies go
            to <code>hello@cryptopop.org</code>.
          </li>
        </ul>
      </Section>

      <Section title="Run-of-show checklist">
        <ol className="list-decimal space-y-2 pl-5">
          <li><strong>2 weeks out</strong> — create event, share RSVP link, print poster draft.</li>
          <li><strong>Week of</strong> — send a reminder blast to confirmed signups.</li>
          <li><strong>Day of</strong> — final poster printed, QR test-scanned, geofence radius double-checked on site.</li>
          <li><strong>During</strong> — keep <em>Admin → Signups</em> open at the door; watch <em>POP awards</em> for stuck mints.</li>
          <li><strong>After</strong> — reconcile pending awards, send a thank-you blast, tag attendees in CRM.</li>
        </ol>
      </Section>

      <p className="mt-12 font-mono text-xs text-muted-foreground">
        Looking for the participant-side flow? Read the{" "}
        <Link to="/docs/users" className="text-primary underline">
          user guide
        </Link>
        .
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
