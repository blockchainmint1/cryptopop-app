/**
 * Promise-based "type your wallet password" prompt, used when Face ID /
 * fingerprint is required but its copy is missing or out of date. The dialog
 * component registers itself as the listener; the password is never stored.
 */
export interface PasswordRequest {
  reason: string;
  resolve: (password: string | null) => void;
}

let listener: ((r: PasswordRequest) => void) | null = null;

export function onPasswordRequest(fn: (r: PasswordRequest) => void): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

/** Resolves with the typed password, or null when cancelled / no dialog mounted. */
export function askForPassword(reason: string): Promise<string | null> {
  const fn = listener;
  if (!fn) return Promise.resolve(null);
  return new Promise((resolve) => fn({ reason, resolve }));
}
