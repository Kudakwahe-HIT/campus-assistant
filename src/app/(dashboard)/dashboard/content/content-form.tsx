'use client';

import { useActionState } from 'react';
import { saveContentAction, type FormState } from './actions';

export type ContentFormValues = {
  id: string | null;
  category: string;
  title: string;
  keywords: string;
  body: string;
  ownerName: string;
  lastReviewedAt: string; // YYYY-MM-DD or ''
  isPublished: boolean;
  fromQuestion: string | null;
};

export function ContentForm({ values: initial, categories }: { values: ContentFormValues; categories: readonly string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveContentAction, {});
  const values = { ...initial, ...state.values } as ContentFormValues;

  return (
    // Remount with the returned values after an error: React's post-action form reset
    // puts a <select> back to its mount-time option, ignoring the new defaultValue.
    <form key={state.values ? JSON.stringify(state.values) : 'initial'} action={action} className="panel">
      {state.error && <div className="alert error">{state.error}</div>}
      {values.id && <input type="hidden" name="id" value={values.id} />}
      {values.fromQuestion && <input type="hidden" name="fromQuestion" value={values.fromQuestion} />}

      <div className="grid2">
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" type="text" defaultValue={values.title} required maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={values.category} required>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="body">
          Answer <span className="hint">(sent to students exactly as written; *bold* works in WhatsApp)</span>
        </label>
        <textarea id="body" name="body" rows={10} defaultValue={values.body} required maxLength={4000} />
      </div>

      <div className="field">
        <label htmlFor="keywords">
          Keywords <span className="hint">(comma separated; phrases students actually type, e.g. &quot;how to apply, apply online&quot;)</span>
        </label>
        <textarea id="keywords" name="keywords" rows={2} defaultValue={values.keywords} />
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="ownerName">
            Owner <span className="hint">(office responsible for keeping this correct)</span>
          </label>
          <input id="ownerName" name="ownerName" type="text" defaultValue={values.ownerName} placeholder="e.g. Admissions Office" />
        </div>
        <div className="field">
          <label htmlFor="lastReviewedAt">
            Last reviewed <span className="hint">(date the owner confirmed the facts)</span>
          </label>
          <input id="lastReviewedAt" name="lastReviewedAt" type="date" defaultValue={values.lastReviewedAt} />
        </div>
      </div>

      <div className="field">
        <label className="check">
          <input type="checkbox" name="isPublished" defaultChecked={values.isPublished} />
          Published: the bot may use this answer <span className="hint">(needs an owner and a review date)</span>
        </label>
      </div>

      <div className="row">
        <button className="primary" type="submit" name="intent" value="review" disabled={pending}>
          Save &amp; mark reviewed today
        </button>
        <button type="submit" name="intent" value="save" disabled={pending}>
          Save
        </button>
        {pending && <span className="muted small">Saving…</span>}
      </div>
    </form>
  );
}
