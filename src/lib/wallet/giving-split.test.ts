import { describe, expect, it } from "vitest";
import * as bitcoin from "bitcoinjs-lib";
import { deriveTxcAddress } from "../wallet";
import { splitGiving, tsdSendToManyScript, validateSplitSend } from "./transaction-policy";
import { signSplitPsbt } from "./sign";

const PHRASE = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const from = deriveTxcAddress(PHRASE);
const merchant = deriveTxcAddress("legal winner thank year wave sausage worth useful legal winner thank yellow");
const church = "Tst3dVnJbFrnx5ChmK6qj9F3M8YNsHWR44";
const platform = "TmmoqqhcfBZWRG8feCTE2c4N4BsADgwD1m";
const network = { messagePrefix: "", bech32: "txc", bip32: { public: 0x0488b21e, private: 0x0488ade4 }, pubKeyHash: 0x42, scriptHash: 0x32, wif: 0xc1 };

describe("eGiving split (90% merchant / 8% church / 2% platform)", () => {
  it("splits $100 into 90 / 8 / 2", () => expect(splitGiving(100)).toEqual({ merchant: 90, church: 8, platform: 2, total: 100 }));
  it("gives leftover cents to the merchant so parts always total the price", () => {
    const s = splitGiving(4.99);
    expect(s).toEqual({ merchant: 4.51, church: 0.39, platform: 0.09, total: 4.99 });
  });
});

function build(recipients: { to: string; amount: number }[], tweak?: (p: bitcoin.Psbt) => void) {
  const previous = new bitcoin.Transaction();
  previous.addInput(Buffer.alloc(32, 1), 0);
  previous.addOutput(bitcoin.address.toOutputScript(from, network), 2_000_000n);
  const p = new bitcoin.Psbt({ network });
  p.addInput({ hash: previous.getId(), index: 0, nonWitnessUtxo: previous.toBuffer() });
  p.addOutput({ script: Buffer.from(tsdSendToManyScript(recipients.map((r, i) => ({ vout: i + 1, amount: r.amount })))), value: 0n });
  for (const r of recipients) p.addOutput({ address: r.to, value: 10_000n });
  p.addOutput({ address: from, value: 2_000_000n - 10_000n * BigInt(recipients.length) - 10_000n });
  tweak?.(p);
  return p.toBase64();
}

describe("split payment safety check", () => {
  const recipients = [
    { to: merchant, amount: 90 },
    { to: church, amount: 8 },
    { to: platform, amount: 2 },
  ];
  const intent = { from, recipients };
  it("accepts the exact three-way split", () => expect(validateSplitSend(build(recipients), intent, [from]).feeSats).toBe(10_000));
  it("rejects a split that pays the church less than requested", () =>
    expect(() => validateSplitSend(build([recipients[0], { to: church, amount: 7 }, recipients[2]]), intent, [from])).toThrow());
  it("rejects a swapped recipient", () =>
    expect(() => validateSplitSend(build([recipients[0], { to: platform, amount: 8 }, { to: church, amount: 2 }]), intent, [from])).toThrow());
  it("rejects an extra output", () =>
    expect(() => validateSplitSend(build(recipients, (p) => p.addOutput({ address: merchant, value: 10_000n })), intent, [from])).toThrow());
  it("signs the checked split on device", () => {
    const tx = bitcoin.Transaction.fromHex(signSplitPsbt(build(recipients), PHRASE, intent));
    expect(tx.outs.length).toBe(5);
  });
});
