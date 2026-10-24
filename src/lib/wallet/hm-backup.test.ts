import { expect, it } from "vitest";
import { passwordStrongEnough } from "./hm-backup";
it("requires 12 characters for cloud backups", () => expect(passwordStrongEnough("Abc123!" )).toBe(false));
it("requires three character classes", () => expect(passwordStrongEnough("abcdefghijklmnop")).toBe(false));
it("accepts 12 characters with three classes", () => expect(passwordStrongEnough("Abcdefghi123")).toBe(true));