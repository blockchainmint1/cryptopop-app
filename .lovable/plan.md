## What "wallet setup" actually does

When you sign in, `useEnsureWallet()` runs this sequence in the browser:

1. **`getOrCreateMnemonic()`** — reads `localStorage["cryptopop:mnemonic"]`. If absent or invalid, generates a fresh 12-word BIP39 mnemonic and stores it.
2. **`deriveTxcAddress(mnemonic)`** — pure crypto, no network:
   - `mnemonicToSeedSync` (bip39) → 64-byte seed
   - `BIP32Factory(ecc).fromSeed(seed).derivePath("m/44'/0'/0'/0/0")` → child key
   - `ripemd160(sha256(pubkey))` → HASH160
   - prepend TXC version byte `0x42`, base58check encode → `T…` address
3. **Supabase upsert** — `profiles.upsert({ id: user.id, wallet_address, updated_at })` with `onConflict: "id"`.
4. On success: `setAddress`, `setReady(true)`, `setSettingUp(false)`.
5. On any throw: catch block sets `address=null`, `ready=true`, `settingUp=false`, `error=<message>`.

The retry button calls `setAttempt(n+1)`, which re-runs the effect. That wiring is correct — so if clicking it does *nothing visible*, the effect IS re-running but failing again at the same step within ~ms, leaving the UI in the same state. (No spinner flash because the failure is synchronous-fast.)

## Why it's most likely failing

We don't yet know which step throws — the catch only does `console.error("[wallet] provisioning failed", e)` and we have no console logs captured. The likely culprits, in order:

1. **`Buffer is not defined`** in the browser. `bip39` / `bs58check` / `bip32` historically expect Node's `Buffer` global. Vite doesn't polyfill it by default. This is the #1 cause of "wallet setup fails silently the moment you load the app."
2. **`crypto.getRandomValues` unavailable** — only on insecure (http://) origins. Unlikely on `*.lovable.app` (https), but possible on a custom dev URL.
3. **Supabase upsert RLS denial** — RLS allows `INSERT` only when `auth.uid() = id`. If the session token isn't yet attached at the moment of upsert, this 401s. Less likely (you're already past auth gate), but possible.
4. **localStorage disabled** (private mode / iframe sandbox) — `getOrCreateMnemonic` would throw on `setItem`.

## Fix

### Step 1 — surface the actual error (1 file)

Edit `src/hooks/use-ensure-wallet.ts` catch block to log the failing **step** and the raw error message, and stash that on `error` so the UI shows it:

```ts
} catch (e) {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  console.error("[wallet] provisioning failed", { step, error: e });
  if (!cancelled) { setAddress(null); setReady(true); setSettingUp(false); setError(msg); }
}
```

…and track `step` (`"mnemonic" | "derive" | "read-profile" | "upsert"`) as we go.

### Step 2 — fix the most likely root cause preemptively

Add a Buffer polyfill so bip39/bs58check work in the browser. Two options:

- **Quick:** in `src/lib/wallet.ts` top-of-file: `import { Buffer } from "buffer"; if (typeof globalThis.Buffer === "undefined") globalThis.Buffer = Buffer;` (the `buffer` package ships with Vite via `node_modules`).
- **Cleaner:** add `vite-plugin-node-polyfills` to `vite.config.ts` with `{ globals: { Buffer: true } }`.

I'll go with the quick inline polyfill — it's one import, no config changes, and only loads when `wallet.ts` is imported.

### Step 3 — show the real error in the UI

In `_authenticated.app.tsx`, replace the generic "Wallet setup failed. Tap retry…" with the actual `walletError` string (truncated). That way if it fails again you'll see *why* without opening DevTools.

### Step 4 — verify

After the fix, sign out + back in (or hard reload). Expected: address derives in <100ms and the "Scan to Earn" button replaces the retry. If it still fails, the toast/inline message will name the failing step.

## Files touched

- `src/hooks/use-ensure-wallet.ts` — track `step`, expose detailed error.
- `src/lib/wallet.ts` — Buffer polyfill at top of file.
- `src/routes/_authenticated.app.tsx` — show `walletError` text inline.

## Out of scope

- Switching crypto libs (e.g. to `@scure/bip39`) — only if Buffer polyfill doesn't fix it.
- Any DB / RLS changes.
