
- NectarPay calls go through src/lib/nectarpay.functions.ts (server-side proxy) — avoids CORS and lets POP rewards be verified with NectarPay before minting.
- Merchant/community rewards ledger lives in `reward_programs` + `reward_ledger` (database is authoritative, keyed by wallet address); logic in `src/lib/store-rewards.server.ts`. Why: non-custodial wallet has no login, and NectarPay only needs to confirm payments.
