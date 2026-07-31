/**
 * Biometric unlock for the CryptoPOP wallet.
 *
 * The vault is always encrypted on disk with the user's password
 * (PBKDF2 + AES-GCM, see src/lib/wallet/vault.ts). When the user opts in to
 * Face ID / fingerprint unlock, we store the plaintext password in the OS
 * secure store (iOS Keychain / Android Keystore) and only read it back after
 * a successful biometric prompt. The password always remains a fallback.
 *
 * On the web everything here is a no-op: `isBiometricAvailable()` is false and
 * `enableBiometric()` throws.
 */
import { isNative } from "./platform";

const SECURE_KEY = "cryptopop.wallet.bio.password.v1";
const FLAG_KEY = "cryptopop.wallet.bio.enabled.v1";

export interface BiometricStatus {
  available: boolean;
  enabled: boolean;
}

async function loadPlugins() {
  if (!isNative()) return null;
  const [{ BiometricAuth }, { SecureStorage }] = await Promise.all([
    import("@aparajita/capacitor-biometric-auth"),
    import("@aparajita/capacitor-secure-storage"),
  ]);
  return { BiometricAuth, SecureStorage };
}

export async function isBiometricAvailable(): Promise<boolean> {
  const plugins = await loadPlugins();
  if (!plugins) return false;
  try {
    const info = await plugins.BiometricAuth.checkBiometry();
    return info.isAvailable === true;
  } catch {
    return false;
  }
}

let cachedFlag: boolean | null = null;

async function readFlag(): Promise<boolean> {
  if (cachedFlag !== null) return cachedFlag;
  const plugins = await loadPlugins();
  if (!plugins) {
    cachedFlag = false;
    return false;
  }
  try {
    const v = await plugins.SecureStorage.get(FLAG_KEY, true, false).catch(() => null);
    cachedFlag = v === "1";
    return cachedFlag;
  } catch {
    cachedFlag = false;
    return false;
  }
}

export function isBiometricEnabled(): boolean {
  return cachedFlag === true;
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  const available = await isBiometricAvailable();
  const enabled = available ? await readFlag() : false;
  return { available, enabled };
}

/** Store the wallet password in the OS secure store behind a biometric gate. */
export async function enableBiometric(password: string): Promise<void> {
  const plugins = await loadPlugins();
  if (!plugins) throw new Error("Biometric unlock is only available in the mobile app.");
  await plugins.BiometricAuth.authenticate({
    reason: "Enable Face ID / fingerprint unlock for your CryptoPOP wallet",
    cancelTitle: "Cancel",
    allowDeviceCredential: false,
    iosFallbackTitle: "Use Passcode",
    androidTitle: "Enable biometric unlock",
    androidSubtitle: "Confirm your identity to enable biometric unlock",
  });
  await plugins.SecureStorage.set(SECURE_KEY, password, true, false);
  await plugins.SecureStorage.set(FLAG_KEY, "1", true, false);
  cachedFlag = true;
}

export async function disableBiometric(): Promise<void> {
  const plugins = await loadPlugins();
  if (plugins) {
    try {
      await plugins.SecureStorage.remove(SECURE_KEY);
    } catch {
      /* ignore */
    }
    try {
      await plugins.SecureStorage.remove(FLAG_KEY);
    } catch {
      /* ignore */
    }
  }
  cachedFlag = false;
}

/** Prompt for biometrics and return the stored password, or null on cancel. */
export async function unlockWithBiometric(): Promise<string | null> {
  const plugins = await loadPlugins();
  if (!plugins) return null;
  const enabled = await readFlag();
  if (!enabled) return null;
  try {
    await plugins.BiometricAuth.authenticate({
      reason: "Unlock your CryptoPOP wallet",
      cancelTitle: "Use password",
      allowDeviceCredential: false,
      iosFallbackTitle: "Use Passcode",
      androidTitle: "Unlock wallet",
      androidSubtitle: "Confirm your identity",
    });
    const pw = await plugins.SecureStorage.get(SECURE_KEY, true, false);
    return typeof pw === "string" ? pw : null;
  } catch {
    return null;
  }
}

/** Re-confirm with biometrics before a sensitive action. True when unavailable. */
export async function confirmWithBiometric(reason: string): Promise<boolean> {
  const plugins = await loadPlugins();
  if (!plugins) return true;
  const enabled = await readFlag();
  if (!enabled) return true;
  try {
    await plugins.BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancel",
      allowDeviceCredential: false,
      iosFallbackTitle: "Use Passcode",
      androidTitle: "Confirm",
      androidSubtitle: reason,
    });
    return true;
  } catch {
    return false;
  }
}
