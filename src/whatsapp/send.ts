import { env } from '../env';
import type { Reply } from '../bot/types';

// WhatsApp Cloud API limits
const LIMITS = { text: 4096, interactiveBody: 1024, buttonTitle: 20, rowTitle: 24, rowDesc: 72, sectionTitle: 24 };

export function clip(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

async function callApi(payload: Record<string, unknown>): Promise<string | undefined> {
  const url = `https://graph.facebook.com/${env.apiVersion}/${env.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
  });
  if (!res.ok) {
    throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { messages?: { id: string }[] };
  return data.messages?.[0]?.id;
}

export function sendText(to: string, body: string) {
  return callApi({ to, type: 'text', text: { body: clip(body, LIMITS.text), preview_url: false } });
}

export async function sendReply(to: string, reply: Reply): Promise<string | undefined> {
  switch (reply.kind) {
    case 'text':
      return sendText(to, reply.body);

    case 'buttons':
      return callApi({
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: clip(reply.body, LIMITS.interactiveBody) },
          action: {
            buttons: reply.buttons.slice(0, 3).map((b) => ({
              type: 'reply',
              reply: { id: b.id, title: clip(b.title, LIMITS.buttonTitle) },
            })),
          },
        },
      });

    case 'list':
      return callApi({
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: clip(reply.body, LIMITS.interactiveBody) },
          action: {
            button: clip(reply.button, LIMITS.buttonTitle),
            sections: reply.sections.map((s) => ({
              ...(s.title ? { title: clip(s.title, LIMITS.sectionTitle) } : {}),
              rows: s.rows.map((r) => ({
                id: r.id,
                title: clip(r.title, LIMITS.rowTitle),
                ...(r.description ? { description: clip(r.description, LIMITS.rowDesc) } : {}),
              })),
            })),
          },
        },
      });
  }
}

/** Short text version of a reply, for the message log. */
export function replyPreview(reply: Reply): string {
  return reply.body;
}
