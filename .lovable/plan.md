## Update `src/routes/l2-api.tsx` with what we learned from the failed mint

The mint that failed wasn't an Omni encoding bug — it was a **UTXO selection** bug. After a rapid mint, the issuer's only spendable coin was the change output from the previous mint, which was still **unconfirmed** in the mempool. Esplora's default `/address/:addr/utxo` response includes unconfirmed entries, but if a caller filters to `status.confirmed === true` (a very common pattern), the next mint sees "no UTXOs" and fails — even though there's plenty of TXC sitting on-chain. We also clarified what the `grantdata` arg actually is: not just a required-but-empty string, but an on-chain attribution memo embedded inside the Omni payload.

Two doc edits, both in the existing structure — no new sections, no restructuring.

### 1. Expand the existing "`grantdata` is not optional" gotcha (§8)

Currently it just says "pass an empty string." Add: it's actually a free-form attribution memo carried inside the Omni payload (separate from any OP_RETURN memo), capped at ~60 bytes in practice because the whole OP_RETURN must fit under the node's datacarrier size limit. Show both the empty form and a memo form:

```ts
rpc("omni_createpayload_grant", [propertyId, amount, ""]);                 // no memo
rpc("omni_createpayload_grant", [propertyId, amount, "claim:abc123"]);     // attribution memo
```

### 2. Add a new gotcha: "Chain your own change for back-to-back mints"

Sits in §8 alongside the others. Content:

- TXC blocks take real time; if you mint twice in quick succession the second mint's only available coin is the **unconfirmed change** from the first.
- Symptom: second mint fails with "issuer has no UTXOs" even though a block explorer shows the address is funded.
- Fix: when calling Esplora's `/address/:addr/utxo`, **do not filter out unconfirmed UTXOs**. Sort confirmed-first so settled coins are preferred, and only fall through to unconfirmed (your own change) when needed:

```ts
const utxos = raw
  .sort((a, b) => Number(b.status.confirmed) - Number(a.status.confirmed))
  .map(({ txid, vout, value }) => ({ txid, vout, value }));
```

- Caveat: spending unconfirmed change creates a chain. If the parent gets evicted or replaced, every child mint becomes invalid too. For high-throughput minting, either batch grants into one tx or pre-fund several issuer UTXOs.

### Out of scope

- No changes to `txc.server.ts` (already fixed last turn).
- No changes to the table of network params, Quickstart, or RPC reference — the new info fits cleanly into §8 Gotchas.
- No SEO/meta changes.