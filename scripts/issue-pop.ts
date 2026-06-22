// Issue a new managed indivisible CryptoPOP token on TXC Omni.
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "@bitcoinerlab/secp256k1";
import bs58check from "bs58check";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const WIF = process.env.TXC_WIF!;
const RPC_URL_RAW = process.env.TXC_RPC_URL ?? process.env.TXC_RPC_ADDRESS!;
const RPC_USER = process.env.TXC_RPC_USER!;
const RPC_PASS = process.env.TXC_RPC_PASS!;
const MEMPOOL_BASE = ((process.env.TXC_MEMPOOL_URL ?? "https://mempool.texitcoin.org").replace(/\/$/, "") + "/api").replace(/\/$/, "");
const RPC_URL = RPC_URL_RAW.startsWith("http") ? RPC_URL_RAW : `https://${RPC_URL_RAW}`;

async function rpc<T = any>(method: string, params: any[]): Promise<T> {
  const auth = "Basic " + Buffer.from(`${RPC_USER}:${RPC_PASS}`).toString("base64");
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "text/plain", authorization: auth },
    body: JSON.stringify({ jsonrpc: "1.0", id: "issue", method, params }),
  });
  if (!res.ok) throw new Error(`rpc ${method} http ${res.status} ${await res.text()}`);
  const j = await res.json() as any;
  if (j.error) throw new Error(`rpc ${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

const TXC_NET = {
  messagePrefix: "\x18Texitcoin Signed Message:\n",
  bech32: "tx",
  bip32: { public: 0x0488b21e, private: 0x0488ade4 },
  pubKeyHash: 0x42,
  scriptHash: 0x05,
  wif: bs58check.decode(WIF)[0],
} as bitcoin.Network;

const keyPair = ECPair.fromWIF(WIF, TXC_NET);
const issuer = bitcoin.payments.p2pkh({
  pubkey: Buffer.from(keyPair.publicKey),
  network: TXC_NET,
}).address!;
console.log("Issuer address:", issuer);

const ECOSYSTEM = 1;
const TYPE = 1; // indivisible
const PREVIOUS_ID = 0;
const CATEGORY = "Rewards";
const SUBCATEGORY = "Community POP";
const NAME = "CryptoPOP";
const URL = "https://cryptopop.org";
const DATA = "CryptoPOP community reward token";

const FEE_RATE = 5;
const DUST = 10000;

async function getUtxos(addr: string) {
  const r = await fetch(`${MEMPOOL_BASE}/address/${addr}/utxo`);
  if (!r.ok) throw new Error(`utxo http ${r.status}`);
  const raw = await r.json() as any[];
  return raw
    .map(u => ({ txid: u.txid, vout: u.vout, value: u.value, confirmed: u.status.confirmed }))
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed));
}
async function getTxHex(txid: string) {
  const r = await fetch(`${MEMPOOL_BASE}/tx/${txid}/hex`);
  if (!r.ok) throw new Error(`txhex http ${r.status}`);
  return (await r.text()).trim();
}

(async () => {
  // 1. payload
  const payloadHex = await rpc<string>("omni_createpayload_issuancemanaged", [
    ECOSYSTEM, TYPE, PREVIOUS_ID, CATEGORY, SUBCATEGORY, NAME, URL, DATA,
  ]);
  console.log("Payload bytes:", payloadHex.length / 2);

  const opData = Buffer.concat([Buffer.from("omni", "ascii"), Buffer.from(payloadHex, "hex")]);
  const opScript = bitcoin.payments.embed({ data: [opData] }).output!;

  // 2. utxos + build tx (issuance has no reference output — just OP_RETURN + change)
  const utxos = await getUtxos(issuer);
  console.log("UTXOs:", utxos.length, "total:", utxos.reduce((s, u) => s + u.value, 0));
  if (!utxos.length) throw new Error("no utxos — fund issuer first");
  utxos.sort((a, b) => b.value - a.value);

  const psbt = new bitcoin.Psbt({ network: TXC_NET });
  let inputSats = 0;
  const used: typeof utxos = [];
  for (const u of utxos) {
    const hex = await getTxHex(u.txid);
    psbt.addInput({ hash: u.txid, index: u.vout, nonWitnessUtxo: Buffer.from(hex, "hex") });
    used.push(u);
    inputSats += u.value;
    const vsize = 10 + 148 * used.length + 34 + (10 + opData.length);
    if (inputSats >= vsize * FEE_RATE + DUST) break;
  }
  const vsize = 10 + 148 * used.length + 34 + (10 + opData.length);
  const fee = vsize * FEE_RATE;
  const change = inputSats - fee;
  if (change < 0) throw new Error("insufficient funds for fee");

  psbt.addOutput({ script: opScript, value: 0n });
  if (change >= DUST) psbt.addOutput({ address: issuer, value: BigInt(change) });

  const signer: bitcoin.Signer = {
    publicKey: Buffer.from(keyPair.publicKey),
    sign: (h: Buffer) => Buffer.from(keyPair.sign(h)),
  };
  for (let i = 0; i < used.length; i++) psbt.signInput(i, signer);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();
  const rawHex = tx.toHex();
  console.log("Raw tx bytes:", rawHex.length / 2, "fee:", fee, "change:", change);

  // 3. broadcast via RPC (avoid mempool 80-byte datacarrier limit)
  const txid = await rpc<string>("sendrawtransaction", [rawHex]);
  console.log("BROADCAST TXID:", txid);

  // 4. read back property id from listproperties (newest = highest id)
  await new Promise(r => setTimeout(r, 3000));
  const props = await rpc<any[]>("omni_listproperties", []);
  const ours = props.filter(p => p.name === NAME).sort((a, b) => b.propertyid - a.propertyid)[0];
  console.log("New property:", JSON.stringify(ours, null, 2));
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
