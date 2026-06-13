import * as React from 'react'
import {
  BrandShell,
  BrandHeading,
  BrandBody,
  BrandCta,
  BrandMuted,
  BrandLink,
} from './_brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <BrandShell preview={`Confirm your email and unlock ${siteName}`}>
    <BrandHeading>Welcome to the POP</BrandHeading>
    <BrandBody>
      One tap to confirm <strong>{recipient}</strong> and your CryptoPOP
      account is live — events, rewards, and the whole community open up.
    </BrandBody>
    <BrandCta href={confirmationUrl}>Confirm my email</BrandCta>
    <BrandMuted>
      Button not playing nice? Paste this into your browser:
      <br />
      <BrandLink href={confirmationUrl}>{confirmationUrl}</BrandLink>
    </BrandMuted>
    <BrandMuted>
      Didn't sign up? Ignore this — no account gets created.
    </BrandMuted>
  </BrandShell>
)

export default SignupEmail
