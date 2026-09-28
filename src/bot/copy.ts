// Bot copy: names and other values that show up in user-facing text.
// Copy itself still lives in code (src/bot/menus.ts, src/bot/router.ts); this is the
// variable layer so wording doesn't hardcode the bot's name. When copy moves into a
// database (see CLAUDE.md "Next to build" — a message_templates table with tone and
// language), templates keep using the same {bot_name} token and fill() keeps working.

export const BOT_NAME = 'Trish';

const VARS: Record<string, string> = { bot_name: BOT_NAME };

/** Replaces {var} placeholders in a copy string. Unknown placeholders are left as-is. */
export function fill(template: string): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => VARS[key] ?? match);
}
