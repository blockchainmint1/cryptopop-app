import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Button,
  Font,
} from '@react-email/components'

/**
 * Shared CryptoPOP-branded shell for auth emails.
 *
 * Body bg stays #ffffff per email best practice; the inner "card" is dark
 * ink with neon accents so the email reads on-brand without breaking
 * clients that strip backgrounds.
 */

export const BRAND = {
  ink: '#0B0712',
  inkSoft: '#15101F',
  bone: '#F5F5F5',
  pink: '#FF3DBE',
  cyan: '#00E5FF',
  purple: '#8B3DFF',
  lime: '#CCF695',
  mutedText: '#B7AECB',
  border: 'rgba(255, 255, 255, 0.08)',
}

const LOGO_URL =
  'https://cryptopop.org/cryptopop-logo.png' // best-effort; falls back to wordmark text

interface ShellProps {
  preview: string
  children: React.ReactNode
}

export const BrandShell = ({ preview, children }: ShellProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <Font
        fontFamily="Bebas Neue"
        fallbackFontFamily={["Helvetica","sans-serif"]}
        webFont={{
          url: 'https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2',
          format: 'woff2',
        }}
        fontWeight={400}
        fontStyle="normal"
      />
      <Font
        fontFamily="Poppins"
        fallbackFontFamily={["Helvetica","Arial","sans-serif"]}
        webFont={{
          url: 'https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrJJfecnFHGPc.woff2',
          format: 'woff2',
        }}
        fontWeight={400}
        fontStyle="normal"
      />
      <Font
        fontFamily="Poppins"
        fallbackFontFamily={["Helvetica","Arial","sans-serif"]}
        webFont={{
          url: 'https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLCz7Z1xlEA.woff2',
          format: 'woff2',
        }}
        fontWeight={600}
        fontStyle="normal"
      />
    </Head>
    <Preview>{preview}</Preview>
    <Body style={body}>
      <Container style={outer}>
        {/* Neon top stripe */}
        <Section style={stripe} />
        <Container style={card}>
          {/* Wordmark */}
          <Section style={{ textAlign: 'center', padding: '8px 0 24px' }}>
            <Text style={wordmark}>CRYPTOPOP</Text>
            <Text style={tagline}>Connect · Experience · Learn</Text>
          </Section>
          {children}
        </Container>
        <Section style={{ textAlign: 'center', padding: '24px 16px 8px' }}>
          <Text style={footerText}>
            © {new Date().getFullYear()} CryptoPOP ·{' '}
            <Link href="https://cryptopop.org" style={footerLink}>
              cryptopop.org
            </Link>
          </Text>
          <Text style={footerSmall}>
            You're receiving this because someone (hopefully you) used this
            email on CryptoPOP.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

interface CtaProps {
  href: string
  children: React.ReactNode
}
export const BrandCta = ({ href, children }: CtaProps) => (
  <Section style={{ textAlign: 'center', padding: '8px 0 24px' }}>
    <Button href={href} style={cta}>
      {children}
    </Button>
  </Section>
)

export const BrandHeading = ({ children }: { children: React.ReactNode }) => (
  <Text style={heading}>{children}</Text>
)

export const BrandBody = ({ children }: { children: React.ReactNode }) => (
  <Text style={bodyText}>{children}</Text>
)

export const BrandMuted = ({ children }: { children: React.ReactNode }) => (
  <Text style={muted}>{children}</Text>
)

export const BrandCode = ({ children }: { children: React.ReactNode }) => (
  <Section style={{ textAlign: 'center', padding: '4px 0 12px' }}>
    <Text style={code}>{children}</Text>
  </Section>
)

export const BrandLink = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) => (
  <Link href={href} style={link}>
    {children}
  </Link>
)

// ─── styles ───────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: 0,
  padding: '32px 16px',
  fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
}

const outer: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
}

const stripe: React.CSSProperties = {
  height: '6px',
  backgroundImage: `linear-gradient(90deg, ${BRAND.pink} 0%, ${BRAND.purple} 50%, ${BRAND.cyan} 100%)`,
  borderRadius: '8px 8px 0 0',
}

const card: React.CSSProperties = {
  backgroundColor: BRAND.ink,
  backgroundImage: `linear-gradient(180deg, ${BRAND.inkSoft} 0%, ${BRAND.ink} 100%)`,
  borderRadius: '0 0 16px 16px',
  padding: '36px 32px 32px',
  border: `1px solid ${BRAND.border}`,
  borderTop: 'none',
}

const wordmark: React.CSSProperties = {
  fontFamily: '"Bebas Neue", Impact, Helvetica, sans-serif',
  fontSize: '32px',
  letterSpacing: '0.18em',
  margin: 0,
  color: BRAND.bone,
  textAlign: 'center',
  lineHeight: 1,
}

const tagline: React.CSSProperties = {
  fontFamily: '"JetBrains Mono", "Courier New", monospace',
  fontSize: '10px',
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  color: BRAND.pink,
  margin: '8px 0 0',
  textAlign: 'center',
}

const heading: React.CSSProperties = {
  fontFamily: '"Bebas Neue", Impact, Helvetica, sans-serif',
  fontSize: '36px',
  lineHeight: 1.05,
  letterSpacing: '0.04em',
  color: BRAND.bone,
  margin: '8px 0 16px',
  textAlign: 'center',
  textTransform: 'uppercase',
}

const bodyText: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: 1.65,
  color: BRAND.bone,
  margin: '0 0 18px',
  textAlign: 'center',
}

const muted: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: 1.6,
  color: BRAND.mutedText,
  margin: '20px 0 0',
  textAlign: 'center',
}

const cta: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: BRAND.pink,
  backgroundImage: `linear-gradient(90deg, ${BRAND.pink} 0%, ${BRAND.purple} 100%)`,
  color: '#ffffff',
  fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
  fontSize: '14px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  borderRadius: '999px',
  padding: '14px 32px',
  textDecoration: 'none',
}

const code: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: '"JetBrains Mono", "Courier New", monospace',
  fontSize: '32px',
  letterSpacing: '0.4em',
  color: BRAND.cyan,
  backgroundColor: 'rgba(0, 229, 255, 0.08)',
  border: `1px solid rgba(0, 229, 255, 0.35)`,
  borderRadius: '12px',
  padding: '14px 24px',
  margin: 0,
}

const link: React.CSSProperties = {
  color: BRAND.cyan,
  textDecoration: 'underline',
}

const footerText: React.CSSProperties = {
  fontFamily: '"JetBrains Mono", "Courier New", monospace',
  fontSize: '11px',
  letterSpacing: '0.12em',
  color: '#9a93ad',
  margin: 0,
  textAlign: 'center',
  textTransform: 'uppercase',
}

const footerLink: React.CSSProperties = {
  color: BRAND.pink,
  textDecoration: 'none',
}

const footerSmall: React.CSSProperties = {
  fontSize: '11px',
  color: '#9a93ad',
  margin: '10px 0 0',
  textAlign: 'center',
  lineHeight: 1.5,
}
