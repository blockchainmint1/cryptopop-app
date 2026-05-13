## Make the TXC token ID configurable

Right now `src/lib/txc.server.ts` hard-codes `PROPERTY_ID = 19` ("NestB"). To make it easy to swap to your real token at go-live without a code change, read it from an env var.

### Changes

1. **Add secret** `TXC_TOKEN_ID` (you said you'd add it; I'll request via the secrets tool so the input form pops up).
2. **`src/lib/txc.server.ts`** — replace the constant with:
   ```ts
   const PROPERTY_ID = Number(process.env.TXC_TOKEN_ID ?? 19);
   ```
   Read it inside the handler call paths (not at module top level) so the Worker picks up the runtime value. Validate it's a positive integer; throw a clear error otherwise.
3. Update the comment at the top of the file to note the token id is env-driven.

### Out of scope
- No DB / UI changes.
- Mint amount, recipient address, and `MINTER_WIF` stay as they are.

Once you approve, I'll prompt for the secret and wire it in.