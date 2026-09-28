export type Button = { id: string; title: string };
export type ListRow = { id: string; title: string; description?: string };

/** Channel-agnostic reply. The WhatsApp layer turns these into API calls. */
export type Reply =
  | { kind: 'text'; body: string }
  | { kind: 'buttons'; body: string; buttons: Button[] }
  | {
      kind: 'list';
      body: string;
      button: string;
      sections: { title?: string; rows: ListRow[] }[];
    };
