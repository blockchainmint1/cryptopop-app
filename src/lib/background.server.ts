/**
 * Work that must happen after the customer's answer is already on its way.
 *
 * A card tap is a point-of-sale call: the terminal sits waiting for "paid"
 * before it prints a receipt. Nothing optional — a reward claim, a Telegram
 * alert — may hold that reply up. On this runtime a promise left running when
 * a response finishes can be frozen mid-flight, so we hand the work to the
 * platform's own "keep this request alive" hook instead of just abandoning it.
 */
import { AsyncLocalStorage } from "node:async_hooks";

type ExecutionContext = { waitUntil?: (p: Promise<unknown>) => void };

const store = new AsyncLocalStorage<ExecutionContext | undefined>();

/** Record the platform's context for everything handled inside `fn`. */
export function runWithExecutionContext<T>(ctx: unknown, fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(store.run((ctx ?? undefined) as ExecutionContext | undefined, fn));
}

/**
 * Run `task` once the response has been sent. Never blocks the caller and never
 * throws: if the platform hook is missing (local dev, or a context we couldn't
 * capture) the task still starts, and anything it didn't finish is picked up
 * later from the queue instead of being lost.
 */
export function afterResponse(task: () => Promise<unknown>, label = "background task") {
  const run = Promise.resolve().then(task).catch((e) => console.error(`[${label}]`, e));
  const ctx = store.getStore();
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(run);
}
