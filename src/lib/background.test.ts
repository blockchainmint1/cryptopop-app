import { describe, it, expect, vi } from "vitest";
import { afterResponse, runWithExecutionContext } from "./background.server";

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
});
