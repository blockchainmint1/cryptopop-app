import { describe, expect, it } from "vitest";
import * as bitcoin from "bitcoinjs-lib";
import { deriveTxcAddress } from "../wallet";
import { isRelayableOmniPayload, splitGiving, tsdSendToManyScript, validateSplitSend } from "./transaction-policy";
import { configMatchesPinned, GIVE_CHURCH, GIVE_PLATFORM_ADDRESS } from "../give/constants";
import { signSplitPsbt } from "./sign";

const PHRASE = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const from = deriveTxcAddress(PHRASE);
const merchant = deriveTxcAddress("legal winner thank year wave sausage worth useful legal winner thank yellow");
const church = "Tst3dVnJbFrnx5ChmK6qj9F3M8YNsHWR44";
const platform = "TmmoqqhcfBZWRG8feCTE2c4N4BsADgwD1m";
const network = { messagePrefix: "", bech32: "txc", bip32: { public: 0x0488b21e, private: 0x0488ade4 }, pubKeyHash: 0x42, scriptHash: 0x32, wif: 0xc1 };

describe("eGiving split: store discount shared 80% church / 20% eGiving", () => {
  it("10% discount splits $100 into 90 / 8 / 2", () =>
    expect(splitGiving(100, 10)).toEqual({ merchant: 90, church: 8, platform: 2, total: 100, discountPct: 10 }));
  it("5% discount splits $100 into 95 / 4 / 1", () =>
    expect(splitGiving(100, 5)).toMatchObject({ merchant: 95, church: 4, platform: 1 }));
  it("20% discount splits $100 into 80 / 16 / 4", () =>
    expect(splitGiving(100, 20)).toMatchObject({ merchant: 80, church: 16, platform: 4 }));
  it("$5 test at 10% sends 4.50 / 0.40 / 0.10", () =>
    expect(splitGiving(5, 10)).toMatchObject({ merchant: 4.5, church: 0.4, platform: 0.1 }));
  it("gives leftover cents to the merchant so parts always total the price", () => {
    const s = splitGiving(4.99, 10);
    expect(s).toMatchObject({ merchant: 4.51, church: 0.39, platform: 0.09, total: 4.99 });
  });
  it("merchant never gets less than (100 - discount)%", () => {
    for (const pct of [1, 3, 7.5, 10, 15, 50]) for (const t of [0.5, 1.23, 9.99, 37.41, 100]) {
      const s = splitGiving(t, pct);
      expect(Math.round(s.merchant * 100)).toBeGreaterThanOrEqual(Math.ceil(Math.round(t * 100) * (1 - pct / 100) - 1e-9));
      expect(Math.round((s.merchant + s.church + s.platform) * 100)).toBe(Math.round(t * 100));
    }
  });
  it("refuses discounts outside 1% to 50%", () => {
    expect(() => splitGiving(100, 0)).toThrow();
    expect(() => splitGiving(100, 51)).toThrow();
  });
});

describe("pinned eGiving recipients", () => {
  it("accepts the pinned church and eGiving addresses", () =>
    expect(configMatchesPinned({ church: { address: GIVE_CHURCH.address }, platformAddress: GIVE_PLATFORM_ADDRESS })).toBe(true));
  it("refuses a server that swaps the church address", () =>
    expect(configMatchesPinned({ church: { address: GIVE_PLATFORM_ADDRESS }, platformAddress: GIVE_PLATFORM_ADDRESS })).toBe(false));
});

describe("relay payload filter", () => {
  const payload = (script: Uint8Array) => script.subarray(2);
  it("relays a TSD split payment (type 7)", () =>
    expect(isRelayableOmniPayload(payload(tsdSendToManyScript([{ vout: 1, amount: 9 }, { vout: 2, amount: 0.8 }, { vout: 3, amount: 0.2 }])))).toBe(true));
  it("relays a TSD simple send (type 0)", () => {
    const p = new Uint8Array(20); p.set([0x6f, 0x6d, 0x6e, 0x69]); new DataView(p.buffer).setUint32(8, 39);
    expect(isRelayableOmniPayload(p)).toBe(true);
  });
  it("refuses a split for another property (POP)", () => {
    const p = payload(tsdSendToManyScript([{ vout: 1, amount: 1 }])).slice(); new DataView(p.buffer).setUint32(8, 40);
    expect(isRelayableOmniPayload(p)).toBe(false);
  });
  it("refuses more than 3 recipients", () => expect(() => tsdSendToManyScript([1, 2, 3, 4].map((v) => ({ vout: v, amount: 1 })))).toThrow());
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
  it("rejects a wrong property id in the token payload", () =>
    expect(() => validateSplitSend(build(recipients, (p) => {
      const bad = Buffer.from(tsdSendToManyScript(recipients.map((r, i) => ({ vout: i + 1, amount: r.amount }))));
      bad.writeUInt32BE(40, 10);
      (p.data.globalMap.unsignedTx as unknown as { tx: bitcoin.Transaction }).tx.outs[0].script = bad;
    }), intent, [from])).toThrow());
  it("rejects change sent to a foreign address", () =>
    expect(() => validateSplitSend(build(recipients, (p) => {
      (p.data.globalMap.unsignedTx as unknown as { tx: bitcoin.Transaction }).tx.outs[4].script = bitcoin.address.toOutputScript(merchant, network);
    }), intent, [from])).toThrow());
  it("rejects an input the wallet does not own", () =>
    expect(() => validateSplitSend(build(recipients), { from: merchant, recipients }, [from])).toThrow());
  it("rejects a fee over the safety cap", () =>
    expect(() => validateSplitSend(build(recipients, (p) => {
      (p.data.globalMap.unsignedTx as unknown as { tx: bitcoin.Transaction }).tx.outs[4].value = 10_000n;
    }), intent, [from])).toThrow());
  it("rejects duplicate recipients", () =>
    expect(() => validateSplitSend(build(recipients), { from, recipients: [recipients[0], recipients[0], recipients[2]] }, [from])).toThrow());
});

import { givingMinimumUsd as minUsd, splitGiving as split2 } from "./transaction-policy";
describe("giving minimum per discount (500 cents / %)", () => {
  it.each([[10, 0.5], [5, 1], [1, 5], [50, 0.1]])("%d%% store minimum is $%d", (pct, usd) => {
    expect(minUsd(pct)).toBe(usd);
    const s = split2(usd, pct);
    expect(s.church).toBeGreaterThan(0);
    expect(s.platform).toBeGreaterThan(0);
    const below = split2(usd - 0.01, pct);
    expect(below.church <= 0 || below.platform <= 0).toBe(true);
  });
});
