/**
 * `hm-link-delegate` — a verified HME trading site (e.g. Seeds) asks to link
 * to this wallet's Trading pocket (hardened account 1106'.., never 0').
 *
 * Modes:
 * - "access":  hands over the pocket's account-level keys for all requested
 *   chains (up to 19 approved chains), sealed on-device to the site's X25519 key.
 * - "approve": hands over xpubs only (watch-only / approve-each-trade).
 *
 * Hard rules (never configurable by the site):
 * - Site must be marked delegate: true on a fresh, signed honest.money list.
 * - Requested paths must all be one branch honest.money reserved for that site.
 * - submit_url / revoke_url must share the manifest origin.
 * - Signed identity message is rebuilt locally from a fixed shape.
 */
import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { base64url, base64urlnopad } from "@scure/base";
import { mnemonicToSeedSync } from "@scure/bip39";
import { deriveTxcAddress, TXC_PATH } from "@/lib/wallet";
import { derivePrivateKeyAtPath } from "@/lib/wallet/sign";
import { signTxcMessage } from "@/lib/wallet/txc-message";
import { isEcosystemSite, loginSiteName, setEcosystemSites, spendingGrant } from "./hosts";
import { getEcosystemSites } from "./sites.functions";
import { chooseDelegateBranch, claimBranch, loadBranchBook, retireBranch, type BranchBook } from "./branches";
import {
  accountPath,
  coreChainRoot,
  deriveExtraKey,
  EXTRA_CHAIN_LABEL,
  extraAccountOf,
  isLinkExtraChain,
  linkExtraFormat,
  POCKET_CHAINS,
  type LinkExtraChain,
  type PocketChain,
} from "./delegate-keys";

const PROXY = "/api/nectar/link";

export type DelegateMode = "access" | "approve";

export interface DelegateManifest {
  kind: "delegate";
  host: string;
  appName: string;
  purpose?: string;
  token: string;
  challenge: string;
  chains: PocketChain[];
  extraChains: LinkExtraChain[];
  requestedAccount: number;
  account: number;
  modes: DelegateMode[];
  recipientPub: Uint8Array;
  submitUrl: string;
  revokeUrl: string;
  manifestUrl: string;
  reusesRevoked?: boolean;
  replaces?: { linkId: string; mode: DelegateMode; addedExtraChains: LinkExtraChain[] };
}

export interface DelegateLinkRecord {
  linkId: string;
  host: string;
  appName: string;
  mode: DelegateMode;
  account: number;
  chains: PocketChain[];
  extraChains?: LinkExtraChain[];
  revokeUrl: string;
  origin: string;
  identity: string;
  linkedAt: string;
}

export const REGISTRY_UNREACHABLE =
  "Couldn't reach honest.money to check which sites may trade. Nothing was shared — try again in a moment.";

export function isDelegateDialect(raw: Record<string, unknown>): boolean {
  return raw["type"] === "hm-link-delegate";
}

function requestedAccountOf(chain: PocketChain, path: unknown): number | null {
  const m = /^m\/\d+'\/\d+'\/(\d{1,10})'$/.exec(String(path));
  if (!m) return null;
  const n = Number(m[1]);
  return accountPath(chain, n) === path ? n : null;
}

export function validateDelegate(
  raw: Record<string, unknown>,
  manifestUrl: string,
  book: BranchBook = {},
  existing: DelegateLinkRecord[] = [],
): DelegateManifest {
  const fail = (m: string): never => {
    throw new Error(m);
  };
  if (!isDelegateDialect(raw)) fail("That code isn't a trading link.");
  const u = new URL(manifestUrl);
  const host = u.hostname;
  const siteName = loginSiteName(host) === host ? host : `${loginSiteName(host)} (${host})`;
  const grant = spendingGrant(host);
  if (!grant) {
    fail(
      isEcosystemSite(host)
        ? `honest.money hasn't approved ${siteName} for trading access, so no trading branch is reserved for it.`
        : `${host} isn't on the honest.money trusted list, so it can't be given trading access.`,
    );
  }
  const sameOrigin = (s: unknown) => {
    try {
      return typeof s === "string" && new URL(s).origin === u.origin;
    } catch {
      return false;
    }
  };
  if (!sameOrigin(raw["submit_url"]) || !sameOrigin(raw["revoke_url"])) {
    fail("Link sends keys to a different server.");
  }
  const token = raw["challenge_id"];
  const challenge = raw["challenge"];
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(token)) fail("Link is malformed.");
  if (typeof challenge !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(challenge)) fail("Link is malformed.");
  const exp = Date.parse(String(raw["expires_at"] ?? ""));
  if (!Number.isFinite(exp) || exp <= Date.now()) fail("This link has expired.");
  let recipientPub: Uint8Array = new Uint8Array();
  try {
    recipientPub = base64urlnopad.decode(String(raw["recipient_pubkey"] ?? "").trim().replace(/=+$/, ""));
  } catch {
    fail("Link is missing its encryption key.");
  }
  if (recipientPub.length !== 32) fail("Link is missing its encryption key.");

  const req = Array.isArray(raw["request"]) ? (raw["request"] as Record<string, unknown>[]) : [];
  const opt = Array.isArray(raw["request_optional"]) ? (raw["request_optional"] as Record<string, unknown>[]) : [];
  if (req.length === 0) fail("Link doesn't ask for any chain.");
  if (req.length + opt.length > 40) fail("Link is malformed.");

  const chains: PocketChain[] = [];
  const extraChains: LinkExtraChain[] = [];
  let requiredExtra = false;
  let requested: number | null = null;
  const entries = [...req.map((r) => ({ r, optional: false })), ...opt.map((r) => ({ r, optional: true }))];
  for (const { r, optional } of entries) {
    const chain = String(r?.["chain"] ?? "").toUpperCase();
    const core = (POCKET_CHAINS as readonly string[]).includes(chain);
    const extra = isLinkExtraChain(chain) && r?.["format"] === linkExtraFormat(chain);
    if (!core && !extra) {
      if (optional) continue;
      fail(`Unsupported chain: ${chain}`);
    }
    const n = core ? requestedAccountOf(chain as PocketChain, r["path"]) : extraAccountOf(chain as LinkExtraChain, r["path"]);
    if (n === null) fail(`Refused key request: ${chain} ${String(r["path"])} isn't a trading branch path.`);
    if (requested !== null && n !== requested) fail("Link asks for different branches on different chains.");
    requested = n;
    if (core) {
      if (!chains.includes(chain as PocketChain)) chains.push(chain as PocketChain);
    } else {
      if (!optional) requiredExtra = true;
      if (!extraChains.includes(chain as LinkExtraChain)) extraChains.push(chain as LinkExtraChain);
    }
  }

  const choice = chooseDelegateBranch({ host, siteName, requested: requested!, reserved: grant!.branches, book });
  if (!choice.ok) throw new Error(`Refused key request: ${choice.reason}`);
  const account = choice.account;
  const reusesRevoked = choice.reusesRevoked === true;
  const prior = existing.find((l) => l.host === host && l.account === account);

  if (prior?.mode === "access") {
    const droppedCore = prior.chains.filter((c) => !chains.includes(c));
    const droppedExtra = (prior.extraChains ?? []).filter((c) => !extraChains.includes(c));
    const dropped = [...droppedCore, ...droppedExtra.map((c) => EXTRA_CHAIN_LABEL[c] ?? c)];
    if (dropped.length) {
      fail(
        `This update would drop ${dropped.join(", ")} from your ${loginSiteName(host)} link. Nothing was changed. ` +
          `Ask ${loginSiteName(host)} to include every coin you already share, or revoke and link again.`,
      );
    }
  }

  const modes = grant!.modes.filter(
    (m) => m !== "approve" || (!requiredExtra && chains.length > 0 && prior?.mode !== "access" && !reusesRevoked),
  );
  if (modes.length === 0) {
    fail(
      reusesRevoked
        ? `Refused key request: you revoked ${siteName} from Trading pocket ${account} before. It still has that pocket's old keys, so it can only be linked again with "Give access", which honest.money doesn't allow for this site.`
        : `Refused key request: honest.money doesn't allow ${siteName} either kind of link for these coins.`,
    );
  }

  const app = (raw["app"] ?? {}) as Record<string, unknown>;
  const appName =
    typeof app["name"] === "string"
      ? app["name"].slice(0, 40)
      : typeof raw["app_name"] === "string"
        ? raw["app_name"].slice(0, 40)
        : loginSiteName(host);

  return {
    kind: "delegate",
    host,
    appName,
    ...(typeof raw["purpose"] === "string" ? { purpose: raw["purpose"].slice(0, 300) } : {}),
    token: token as string,
    challenge: challenge as string,
    chains,
    extraChains,
    requestedAccount: requested!,
    account,
    modes,
    ...(reusesRevoked ? { reusesRevoked: true } : {}),
    ...(prior
      ? {
          replaces: {
            linkId: prior.linkId,
            mode: prior.mode,
            addedExtraChains: extraChains.filter((c) => !(prior.extraChains ?? []).includes(c)),
          },
        }
      : {}),
    recipientPub,
    submitUrl: raw["submit_url"] as string,
    revokeUrl: raw["revoke_url"] as string,
    manifestUrl,
  };
}

/**
 * Seal bytes to an X25519 public key.
 * Format: ephemeralPub(32) || nonce(12) || AES-256-GCM ciphertext+tag
 * key = HKDF-SHA256(ikm = X25519(eph, recipient), salt = ephPub || recipientPub,
 *                   info = "hm-link-delegate v1"), 32 bytes.
 */
export async function sealTo(recipientPub: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const eph = x25519.utils.randomPrivateKey();
  const ephPub = x25519.getPublicKey(eph);
  const shared = x25519.getSharedSecret(eph, recipientPub);
  const salt = new Uint8Array(64);
  salt.set(ephPub, 0);
  salt.set(recipientPub, 32);
  const keyBytes = hkdf(sha256, shared, salt, new TextEncoder().encode("hm-link-delegate v1"), 32);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  try {
    const cryptoKey = await crypto.subtle.importKey("raw", new Uint8Array(keyBytes), { name: "AES-GCM" }, false, ["encrypt"]);
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cryptoKey, new Uint8Array(plaintext)),
    );
    const out = new Uint8Array(32 + 12 + ct.length);
    out.set(ephPub, 0);
    out.set(nonce, 32);
    out.set(ct, 44);
    return out;
  } finally {
    // Zero temporary plaintext bytes (note: JS strings and JSON copies cannot be wiped).
    plaintext.fill(0);
    keyBytes.fill(0);
    shared.fill(0);
    eph.fill(0);
  }
}

function hexOf(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function buildDelegateMessage(args: {
  host: string;
  challenge: string;
  paths: string[];
  mode: DelegateMode;
  payloadSha256: string;
}): string {
  const last =
    args.mode === "access"
      ? "I authorize this site to spend from these branches until I revoke."
      : "I authorize this site to propose trades from these branches. Each trade needs my approval.";
  return [
    "Honest Money - Link wallet (delegate)",
    "",
    `Domain: ${args.host}`,
    `Challenge: ${args.challenge}`,
    `Mode: ${args.mode}`,
    `Paths: ${args.paths.join(",")}`,
    `Payload-SHA256: ${args.payloadSha256}`,
    "",
    last,
  ].join("\n");
}

export async function refreshSpendingList(): Promise<void> {
  const registry = await getEcosystemSites().catch(() => null);
  if (!registry || registry.verified !== true) throw new Error(REGISTRY_UNREACHABLE);
  setEcosystemSites(registry.sites, true);
}

export async function submitDelegate(args: {
  walletAddr: string;
  manifest: DelegateManifest;
  mode: DelegateMode;
  mnemonic: string;
}): Promise<DelegateLinkRecord> {
  const { walletAddr, manifest, mode, mnemonic } = args;
  await refreshSpendingList();
  const grant = spendingGrant(manifest.host);
  if (!grant) throw new Error("This site is no longer on the verified spending list.");
  if (!grant.modes.includes(mode)) throw new Error("honest.money no longer allows this kind of link for this site.");
  if (!manifest.modes.includes(mode)) throw new Error("This link can't be used that way.");

  const existing = listDelegateLinks(walletAddr);
  const book = loadBranchBook(walletAddr, existing);
  const choice = chooseDelegateBranch({
    host: manifest.host,
    siteName: manifest.appName,
    requested: manifest.requestedAccount,
    reserved: grant.branches,
    book,
  });
  if (!choice.ok) throw new Error(choice.reason);
  if (choice.account !== manifest.account) {
    throw new Error("The trading branch for this site changed. Open the link again.");
  }
  if (choice.reusesRevoked && mode !== "access") {
    throw new Error(
      "This pocket was revoked from this site before and the site still has its old keys, so it can only be linked again with “Give access”.",
    );
  }
  const account = choice.account;
  claimBranch(walletAddr, book, manifest.host, account);

  const seed = mnemonicToSeedSync(mnemonic);
  const xpubs: Record<string, string> = {};
  const xprvs: Record<string, string> = {};
  const paths: string[] = [];
  const extraChains = mode === "access" ? manifest.extraChains : [];
  try {
    for (const c of manifest.chains) {
      const path = accountPath(c, account);
      const node = coreChainRoot(seed, c).derivePath(path);
      paths.push(path);
      xpubs[c] = node.neutered().toBase58();
      if (mode === "access") xprvs[c] = node.toBase58();
    }
    for (const c of extraChains) {
      const k = deriveExtraKey({ chain: c, account, seed, mnemonic, withPrivate: true });
      paths.push(k.path);
      xpubs[c] = k.pub;
      xprvs[c] = k.priv!;
    }
  } finally {
    seed.fill(0);
  }

  let payload: string | undefined;
  let payloadSha = "none";
  if (mode === "access") {
    const sealed = await sealTo(manifest.recipientPub, new TextEncoder().encode(JSON.stringify(xprvs)));
    for (const k of Object.keys(xprvs)) xprvs[k] = "";
    payload = base64url.encode(sealed);
    payloadSha = hexOf(sha256(sealed));
  }

  const message = buildDelegateMessage({
    host: manifest.host,
    challenge: manifest.challenge,
    paths,
    mode,
    payloadSha256: payloadSha,
  });
  const identityAddress = await deriveTxcAddress(mnemonic);
  const priv = derivePrivateKeyAtPath(mnemonic, TXC_PATH);
  const signature = signTxcMessage(priv, message);
  priv.fill(0);

  const res = await fetch(`${PROXY}?url=${encodeURIComponent(manifest.submitUrl)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      token: manifest.token,
      mode,
      account,
      paths,
      identity_address: identityAddress,
      signature,
      message,
      ...(payload ? { payload } : {}),
      xpubs,
      app_name: "CryptoPOP Wallet",
      app: { name: "CryptoPOP Wallet" },
    }),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    throw new Error((body?.["error"] as string) ?? (body?.["message"] as string) ?? `Link failed (${res.status})`);
  }
  const linkId = String(body?.["link_id"] ?? manifest.token);
  const record: DelegateLinkRecord = {
    linkId,
    host: manifest.host,
    appName: (body?.["linked_to"] as string) ?? manifest.appName,
    mode,
    account,
    chains: manifest.chains,
    ...(extraChains.length ? { extraChains: [...extraChains] } : {}),
    revokeUrl: manifest.revokeUrl,
    origin: new URL(manifest.manifestUrl).origin,
    identity: identityAddress,
    linkedAt: new Date().toISOString(),
  };
  saveDelegateLink(walletAddr, record);
  return record;
}

export async function revokeDelegate(args: {
  walletAddr: string;
  record: DelegateLinkRecord;
  mnemonic: string;
}): Promise<void> {
  const { walletAddr, record, mnemonic } = args;
  const message = [
    "Honest Money - Revoke link",
    "",
    `Domain: ${record.host}`,
    `Link: ${record.linkId}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");
  const identityAddress = await deriveTxcAddress(mnemonic);
  const priv = derivePrivateKeyAtPath(mnemonic, TXC_PATH);
  const signature = signTxcMessage(priv, message);
  priv.fill(0);

  const res = await fetch(`${PROXY}?url=${encodeURIComponent(record.revokeUrl)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ link_id: record.linkId, identity_address: identityAddress, signature, message }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    throw new Error((body?.["error"] as string) ?? `Revoke failed (${res.status})`);
  }
  if (record.mode === "access") retireBranch(walletAddr, record.account, record.host);
  removeDelegateLink(walletAddr, record.linkId);
}

/* ------------------------------ local records ---------------------------- */

const keyFor = (walletAddr: string) => `cryptopop:delegate-links:${walletAddr}`;

export function onePerSitePocket(list: DelegateLinkRecord[]): DelegateLinkRecord[] {
  const out: DelegateLinkRecord[] = [];
  for (const r of list) {
    const i = out.findIndex((l) => l.host === r.host && l.account === r.account);
    if (i < 0) out.push(r);
    else if (Date.parse(r.linkedAt) >= Date.parse(out[i]!.linkedAt)) out[i] = r;
  }
  return out;
}

export function listDelegateLinks(walletAddr: string): DelegateLinkRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(keyFor(walletAddr)) ?? "[]") as DelegateLinkRecord[];
    return Array.isArray(v) ? onePerSitePocket(v) : [];
  } catch {
    return [];
  }
}

function writeLinks(walletAddr: string, list: DelegateLinkRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(walletAddr), JSON.stringify(list));
  } catch {
    /* ignore storage quota errors */
  }
}

export function saveDelegateLink(walletAddr: string, r: DelegateLinkRecord): void {
  writeLinks(walletAddr, [
    ...listDelegateLinks(walletAddr).filter((l) => l.linkId !== r.linkId && !(l.host === r.host && l.account === r.account)),
    r,
  ]);
}

export function removeDelegateLink(walletAddr: string, linkId: string): void {
  writeLinks(walletAddr, listDelegateLinks(walletAddr).filter((l) => l.linkId !== linkId));
}