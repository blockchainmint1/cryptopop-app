import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/cryptopop-logo.png";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — CryptoPOP" },
      {
        name: "description",
        content:
          "Terms of Service for CryptoPOP, a proof-of-participation wallet.",
      },
      { property: "og:title", content: "Terms of Service — CryptoPOP" },
      {
        property: "og:description",
        content: "The terms that govern your use of CryptoPOP.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const updated = "May 14, 2026";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="CryptoPOP" className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition">
              Privacy
            </Link>
            <Link to="/api" className="hover:text-foreground transition">
              API
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Legal · Singapore
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated: {updated}</p>

        <Section title="1. About CryptoPOP">
          <p>
            CryptoPOP ("we", "us", "our") is a proof-of-participation wallet that lets
            you collect POP by attending real-world events in Singapore and
            beyond. The service is operated from Singapore. By using CryptoPOP you
            agree to these Terms.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            You must be at least 18 years old, or the age of legal majority in your
            jurisdiction, to use CryptoPOP. By using the service you represent that
            you can lawfully enter into this agreement.
          </p>
        </Section>

        <Section title="3. Your account and wallet">
          <p>
            CryptoPOP issues you a non-custodial TXC wallet tied to your sign-in.
            You are responsible for safeguarding access to the email or social account
            you use to sign in. We do not have the ability to recover lost POP
            sent to incorrect addresses or accessed by unauthorised third parties.
          </p>
        </Section>

        <Section title="4. POP">
          <p>
            POP is a non-monetary participation token issued on the Texitcoin (TXC)
            Omni Layer. POP has no cash value, is not redeemable for currency, and is
            not a security, e-money, deposit, or financial instrument. We make no
            promise that POP will retain any utility or that any third party will
            accept it.
          </p>
        </Section>

        <Section title="5. Acceptable use">
          <p>You agree not to:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>Spoof your location or otherwise game the geofence to claim POP you didn't earn.</li>
            <li>Use bots, scripts, or multiple accounts to claim a single event reward.</li>
            <li>Resell, repackage, or misrepresent POP as an investment product.</li>
            <li>Interfere with the service, our infrastructure, or the TXC network.</li>
            <li>Use CryptoPOP for any unlawful purpose under Singapore law.</li>
          </ul>
        </Section>

        <Section title="6. Events and third parties">
          <p>
            Events are organised by third-party hosts. We are not responsible for the
            conduct, safety, or representations of event organisers or attendees.
            Reward amounts, eligibility windows, and geofence boundaries are set by
            the organiser and may change without notice.
          </p>
        </Section>

        <Section title="7. Service availability">
          <p>
            CryptoPOP is provided "as is" and "as available". We may modify, suspend,
            or discontinue any part of the service at any time. On-chain transactions,
            once broadcast, are irreversible.
          </p>
        </Section>

        <Section title="8. Disclaimers">
          <p>
            To the maximum extent permitted by law, we disclaim all warranties,
            express or implied, including merchantability, fitness for a particular
            purpose, and non-infringement. We do not warrant that the service will be
            uninterrupted, secure, or error-free.
          </p>
        </Section>

        <Section title="9. Limitation of liability">
          <p>
            To the maximum extent permitted by law, our total liability arising out
            of or relating to your use of CryptoPOP will not exceed SGD 100. We are
            not liable for indirect, incidental, special, consequential, or punitive
            damages, or for loss of POP, profits, data, or goodwill.
          </p>
        </Section>

        <Section title="10. Changes to these Terms">
          <p>
            We may update these Terms from time to time. Material changes will be
            posted on this page with a new "Last updated" date. Continued use after
            changes take effect means you accept the revised Terms.
          </p>
        </Section>

        <Section title="11. Governing law">
          <p>
            These Terms are governed by the laws of Singapore. Any dispute arising
            out of or in connection with these Terms, including any question of
            existence, validity, or termination, shall be referred to and finally
            resolved by the Singapore International Arbitration Centre (SIAC) in
            accordance with its rules in force at the time. The seat of arbitration
            shall be Singapore and the language shall be English.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            Questions about these Terms? Email{" "}
            <a className="underline hover:text-foreground" href="mailto:hello@cryptopop.sg">
              hello@cryptopop.sg
            </a>
            .
          </p>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}
