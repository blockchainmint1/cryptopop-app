import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'CryptoPOP'
const SITE_URL = 'https://cryptopop.sg'

interface EventConfirmationProps {
  name?: string
  passId?: string
  eventName?: string
  eventDate?: string
  venueName?: string
  venueAddress?: string
  mapUrl?: string
  popCredits?: number
}

const EventConfirmationEmail = ({
  name,
  passId,
  eventName = 'Red, White & Barbecue — USA 250ᵗʰ',
  eventDate = 'Saturday, 4 July 2026 · 11am – 4pm',
  venueName = 'ONE°15 Marina, Sentosa Cove',
  venueAddress = '11 Cove Drive, Sentosa Cove, Singapore 098497',
  mapUrl = 'https://www.google.com/maps/place/ONE%C2%B015+Marina+Sentosa+Cove,+Singapore/@1.2462,103.8378,17z',
  popCredits = 10,
}: EventConfirmationProps) => {
  const passUrl = passId
    ? `${SITE_URL}/my-pass?id=${passId}`
    : `${SITE_URL}/my-pass`
  const qrUrl = passId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=${encodeURIComponent(passId)}`
    : `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=cryptopop`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You're in for {eventName}. Your pass + QR are inside.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brandText}>CRYPTOPOP</Text>
            <Text style={brandTag}>Connect · Experience · Learn</Text>
          </Section>

          <Heading style={h1}>
            {name ? `You're in, ${name}.` : `You're in.`}
          </Heading>
          <Text style={lead}>
            Your spot at <strong>{eventName}</strong> is confirmed. We've
            credited <strong>{popCredits} POP</strong> to your account — see
            you on the day.
          </Text>

          <Section style={card}>
            <Text style={cardLabel}>EVENT</Text>
            <Text style={cardTitle}>{eventName}</Text>
            <Hr style={hr} />
            <Text style={cardLabel}>WHEN</Text>
            <Text style={cardValue}>{eventDate}</Text>
            <Hr style={hr} />
            <Text style={cardLabel}>WHERE</Text>
            <Text style={cardValue}>
              {venueName}
              <br />
              {venueAddress}
            </Text>
            <Link href={mapUrl} style={mapLink}>
              Open in Google Maps →
            </Link>
          </Section>

          <Section style={qrCard}>
            <Text style={cardLabel}>YOUR CHECK-IN PASS</Text>
            <Img
              src={qrUrl}
              width="240"
              height="240"
              alt="Your CryptoPOP check-in QR"
              style={qrImg}
            />
            <Text style={qrCaption}>
              Show this QR at the door. We'll scan it to check you in.
            </Text>
            <Button href={passUrl} style={primaryBtn}>
              Open my pass
            </Button>
          </Section>

          <Heading as="h2" style={h2}>
            Set up the CryptoPOP app
          </Heading>
          <Text style={text}>
            Sign in with the same email at{' '}
            <Link href={`${SITE_URL}/login`} style={link}>
              cryptopop.sg/login
            </Link>{' '}
            — it's magic-link, no password. Inside you'll see all your events,
            your live POP balance, and your check-in QR on the go. Your sandbox
            wallet is auto-backed up to your account — recover it any time from{' '}
            <Link href={`${SITE_URL}/recover-wallet`} style={link}>
              Recover wallet
            </Link>
            .
          </Text>

          <Heading as="h2" style={h2}>
            Getting there
          </Heading>
          <Text style={text}>
            <strong>Taxi / Grab:</strong> ~20 min from the city. Tell the
            driver "ONE°15 Marina, Sentosa Cove" — they'll know it. No Sentosa
            entry charge for drop-off.
            <br />
            <br />
            <strong>MRT:</strong> Take the NE / CC line to HarbourFront, then
            grab a taxi (~10 min). The Sentosa Express doesn't reach the Cove
            — taxi is the move.
            <br />
            <br />
            <strong>Parking:</strong> Open-air parking is available at the
            marina. Arrive 15 min early on the day — Sentosa Cove can back up.
          </Text>

          <Heading as="h2" style={h2}>
            What to expect on the day
          </Heading>
          <Text style={text}>
            • Doors open <strong>11am sharp</strong>. Head to the CryptoPOP
            check-in tent at the marina entrance.
            <br />
            • Dress code: <strong>red, white & blue</strong> if you're feeling
            it — otherwise smart-casual.
            <br />
            • BBQ + drinks all afternoon, live music, face painting for the
            kids, and complimentary exploratory yacht charters (first-come,
            first-served — sign up on arrival).
            <br />
            • Pick up bonus POP for activities. Bring a friend? Both of you
            earn extra.
          </Text>

          <Heading as="h2" style={h2}>
            Need to make a change?
          </Heading>
          <Text style={text}>
            Plans shifted? Just reply to this email and we'll sort the edit
            or cancellation for you — no fuss.
          </Text>

          <Section style={socialRow}>
            <Link href="https://instagram.com/cryptopop" style={socialLink}>
              Instagram
            </Link>
            <Text style={socialDot}>·</Text>
            <Link href="https://t.me/cryptopop" style={socialLink}>
              Telegram
            </Link>
            <Text style={socialDot}>·</Text>
            <Link href={SITE_URL} style={socialLink}>
              cryptopop.sg
            </Link>
          </Section>

          <Text style={footer}>
            {SITE_NAME} · Education-only · POP are a participation record, not
            money.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EventConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `You're in${data?.name ? `, ${data.name}` : ''} — ${data?.eventName ?? 'CryptoPOP event'} confirmed`,
  displayName: 'Event confirmation',
  previewData: {
    name: 'Jane',
    passId: '00000000-0000-0000-0000-000000000000',
    eventName: 'Red, White & Barbecue — USA 250ᵗʰ',
    eventDate: 'Saturday, 4 July 2026 · 11am – 4pm',
    venueName: 'ONE°15 Marina, Sentosa Cove',
    venueAddress: '11 Cove Drive, Sentosa Cove, Singapore 098497',
    mapUrl:
      'https://www.google.com/maps/place/ONE%C2%B015+Marina+Sentosa+Cove,+Singapore/@1.2462,103.8378,17z',
    popCredits: 10,
  },
} satisfies TemplateEntry

// Styles — body must be white per Lovable email guidance.
const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  color: '#1a1024',
  margin: 0,
  padding: 0,
}
const container = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '32px 24px',
}
const brandBar = {
  textAlign: 'center' as const,
  padding: '20px 0 28px',
  borderBottom: '1px solid #eeeaf3',
  marginBottom: '32px',
}
const brandText = {
  fontFamily: "'Bebas Neue', Impact, Arial Black, sans-serif",
  fontSize: '28px',
  letterSpacing: '4px',
  margin: 0,
  color: '#1a1024',
}
const brandTag = {
  fontSize: '10px',
  letterSpacing: '3px',
  textTransform: 'uppercase' as const,
  color: '#8a7da0',
  margin: '6px 0 0',
}
const h1 = {
  fontFamily: "'Bebas Neue', Impact, sans-serif",
  fontSize: '38px',
  lineHeight: '1.1',
  margin: '0 0 16px',
  color: '#1a1024',
  letterSpacing: '1px',
}
const h2 = {
  fontFamily: "'Bebas Neue', Impact, sans-serif",
  fontSize: '22px',
  lineHeight: '1.2',
  margin: '32px 0 12px',
  color: '#1a1024',
  letterSpacing: '1px',
}
const lead = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#2a1f3a',
  margin: '0 0 24px',
}
const text = {
  fontSize: '14px',
  lineHeight: '1.65',
  color: '#3a2f4a',
  margin: '0 0 16px',
}
const card = {
  backgroundColor: '#faf7ff',
  border: '1px solid #ebe0ff',
  borderRadius: '14px',
  padding: '20px 22px',
  margin: '8px 0 24px',
}
const cardLabel = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '10px',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  color: '#8a7da0',
  margin: '0 0 6px',
}
const cardTitle = {
  fontFamily: "'Bebas Neue', Impact, sans-serif",
  fontSize: '20px',
  margin: '0 0 4px',
  color: '#1a1024',
  letterSpacing: '0.5px',
}
const cardValue = {
  fontSize: '14px',
  lineHeight: '1.5',
  color: '#2a1f3a',
  margin: '0 0 8px',
}
const hr = {
  borderColor: '#ebe0ff',
  borderStyle: 'solid',
  borderWidth: '0 0 1px',
  margin: '14px 0',
}
const mapLink = {
  fontSize: '13px',
  color: '#FF3DBE',
  textDecoration: 'none',
  fontWeight: 600,
}
const qrCard = {
  backgroundColor: '#0F0820',
  borderRadius: '16px',
  padding: '28px 20px',
  textAlign: 'center' as const,
  margin: '0 0 28px',
}
const qrImg = {
  display: 'block',
  margin: '12px auto',
  borderRadius: '12px',
  backgroundColor: '#ffffff',
  padding: '10px',
}
const qrCaption = {
  fontSize: '13px',
  color: '#CCC0E0',
  margin: '6px 0 18px',
}
const primaryBtn = {
  backgroundColor: '#FF3DBE',
  color: '#ffffff',
  fontFamily: "'Bebas Neue', Impact, sans-serif",
  fontSize: '15px',
  letterSpacing: '2px',
  padding: '14px 28px',
  borderRadius: '999px',
  textDecoration: 'none',
  display: 'inline-block',
}
const link = {
  color: '#8B3DFF',
  textDecoration: 'underline',
}
const socialRow = {
  textAlign: 'center' as const,
  margin: '36px 0 12px',
}
const socialLink = {
  fontSize: '13px',
  color: '#8B3DFF',
  textDecoration: 'none',
  fontWeight: 600,
  display: 'inline',
}
const socialDot = {
  display: 'inline',
  color: '#8a7da0',
  margin: '0 8px',
}
const footer = {
  fontSize: '11px',
  color: '#8a7da0',
  textAlign: 'center' as const,
  margin: '20px 0 0',
  letterSpacing: '0.5px',
}
