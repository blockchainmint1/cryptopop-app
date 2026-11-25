import { NECTARPAY_ORIGIN } from "./nectarpay";
import { directoryGiveParticipants } from "./merchant-give";

/** Join current public Give participation to mirrored listings by store id. */
export async function fetchDirectoryGiveParticipants(): Promise<Set<string> | null> {
  try {
    const response = await fetch(`${NECTARPAY_ORIGIN}/api/public/v1/directory`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
    });
    if (!response.ok) return null;
    return directoryGiveParticipants(await response.json());
  } catch {
    return null;
  }
}