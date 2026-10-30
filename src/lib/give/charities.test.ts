import { describe, it, expect } from "vitest";
import { parseSignedCauses } from "./charities";

// Real list signed by NectarPay on 2026-10-30.
const real = {
  signed_payload:
    '{"issued_at":"2026-10-30T09:18:21.997Z","causes":[{"code":null,"name":"CCV Vault","city":null,"blurb":null,"address":"TrWxgEwo2HuhCSEJXfhD2fJnJbUzpTnU9t","featured":false}]}',
  signer: "TmFtZmNYbLmK9uiS3zcXdWUrShB9WqxVdQ",
  signature: "ICGLt8GE9Ijr8PZSpyj673q2iGRHgiJE9Wddhvc3+GkAWAycbGyQIzeXcAsdwBj9dNs2ZVnbi2uYecF7oo7JNcQ=",
};

describe("NectarPay signed church list", () => {
  it("accepts a genuine list", () => {
    expect(parseSignedCauses(real)?.[0].address).toBe("TrWxgEwo2HuhCSEJXfhD2fJnJbUzpTnU9t");
  });
  it("refuses a list with a swapped church address", () => {
    expect(parseSignedCauses({ ...real, signed_payload: real.signed_payload.replace("TrWx", "TrWy") })).toBeNull();
  });
  it("refuses a different signer", () => {
    expect(parseSignedCauses({ ...real, signer: "Tst3dVnJbFrnx5ChmK6qj9F3M8YNsHWR44" })).toBeNull();
  });
});
