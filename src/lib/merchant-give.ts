import { z } from "zod";

const giveDirectorySchema = z.object({
  stores: z.array(z.object({
    id: z.string().min(1),
    status: z.string().nullish(),
    egiving: z.object({ accepted: z.boolean() }).nullish(),
  })).max(50000),
});

/** Public discovery only; checkout still verifies Give eligibility independently. */
export function directoryGiveParticipants(payload: unknown): Set<string> {
  const feed = giveDirectorySchema.parse(payload);
  return new Set(feed.stores
    .filter((store) => store.status === "live" && store.egiving?.accepted === true)
    .map((store) => store.id));
}

export function filterGiveMerchants<T extends { giveParticipant?: boolean }>(stores: T[], onlyGive: boolean): T[] {
  return onlyGive ? stores.filter((store) => store.giveParticipant === true) : stores;
}