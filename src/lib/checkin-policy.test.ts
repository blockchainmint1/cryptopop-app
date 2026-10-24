import { expect, it } from "vitest";
import { cappedGuestTotal } from "./checkin-policy";
it("permits at most 20 total guests", () => expect(cappedGuestTotal(19, 1)).toBe(20));
it("rejects repeated top-ups beyond 20", () => expect(() => cappedGuestTotal(20, 1)).toThrow());
it("rejects negative guest counts", () => expect(() => cappedGuestTotal(-1, 0)).toThrow());