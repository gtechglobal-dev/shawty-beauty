// Telegram notification helper.
//
// Sends a message to a Telegram chat/channel via the Bot API. To enable:
//   1. Create a bot with @BotFather on Telegram and get its token.
//   2. Get your chat id (e.g. via @userinfobot or @RawDataBot), or use the
//      channel id for a channel. New Group-style ids start with a minus sign.
//   3. Set these environment variables:
//        TELEGRAM_BOT_TOKEN=<bot token>
//        TELEGRAM_CHAT_ID=<chat id>
//
// If either variable is missing, messages are silently skipped (no crash).

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TELEGRAM_API = 'https://api.telegram.org';

export function telegramConfigured(): boolean {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
}

/**
 * Send a text message to the configured Telegram chat.
 * Returns true on success, false if not configured or on failure (never throws).
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!telegramConfigured()) {
    return false;
  }
  try {
    const res = await fetch(
      `${TELEGRAM_API}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      },
    );
    const data = await res.json();
    return Boolean(data?.ok);
  } catch (err) {
    console.warn('Telegram send failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

/** Escape HTML special characters for Telegram parse_mode=HTML. */
export function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Send a photo (given as a base64 data URL / raw base64) to the configured
 * Telegram chat with an HTML caption. Returns true on success, false if not
 * configured or on failure (never throws).
 */
export async function sendTelegramPhoto(
  photoBase64: string,
  caption?: string,
): Promise<boolean> {
  if (!telegramConfigured() || !photoBase64) {
    return false;
  }
  try {
    // Accept both the "data:image/png;base64,...." form and raw base64
    let b64 = photoBase64;
    const comma = b64.indexOf(',');
    if (comma !== -1 && /^data:/.test(b64)) {
      b64 = b64.slice(comma + 1);
    }
    const buffer = Buffer.from(b64, 'base64');

    const form = new FormData();
    form.append('chat_id', TELEGRAM_CHAT_ID);
    form.append('photo', new Blob([buffer]), 'photo.png');
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
    }

    const res = await fetch(
      `${TELEGRAM_API}/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      { method: 'POST', body: form },
    );
    const data = await res.json();
    return Boolean(data?.ok);
  } catch (err) {
    console.warn('Telegram photo send failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

