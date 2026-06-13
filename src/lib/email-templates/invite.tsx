import * as React from 'react'
import {
  BrandShell,
  BrandHeading,
  BrandBody,
  BrandCta,
  BrandMuted,
  BrandLink,
} from './_brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  confirmationUrl,
}: InviteEmailProps) => (
  <BrandShell preview={`You've been invited to ${siteName}`}>
    <BrandHeading>You're invited</BrandHeading>
    <BrandBody>
      Someone just dropped you an invite to CryptoPOP — the home for
      connect-experience-learn moments in Web3. Claim your spot below.
    </BrandBody>
    <BrandCta href={confirmationUrl}>Accept invite</BrandCta>
    <BrandMuted>
      Or paste this into your browser:
      <br />
      <BrandLink href={confirmationUrl}>{confirmationUrl}</BrandLink>
    </BrandMuted>
  </BrandShell>
)

export default InviteEmail
