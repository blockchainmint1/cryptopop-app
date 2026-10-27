import { describe, expect, it } from "vitest";
import * as bitcoin from "bitcoinjs-lib";
import { deriveTxcAddress } from "../wallet";
import { validateSend, tsdScript } from "./transaction-policy";
import { signPsbt } from "./sign";

const from = deriveTxcAddress("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
const to = deriveTxcAddress("legal winner thank year wave sausage worth useful legal winner thank yellow");
const network = { messagePrefix: "", bech32: "txc", bip32: { public: 0x0488b21e, private: 0x0488ade4 }, pubKeyHash: 0x42, scriptHash: 0x32, wif: 0xc1 };
function make(asset: "tsd" | "txc" = "txc", tweak?: (p: bitcoin.Psbt) => void, change?: bigint, recipientValue?: bigint) {
  const previous = new bitcoin.Transaction();
  previous.addInput(Buffer.alloc(32, 1), 0);
  previous.addOutput(bitcoin.address.toOutputScript(from, network), 2_000_000n);
  const p = new bitcoin.Psbt({ network });
  p.addInput({ hash: previous.getId(), index: 0, nonWitnessUtxo: previous.toBuffer() });
  if (asset === "tsd") p.addOutput({ script: tsdScript(1.25), value: 0n });
  p.addOutput({ address: to, value: recipientValue ?? (asset === "tsd" ? 10_000n : 100_000n) });
  p.addOutput({ address: from, value: change ?? (asset === "tsd" ? 1_980_000n : 1_890_000n) });
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
  it("rejects excessive fees", () => {
    expect(() => validateSend(make("txc", undefined, 100_000n), intent, [from])).toThrow("fee");
  });
  it("rejects a changed TSD amount", () => expect(() => validateSend(make("tsd"), { ...intent, asset: "tsd", amount: 1.26 }, [from])).toThrow());
  it("signs and finalizes the checked TXC transaction", () => {
    const raw = signPsbt(make(), "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", intent);
    const tx = bitcoin.Transaction.fromHex(raw);
    expect(tx.outs[0]?.value).toBe(100_000n);
    expect(tx.ins[0]?.script.length).toBeGreaterThan(0);
  });
  it("signs and finalizes the checked TSD transaction", () => {
    const raw = signPsbt(make("tsd"), "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", { ...intent, asset: "tsd", amount: 1.25 });
    expect(bitcoin.Transaction.fromHex(raw).outs[0]?.script).toEqual(tsdScript(1.25));
  });
  it("accepts a combined TSD + TXC output to the same recipient", () => {
    const combo = { asset: "tsd" as const, from, to, amount: 1.25, txcAmount: 0.001 };
    expect(validateSend(make("tsd", undefined, undefined, 110_000n), combo, [from]).feeSats).toBe(10_000);
  });
  it("rejects a combined send with the wrong TXC amount", () => {
    const combo = { asset: "tsd" as const, from, to, amount: 1.25, txcAmount: 0.002 };
    expect(() => validateSend(make("tsd", undefined, undefined, 110_000n), combo, [from])).toThrow();
  });
  it("rejects extra TXC on a plain TXC send", () => {
    expect(() => validateSend(make(), { ...intent, txcAmount: 0.001 }, [from])).toThrow("ride along");
  });
  it("signs and finalizes a combined TSD + TXC transaction", () => {
    const combo = { asset: "tsd" as const, from, to, amount: 1.25, txcAmount: 0.001 };
    const raw = signPsbt(make("tsd", undefined, undefined, 110_000n), "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", combo);
    const tx = bitcoin.Transaction.fromHex(raw);
    expect(tx.outs[0]?.script).toEqual(tsdScript(1.25));
    expect(tx.outs[1]?.value).toBe(110_000n);
  });
});