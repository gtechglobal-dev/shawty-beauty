import { Request } from 'express';
import geoip from 'geoip-lite';

/**
 * Resolve the real client IP behind proxies (Express `trust proxy` = 1, and
 * render.com which sits behind a load balancer). Prefers the first, leftmost
 * entry of the X-Forwarded-For chain (the original client), falling back to
 * express's resolved req.ip.
 *
 * IPv6-mapped IPv4 addresses (e.g. "::ffff:1.2.3.4") are normalized to plain
 * IPv4 because the offline geo-IP DB is keyed on IPv4.
 */
export function resolveClientIp(req: Request): string | undefined {
  const xff = req.headers['x-forwarded-for'];
  let candidate = '';
  if (typeof xff === 'string') {
    candidate = xff.split(',')[0].trim();
  } else if (Array.isArray(xff)) {
    candidate = String(xff[0] || '').split(',')[0].trim();
  }
  if (!candidate) {
    candidate = (req.ip || req.socket?.remoteAddress || '').toString();
  }
  return normalizeIp(candidate) || undefined;
}

function normalizeIp(ip: string): string {
  let s = ip.trim();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(s);
  if (mapped) return mapped[1];
  if (s.startsWith('::1')) return '127.0.0.1';
  return /^\d+\.\d+\.\d+\.\d+$/.test(s) ? s : '';
}

export interface IpLocation {
  ip?: string;
  location?: string;
}

/**
 * Best-effort IP -> location lookup using the offline geoip-lite database.
 * Returns a human-readable location string, falling back gracefully.
 */
export function lookupIpInfo(ip?: string): IpLocation {
  const result: IpLocation = {};
  if (!ip) return result;
  result.ip = ip;
  try {
    const rec = geoip.lookup(ip);
    if (rec) {
      const parts: string[] = [];
      if (rec.city) parts.push(rec.city);
      if (rec.region) parts.push(rec.region);
      if (rec.country) parts.push(countryName(rec.country));
      if (parts.length) result.location = parts.join(', ');
      else if (rec.country) result.location = countryName(rec.country);
    }
  } catch {
    // geo-IP lookups are best-effort; ignore failures.
  }
  return result;
}

const COUNTRY_CODES: Record<string, string> = {
  US: 'United States',
  NG: 'Nigeria',
  GH: 'Ghana',
  GB: 'United Kingdom',
  CA: 'Canada',
  KE: 'Kenya',
  ZA: 'South Africa',
  TG: 'Togo',
  BJ: 'Benin',
  CM: 'Cameroon',
  CI: 'Côte d\'Ivoire',
  SN: 'Senegal',
  FR: 'France',
  DE: 'Germany',
  AE: 'United Arab Emirates',
  IN: 'India',
};

function countryName(code: string): string {
  return COUNTRY_CODES[code] || code;
}
