import { describe, it, expect, vi } from "vitest";
import { afterResponse, afterResponseWithin, runWithExecutionContext } from "./background.server";

describe("work that waits for the reply", () => {
  it("hands the task to the platform instead of holding up the answer", async () => {
    const kept: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => kept.push(p) };
    let done = false;

    await runWithExecutionContext(ctx, async () => {
      afterResponse(async () => { done = true; }, "test");
      expect(done).toBe(false);      // the caller is not waiting on it
      expect(kept).toHaveLength(1);  // ...but the platform is told to finish it
    });

    await kept[0];
    expect(done).toBe(true);
  });

  it("still runs the task when there is no platform context (local dev)", async () => {
    let done = false;
    afterResponse(async () => { done = true; }, "test");
    expect(done).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toBe(true);
  });

  it("a task that blows up never reaches the payment", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const kept: Promise<unknown>[] = [];
    await runWithExecutionContext({ waitUntil: (p: Promise<unknown>) => kept.push(p) }, async () => {
      afterResponse(async () => { throw new Error("boom"); }, "test");
    });
    await expect(kept[0]).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("bounded work starts immediately and returns after exactly 1.5 seconds when stuck", async () => {
    vi.useFakeTimers();
    try {
      let started = false;
      let returned = false;
      const pending = afterResponseWithin(() => {
        started = true;
        return new Promise(() => {});
      }, 1500, "test").then(() => { returned = true; });

      await vi.advanceTimersByTimeAsync(0);
      expect(started).toBe(true);
      expect(returned).toBe(false);
      await vi.advanceTimersByTimeAsync(1499);
      expect(returned).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(returned).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("bounded work keeps the same task alive on the platform", async () => {
    const kept: Promise<unknown>[] = [];
    let done = false;
    await runWithExecutionContext({ waitUntil: (p: Promise<unknown>) => kept.push(p) }, async () => {
      await afterResponseWithin(async () => { done = true; }, 1500, "test");
    });
    expect(kept).toHaveLength(1);
    await expect(kept[0]).resolves.toBeUndefined();
    expect(done).toBe(true);
  });

  it("a bounded notice failure still resolves instead of failing the payment", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(afterResponseWithin(async () => { throw new Error("NectarPay unavailable"); }, 1500, "test"))
      .resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
