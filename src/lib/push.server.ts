/**
 * Firebase Cloud Messaging (HTTP v1) sender.
 *
 * Requires the FCM_SERVICE_ACCOUNT_JSON secret — the full service-account JSON
 * downloaded from Firebase console → Project settings → Service accounts.
 * iOS delivery goes through the same API once an APNs key is uploaded to Firebase.
 */

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let s = "";
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`)),
  );
  const assertion = `${header}.${claims}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`FCM auth failed [${res.status}]: ${body.error_description ?? "unknown"}`);
  }
  return body.access_token;
}

export interface PushMessage {
  title: string;
  body: string;
  url?: string | null;
}

export interface PushResult {
  sent: number;
  failed: number;
  invalidTokens: string[];
}

export async function sendPush(tokens: string[], msg: PushMessage): Promise<PushResult> {
  const raw = process.env["FCM_SERVICE_ACCOUNT_JSON"];
  if (!raw) throw new Error("FCM_SERVICE_ACCOUNT_JSON is not configured");
  const sa = JSON.parse(raw) as ServiceAccount;
  const accessToken = await getAccessToken(sa);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  for (const token of tokens) {
    const payload = {
      message: {
        token,
        notification: { title: msg.title, body: msg.body },
        data: msg.url ? { url: msg.url } : {},
        android: { priority: "HIGH" as const },
        apns: { payload: { aps: { sound: "default" } } },
      },
    };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        sent += 1;
      } else {
        failed += 1;
        const text = await res.text();
        console.error(`FCM send failed [${res.status}]: ${text}`);
        if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(text)) invalidTokens.push(token);
      }
    } catch (e) {
      failed += 1;
      console.error("FCM send threw", e);
    }
  }

  return { sent, failed, invalidTokens };
}
