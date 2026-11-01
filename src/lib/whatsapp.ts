import 'server-only';
import { getEnv, whatsappEnabled } from './env';
import { ApiError } from './http';

/**
 * Sends an OTP through the Meta WhatsApp Cloud API using an approved
 * "Authentication" template with one body parameter (the code) and the
 * standard copy code button.
 */
export async function sendWhatsAppOtp(phoneE164: string, code: string): Promise<void> {
  if (!whatsappEnabled()) throw new ApiError(400, 'WhatsApp verification is not switched on for this board.');
  const e = getEnv();
  const to = phoneE164.replace(/^\+/, '');
  const res = await fetch(`https://graph.facebook.com/v21.0/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: e.WHATSAPP_OTP_TEMPLATE,
        language: { code: e.WHATSAPP_TEMPLATE_LANG || 'en' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[whatsapp] send failed', res.status, body.slice(0, 500));
    throw new ApiError(502, 'We could not send the WhatsApp code. Check the number is on WhatsApp and try again.');
  }
}
