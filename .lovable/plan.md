## Use `SCAN_REWARD` env for the per-scan reward

### Changes

**`src/lib/qr.functions.ts`** — replace `const reward = Number(event.base_reward);` with:
```ts
const reward = Number(process.env.SCAN_REWARD ?? event.base_reward);
```
Validate it's a positive finite number; otherwise fall back to `event.base_reward`. This lets you tune the global scan reward via the secret without per-event edits.

### One-scan-per-user
Already enforced — `claimPop` checks for an existing `claims` row with the same `(user_id, event_id)` and returns `already_claimed`. No change needed.

### Out of scope
- DB schema, quiz/referral rewards, UI.

Approve and I'll wire it in.