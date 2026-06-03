import * as React from 'react'
import { render } from '@react-email/components'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'CryptoPOP'
const SENDER_DOMAIN = 'notify.cryptopop.asia'
const FROM_DOMAIN = 'cryptopop.asia'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Enqueue a transactional email directly from server-side code (server fns,
 * webhook handlers, etc). Use this from public/unauthenticated triggers
 * where the JWT-protected /lovable/email/transactional/send route can't be
 * called. Handles suppression check, unsubscribe-token reuse, render, and
 * enqueue to pgmq.
 *
 * Returns { ok: true, queued: true } on success or { ok: false, reason }
 * on suppression / lookup failure. NEVER throws — email failures must not
 * break the user-facing flow.
 */
export async function enqueueTransactionalEmail(params: {
  templateName: string
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, any>
}): Promise<{ ok: boolean; reason?: string; queued?: boolean }> {
  const { templateName, recipientEmail, templateData = {} } = params
  const messageId = crypto.randomUUID()
  const idempotencyKey = params.idempotencyKey || messageId

  try {
    const template = TEMPLATES[templateName]
    if (!template) {
      console.error('[enqueueTransactionalEmail] unknown template', { templateName })
      return { ok: false, reason: 'unknown_template' }
    }

    const effectiveRecipient = template.to || recipientEmail
    if (!effectiveRecipient) return { ok: false, reason: 'missing_recipient' }
    const normalizedEmail = effectiveRecipient.toLowerCase()

    // Suppression check (fail-closed)
    const { data: suppressed, error: suppressionError } = await supabaseAdmin
      .from('suppressed_emails')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (suppressionError) {
      console.error('[enqueueTransactionalEmail] suppression check failed', suppressionError)
      return { ok: false, reason: 'suppression_check_failed' }
    }
    if (suppressed) {
      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'suppressed',
      })
      return { ok: false, reason: 'email_suppressed' }
    }

    // Get or create unsubscribe token (one per email address)
    let unsubscribeToken: string
    const { data: existingToken } = await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .select('token, used_at')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingToken && !existingToken.used_at) {
      unsubscribeToken = existingToken.token
    } else if (!existingToken) {
      const candidate = generateToken()
      await supabaseAdmin
        .from('email_unsubscribe_tokens')
        .upsert({ token: candidate, email: normalizedEmail }, {
          onConflict: 'email',
          ignoreDuplicates: true,
        })
      const { data: stored } = await supabaseAdmin
        .from('email_unsubscribe_tokens')
        .select('token')
        .eq('email', normalizedEmail)
        .maybeSingle()
      if (!stored) return { ok: false, reason: 'token_storage_failed' }
      unsubscribeToken = stored.token
    } else {
      // Token already used but somehow not suppressed — skip
      return { ok: false, reason: 'email_suppressed' }
    }

    const element = React.createElement(template.component, templateData)
    const html = await render(element)
    const text = await render(element, { plainText: true })
    const subject =
      typeof template.subject === 'function'
        ? template.subject(templateData)
        : template.subject

    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'pending',
    })

    const { error: enqueueError } = await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: effectiveRecipient,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: 'transactional',
        label: templateName,
        idempotency_key: idempotencyKey,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    })

    if (enqueueError) {
      console.error('[enqueueTransactionalEmail] enqueue failed', enqueueError)
      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to enqueue email',
      })
      return { ok: false, reason: 'enqueue_failed' }
    }

    return { ok: true, queued: true }
  } catch (err) {
    console.error('[enqueueTransactionalEmail] unexpected error', err)
    return { ok: false, reason: 'unexpected_error' }
  }
}
