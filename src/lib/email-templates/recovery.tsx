import * as React from 'react'
import {
  BrandShell,
  BrandHeading,
  BrandBody,
  BrandCta,
  BrandMuted,
  BrandLink,
} from './_brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <BrandShell preview={`Reset your ${siteName} password`}>
    <BrandHeading>Reset your password</BrandHeading>
    <BrandBody>
      We got a request to reset the password for your CryptoPOP account.
      Tap the button below to pick a new one. Link expires soon.
    </BrandBody>
    <BrandCta href={confirmationUrl}>Reset password</BrandCta>
    <BrandMuted>
      Or paste this into your browser:
      <br />
      <BrandLink href={confirmationUrl}>{confirmationUrl}</BrandLink>
    </BrandMuted>
    <BrandMuted>
      Didn't ask for this? Ignore it — your password stays the same.
    </BrandMuted>
  </BrandShell>
)

export default RecoveryEmail
