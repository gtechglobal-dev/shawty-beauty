// Telegram Admin Bot — an admin control layer for Shawty Beauty Studio.
//
// This long-polls Telegram's getUpdates and exposes a set of slash commands
// that let an allowed admin see database data and brand/event information.
//
// Requirements (environment variables):
//   TELEGRAM_BOT_TOKEN   - bot token from @BotFather
//   TELEGRAM_ADMIN_IDS   - comma-separated Telegram user IDs allowed to use
//                          the bot (e.g. "123456789,987654321")
//
// No public webhook is needed; it polls Telegram over HTTPS.
import {
  readRegistrations,
  readSponsors,
  readContacts,
  readSubscribers,
  type Registration,
} from '../db.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const TELEGRAM_API = 'https://api.telegram.org';

const BRAND = {
  name: 'Shawty Beauty Studio',
  owner: 'Makeup Artist & Lash Tech Professional',
  tagline: 'Makeup Available and Reachable for All',
  email: 'nancylawrence545@gmail.com',
  phone: '+234 916 319 8567',
  phoneRaw: '+2349163198567',
  whatsapp: 'https://wa.me/2349163198567',
  instagram: '@shawtys_beauty_studio',
};

const EVENT = {
  title: '3-Day Beginner Makeup Class',
  dates: '4th – 6th February 2027',
  time: 'Morning 9:00 AM | Evening 3:00 PM',
  venue: 'Disclosed to registered students after ticket purchase.',
  bring: 'Bring your own makeup products and tools.',
  learn: [
    'How to do your own personal makeup',
    'How to recreate basic makeup looks on friends',
    'Fundamental beginner makeup techniques',
    'The difference between being a Makeup Artist and becoming a Beauty CEO',
  ],
};

export function telegramAdminBotConfigured(): boolean {
  return Boolean(BOT_TOKEN && ADMIN_IDS.length > 0);
}

function isAdmin(userId: number | undefined): boolean {
  return userId !== undefined && ADMIN_IDS.includes(String(userId));
}

async function callApi(method: string, body: Record<string, any>): Promise<any> {
  const res = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  try {
    await callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.warn('Telegram admin send failed:', err instanceof Error ? err.message : err);
  }
}

// Send a message with tappable inline buttons. Inline buttons open links
// reliably on every Telegram client (mobile + desktop), unlike bare
// mailto:/tel:/https anchors which some desktop clients only "copy".
interface InlineButton {
  text: string;
  url: string;
}
async function sendMessageWithButtons(
  chatId: number,
  text: string,
  buttons: InlineButton[],
): Promise<void> {
  try {
    const row = buttons.map((b) => ({ text: b.text, url: b.url }));
    await callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [row] },
    });
  } catch (err) {
    console.warn('Telegram admin button send failed:', err instanceof Error ? err.message : err);
  }
}

async function sendPhoto(chatId: number, photoBase64: string, caption?: string): Promise<void> {
  try {
    let b64 = photoBase64;
    const comma = b64.indexOf(',');
    if (comma !== -1 && /^data:/.test(b64)) b64 = b64.slice(comma + 1);
    const buffer = Buffer.from(b64, 'base64');
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('photo', new Blob([buffer]), 'photo.png');
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
    }
    const res = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form,
    });
    await res.json();
  } catch (err) {
    console.warn('Telegram admin photo send failed:', err instanceof Error ? err.message : err);
  }
}

function helpText(): string {
  return [
    `<b>🤖 Shawty Beauty Admin Bot</b>`,
    ``,
    `I give you a quick view into the studio's data and event.`,
    ``,
    `<b>Data commands</b>`,
    `<code>/stats</code> — overall numbers & revenue`,
    `<code>/regs</code> — recent registrations`,
    `<code>/regs paid</code> — only paid (pending | paid | approved)`,
    `<code>/reg &lt;name or email or phone&gt;</code> — find one registration`,
    `<code>/sponsors</code> — list sponsors`,
    `<code>/messages</code> — contact messages`,
    `<code>/subscribers</code> — newsletter subscriber count`,
    ``,
    `<b>Info commands</b>`,
    `<code>/brand</code> — about Shawty Beauty Studio`,
    `<code>/event</code> — the 3-Day Makeup Class details`,
    `<code>/help</code> — this message`,
  ].join('\n');
}

function fmtMoney(n: number): string {
  return `₦${(n || 0).toLocaleString()}`;
}

function regLine(r: Registration): string {
  const p = r.photoBase64 ? '🖼️' : '';
  return [
    `• <b>${escapeHtml(r.fullName)}</b> ${p}`,
    `   ${mailLink(r.email)} | ${telLink(r.phone)}`,
    `   ${r.ticketType.toUpperCase()} ×${r.quantity} — ${fmtMoney(r.amount)} — <b>${r.status.toUpperCase()}</b>`,
  ].join('\n');
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// "Not available" fallback for optional fields.
function orNA(value?: string | null): string {
  return value && value.trim() ? escapeHtml(value) : 'Not provided';
}

// Make telephone numbers tappable (opens the dialer on mobile).
function telLink(phone: string): string {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `<a href="tel:${escapeHtml(digits)}">${escapeHtml(phone)}</a>` : 'Not provided';
}

// Make email addresses tappable (opens the mail app).
function mailLink(email: string): string {
  return email && email.trim()
    ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`
    : 'Not provided';
}

// Make an Instagram handle tappable (opens the profile / app).
function instaLink(handle: string): string {
  const name = (handle || '').trim().replace(/^@/, '');
  if (!name) return 'Not provided';
  return `<a href="https://instagram.com/${escapeHtml(name)}">@${escapeHtml(name)}</a>`;
}

// Turn a website URL into a clickable link, else "Not provided".
function urlLink(url: string, label?: string): string {
  const u = (url || '').trim();
  if (!u) return 'Not provided';
  const href = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  return `<a href="${escapeHtml(href)}">${escapeHtml(label || u)}</a>`;
}

// --- Command handlers ---
async function handleStats(chatId: number): Promise<void> {
  const regs = await readRegistrations();
  const sponsors = await readSponsors();
  const contacts = await readContacts();
  const subs = await readSubscribers();

  const revenue =
    regs.filter((r) => r.status === 'paid').reduce((s, r) => s + (r.amount || 0), 0) +
    sponsors.filter((s) => s.status === 'confirmed').reduce((s, sp) => s + (sp.amount || 0), 0);

  const counts = (st: string) => regs.filter((r) => r.status === st).length;

  const msg = [
    `<b>📊 Shawty Beauty — Overview</b>`,
    ``,
    `<b>Registrations</b>`,
    `Total: ${regs.length}`,
    `• Paid: ${counts('paid')}`,
    `• Pending: ${counts('pending')}`,
    `• Approved: ${counts('approved')}`,
    `Revenue (paid): <b>${fmtMoney(revenue)}</b>`,
    ``,
    `<b>Sponsors</b> — Total: ${sponsors.length} (confirmed: ${sponsors.filter((s) => s.status === 'confirmed').length})`,
    `<b>Messages</b> — Total: ${contacts.length} (unread: ${contacts.filter((c) => !c.read).length})`,
    `<b>Subscribers</b> — ${subs.length}`,
  ].join('\n');
  await sendMessage(chatId, msg);
}

async function handleRegs(chatId: number, arg: string): Promise<void> {
  const status = arg.trim().toLowerCase();
  let regs = await readRegistrations();
  if (regs.length === 0) {
    await sendMessage(chatId, 'No registrations yet.');
    return;
  }
  if (status) {
    regs = regs.filter((r) => r.status === status);
    if (regs.length === 0) {
      await sendMessage(chatId, `No registrations with status "${status}".`);
      return;
    }
  }
  const list = regs.slice(0, 12).map(regLine).join('\n\n');
  const more = regs.length > 12 ? `\n\n…and ${regs.length - 12} more.` : '';
  await sendMessage(
    chatId,
    `<b>🎟️ Registrations${status ? ` (${status})` : ''} — ${regs.length}</b>\n\n${list}${more}`,
  );
}

async function handleRegSearch(chatId: number, arg: string): Promise<void> {
  const q = arg.trim().toLowerCase();
  if (!q) {
    await sendMessage(chatId, `Usage: <code>/reg &lt;name, email or phone&gt;</code>`);
    return;
  }
  const regs = await readRegistrations();
  const matches = regs.filter(
    (r) =>
      r.fullName.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.phone.toLowerCase().includes(q),
  );
  if (matches.length === 0) {
    await sendMessage(chatId, `No registrations matched "<b>${escapeHtml(arg.trim())}</b>".`);
    return;
  }
  for (const r of matches.slice(0, 5)) {
    const msg = [
      `<b>🎟️ ${escapeHtml(r.fullName)}</b>`,
      `Email: ${mailLink(r.email)}`,
      `Phone: ${telLink(r.phone)}`,
      `Instagram: ${instaLink(r.instagram || '')}`,
      `Ticket: ${r.ticketType.toUpperCase()} × ${r.quantity}`,
      `Amount: ${fmtMoney(r.amount)} (fees incl.)`,
      `Status: <b>${r.status.toUpperCase()}</b>`,
      `Nationality: ${orNA(r.nationality)}`,
      `State: ${orNA(r.state)}`,
      `DOB: ${orNA(r.dateOfBirth)}`,
      `What they hope to learn: ${orNA(r.reason)}`,
    ].filter(Boolean).join('\n');
    if (r.photoBase64) {
      await sendPhoto(chatId, r.photoBase64, msg);
    } else {
      await sendMessage(chatId, msg);
    }
  }
  if (matches.length > 5) {
    await sendMessage(chatId, `...and ${matches.length - 5} more matches.`);
  }
}

async function handleSponsors(chatId: number): Promise<void> {
  const sponsors = await readSponsors();
  if (sponsors.length === 0) {
    await sendMessage(chatId, 'No sponsor applications yet.');
    return;
  }
  const list = sponsors
    .slice(0, 15)
    .map(
      (s) =>
        `• <b>${escapeHtml(s.brandName)}</b> (${escapeHtml(s.packageType)}) — ${fmtMoney(s.amount)} — <b>${s.status.toUpperCase()}</b>\n   ${escapeHtml(s.contactName || 'Contact name not provided')} | ${mailLink(s.email)}`,
    )
    .join('\n\n');
  await sendMessage(chatId, `<b>🤝 Sponsors — ${sponsors.length}</b>\n\n${list}`);
}

async function handleMessages(chatId: number): Promise<void> {
  const contacts = await readContacts();
  if (contacts.length === 0) {
    await sendMessage(chatId, 'No contact messages yet.');
    return;
  }
  const list = contacts
    .slice(0, 10)
    .map(
      (c) =>
        `${c.read ? '📖' : '📩'} <b>${escapeHtml(c.name)}</b> — ${c.subject}\n   ${escapeHtml(c.message).slice(0, 120)}`,
    )
    .join('\n\n');
  await sendMessage(chatId, `<b>📨 Contact messages — ${contacts.length}</b>\n\n${list}`);
}

async function handleSubscribers(chatId: number): Promise<void> {
  const subs = await readSubscribers();
  await sendMessage(chatId, `<b>📧 Newsletter subscribers:</b> ${subs.length}`);
}

async function handleBrand(chatId: number): Promise<void> {
  const text = [
    `<b>💄 ${BRAND.name}</b>`,
    `${BRAND.owner}`,
    `✨ ${BRAND.tagline}`,
    ``,
    `Services: lashes (classic, hybrid, volume, wispy/bottom), makeup (soft glam, full glam, bridal, photoshoot, 1-on-1 training).`,
    ``,
    `Tap a button below to open the link.`,
  ].join('\n');
  await sendMessageWithButtons(chatId, text, [
    { text: '📞 Call', url: `tel:${BRAND.phoneRaw}` },
    { text: '✉️ Email', url: `mailto:${BRAND.email}` },
    { text: '📷 Instagram', url: 'https://instagram.com/shawtys_beauty_studio' },
    { text: '💬 WhatsApp', url: BRAND.whatsapp },
  ]);
}

async function handleEvent(chatId: number): Promise<void> {
  await sendMessage(
    chatId,
    [
      `<b>🎓 ${EVENT.title}</b>`,
      ``,
      `📅 <b>${EVENT.dates}</b>`,
      `🕘 ${EVENT.time}`,
      `📍 ${EVENT.venue}`,
      `🎒 ${EVENT.bring}`,
      ``,
      `<b>You will learn:</b>`,
      ...EVENT.learn.map((l) => `• ${l}`),
      ``,
      `Register on the site to secure your ticket (processing fee applies).`,
    ].join('\n'),
  );
}

async function handleCommand(chatId: number, raw: string): Promise<void> {
  const [cmd, ...rest] = raw.trim().split(/\s+/);
  const arg = rest.join(' ');
  switch (cmd.toLowerCase()) {
    case '/start':
    case '/help':
      await sendMessage(chatId, helpText());
      break;
    case '/stats':
      await handleStats(chatId);
      break;
    case '/regs':
      await handleRegs(chatId, arg);
      break;
    case '/reg':
      await handleRegSearch(chatId, arg);
      break;
    case '/sponsors':
      await handleSponsors(chatId);
      break;
    case '/messages':
      await handleMessages(chatId);
      break;
    case '/subscribers':
      await handleSubscribers(chatId);
      break;
    case '/brand':
    case '/about':
      await handleBrand(chatId);
      break;
    case '/event':
      await handleEvent(chatId);
      break;
    default:
      await sendMessage(chatId, `Unknown command. Send <code>/help</code> to see options.`);
  }
}

let polling = false;
let offset = 0;
let stopped = false;

/**
 * Start the long-polling loop. Safe to call once on boot.
 */
export function startTelegramAdminBot(): void {
  if (!telegramAdminBotConfigured()) {
    console.log('Telegram admin bot not configured (need TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_IDS). Skipping.');
    return;
  }
  if (polling) return;
  polling = true;
  console.log(`Telegram admin bot started (admins: ${ADMIN_IDS.join(', ')})`);
  void poll();
}

function poll(): Promise<void> {
  return (async () => {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    while (!stopped) {
      try {
        const data = await callApi('getUpdates', {
          timeout: 50,
          offset,
          allowed_updates: ['message'],
        });
        if (data?.ok && Array.isArray(data.result)) {
          for (const upd of data.result) {
            offset = Math.max(offset, upd.update_id + 1);
            const msg = upd.message;
            if (!msg || typeof msg.text !== 'string') continue;

            // Only the first word that starts with '/' is treated as a command.
            if (!msg.text.startsWith('/')) continue;

            if (!isAdmin(msg.from?.id)) {
              await sendMessage(msg.chat.id, '⛔ You are not authorized to use this bot.');
              continue;
            }
            await handleCommand(msg.chat.id, msg.text);
          }
        }
      } catch (err) {
        console.warn('Telegram admin poll error:', err instanceof Error ? err.message : err);
      }
      await delay(1500);
    }
  })();
}

export function stopTelegramAdminBot(): void {
  stopped = true;
}
