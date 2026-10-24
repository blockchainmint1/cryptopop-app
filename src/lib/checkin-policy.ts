export const MAX_CHECKIN_GUESTS = 20;
export function cappedGuestTotal(current: number, added: number): number {
  const total = current + added;
  if (!Number.isInteger(current) || !Number.isInteger(added) || current < 0 || added < 0 || total > MAX_CHECKIN_GUESTS)
    throw new Error("A pass can have at most 20 guests in total");
  return total;
}