# TSD receiving-only connection

Wallet implementation follows the TSD project handoff (snapshot 38bb9883).

- Top up → Stablecoins opens the retained `https://tsd.honest.money/connect` popup.
- Exact sender origin/window, protocol, request, destination, known HME member, five-minute expiry and one-use challenge checks precede local consent signing.
- No keys, recovery phrases, spending authorization, or cash-out access leave the wallet.
- Current connection information stays in memory only; closing the panel/popup, locking/changing the wallet, or changing member requires reconnection.
- Progress refreshes every 30 seconds only while the panel and document are visible. Bridge errors and lost connections remove deposit instructions.
- Deposit UI uses only bridge-provided Ethereum/Base token contracts, decimals, limits, address and availability. It does not infer completion from a TSD payout transaction.

## Release blocker

On 2026-10-24, the public `/connect` returned HTTP 404. TSD must publish the new connection flow before a live member round trip can be verified.

TSD currently approves `https://cryptopop.org` and `https://app.cryptopop.org`; `https://wallet.cryptopop.org` and preview origins need explicit approval. Native WebViews may not support the retained-popup protocol; do not relax native navigation restrictions to work around this.

`TOPUP_DEPOSITS_ENABLED` remains false until live new-member/existing-member connections, correct destination binding, conflicts, and member identity are checked. Do not enable based only on mocked browser results.

## Verified without moving funds

- 54 wallet safety tests passed, including 14 new top-up tests.
- Controlled TSD popup on an unfunded, locally unlocked test wallet: explicit approval, real local signature verification, only the five protocol signature fields returned, 30-second progress refresh, pending status despite TSD delivery, hidden release-gated address, and reconnect after popup closure.
- Mobile and desktop screenshots reviewed; no browser runtime errors in that flow.

## Still unverified

Live HME sign-in within TSD, new/existing bridge accounts, destination conflict handling on TSD, native popup behavior, and a real settled deposit. Any financial test requires Bobby's separate approval for that specific test.