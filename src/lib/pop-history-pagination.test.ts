import { describe, expect, it } from "vitest";
import { paginatePopHistory } from "./pop-history-pagination";

describe("POP history pagination", () => {
  const history = Array.from({ length: 12 }, (_, i) => i + 1);

  it("shows exactly five rows on the first page", () => {
    expect(paginatePopHistory(history, 1)).toEqual({ page: 1, pageCount: 3, rows: [1, 2, 3, 4, 5] });
  });

  it("advances five rows without skipping or repeating entries", () => {
    expect(paginatePopHistory(history, 2).rows).toEqual([6, 7, 8, 9, 10]);
    expect(paginatePopHistory(history, 3).rows).toEqual([11, 12]);
  });

  it("clamps to the last available page after history shrinks", () => {
    expect(paginatePopHistory(history.slice(0, 5), 3)).toEqual({ page: 1, pageCount: 1, rows: [1, 2, 3, 4, 5] });
  });

  it("handles empty history and never goes before page one", () => {
    expect(paginatePopHistory([], 2)).toEqual({ page: 1, pageCount: 1, rows: [] });
    expect(paginatePopHistory(history, 0).rows).toEqual([1, 2, 3, 4, 5]);
  });
});