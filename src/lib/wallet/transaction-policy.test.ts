import { describe, expect, it } from "vitest";
import * as bitcoin from "bitcoinjs-lib";
import { deriveTxcAddress } from "../wallet";
import { validateSend, tsdScript } from "./transaction-policy";

const from = deriveTxcAddress("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
const to = deriveTxcAddress("legal winner thank year wave sausage worth useful legal winner thank yellow");
const network = { messagePrefix: "", bech32: "txc", bip32: { public: 0x0488b21e, private: 0x0488ade4 }, pubKeyHash: 0x42, scriptHash: 0x32, wif: 0xc1 };
function make(asset: "tsd" | "txc" = "txc", tweak?: (p: bitcoin.Psbt) => void) {
  const previous = new bitcoin.Transaction();
  previous.addInput(Buffer.alloc(32, 1), 0);
  previous.addOutput(bitcoin.address.toOutputScript(from, network), 2_000_000n);
  const p = new bitcoin.Psbt({ network });
  p.addInput({ hash: previous.getId(), index: 0, nonWitnessUtxo: previous.toBuffer() });
  if (asset === "tsd") p.addOutput({ script: tsdScript(1.25), value: 0n });
  p.addOutput({ address: to, value: asset === "tsd" ? 10_000n : 100_000n });
  p.addOutput({ address: from, value: asset === "tsd" ? 1_980_000n : 1_890_000n });
  tweak?.(p);
  return p.toBase64();
}
describe("independent transaction policy", () => {
  const intent = { asset: "txc" as const, from, to, amount: 0.001 };
  it("accepts exact TXC output with 10,000 sat fee", () => expect(validateSend(make(), intent, [from]).feeSats).toBe(10_000));
  it("accepts exact TSD property 39 and 1.25 tokens", () => expect(validateSend(make("tsd"), { ...intent, asset: "tsd", amount: 1.25 }, [from]).feeSats).toBe(10_000));
  it("rejects a substituted recipient", () => expect(() => validateSend(make(), { ...intent, to: from }, [from])).toThrow());
  it("rejects a changed amount", () => expect(() => validateSend(make(), { ...intent, amount: 0.002 }, [from])).toThrow());
  it("rejects extra outputs", () => expect(() => validateSend(make("txc", (p) => p.addOutput({ address: to, value: 1n })), intent, [from])).toThrow());
  it("rejects POP sends", () => expect(() => validateSend(make(), { ...intent, asset: "pop" } as unknown as typeof intent, [from])).toThrow("POP rewards"));
  it("rejects phPOP sends", () => expect(() => validateSend(make(), { ...intent, asset: "phpop" } as unknown as typeof intent, [from])).toThrow("POP rewards"));
  it("rejects excessive fees", () => expect(() => validateSend(make("txc", (p) => p.updateOutput(1, { value: 100_000n })), intent, [from])).toThrow());
  it("rejects a changed TSD amount", () => expect(() => validateSend(make("tsd"), { ...intent, asset: "tsd", amount: 1.26 }, [from])).toThrow());
});