import * as React from 'react'
import {
  BrandShell,
  BrandHeading,
  BrandBody,
  BrandCode,
  BrandMuted,
} from './_brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <BrandShell preview="Your CryptoPOP verification code">
    <BrandHeading>Verify it's you</BrandHeading>
    <BrandBody>Enter this code in CryptoPOP to confirm your identity.</BrandBody>
    <BrandCode>{token}</BrandCode>
    <BrandMuted>
      Code expires shortly. Didn't ask for it? You can safely ignore this
      email.
    </BrandMuted>
  </BrandShell>
)

export default ReauthenticationEmail
