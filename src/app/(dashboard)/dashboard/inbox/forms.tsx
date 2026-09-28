'use client';

import { useActionState } from 'react';
import { reopenTicketAction, replyAction, type ReplyState } from './actions';

export function ReplyForm({ ticketId, disabledReason }: { ticketId: string; disabledReason: string | null }) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(replyAction, {});

  return (
    <form action={action} className="panel" style={{ marginTop: 12 }}>
      {state.error && <div className="alert error">{state.error}</div>}
      {disabledReason && <div className="alert warn">{disabledReason}</div>}
      <input type="hidden" name="ticketId" value={ticketId} />
      <div className="field">
        <label htmlFor="body">Reply on WhatsApp</label>
        <textarea
          // New key after a successful send clears the box; on error the draft is kept.
          key={state.sentAt ?? 'draft'}
          id="body"
          name="body"
          rows={4}
          maxLength={4096}
          defaultValue={state.draft ?? ''}
          disabled={!!disabledReason}
          required
        />
      </div>
      <div className="row">
        <button className="primary" type="submit" disabled={pending || !!disabledReason}>
          {pending ? 'Sending…' : 'Send'}
        </button>
        <span className="muted small">Sent as plain text from the HIT WhatsApp number. Your name is logged.</span>
      </div>
    </form>
  );
}

export function ReopenForm({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(reopenTicketAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <button type="submit" disabled={pending}>
        Reopen
      </button>
      {state.error && <span className="small" style={{ color: 'var(--bad)', marginLeft: 8 }}>{state.error}</span>}
    </form>
  );
}
