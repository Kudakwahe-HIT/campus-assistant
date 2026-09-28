import { after } from 'next/server';
import { env } from '../../../../env';
import { processInbound } from '../../../../bot/process';
import { extractInbound } from '../../../../whatsapp/parse';
import { verifySignature } from '../../../../whatsapp/verify';

export const dynamic = 'force-dynamic';

// Meta calls this once when you register the webhook.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === env.verifyToken) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// Meta posts every inbound message here. Reply 200 fast, work after.
export async function POST(req: Request) {
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'), env.appSecret)) {
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const inbound = extractInbound(payload);
  after(async () => {
    for (const m of inbound) {
      try {
        await processInbound(m);
      } catch (err) {
        console.error('webhook processing error', err);
      }
    }
  });

  return new Response('ok', { status: 200 });
}
