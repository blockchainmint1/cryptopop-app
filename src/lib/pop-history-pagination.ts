export const POP_HISTORY_PAGE_SIZE = 5;

/** Keep the selected page valid when refreshed history changes length. */
export function paginatePopHistory<T>(rows: readonly T[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / POP_HISTORY_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * POP_HISTORY_PAGE_SIZE;
  return { page, pageCount, rows: rows.slice(start, start + POP_HISTORY_PAGE_SIZE) };
}