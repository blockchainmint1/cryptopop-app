# YOU GOT POP 🎉

Turn the success screen into a loud, joyful celebration using the CryptoPOP logo, then bounce the user back to their wallet automatically. Also fix the spinner-stuck bug on the scan page.

## What changes

### 1. New celebration page (`/scan/success`)
Replace the current minimal success card with a full-screen, goofy, colorful "YOU GOT POP!" moment:

- **Big bouncy logo**: CryptoPOP logo (`src/assets/cryptopop-logo.png`) center-screen, scales in with a springy bounce, then wobbles continuously.
- **Confetti burst**: multi-color confetti explosion on mount (using `canvas-confetti`, ~12KB, no React deps), fired 2–3 times in quick succession for maximum goof.
- **Headline**: "YOU GOT POP!" in huge display font, each letter staggered in with a rainbow color cycle.
- **Reward chip**: floating "+N POP" badge that pops in with overshoot scale, plus event name underneath.
- **New balance** shown smaller below.
- **Background**: animated gradient (pink → orange → yellow → mint) that slowly shifts — much more colorful than the current subtle primary tint.
- **Floating emoji/sparkles** drifting up in the background for ambient goof.
- **Dismiss "X" button** top-right that cancels the auto-redirect and stays on the page.
- **Manual buttons** at the bottom: "Scan another" + "Back to wallet" (preserved from current design).

### 2. Auto-redirect with countdown
- 5-second countdown after mount; redirects to `/app`.
- Subtle progress bar or "Returning to wallet in 5…4…3…" text at the bottom.
- Clicking the X button (or either CTA) cancels the timer.

### 3. Fix the scanner getting stuck
Two robustness fixes in `src/routes/_authenticated.scan.tsx`:
- **Hard-stop on first hit**: unmount the `<Scanner>` (conditional render) the moment we have a QR value, so the camera feed and `onScan` loop stop immediately. Today the spinner sits over a still-running scanner.
- **Always recover from navigation failures**: wrap the `navigate(...)` call so any error (e.g. search-param validation mismatch) flips `busy` back off and shows a toast instead of a permanent spinner.
- **Loosen success search validation**: change `z.string()` for `event` to `z.string().catch("Event")` and `z.coerce.number().catch(0)` for the numbers, so a slightly off payload from the server still lands on the celebration page.

## Technical notes

- Add dependency: `canvas-confetti` + `@types/canvas-confetti`.
- All animation via CSS keyframes + Tailwind `animate-*` (no framer-motion needed for this).
- Logo bounce/wobble: a custom `@keyframes` pair in `src/styles.css`.
- Auto-redirect uses `useEffect` + `setTimeout` + `useNavigate`; cleanup on unmount and on dismiss.
- Honor `prefers-reduced-motion`: skip confetti and continuous wobble, keep the static page + redirect.
- No backend changes. No on-chain changes. Pure frontend celebration + bug fix.

## On-chain minting answer (no change needed)
Just confirming: `claimPop` already mints real TXC to the user's wallet via `mintGrant`, then sets `claims.status = "minted"` with the on-chain `tx_hash`. The 100 POP balance you see is backed by an actual on-chain transaction — the `pop_balance_mirror` row is just a fast-read mirror of the chain state.
