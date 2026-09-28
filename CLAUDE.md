# HIT Campus Assistant

WhatsApp chatbot + back-office dashboard for Harare Institute of Technology (HIT). Stack: Next.js 15 (App Router, TypeScript), Drizzle ORM, Postgres, WhatsApp Cloud API.

## Commands
- `npm run dev` start the app
- `npm run typecheck` / `npm test` must pass before finishing any task
- `npm run db:generate` after editing `src/db/schema.ts`, then `npm run db:migrate`
- `npm run db:seed` loads HIT schools/departments and starter FAQ content

## Layout
- `src/whatsapp/`: signature verification, webhook parsing, Graph API sending
- `src/bot/`: `router.ts` (what to reply), `match.ts` (keyword matching), `menus.ts`, `process.ts` (dedupe, log, send)
- `src/db/`: schema, client, seed
- `src/app/api/webhook/whatsapp/route.ts`: Meta webhook (GET verify, POST receive)

## Rules
- Rule-based first. Any AI added later must be scoped to campus topics (Meta bans general-purpose assistants on the WhatsApp Business API) and answer only from approved `content_items`.
- Never hardcode fees, dates, or account numbers in code. They live in `content_items` with an owner and `lastReviewedAt`.
- Never send student personal data (phone, student number) to any third-party AI API.
- Webhook must verify `X-Hub-Signature-256` against the raw body and respond 200 fast; work runs in `after()`.
- Broadcasts must skip users with `opted_out_at` set and require recorded consent.

## Next to build
1. Back-office dashboard (auth, content editor with owner/review date, unanswered-questions queue, shared inbox that replies through `sendText` and logs outbound messages, tickets open/assign/close)
2. Router end-to-end tests against a real Postgres (PGlite works)
3. Student verification (student number + OTP) using `conversation_state`
4. Opt-in alerts with approved templates and faculty/level segmentation
Later modules: canteen and campus marketplace, laptop asset registry, tone modes, WhatsApp Flows for applications.
