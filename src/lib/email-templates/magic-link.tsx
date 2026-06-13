import * as React from 'react'
import {
  BrandShell,
  BrandHeading,
  BrandBody,
  BrandCta,
  BrandMuted,
  BrandLink,
} from './_brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <BrandShell preview={`Your one-tap login link for ${siteName}`}>
    <BrandHeading>One tap, you're in</BrandHeading>
    <BrandBody>
      Click below to sign in to CryptoPOP. This link expires in a few
      minutes, so use it fresh.
    </BrandBody>
    <BrandCta href={confirmationUrl}>Sign me in</BrandCta>
    <BrandMuted>
      Or paste this into your browser:
      <br />
      <BrandLink href={confirmationUrl}>{confirmationUrl}</BrandLink>
    </BrandMuted>
    <BrandMuted>Didn't try to sign in? Safe to ignore.</BrandMuted>
  </BrandShell>
)

export default MagicLinkEmail
