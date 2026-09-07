import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { Resvg } from '@resvg/resvg-js';
import type { StudioEvent, Registration, TicketType } from '../db.js';
import { sendEmail } from './mailer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Fonts live in src/assets/fonts. `tsc` does not copy them into dist, so
// resolve both relative to the compiled module and to the source tree.
const FONT_DIR = [
  resolve(__dirname, '..', 'assets', 'fonts'),
  resolve(__dirname, '..', '..', 'src', 'assets', 'fonts'),
].find((p) => existsSync(p))!;

const POPPINS_REGULAR = resolve(FONT_DIR, 'Poppins-Regular.ttf');
const POPPINS_SEMIBOLD = resolve(FONT_DIR, 'Poppins-SemiBold.ttf');
const POPPINS_BOLD = resolve(FONT_DIR, 'Poppins-Bold.ttf');

// The ticket templates the studio designed (frontend/public/images).
// Both are 1774x887 landscape cards composed of a cream info panel framed
// by decorative borders — gold/bronze foil for the Gold ticket, navy + gold
// for the Student ticket. Attendee data is layered onto the cream panel.
const W = 1774;
const H = 887;

function templateDir(): string {
  const env = (process.env.TICKET_TEMPLATE_DIR || '').trim();
  if (env) return resolve(env);
  const fromSrc = resolve(__dirname, '..', '..', '..', 'frontend', 'public', 'images');
  const fromDist = resolve(__dirname, '..', '..', '..', '..', 'frontend', 'public', 'images');
  return existsSync(fromSrc) ? fromSrc : fromDist;
}

function templateFile(ticketType: TicketType): string {
  const name = ticketType === 'gold' ? 'gold ticket.png' : 'student ticket.png';
  return resolve(templateDir(), name);
}

// ------------------------------------------------------------------
// Token / URL helpers
// ------------------------------------------------------------------

/** Unique per-registrant token embedded in the ticket QR code. */
export function generateTicketToken(): string {
  return randomBytes(24).toString('hex');
}

export function baseOrigin(baseUrl?: string): string {
  return (baseUrl || process.env.BASE_URL || 'https://shawtybeautystudio.com').replace(/\/+$/, '');
}

/** What the QR encodes: opens the daily check-in page for this registrant. */
export function ticketScanUrl(token: string, baseUrl?: string): string {
  return `${baseOrigin(baseUrl)}/attendance?t=${encodeURIComponent(token)}`;
}

/** Direct PNG download link for the ticket. */
export function ticketDownloadUrl(token: string, baseUrl?: string): string {
  return `${baseOrigin(baseUrl)}/api/tickets/${encodeURIComponent(token)}.png`;
}

// ------------------------------------------------------------------
// PNG ticket builder (template background + layered attendee info)
// ------------------------------------------------------------------

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wrap text into at most 2 visual lines of <= maxChars characters. */
function fit(text: string, maxChars: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

// Palette tuned to each template:
//  - gold ticket  -> champagne cream + bronze/gold foil accents
//  - student ticket -> cool ivory + navy/black + bright gold accents
interface Palette {
  ink: string;        // primary text
  accent: string;     // strong accent (chips, labels)
  gold: string;       // gold accent
  muted: string;      // secondary text
  faint: string;      // small caps labels
  chipText: string;   // text on filled chips
  card: string;       // white "sticker" backing (QR / photo)
  cardStroke: string; // sticker border
}

const GOLD_PALETTE: Palette = {
  ink: '#2e1c0c',
  accent: '#a5751a',
  gold: '#b8860b',
  muted: '#8d6f44',
  faint: '#b2956a',
  chipText: '#fffbe9',
  card: '#fffdf7',
  cardStroke: '#e4cf9f',
};

const STUDENT_PALETTE: Palette = {
  ink: '#12263a',
  accent: '#16324b',
  gold: '#d9a520',
  muted: '#5f6b7a',
  faint: '#8a94a3',
  chipText: '#ffffff',
  card: '#ffffff',
  cardStroke: '#d8d4ca',
};

export async function buildTicketPng(opts: {
  registration: Registration;
  event: StudioEvent | null;
  scanUrl: string;
}): Promise<Buffer> {
  const { registration: r, event, scanUrl } = opts;

  const templatePath = templateFile(r.ticketType);
  const templateB64 = readFileSync(templatePath).toString('base64');
  const palette = r.ticketType === 'gold' ? GOLD_PALETTE : STUDENT_PALETTE;

  const qr = await QRCode.toDataURL(scanUrl, { width: 300, margin: 1 });
  const logoPath = resolve(templateDir(), '3BMC.png');
  const logoDataUrl = existsSync(logoPath) ? `data:image/png;base64,${readFileSync(logoPath).toString('base64')}` : '';

  // Price-tier badge shown above the QR: Gold tickets always carry the 10K
  // logo; student tickets show 3K during the early-bird promo (an
  // originalPrice with a future promoDeadline) and flip to 5K once the
  // promo deadline passes.
  const eventTicket = event?.tickets?.find(
    (t) => t.id === r.ticketType || t.label?.toLowerCase() === (r.ticketType || '').toLowerCase(),
  );
  const promoActive = Boolean(
    eventTicket?.originalPrice && eventTicket.promoDeadline && Date.now() < eventTicket.promoDeadline,
  );
  const priceTier: '3K' | '5K' | '10K' = r.ticketType === 'gold' ? '10K' : promoActive ? '3K' : '5K';
  const PRICE_LOGO_ASPECT: Record<'3K' | '5K' | '10K', number> = {
    '3K': 1286 / 509,
    '5K': 1052 / 410,
    '10K': 1183 / 337,
  };
  const priceLogoPath = resolve(templateDir(), `${priceTier}.png`);
  const priceLogoDataUrl = existsSync(priceLogoPath)
    ? `data:image/png;base64,${readFileSync(priceLogoPath).toString('base64')}`
    : '';
  const PRICE_LOGO_W = 200;
  const priceLogoH = Math.round(PRICE_LOGO_W / PRICE_LOGO_ASPECT[priceTier]);

  const ticketNo = `SBS-${(r.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const eventTitle = event?.title || 'Shawty Beauty Studio';
  const theme = event?.theme || '';
  const dates = event?.datesLabel || '';
  const ticketLabel = r.ticketLabel || r.ticketType || 'Ticket';
  const qty = r.quantity || 1;

  // Date the ticket was issued (registration time), formatted for the
  // vertical "issued on" label, e.g. "05 SEP 2026".
  const issued =
    (r.createdAt ? new Date(r.createdAt) : new Date())
      .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      .toUpperCase()
      .replace(/ /g, ' ');

  // ---- Geometry (absolute in the 1774x887 template coordinate space) ----
  // The cream info panel spans roughly x 200..1420, y 175..560 on both
  // templates; everything below that is decorative border/foil.
  const CX = 815;             // horizontal center of the info panel
  const RIGHT = 1335;         // right-safe column inside the panel

  // Vertical offset applied to everything except the QR sticker — the studio
  // wanted the text block lower while keeping the QR exactly where it is.
  const DY = 55;

  const titleLines = fit(eventTitle, 42);
  const titleBase = 250 + DY;
  const titleBottom = titleBase + (titleLines.length - 1) * 52;
  const themeY = titleBottom + 44;
  const dividerY = theme ? themeY + 30 : titleBottom + 30;
  const labelY = dividerY + 36;
  const nameY = labelY + 44;
  const phoneY = labelY + 88;

  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="${CX}" y="${titleBase + i * 52}" font-family="Poppins" font-size="41" font-weight="700" fill="${palette.ink}" text-anchor="middle">${esc(line)}</text>`,
    )
    .join('');

  const themeSvg = theme
    ? `<text x="${CX}" y="${themeY}" font-family="Poppins" font-size="17" font-weight="500" fill="${palette.accent}" text-anchor="middle">${esc('\u201c' + (fit(theme, 62)[0] || '') + '\u201d')}</text>`
    : '';

  const nameLine = esc(fit(r.fullName, 40)[0] || r.fullName);
  const ticketChipTxt = `${esc(ticketLabel)} \u00d7 ${qty}`;
  const chipW = Math.max(190, Math.min(370, ticketChipTxt.length * 14 + 90));
  const admitW = 190;
  const gap = 22;
  const rowW = chipW + gap + admitW;
  const chipX = CX - rowW / 2;
  const admitX = chipX + chipW + gap;
  const chipY = phoneY + 44;
  const chipH = 64;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="chip-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.accent}"/>
      <stop offset="1" stop-color="${palette.gold}"/>
    </linearGradient>
    <linearGradient id="gold-line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${palette.gold}" stop-opacity="0.25"/>
      <stop offset="0.5" stop-color="${palette.gold}"/>
      <stop offset="1" stop-color="${palette.gold}" stop-opacity="0.25"/>
    </linearGradient>
  </defs>

  <!-- The studio's designed ticket template -->
  <image x="0" y="0" width="${W}" height="${H}" href="data:image/png;base64,${templateB64}"/>

  <!-- ===== Brand logo / header ===== -->
  ${logoDataUrl
    ? `<image x="${CX - 130}" y="186" width="260" height="${Math.round((260 * 822) / 2654)}" href="${logoDataUrl}" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="${CX}" y="${188 + DY}" font-family="Poppins" font-size="18" font-weight="600" letter-spacing="6" fill="${palette.gold}" text-anchor="middle">SHAWTY BEAUTY STUDIO</text>`}
  ${logoDataUrl
    ? `<rect x="${CX - 90}" y="${258 + DY}" width="180" height="3.5" rx="1.75" fill="url(#gold-line)"/>`
    : `<rect x="${CX - 90}" y="${205 + DY}" width="180" height="3.5" rx="1.75" fill="url(#gold-line)"/>`}

  <!-- ===== Event title / theme / divider ===== -->
  ${titleSvg}
  ${themeSvg}
  <rect x="${CX - 60}" y="${dividerY}" width="42" height="3" rx="1.5" fill="${palette.gold}"/>
  <rect x="${CX - 10}" y="${dividerY}" width="430" height="1" fill="${palette.cardStroke}"/>

  <!-- ===== Attendee ===== -->
  <text x="${CX}" y="${labelY}" font-family="Poppins" font-size="17" font-weight="700" letter-spacing="4.5" fill="${palette.faint}" text-anchor="middle">HOLDER</text>
  <text x="${CX}" y="${nameY}" font-family="Poppins" font-size="44" font-weight="600" fill="${palette.ink}" text-anchor="middle">${nameLine}</text>
  <text x="${CX}" y="${phoneY}" font-family="Poppins" font-size="30" font-weight="500" fill="${palette.accent}" text-anchor="middle">${esc(r.phone || '')}</text>

  <!-- ===== Ticket chip + ADMIT + ticket no ===== -->
  <rect x="${chipX}" y="${chipY}" width="${chipW}" height="${chipH}" rx="${chipH / 2}" fill="url(#chip-grad)"/>
  <text x="${chipX + chipW / 2}" y="${chipY + chipH / 2}" font-family="Poppins" font-size="22" font-weight="600" fill="${palette.chipText}" text-anchor="middle" dominant-baseline="middle">${ticketChipTxt}</text>

  <rect x="${admitX}" y="${chipY}" width="${admitW}" height="${chipH}" rx="${chipH / 2}" fill="none" stroke="${palette.gold}" stroke-width="3"/>
  <text x="${admitX + admitW / 2}" y="${chipY + chipH / 2}" font-family="Poppins" font-size="21" font-weight="700" fill="${palette.accent}" text-anchor="middle" dominant-baseline="middle">ADMIT</text>

  <text x="${RIGHT}" y="${chipY + chipH / 2 - 66}" font-family="Poppins" font-size="11" font-weight="700" letter-spacing="3" fill="${palette.faint}" text-anchor="end">TICKET NO</text>
  <text x="${RIGHT}" y="${chipY + chipH / 2 - 38}" font-family="Poppins" font-size="16" font-weight="600" fill="${palette.ink}" text-anchor="end" letter-spacing="1">${esc(ticketNo)}</text>

  <!-- ===== Dates strip ===== -->
  <text x="${CX}" y="${chipY + chipH + 48}" font-family="Poppins" font-size="20" font-weight="600" letter-spacing="2" fill="${palette.muted}" text-anchor="middle">${esc(dates)}</text>

  <!-- ===== Vertical "SHAWTY BEAUTY STUDIO" branding (rotated 90°, gold) ===== -->
  <text transform="rotate(-90 ${1610} ${560})" x="1610" y="560" font-family="Poppins" font-size="13" font-weight="600" letter-spacing="3" fill="#FFD700" text-anchor="start">SHAWTY BEAUTY STUDIO</text>
  <text transform="rotate(-90 ${1500} ${570})" x="1500" y="570" font-family="Poppins" font-size="14" font-weight="700" letter-spacing="4" fill="#ffffff" text-anchor="start">ISSUED</text>
  <text transform="rotate(-90 ${1500} ${470})" x="1500" y="470" font-family="Poppins" font-size="19" font-weight="600" letter-spacing="2" fill="#ffffff" text-anchor="start">${esc(issued)}</text>

  <!-- ===== Price-tier badge (above the QR, early-bird / full price / gold) ===== -->
  ${priceLogoDataUrl
    ? `<image x="${340 - PRICE_LOGO_W / 2}" y="${432 - priceLogoH}" width="${PRICE_LOGO_W}" height="${priceLogoH}" href="${priceLogoDataUrl}" preserveAspectRatio="xMidYMid meet"/>`
    : ''}

  <!-- ===== QR sticker (far-left), white backing so it always scans ===== -->
  <rect x="235" y="440" width="210" height="210" rx="24" fill="${palette.card}" stroke="${palette.cardStroke}" stroke-width="1.5"/>
  <image x="243" y="448" width="194" height="194" href="${qr}" preserveAspectRatio="xMidYMid meet"/>
  <text x="340" y="666" font-family="Poppins" font-size="12" font-weight="700" letter-spacing="2.5" fill="${palette.ink}" text-anchor="middle">SCAN TO CHECK IN</text>
  <text x="340" y="687" font-family="Poppins" font-size="12" font-weight="500" fill="${palette.muted}" text-anchor="middle">daily at the entrance</text>
</svg>`;

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: {
      fontFiles: [POPPINS_REGULAR, POPPINS_SEMIBOLD, POPPINS_BOLD],
      defaultFontFamily: 'Poppins',
      loadSystemFonts: false,
    },
  });
  const png = resvg.render().asPng();
  return Buffer.from(png);
}

// ------------------------------------------------------------------
// Ticket email delivery
// ------------------------------------------------------------------

export async function deliverTicketEmail(opts: {
  registration: Registration;
  event: StudioEvent | null;
  baseUrl?: string;
}): Promise<{ emailed: boolean; downloadUrl: string; scanUrl: string; reason?: string }> {
  const { registration: reg, event } = opts;
  const origin = baseOrigin(opts.baseUrl);
  const scanUrl = ticketScanUrl(reg.ticketToken || '', origin);
  const downloadUrl = ticketDownloadUrl(reg.ticketToken || '', origin);

  try {
    const eventTitle = event?.title || 'Shawty Beauty Studio';
    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; background: #fdf9f4; padding: 32px 16px; border-radius: 16px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f0dbe4;">
          <div style="background: linear-gradient(135deg, #d98aa0, #914e6c); padding: 26px 32px;">
            <h1 style="font-family: Georgia, serif; font-size: 22px; font-weight: 600; margin: 0; color: #ffffff;">Shawty Beauty Studio</h1>
            <p style="color: #fbeef4; font-size: 13px; margin: 4px 0 0;">Ticket Confirmation</p>
          </div>
          <div style="padding: 28px 32px 8px;">
            <p style="color: #2a1b22; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              Hello <strong>${esc(htmlSafeName(reg.fullName))}</strong>,
            </p>
            <p style="color: #2a1b22; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              &#10024; <strong>Welcome to Shawty Beauty Studio 3BMC!</strong> &#10024;
            </p>
            <p style="color: #2a1b22; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              We&rsquo;re so excited to have you join us for the <strong>3-Day Beginner Makeup Class</strong>,
              where you&rsquo;ll learn, practice, and build the confidence to create beautiful makeup looks
              from the ground up.
            </p>
            <p style="color: #2a1b22; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              Your registration has been successfully confirmed, and <strong>your event ticket is now
              ready.</strong>
            </p>
            <p style="color: #2a1b22; font-size: 15px; line-height: 1.7; margin: 0 0 12px;">
              &#127915; <strong>Your Ticket:</strong><br/>
              Your personalized ticket is available through the download link below.
            </p>
            <div style="text-align: center; margin: 0 0 18px;">
              <a href="${downloadUrl}" style="display: inline-block; background: linear-gradient(135deg, #d98aa0, #914e6c); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 34px; border-radius: 999px;">
                DOWNLOAD MY TICKET
              </a>
            </div>
            <p style="color: #2a1b22; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              Please save your ticket securely and have it available when attending the class.
            </p>
            <p style="color: #2a1b22; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              We can&rsquo;t wait to have you with us for <strong>3 amazing days of beauty, learning,
              creativity, and transformation!</strong> &#128132;&#10024;
            </p>
            <p style="color: #2a1b22; font-size: 15px; line-height: 1.7; margin: 0 0 4px;">
              With love,<br/>
              <strong>Shawty Beauty Studio</strong>
            </p>
            <p style="margin: 0 0 8px; color: #b39aa5; font-size: 13px; font-style: italic;">
              Beauty &bull; Confidence &bull; Creativity
            </p>
            <p style="margin: 16px 0 0; color: #b39aa5; font-size: 12px;">
              Having trouble downloading on mobile? Open this link in your browser:
            </p>
            <p style="margin: 0 0 8px;"><a href="${downloadUrl}" style="color: #b36380; word-break: break-all; font-size: 12px;">${downloadUrl}</a></p>
          </div>
          <div style="background: #f6e3ec; padding: 12px 32px;">
            <p style="margin: 0; color: #914e6c; font-size: 12px;">\u00a9 ${new Date().getFullYear()} Shawty Beauty Studio</p>
          </div>
        </div>
      </div>`;

    await sendEmail(
      reg.email,
      `Your ${eventTitle} ticket \u2014 ${reg.fullName}`,
      html,
    );

    return { emailed: true, downloadUrl, scanUrl };
  } catch (err: any) {
    return { emailed: false, downloadUrl, scanUrl, reason: err?.message || 'Unknown error' };
  }
}

function htmlSafeName(name: string): string {
  return String(name || '').replace(/[<>&\u201c\u201d]/g, '').trim() || 'there';
}