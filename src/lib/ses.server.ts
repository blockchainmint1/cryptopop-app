import { createHash, createHmac } from "node:crypto";

/**
 * Minimal AWS SES v2 SendEmail using SigV4. No SDK dependency — works on
 * Cloudflare Workers / TanStack server runtime.
 */

export const FROM_EMAIL = "noreply@cryptopop.org";
export const FROM_NAME_DEFAULT = "CryptoPOP";

type SesHeader = { Name: string; Value: string };

export type SendSesArgs = {
  from: string;
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: SesHeader[];
  configurationSetName?: string;
};

export async function sendSesEmail(args: SendSesArgs): Promise<{ id: string }> {
  const region = process.env.AWS_SES_REGION;
  const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS SES not configured (need AWS_SES_REGION, AWS_SES_ACCESS_KEY_ID, AWS_SES_SECRET_ACCESS_KEY)",
    );
  }

  const toAddrs = Array.isArray(args.to) ? args.to : [args.to];
  const ccAddrs = args.cc
    ? Array.isArray(args.cc)
      ? args.cc
      : [args.cc]
    : undefined;

  const bodyContent: Record<string, unknown> = {
    Html: { Data: args.html, Charset: "UTF-8" },
  };
  if (args.text) bodyContent.Text = { Data: args.text, Charset: "UTF-8" };

  const body = JSON.stringify({
    FromEmailAddress: args.from,
    ...(args.configurationSetName
      ? { ConfigurationSetName: args.configurationSetName }
      : {}),
    Destination: {
      ToAddresses: toAddrs,
      ...(ccAddrs ? { CcAddresses: ccAddrs } : {}),
    },
    ReplyToAddresses: args.replyTo ? [args.replyTo] : undefined,
    Content: {
      Simple: {
        Subject: { Data: args.subject, Charset: "UTF-8" },
        Body: bodyContent,
        ...(args.headers?.length ? { Headers: args.headers } : {}),
      },
    },
  });

  const url = new URL(
    `https://email.${region}.amazonaws.com/v2/email/outbound-emails`,
  );
  const signedHeaders = signAwsJsonRequest({
    method: "POST",
    url,
    body,
    region,
    service: "ses",
    accessKeyId,
    secretAccessKey,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: signedHeaders,
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `SES send failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }
  const parsed = JSON.parse(text) as { MessageId?: string };
  return { id: parsed.MessageId ?? "" };
}

function signAwsJsonRequest(args: {
  method: "POST";
  url: URL;
  body: string;
  region: string;
  service: "ses";
  accessKeyId: string;
  secretAccessKey: string;
}): Record<string, string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const canonicalHeaders = `content-type:application/json\nhost:${args.url.host}\nx-amz-date:${amzDate}\n`;
  const signedHeadersStr = "content-type;host;x-amz-date";
  const canonicalRequest = [
    args.method,
    args.url.pathname,
    "",
    canonicalHeaders,
    signedHeadersStr,
    createHash("sha256").update(args.body).digest("hex"),
  ].join("\n");
  const credentialScope = `${dateStamp}/${args.region}/${args.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signingKey = getAwsSigningKey(
    args.secretAccessKey,
    dateStamp,
    args.region,
    args.service,
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  return {
    "Content-Type": "application/json",
    "X-Amz-Date": amzDate,
    Authorization: `AWS4-HMAC-SHA256 Credential=${args.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`,
  };
}

function getAwsSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = createHmac("sha256", `AWS4${secretAccessKey}`)
    .update(dateStamp)
    .digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  return createHmac("sha256", kService).update("aws4_request").digest();
}

/** Strip HTML to a rough plaintext fallback. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
