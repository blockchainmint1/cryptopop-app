// Arcade player identity for the login-free wallet: a random id kept on this
// device. It only tracks game progress — never wallet keys or balances.
import { useServerFn } from "@tanstack/react-start";

const KEY = "cryptopop.arcade.player";

export function arcadePlayerId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** useServerFn that adds this device's player id to every arcade call. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePlayerFn<T extends (...args: any[]) => any>(fn: T): (opts?: { data?: Record<string, unknown> }) => ReturnType<T> {
  const call = useServerFn(fn) as unknown as (o: { data: Record<string, unknown> }) => ReturnType<T>;
  return (opts) => call({ data: { ...(opts?.data ?? {}), player: arcadePlayerId() } });
}
