import { v2 as cloudinary } from 'cloudinary';

// Cloudinary image uploads with an automatic step-down so stored/delivered
// images never exceed the target byte budget (~100 KB). Quality is preserved
// via Cloudinary's auto quality/format heuristics (q_auto / f_auto).
//
// When Cloudinary env vars are missing the helper reports failure and callers
// fall back to the previous base64-in-DB behaviour so nothing breaks.

const BASE_URL = 'https://res.cloudinary.com';
const DEFAULT_MAX_BYTES = 100 * 1024; // 100 KB

const CLOUD = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const KEY = (process.env.CLOUDINARY_API_KEY || '').trim();
const SECRET = (process.env.CLOUDINARY_API_SECRET || '').trim();

if (CLOUD && KEY && SECRET) {
  cloudinary.config({ cloud_name: CLOUD, api_key: KEY, api_secret: SECRET });
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD && KEY && SECRET);
}

/** Normalise a data URL (or raw base64) into { mime, base64 }, or null. */
export function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  if (!dataUrl) return null;
  const trimmed = String(dataUrl).trim();
  const m = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(trimmed);
  if (m) return { mime: m[1], base64: m[2] };
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) return { mime: 'image/png', base64: trimmed };
  return null;
}

// Delivery transforms tried from gentlest to most aggressive: each is measured
// and the first that fits the budget wins (the smallest is kept as fallback).
interface Transform {
  w?: number;
  q: string;
}

function candidates(maxWidth?: number): Transform[] {
  const mw = Math.max(300, Math.min(2000, maxWidth || 1400));
  return [
    { w: mw, q: 'auto:good' },
    { w: Math.round(mw * 0.75), q: 'auto:good' },
    { w: 640, q: 'auto:good' },
    { w: mw, q: 'auto:eco' },
    { w: 480, q: 'auto:good' },
    { w: 640, q: 'auto:eco' },
    { w: 400, q: 'auto:good' },
    { w: 480, q: 'auto:low' },
    { w: 320, q: 'auto:eco' },
  ];
}

function transformPath(t: Transform): string {
  const parts = ['f_auto'];
  if (t.w) parts.push(`w_${t.w}`);
  parts.push(`q_${t.q}`);
  return parts.join(',');
}

function deliveryUrl(publicId: string, t?: Transform): string {
  const transforms = t ? `${transformPath(t)}/` : '';
  return `${BASE_URL}/${CLOUD}/image/upload/${transforms}${publicId}`;
}

async function probeSize(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    if (!res.ok) return null;
    const contentRange = res.headers.get('content-range');
    const total = contentRange ? /\/\s*(\d+)\s*$/.exec(contentRange)?.[1] : undefined;
    if (total) return parseInt(total, 10);
    const buf = await res.arrayBuffer();
    return buf.byteLength;
  } catch {
    return null;
  }
}

/** Fetch a remote image and return it as a raw base64 string (no data: prefix). */
export async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString('base64');
  } catch {
    return null;
  }
}

export async function uploadAndStepDown(
  dataUrl: string,
  opts?: { folder?: string; maxWidth?: number; maxBytes?: number },
): Promise<{ ok: boolean; url?: string; bytes?: number }> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return { ok: false };
  if (!isCloudinaryConfigured()) return { ok: false };

  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  const folder = (opts?.folder || 'shawty-beauty-studio').replace(/\/+$/, '');

  let result;
  try {
    result = await cloudinary.uploader.upload(
      `data:${parsed.mime};base64,${parsed.base64}`,
      { folder, resource_type: 'image', use_filename: false, unique_filename: true },
    );
  } catch {
    return { ok: false };
  }

  const publicId = result?.public_id;
  if (!publicId) return { ok: false };

  // Original already small enough — no step-down needed.
  if ((result.bytes ?? Number.MAX_SAFE_INTEGER) <= maxBytes) {
    return { ok: true, url: deliveryUrl(publicId), bytes: result.bytes };
  }

  let best: { url: string; bytes: number } | null = null;
  for (const t of candidates(opts?.maxWidth)) {
    const url = deliveryUrl(publicId, t);
    const size = await probeSize(url);
    if (size == null) continue;
    if (best == null || size < best.bytes) best = { url, bytes: size };
    if (size <= maxBytes) break;
  }

  if (best) return { ok: true, url: best.url, bytes: best.bytes };

  // Couldn't measure (unexpected) — serve an auto-optimised fallback.
  return { ok: true, url: deliveryUrl(publicId, { w: 640, q: 'auto:good' }), bytes: result.bytes };
}