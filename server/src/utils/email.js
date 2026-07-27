/**
 * Email helper — powered by Resend (resend.com)
 *
 * Setup:
 *  1. Sign up free at https://resend.com
 *  2. Get your API key from the dashboard
 *  3. Add RESEND_API_KEY to your Vercel env vars (and local .env)
 *  4. (Optional) Add RESEND_FROM_EMAIL — defaults to onboarding@resend.dev (works for testing)
 *     For production, add your own domain in Resend and use noreply@yourdomain.com
 *
 * If RESEND_API_KEY is missing, emails are skipped silently — no crashes.
 */

import { Resend } from 'resend'

const RESEND_API_KEY  = process.env.RESEND_API_KEY
const FROM_EMAIL      = process.env.RESEND_FROM_EMAIL || 'Pinlooply <onboarding@resend.dev>'
const ADMIN_EMAIL     = process.env.ADMIN_EMAIL        || ''
const APP_NAME        = 'Pinlooply'
const APP_URL         = process.env.CLIENT_URL          || 'https://pinlooply.vercel.app'

let resend = null
function getClient() {
  if (!resend && RESEND_API_KEY) resend = new Resend(RESEND_API_KEY)
  return resend
}

// ── Core send ─────────────────────────────────────────────────
export async function sendEmail({ to, subject, html, replyTo }) {
  const client = getClient()
  if (!client) {
    console.log('[email] RESEND_API_KEY not set — skipping:', subject)
    return { skipped: true }
  }
  if (!to) return { skipped: true }

  try {
    const { data, error } = await client.emails.send({
      from:     FROM_EMAIL,
      to:       Array.isArray(to) ? to : [to],
      subject,
      html,
      reply_to: replyTo || undefined,
    })
    if (error) console.error('[email] send error:', error)
    return { data, error }
  } catch (err) {
    console.error('[email] unexpected error:', err.message)
    return { error: err.message }
  }
}

// ── Shared HTML wrapper ───────────────────────────────────────
function wrap(title, body) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;text-align:center">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px">${APP_NAME}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px">
            <h2 style="margin:0 0 12px;font-size:17px;font-weight:600;color:#1c1917">${title}</h2>
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #f0eeeb;text-align:center">
            <p style="margin:0;font-size:11px;color:#a8a29e">
              ${APP_NAME} · <a href="${APP_URL}" style="color:#6366f1;text-decoration:none">Open app</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function p(text) {
  return `<p style="margin:0 0 12px;font-size:14px;color:#44403c;line-height:1.6">${text}</p>`
}
function blockquote(text) {
  return `<blockquote style="margin:12px 0;padding:12px 16px;background:#faf9f7;border-left:3px solid #6366f1;border-radius:0 8px 8px 0;font-size:13px;color:#57534e;line-height:1.6;font-style:italic">${text}</blockquote>`
}
function badge(text, color = '#6366f1') {
  return `<span style="display:inline-block;background:${color}20;color:${color};font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;margin-bottom:12px">${text}</span>`
}
function btn(text, href) {
  return `<a href="${href}" style="display:inline-block;background:#6366f1;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;margin-top:8px">${text}</a>`
}

// ── Specific email templates ──────────────────────────────────

/** Auto-reply to user who submitted feedback */
export async function sendFeedbackAck({ to, name, category, message }) {
  const displayName = name ? `, ${name.split(' ')[0]}` : ''
  const catLabel    = { bug: '🐛 Bug Report', feature: '✨ Feature Request', general: '💬 General Feedback' }[category] || 'Feedback'

  return sendEmail({
    to,
    subject: `We got your feedback — ${APP_NAME}`,
    html: wrap(
      `Thanks for your feedback${displayName}! 🙏`,
      `${p(`We received your <strong>${catLabel}</strong> and really appreciate you taking the time to share it.`)}
       ${blockquote(message.length > 200 ? message.slice(0, 200) + '…' : message)}
       ${p('We review every piece of feedback personally. If you shared your email, we\'ll get back to you as soon as we can.')}
       ${p('Thanks again for helping us make Pinlooply better! ❤️')}
       ${btn('Open Pinlooply', APP_URL)}`
    ),
  })
}

/** Admin notification — new feedback received */
export async function notifyAdminFeedback({ name, email, category, rating, message }) {
  if (!ADMIN_EMAIL) return { skipped: true }
  const catLabel = { bug: '🐛 Bug Report', feature: '✨ Feature Request', general: '💬 General' }[category] || category
  const stars    = rating ? '⭐'.repeat(rating) + ` (${rating}/5)` : 'Not rated'

  return sendEmail({
    to:      ADMIN_EMAIL,
    subject: `[${APP_NAME}] New feedback: ${catLabel}`,
    replyTo: email || undefined,
    html: wrap(
      `New feedback received`,
      `${badge(catLabel)}
       ${p(`<strong>From:</strong> ${name || 'Anonymous'}${email ? ` · <a href="mailto:${email}" style="color:#6366f1">${email}</a>` : ''}`)}
       ${p(`<strong>Rating:</strong> ${stars}`)}
       ${blockquote(message)}
       ${email ? btn('Reply to this person', `mailto:${email}?subject=Re: Your feedback on ${APP_NAME}`) : ''}
       ${btn('View all feedback in Admin', `${APP_URL}/admin`)}`
    ),
  })
}

/** Auto-reply to donor */
export async function sendDonorAck({ to, name, method, amount }) {
  const displayName = name.split(' ')[0]
  const methodLabel = { upi: 'UPI', paypal: 'PayPal', buymeacoffee: 'Buy Me a Coffee' }[method] || method
  const amtNote     = amount ? ` of ${amount}` : ''

  return sendEmail({
    to,
    subject: `You just made our day, ${displayName}! 💖`,
    html: wrap(
      `Thank you for your donation, ${displayName}! 🎉`,
      `${p(`Your donation${amtNote} via <strong>${methodLabel}</strong> means more than you know.`)}
       ${p(`${APP_NAME} is a solo-built project, and support like yours is what keeps it alive and growing. Every rupee / dollar truly matters.`)}
       ${p(`We'll send you a personal thank-you note shortly. In the meantime, if you ever have feedback or feature requests, just reply to this email — we'd love to hear from you!`)}
       ${p(`From the bottom of our hearts — thank you. ❤️`)}
       ${btn('Open Pinlooply', APP_URL)}`
    ),
  })
}

/** Admin notification — new donor */
export async function notifyAdminDonor({ name, email, method, amount, message }) {
  if (!ADMIN_EMAIL) return { skipped: true }
  const methodLabel = { upi: '🇮🇳 UPI', paypal: '💳 PayPal', buymeacoffee: '☕ Buy Me a Coffee' }[method] || method

  return sendEmail({
    to:      ADMIN_EMAIL,
    subject: `[${APP_NAME}] 💰 New donor: ${name}`,
    replyTo: email,
    html: wrap(
      `Someone just donated! 🎉`,
      `${badge(methodLabel, '#16a34a')}
       ${p(`<strong>${name}</strong> · <a href="mailto:${email}" style="color:#6366f1">${email}</a>`)}
       ${amount ? p(`<strong>Amount:</strong> ${amount}`) : ''}
       ${message ? blockquote(message) : ''}
       ${btn(`Reply & Thank ${name.split(' ')[0]}`, `mailto:${email}?subject=Thank you for supporting ${APP_NAME}!&body=Hi ${name.split(' ')[0]},%0A%0AThank you so much for your generous donation!`)}
       ${btn('View all donors', `${APP_URL}/admin`)}`
    ),
  })
}

/** Admin sends a custom reply to a feedback/donor */
export async function sendAdminReply({ to, name, replyText, subject }) {
  const firstName = (name || 'there').split(' ')[0]
  return sendEmail({
    to,
    subject: subject || `Re: Your message — ${APP_NAME}`,
    html: wrap(
      `A message from the ${APP_NAME} team`,
      `${p(`Hi ${firstName},`)}
       ${blockquote(replyText)}
       ${p(`Feel free to reply to this email anytime. We love hearing from our users!`)}
       ${btn('Open Pinlooply', APP_URL)}`
    ),
  })
}
