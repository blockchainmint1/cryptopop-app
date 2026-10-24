import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, options?: { context: { nonce: string } }) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-cryptopop-csp-nonce", nonce);
      const response = await handler.fetch(new Request(request, { headers: requestHeaders }), { context: { nonce } });
      const normalized = await normalizeCatastrophicSsrResponse(response);
      const headers = new Headers(normalized.headers);
      headers.set("Referrer-Policy", "no-referrer");
      headers.set("X-Content-Type-Options", "nosniff");
      if (headers.get("content-type")?.includes("text/html")) {
        const development = import.meta.env.DEV;
        headers.set("Content-Security-Policy", [
          "default-src 'self'",
          `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""} https://maps.googleapis.com https://maps.gstatic.com`,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' https: data: blob:",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.lovable.app https://*.lovable.dev https://honest.money https://*.honest.money https://cryptopop.org https://app.nectar-pay.com https://mempool.texitcoin.org https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com" + (development ? " ws: wss:" : ""),
          "frame-src 'self' https://*.lovable.dev https://*.lovable.app https://honest.money https://accounts.google.com",
          "worker-src 'self' blob:",
          "object-src 'none'", "base-uri 'self'", "form-action 'self' https://honest.money",
        ].join("; "));
      }
      return new Response(normalized.body, { status: normalized.status, statusText: normalized.statusText, headers });
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
