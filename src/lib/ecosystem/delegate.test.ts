/**
 * Tests for Seeds 19-chain trading-pocket key derivation and hm-link-delegate
 * validation/encryption against HME Wallet, Seeds, and Trezor published vectors.
 */
import { describe, expect, it } from "vitest";
import { ed25519, x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { base64urlnopad, hex } from "@scure/base";
import { mnemonicToSeedSync } from "@scure/bip39";
import { setEcosystemSites } from "./hosts";
import {
  accountPath,
  coreChainRoot,
  deriveExtraKey,
  EXTRA_CHAINS,
  extraAccountOf,
  POCKET_CHAINS,
  type ExtraChain,
} from "./delegate-keys";
import { HOLD_FORMAT, SEEDS_HOLD_COINS_LIVE, tonAddress } from "./hold-coins";
import { sealTo, validateDelegate, type DelegateLinkRecord } from "./delegate";

const WORDS = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const SEED = mnemonicToSeedSync(WORDS);

const SEEDS_SITE = {
  host: "seeds.honest.money",
  label: "SEEDS",
  delegate: true,
  delegate_modes: ["approve", "access"] as ("approve" | "access")[],
  delegate_branches: [1106],
};

const REF_EXTRA: Record<ExtraChain, { path: string; pub: string; priv: string }> = {
  DOGE: { path: "m/44'/3'/1106'", pub: "xpub6Bxse8AT19uys6z4Sc41PZcxvVX32aDbKGKKLEFJa2nY95dR6nTN2b5boyXDh9TfJxk1d7DtRaKLUTWWzMHVaKMoNVKNVJEyLRGSzs9zpaa", priv: "xprv9xyXEcdZAnMgecubLaX12RgENTgYd7Vjx3PiXqqh1hFZGHJGZF97Unm7xivR6NofbgVgPwXdx3eNmqd1mAeHLrTJGkheA3FF25vJKDVrTtn" },
  BCH: { path: "m/44'/145'/1106'", pub: "xpub6ByHsPNSQXUM9emiMQCYUTzdW7SGQW5fiUZgAxqvJmrF37pPeUQMQHmzQmqsGu9Xv8U9XfrMH5XwTWnvjea6vhjzvKjXNs3pKzuSX6SwuLa", priv: "xprv9xywTsqYa9v3wAhFFNfY7L3tx5bn13MpMFe5NaSJkSKGAKVF6w66rVTWZUKcykEpx4R4P7NwhuFF6YBes1NGRXxwA5TXVU4m1Bfg6LP9KJg" },
  DASH: { path: "m/44'/5'/1106'", pub: "xpub6CYEjsU6zPMtSzi4qWgdBWmtGXhKt3zCpXYUntAWUhqKridudrsJCKWHqzsfgFmeUcW8WrA794f2Qp5rHJQpUNdmULbipvB4h6G9ZYUBtX8", priv: "xprv9yYtLMwDA1obEWdbjV9cpNq9iVrqUbGMTJcszVktvNJLyvJm6KZ3eXBozipD7rfZSdHhjKUTmdhFsMmmhtdtU5Xhq7su6QHRD5UjMKSrGcp" },
  TRX: { path: "m/44'/195'/1106'", pub: "xpub6D1AabNHCuqVKkEYWSLPPSGa9MmB1yKXM4oRkR6r84b4Q3r1uW2Y3HA5gUNhmv3zcbvtgzcJL6u2uPQnLvgmwM6Cjs6E5kgTXB3nQgzGWk5", priv: "xprv9z1pB5qPNYHC7GA5QQoP2JKqbKvgcWbfyqspx2hEZj45XFWsMxiHVUqbqEFHsq1hiyLU59QqePYLR4Qu2ftfP7rdQaBXgzbrZMfrDMYoz9i" },
  ZEC: { path: "m/44'/133'/1106'", pub: "xpub6CLX6bXDznzdoVCvZocJ7Kz42ZF7VjmaXn7JyDmxLKZoYyxJVesX5QWnU8vdkFsC1JmzasUyJrusaY1tc9Bvg2tdFUGeGGtpLQ9QNX1wjN6", priv: "xprv9yMAh5zLARSLb18TTn5HkC3KUXQd6H3jAZBiAqNLmz2pgBd9x7ZGXcCJcqodEMnLjuAHxzPvNV9tkEHXqf93AD92VnrPgVukDKLGfiXiLAx" },
  XRP: { path: "m/44'/144'/1106'", pub: "xpub6CFKyZTfzj4TaAz2iXz53LkoFWjJY8Zh9KqrUxzu85c3HvZ7VRifaFCt1aGVFyp8M5J2MWZaA9yg6rm2Qi3C1ytUucbBqGfSYWLRLr9rW9s", priv: "xprv9yFya3vnAMWAMguZcWT4gCp4hUtp8fqqn6vFgabHZk54R8DxwtQR2StQAKi3UZoc9L1XeUMpNQokHVdbtH1jhS58j2n1tKfcHf8uPV6kCsj" },
  ATOM: { path: "m/44'/118'/1106'", pub: "xpub6DGzViq8bmhBxaVfiupQe5DB1Yc9rr5NmjzqqtK4PoAPZQvqCo4XjUaXnrnWzLvEMxdaEst16D9VmA2fyaiMqmj7HFaPrJKuB5HdVTRvXdQ", priv: "xprv9zHe6DJEmQ8tk6RCctHQGwGSTWmfTPMXQX5F3VuSqTdQgcbgfFkHBgG3wbGnV3k98W87gQ11y477hVruTt6UfXKH9dydgreLi3i5ukniFJi" },
  RUNE: { path: "m/44'/931'/1106'", pub: "xpub6CNbXkRDJeMg8BAp4HD8ZUd6RE3jpBbwMtovvKEQqbDvNzUutoECUP2Q1favP9peqwYn9z7uDgAzmdkexgqfpqNnHPbr5jDArd4KCNYMZCY", priv: "xprv9yPF8EtKUGoNuh6LxFg8CLgMsCDFQit5zftL7vpoHFgwWC9mMFuwvahvAQTvCubrMgURL9EQSW1teUpXfQKsgkkwXJ1kmAr2LxPRRGSrP1o" },
  SOL: { path: "m/44'/501'/1106'/0'", pub: "DXTivYcF78Vznitg6f8JGXouZwsm3xioik1LGWj2H1jV", priv: "23e8f7620c4c073e1df02d77f6d7f4d1be7c00667d413f8cc113b69e2a70dcd4" },
  XMR: { path: "m/44'/128'/1106'", pub: "4A4meFan68GQTKM2GJemCwBkfbVP2UsH2ZLPxWKquxhF93ruBpNL3PjSQzkKWFX5ELS8P4MKc4DVqb5sDFuswXJFCRuGsea", priv: "675040abc909b52bca0ce90007a1a1a262d94523e45cce46323f1d513831ca09" },
  ADA: { path: "m/1852'/1815'/1106'", pub: "44c508747d1f92f49b06019d1f92fbaff0f1a1b08eb8815d77e50fb790f09c0a2e995b349397df051d6674f12c7732907d995ac8baf74ac0ad837aa26ec1a598", priv: "302f52a2aa7654cf7f25e40c862a49949f9cc36a196629436fe3fd686d0e6f5336bc9b30df6ebc2a6e0f21796be17b50d59ec7d6988c1ba7531b3522eabd807e2e995b349397df051d6674f12c7732907d995ac8baf74ac0ad837aa26ec1a598" },
};

describe("19-chain trading-pocket key derivation (pocket 1106)", () => {
  it("derives all 5 core chains with exact paths and version bytes", () => {
    expect(POCKET_CHAINS).toEqual(["TXC", "ISK", "BTC", "LTC", "EVM"]);
    expect(accountPath("TXC", 1106)).toBe("m/44'/696969'/1106'");
    expect(accountPath("ISK", 1106)).toBe("m/44'/969696'/1106'");
    expect(accountPath("BTC", 1106)).toBe("m/84'/0'/1106'");
    expect(accountPath("LTC", 1106)).toBe("m/44'/2'/1106'");
    expect(accountPath("EVM", 1106)).toBe("m/44'/60'/1106'");
    for (const c of POCKET_CHAINS) {
      const node = coreChainRoot(SEED, c).derivePath(accountPath(c, 1106));
      if (c === "LTC") {
        expect(node.neutered().toBase58().startsWith("Ltub")).toBe(true);
      } else {
        expect(node.neutered().toBase58().startsWith("xpub")).toBe(true);
      }
    }
  });

  it("matches all 11 extra chains against published Seeds / bip_utils vectors", () => {
    for (const chain of EXTRA_CHAINS) {
      const k = deriveExtraKey({ chain, account: 1106, seed: SEED, mnemonic: WORDS, withPrivate: true });
      expect(k.path, chain).toBe(REF_EXTRA[chain].path);
      expect(k.pub, chain).toBe(REF_EXTRA[chain].pub);
      expect(k.priv, chain).toBe(REF_EXTRA[chain].priv);
    }
  });

  it("matches Stellar, TON, and Sui published Seeds vectors", () => {
    expect(SEEDS_HOLD_COINS_LIVE).toBe(true);
    const xlm = deriveExtraKey({ chain: "XLM", account: 1106, seed: SEED, mnemonic: WORDS, withPrivate: true });
    expect(xlm.path).toBe("m/44'/148'/1106'");
    expect(xlm.pub).toBe("GARWV2LPPTIXJYVWMINIZHNKNUCR3FDVANOPTZXGYV3765UZKSHWV5AI");
    expect(hex.encode(ed25519.getPublicKey(hex.decode(xlm.priv!))).length).toBe(64);

    const ton = deriveExtraKey({ chain: "TON", account: 1106, seed: SEED, mnemonic: WORDS, withPrivate: true });
    expect(ton.path).toBe("m/44'/607'/1106'");
    expect(ton.pub).toMatch(/^[0-9a-f]{64}$/);
    expect(tonAddress(hex.decode(ton.pub))).toBe("UQCsq4rzqzuJvOOkCj00SPdMru6-SHmeDuGf2_ecmdjlNwcm");

    const sui = deriveExtraKey({ chain: "SUI", account: 1106, seed: SEED, mnemonic: WORDS, withPrivate: true });
    expect(sui.path).toBe("m/44'/784'/1106'/0'/0'");
    expect(sui.pub).toBe("0xc103715616f6451c7d969ef90d20d1016924dad27e9c36cd3c1bd5ee5c36b8a1");
  });

  it("accepts only exact trading branch paths", () => {
    expect(extraAccountOf("SUI", "m/44'/784'/1106'/0'/0'")).toBe(1106);
    expect(extraAccountOf("SUI", "m/44'/784'/1106'")).toBeNull();
    expect(extraAccountOf("DOGE", "m/44'/3'/1106'/0/0")).toBeNull();
  });
});

describe("sealTo (X25519 + HKDF-SHA256 + AES-256-GCM)", () => {
  it("seals and decrypts cleanly with the recipient X25519 private key", async () => {
    const recipientPriv = x25519.utils.randomPrivateKey();
    const recipientPub = x25519.getPublicKey(recipientPriv);
    const plaintext = new TextEncoder().encode(JSON.stringify({ TXC: "xprv-test", SUI: "deadbeef" }));
    const sealed = await sealTo(recipientPub, plaintext);

    const ephPub = sealed.slice(0, 32);
    const nonce = sealed.slice(32, 44);
    const ct = sealed.slice(44);
    const shared = x25519.getSharedSecret(recipientPriv, ephPub);
    const salt = new Uint8Array(64);
    salt.set(ephPub, 0);
    salt.set(recipientPub, 32);
    const keyBytes = hkdf(sha256, shared, salt, new TextEncoder().encode("hm-link-delegate v1"), 32);
    const key = await crypto.subtle.importKey("raw", new Uint8Array(keyBytes), { name: "AES-GCM" }, false, ["decrypt"]);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, new Uint8Array(ct)));
    expect(new TextDecoder().decode(plain)).toBe(new TextDecoder().decode(plaintext));
  });
});

describe("validateDelegate security rules", () => {
  function makeManifest(overrides: Record<string, unknown> = {}) {
    const host = "seeds.honest.money";
    return {
      type: "hm-link-delegate",
      challenge_id: "abcdefgh1234",
      challenge: "challenge-12345678",
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      recipient_pubkey: base64urlnopad.encode(x25519.getPublicKey(x25519.utils.randomPrivateKey())),
      submit_url: `https://${host}/api/public/hme-link/submit`,
      revoke_url: `https://${host}/api/public/hme-link/revoke`,
      request: [
        { chain: "TXC", path: "m/44'/696969'/1106'" },
        { chain: "ISK", path: "m/44'/969696'/1106'" },
        { chain: "BTC", path: "m/84'/0'/1106'" },
        { chain: "LTC", path: "m/44'/2'/1106'" },
        { chain: "EVM", path: "m/44'/60'/1106'" },
      ],
      request_optional: [
        { chain: "DOGE", path: "m/44'/3'/1106'", format: "bip32" },
        { chain: "BCH", path: "m/44'/145'/1106'", format: "bip32" },
        { chain: "DASH", path: "m/44'/5'/1106'", format: "bip32" },
        { chain: "TRX", path: "m/44'/195'/1106'", format: "bip32" },
        { chain: "ZEC", path: "m/44'/133'/1106'", format: "bip32" },
        { chain: "XRP", path: "m/44'/144'/1106'", format: "bip32" },
        { chain: "ATOM", path: "m/44'/118'/1106'", format: "bip32" },
        { chain: "RUNE", path: "m/44'/931'/1106'", format: "bip32" },
        { chain: "SOL", path: "m/44'/501'/1106'/0'", format: "slip10-ed25519" },
        { chain: "ADA", path: "m/1852'/1815'/1106'", format: "cip1852-icarus" },
        { chain: "XMR", path: "m/44'/128'/1106'", format: "slip10-ed25519-monero-trezor" },
        { chain: "XLM", path: "m/44'/148'/1106'", format: HOLD_FORMAT.XLM },
        { chain: "TON", path: "m/44'/607'/1106'", format: HOLD_FORMAT.TON },
        { chain: "SUI", path: "m/44'/784'/1106'/0'/0'", format: HOLD_FORMAT.SUI },
      ],
      ...overrides,
    };
  }

  it("accepts all 19 approved chains for verified Seeds on branch 1106", () => {
    setEcosystemSites([SEEDS_SITE], true);
    const v = validateDelegate(makeManifest(), "https://seeds.honest.money/api/public/hme-link/manifest/abc");
    expect(v.chains.length).toBe(5);
    expect(v.extraChains.length).toBe(14);
    expect(v.chains.length + v.extraChains.length).toBe(19);
    expect(v.account).toBe(1106);
  });

  it("refuses branch 0 (main wallet) or unreserved branches", () => {
    setEcosystemSites([SEEDS_SITE], true);
    const bad = makeManifest({ request: [{ chain: "TXC", path: "m/44'/696969'/0'" }], request_optional: [] });
    expect(() => validateDelegate(bad, "https://seeds.honest.money/api/public/hme-link/manifest/abc")).toThrow(/reserved/i);
  });

  it("refuses an update that drops an already-shared coin", () => {
    setEcosystemSites([SEEDS_SITE], true);
    const prior: DelegateLinkRecord = {
      linkId: "link-1",
      host: "seeds.honest.money",
      appName: "SEEDS",
      mode: "access",
      account: 1106,
      chains: ["TXC"],
      extraChains: ["DOGE"],
      revokeUrl: "https://seeds.honest.money/api/public/hme-link/revoke",
      origin: "https://seeds.honest.money",
      identity: "T123",
      linkedAt: new Date().toISOString(),
    };
    const fewer = makeManifest({ request: [{ chain: "TXC", path: "m/44'/696969'/1106'" }], request_optional: [] });
    expect(() =>
      validateDelegate(fewer, "https://seeds.honest.money/api/public/hme-link/manifest/abc", {}, [prior]),
    ).toThrow(/drop Dogecoin/i);
  });
});