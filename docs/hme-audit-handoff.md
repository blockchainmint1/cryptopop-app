# CryptoPOP audit: Honest Money handoff

## Already supported and verified
- CryptoPOP's stable site code is `pop-wallet`.
- The saved site-specific `HME_ECOSYSTEM` key successfully fetched 35 trusted sites, and their response signature verified.
- The current HME API documents tickets with `iss: "honest.money"` and `site: "pop-wallet"`, signed using our unique site key. CryptoPOP now rejects other issuers/sites, stale tickets, and reused nonces; no legacy shared-key fallback is accepted.
- Tracking and backup requests now use the unique site key plus `X-HME-Site: pop-wallet`, consistent with the updated API contract.

## Please confirm or change
1. Confirm `app.cryptopop.org` and `wallet.cryptopop.org` are enabled for the `pop-wallet` site and that its key retains member sign-in, member activity reporting, trusted-site read, and backup save/restore/delete/status permissions.
2. Return the one-time backup approval as `#hm_backup_pass=...` instead of a query parameter. CryptoPOP already accepts and promptly strips the fragment; query support remains temporarily for compatibility. Do the same for SSO tickets when both clients support it.
3. For stronger separation, offer purpose-specific subkeys for SSO signing, registry verification, activity reporting, and backups. Current HME documentation mandates one unique per-site key, which fixes cross-site key sharing but not separation among purposes within the same site. Do not change the protocol without coordinated deployment.
4. Confirm registry publication permissions, exact-host approval, change auditing, and key rotation procedures. CryptoPOP rejects arbitrary hosts and never trusts locally edited registry data.

## Verification still needed
A real member sign-in and backup save/restore/delete round trip on both approved wallet addresses. Successful registry access does not prove these separate flows work.

## Legacy wallet reconciliation
CryptoPOP disabled all server-derived wallet creation/key export and stopped awards to email-managed addresses. There are 135 historical email-wallet records and 121 historical encrypted backups; record counts are not funded balances. These remain protected for an ownership-verified balance reconciliation and controlled migration, not ordinary sign-in recovery. No keys or funds have been exported or swept during these fixes.

## Tracking policy
No third-party tracking scripts on this wallet origin, including its homepage, settings, sign-in, backup, claims, and payments. Marketing script placement belongs on the separate marketing site. Referral codes can be captured locally without loading remote JavaScript; deliberate server-side member activity reporting remains separate.