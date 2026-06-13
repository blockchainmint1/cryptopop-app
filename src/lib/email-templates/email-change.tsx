import * as React from 'react'
import {
  BrandShell,
  BrandHeading,
  BrandBody,
  BrandCta,
  BrandMuted,
  BrandLink,
} from './_brand'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <BrandShell preview="Confirm your new CryptoPOP email">
    <BrandHeading>Confirm your new email</BrandHeading>
    <BrandBody>
      You asked to move your CryptoPOP account from{' '}
      <strong>{oldEmail}</strong> to <strong>{newEmail}</strong>. Tap below
      to lock it in.
    </BrandBody>
    <BrandCta href={confirmationUrl}>Confirm email change</BrandCta>
    <BrandMuted>
      Or paste this into your browser:
      <br />
      <BrandLink href={confirmationUrl}>{confirmationUrl}</BrandLink>
    </BrandMuted>
    <BrandMuted>
      Didn't request this change? Ignore the email — nothing will move.
    </BrandMuted>
  </BrandShell>
)

export default EmailChangeEmail
