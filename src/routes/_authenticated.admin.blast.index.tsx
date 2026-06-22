import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send, Eye, Mail, AlertTriangle } from "lucide-react";
import {
  validateBlast,
  sendBlastTest,
  previewBlast,
  sendBlast,
  listEmailTemplates,
} from "@/lib/blast.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/blast/")({
  head: () => ({ meta: [{ title: "New Blast — CryptoPOP Admin" }] }),
  component: BlastCompose,
});

type Validation = Awaited<ReturnType<typeof validateBlast>>;

const DEFAULT_HTML = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111;">
  <h1 style="font-family:Helvetica,Arial,sans-serif;font-size:28px;margin:0 0 16px;">Hello from CryptoPOP</h1>
  <p style="font-size:15px;line-height:1.6;">
    Replace this with your message. The unsubscribe footer is added automatically.
  </p>
</div>`;

const TAG_HINTS = [
  "#all",
  "#signups",
  "#rsvps",
  "#has-account",
  "#has-wallet",
  "#checked-in",
  "#rsvp:<event-slug>",
];

function BlastCompose() {
  const validate = useServerFn(validateBlast);
  const sendTest = useServerFn(sendBlastTest);
  const preview = useServerFn(previewBlast);
  const send = useServerFn(sendBlast);
  const listTemplates = useServerFn(listEmailTemplates);

  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [fromName, setFromName] = useState("CryptoPOP");
  const [fromEmail, setFromEmail] = useState("noreply@cryptopop.org");
  const [replyTo, setReplyTo] = useState("");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; subject: string | null; html: string; preview_text: string | null }>
  >([]);

  useEffect(() => {
    listTemplates({ data: {} as never })
      .then((r) =>
        setTemplates(
          r.rows.map((t) => ({
            id: t.id,
            name: t.name,
            subject: t.subject,
            html: t.html,
            preview_text: t.preview_text,
          })),
        ),
      )
      .catch(() => {});
  }, [listTemplates]);

  async function handleValidate() {
    setBusy("validate");
    try {
      const r = await validate({ data: { recipientsRaw } });
      setValidation(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleTest() {
    if (!testEmail) return toast.error("Enter a test email");
    setBusy("test");
    try {
      await sendTest({
        data: { subject, html, fromName, fromEmail, replyTo: replyTo || undefined, testEmail },
      });
      toast.success(`Test sent to ${testEmail}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test send failed");
    } finally {
      setBusy(null);
    }
  }

  async function handlePreview() {
    setBusy("preview");
    try {
      const r = await preview({
        data: { html, sampleEmail: testEmail || "preview@example.com" },
      });
      setPreviewHtml(r.html);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleSend() {
    if (confirmText !== "CONFIRM") {
      return toast.error("Type CONFIRM to send");
    }
    setBusy("send");
    try {
      const r = await send({
        data: {
          subject,
          previewText: previewText || undefined,
          html,
          fromName,
          fromEmail,
          replyTo: replyTo || undefined,
          recipientsRaw,
          confirmText,
        },
      });
      toast.success(
        `Blast queued: ${r.queued} recipients (${r.skippedSuppressed} suppressed)`,
      );
      setConfirmText("");
      setValidation(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-4">
        <Card className="p-5 space-y-4">
          <h2 className="font-display text-lg">Compose</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From name</Label>
              <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </div>
            <div>
              <Label>From email</Label>
              <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Reply-To (optional)</Label>
              <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="hello@cryptopop.org" />
            </div>
            <div className="col-span-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Preview text (optional)</Label>
              <Input value={previewText} onChange={(e) => setPreviewText(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>HTML</Label>
              {templates.length > 0 && (
                <select
                  className="text-xs bg-background border border-border rounded px-2 py-1"
                  onChange={(e) => {
                    const t = templates.find((tp) => tp.id === e.target.value);
                    if (!t) return;
                    setHtml(t.html);
                    if (t.subject) setSubject(t.subject);
                    if (t.preview_text) setPreviewText(t.preview_text);
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Load template…
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <Textarea
              className="font-mono text-xs h-64"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
            />
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Recipients</h2>
            <span className="text-xs text-muted-foreground">
              paste emails, comma/space/newline separated
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TAG_HINTS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setRecipientsRaw((r) => (r ? `${r}\n${t}` : t))
                }
                className="text-[11px] font-mono px-2 py-1 rounded-full bg-secondary hover:bg-secondary/80"
              >
                {t}
              </button>
            ))}
          </div>
          <Textarea
            className="font-mono text-xs h-40"
            value={recipientsRaw}
            onChange={(e) => setRecipientsRaw(e.target.value)}
            placeholder="alice@example.com, bob@example.com&#10;#signups"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidate}
              disabled={!recipientsRaw || busy === "validate"}
            >
              {busy === "validate" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Validate
            </Button>
          </div>

          {validation && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Will send: {validation.willSend}</Badge>
                <Badge variant="secondary">Valid: {validation.validCount}</Badge>
                <Badge variant="secondary">Dupes: {validation.duplicates}</Badge>
                {validation.invalidCount > 0 && (
                  <Badge variant="destructive">
                    Invalid: {validation.invalidCount}
                  </Badge>
                )}
                {validation.suppressed.length > 0 && (
                  <Badge variant="outline">
                    Suppressed: {validation.suppressed.length}
                  </Badge>
                )}
              </div>
              {validation.resolvedTags.length > 0 && (
                <div className="pt-2 text-muted-foreground">
                  Resolved tags:{" "}
                  {validation.resolvedTags
                    .map((t) => `${t.tag}=${t.count}`)
                    .join(", ")}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-5 space-y-3">
          <h2 className="font-display text-lg flex items-center gap-2">
            <Mail className="h-4 w-4" /> Test
          </h2>
          <Input
            placeholder="you@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePreview}
              disabled={busy === "preview"}
            >
              <Eye className="h-4 w-4 mr-2" /> Preview
            </Button>
            <Button
              size="sm"
              onClick={handleTest}
              disabled={!testEmail || !subject || busy === "test"}
            >
              {busy === "test" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send test
            </Button>
          </div>
        </Card>

        <Card className="p-5 space-y-3 border-primary/40">
          <h2 className="font-display text-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" /> Send to all
          </h2>
          <p className="text-xs text-muted-foreground">
            Validate first. Type{" "}
            <span className="font-mono text-foreground">CONFIRM</span> to enable
            the send button. The blast drains in the background.
          </p>
          <Input
            placeholder="Type CONFIRM"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
          <Button
            className="w-full"
            disabled={
              !validation ||
              validation.willSend === 0 ||
              confirmText !== "CONFIRM" ||
              !subject ||
              busy === "send"
            }
            onClick={handleSend}
          >
            {busy === "send" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send blast
          </Button>
        </Card>

        {previewHtml && (
          <Card className="p-3 space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground px-2 pt-1">
              Preview
            </div>
            <iframe
              title="preview"
              className="w-full h-[420px] rounded-md border border-border bg-white"
              srcDoc={previewHtml}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
