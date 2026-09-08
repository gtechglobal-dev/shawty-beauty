/**
 * Single source of truth for the site's public base origin.
 *
 * Every generated link (ticket download / attendance scan, payment
 * callback, register page, password reset, email links, etc.) is built on
 * top of this. Set BASE_URL in the environment for production (e.g.
 * https://example.com) so a domain change updates every link at once.
 * When BASE_URL is unset we fall back to the local frontend dev server so
 * localhost work just works out of the box.
 */
const LOCALHOST_DEFAULT = 'http://localhost:5173';

export function siteBaseUrl(explicit?: string): string {
  return (explicit ?? process.env.BASE_URL ?? LOCALHOST_DEFAULT).replace(/\/+$/, '');
}