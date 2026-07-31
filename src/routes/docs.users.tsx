import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/users")({
  head: () => ({
    meta: [
      { title: "User guide — CryptoPOP" },
      {
        name: "description",
        content:
          "Sign up for CryptoPOP events, claim POP rewards, refer friends, and access your TXC wallet.",
      },
    ],
  }),
  component: UserDocs,
});

function UserDocs() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Docs · For event-goers
      </p>
      <h1 className="mt-3 font-display text-5xl font-bold tracking-tight">User guide</h1>
      <p className="mt-4 text-muted-foreground">
        Everything you need to participate in CryptoPOP events and earn POP.
      </p>

      <Section title="What is POP?">
        <p>
          POP stands for <em>Proof of Participation</em>. It's a small on-chain token on the TXC
          network that records you were present at a CryptoPOP event. POP are <strong>not</strong>{" "}
          an investment and have no resale market — they're a participation record, the same way a
          stamp in a passport records that you visited a country.
        </p>
      </Section>

      <Section title="1. Sign up for an event">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Open the event link (you'll usually get it from the host, or find it on the CryptoPOP
            home page).
          </li>
          <li>Fill in your name, email, and mobile number. Add an Instagram or Telegram handle if you'd like.</li>
          <li>
            Optional — paste an existing TXC wallet address. If you leave it blank, we spin up a
            wallet for you and email you a recovery link.
          </li>
          <li>Submit. You'll instantly earn 10 POP as a signup bonus.</li>
        </ol>
      </Section>

      <Section title="2. Claim POP at the event">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            At the event, look for the CryptoPOP poster — it has a QR code.
          </li>
          <li>
            Scan it with your phone camera. You'll be sent to the claim page.
          </li>
          <li>
            Allow location access when prompted. Claims only work inside the event's geofence and
            within the event's time window — this stops people from claiming from home.
          </li>
          <li>
            Tap claim. POP lands in your wallet within seconds.
          </li>
        </ol>
      </Section>

      <Section title="3. Refer friends">
        <p>
          After you sign up you get a personal referral link. Every friend who signs up through your
          link earns you bonus POP, set per-event by the host. Share it on socials or in your group
          chat.
        </p>
      </Section>

      <Section title="4. Your wallet">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>My POP</strong> — see your current balance and full history of claims and
            referrals.
          </li>
          <li>
            <strong>My Pass</strong> — your event pass and the POP you earned at each event.
          </li>
          <li>
            <strong>Recover wallet</strong> — if you signed up without your own TXC address, this is
            where you can export the wallet we created for you. Keep the recovery phrase somewhere
            safe; we can't recover it for you.
          </li>
        </ul>
      </Section>

      <Section title="Troubleshooting">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>"Out of range"</strong> when claiming — you're outside the event's geofence.
            Move closer to the venue and try again.
          </li>
          <li>
            <strong>"Event hasn't started"</strong> — the QR poster has a short pre-event window. If
            it's not open yet, wait until start time.
          </li>
          <li>
            <strong>Didn't get a confirmation email</strong> — check spam. If it's not there, reach
            out to the host or email <a className="text-primary underline" href="mailto:hello@cryptopop.org">hello@cryptopop.org</a>.
          </li>
        </ul>
      </Section>

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
