# POP Wallet x NectarPay

Events stay exactly as they are. This plan only adds NectarPay features to the wallet.

## What the user gets

1. **Tap-to-pay at NectarPay merchants.** Scan a NectarPay checkout QR (on a terminal, or a link like `/i/<invoice>`). The wallet shows the store name, logo and amount in TSD. One tap (plus fingerprint or face unlock) pays it. The screen then waits for NectarPay to confirm: "Paid ✓ at Store Name".
2. **Receipts.** Each NectarPay payment is saved as a receipt with store, amount, time, invoice number and a link to NectarPay's receipt. Recent transactions show the store name instead of a raw address. Receipts stay private on the phone, like today's labels.
3. **POP for shopping.** A confirmed NectarPay payment earns POP (for example 1 POP per $1, set by us). It is sent to the wallet after NectarPay confirms the payment, and counted only once per invoice.
4. **Merchant directory.** A new "Spend TSD" tile opens a list and map of NectarPay stores that accept TSD, sorted by distance, with a filter for the selected POP Market.
5. **Sign in with wallet.** On NectarPay's login screen, scan the "Sign in with wallet" QR. The wallet asks "Sign in to NectarPay as T…xyz?" and signs with your key on the phone. Your key never leaves the device.

## What NectarPay needs (small additions in that project)

- A public invoice lookup the wallet can read: store name, logo, amount, TSD address, status (pending, paid or expired). The hosted-pay endpoint may already cover this.
- A public merchant list endpoint built on the existing map-pins data, limited to stores that accept TSD.
- A signed "invoice paid" webhook sent to the wallet backend, used to trigger the POP reward.
- Confirmation of the exact message and QR format for wallet sign-in, so our signing matches it.

Once you approve, I'll handle the wallet side here and write out the matching NectarPay changes for you.

## Technical details

- `scan-parse.ts`: new `nectarpay_invoice` intent (NectarPay `/i/<id>` URLs, `v1/pay/<id>` links, and BIP21 with `invoice=` / `order=` / `store=`) and a `wallet_login` intent (NectarPay wallet-challenge envelope).
- `nectarpay.functions.ts`: server functions `getInvoice`, `getInvoiceStatus` (polled every 3 seconds after broadcast; TSD settles instantly up to the store's limit) and `listMerchants` (cached 5 minutes). `NECTARPAY_ORIGIN` goes in config.
- Send sheet: invoice mode locks the amount, address and asset. On success it saves a receipt (tx-labels extended with invoiceId, storeId, logo and receiptUrl) and opens a "waiting for merchant" state.
- Rewards: `/api/public/nectarpay-paid` checks the HMAC signature (new shared secret `NECTARPAY_WEBHOOK_SECRET`, requested later) and records a `pop_awards` row with source `nectarpay` and source_id set to the invoice id, so each invoice pays out once. Minting uses the existing mint lock. The POP rate is stored in `reward_rules` under the key `nectarpay_purchase`.
- Sign-in: sign the challenge message with the device key via `wallet/sign.ts` (Bitcoin-style message signing using TXC's magic prefix), then POST it to NectarPay's wallet-callback.
- UI: "Spend TSD" tile next to the Events and Earn tiles; new `/merchants` page with a list, plus the Google Maps view we already have. Checked at mobile width first.
