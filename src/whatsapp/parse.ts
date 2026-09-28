export type InboundMessage = {
  waMessageId: string;
  from: string; // wa_id (digits, with country code)
  profileName?: string;
  timestamp: number; // unix seconds
  /** 'text' = typed; 'reply' = tapped a button or list row; 'unsupported' = image, audio, etc. */
  kind: 'text' | 'reply' | 'unsupported';
  text?: string;
  replyId?: string;
};

type WaMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  button?: { payload: string; text: string };
};

type WaPayload = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: WaMessage[];
      };
    }[];
  }[];
};

/** Pulls inbound user messages out of a webhook payload. Status updates are ignored. */
export function extractInbound(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (payload as WaPayload)?.entry ?? [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;
      const names = new Map((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));

      for (const msg of value.messages) {
        const base = {
          waMessageId: msg.id,
          from: msg.from,
          profileName: names.get(msg.from),
          timestamp: Number(msg.timestamp) || 0,
        };
        const reply = msg.interactive?.button_reply ?? msg.interactive?.list_reply;

        if (msg.type === 'text' && msg.text) {
          out.push({ ...base, kind: 'text', text: msg.text.body });
        } else if (msg.type === 'interactive' && reply) {
          out.push({ ...base, kind: 'reply', text: reply.title, replyId: reply.id });
        } else if (msg.type === 'button' && msg.button) {
          out.push({ ...base, kind: 'reply', text: msg.button.text, replyId: msg.button.payload });
        } else {
          out.push({ ...base, kind: 'unsupported' });
        }
      }
    }
  }
  return out;
}
