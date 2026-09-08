import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import {
  writeSponsor,
  readSponsors,
  type Sponsor,
  type SponsorPackageType,
} from '../db.js';
import { sendTelegramMessage, telegramConfigured, escapeHtml } from '../lib/telegram.js';
import { uploadAndStepDown } from '../lib/cloudinary.js';
import { deliverSponsorThankYouEmail } from '../lib/sponsorEmail.js';
import { isValidPhone, phoneErrorMessage, normalizePhone } from '../lib/phone.js';
import { broadcastRealtime } from '../lib/realtime.js';

export const SPONSOR_TYPES = [
  'Individual',
  'Business/Company',
  'Organization',
  'NGO/Association',
  'Other',
];

export const SUPPORT_AREAS = [
  'Makeup Training',
  'Lashes Training',
  'Student Scholarship',
  'Training Materials',
  'Beauty Equipment',
  'Event/Class Sponsorship',
  'General Support',
  'Other',
];

export const SPONSORSHIP_TYPES = [
  'Financial Contribution',
  'Products/Materials',
  'Equipment',
  'Professional Services',
  'Other',
];

export const USAGE_PREFERENCES = [
  'For a specific student',
  'For multiple students',
  'For a specific program/class',
  'For equipment or training materials',
  'Where most needed',
];

const LEGACY_PACKAGE_MAP: Record<string, SponsorPackageType> = {
  'Financial Contribution': 'custom',
  'Products/Materials': 'product',
  Equipment: 'product',
  'Professional Services': 'service',
  Other: 'custom',
};

async function generateReference(): Promise<string> {
  const existing = await readSponsors();
  let max = 0;
  for (const s of existing) {
    const m = /^SWS-SP-(\d+)$/.exec(s.reference || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `SWS-SP-${String(max + 1).padStart(6, '0')}`;
}

const router = Router();

// Public directory: sponsors who registered and agreed to public recognition.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const all = await readSponsors();
    const visible = all.filter(
      (s) => s.status !== 'cancelled' && s.publicRecognition !== false && s.deactivated !== true,
    );
    res.json({
      sponsors: visible.map((s) => ({
        id: s.id,
        name: s.displayName || s.contactName || s.brandName,
        email: s.email,
        logoUrl: s.logoUrl,
        logoBase64: s.logoBase64,
        state: s.state,
        country: s.country,
      })),
    });
  } catch (err: any) {
    console.error('Failed to load sponsors:', err.message);
    res.status(500).json({ error: 'Failed to load sponsors' });
  }
});

export const SPONSOR_PACKAGES: Record<
  SponsorPackageType,
  {
    id: SponsorPackageType;
    label: string;
    price: number;
    slots?: number;
    description: string;
    benefits: string[];
  }
> = {
  supporter: {
    id: 'supporter',
    label: 'Supporter',
    price: 20000,
    description: 'For individuals, small businesses, and emerging beauty brands that simply want to support the initiative.',
    benefits: [
      'Name/logo on the official sponsor appreciation graphic',
      'Social media appreciation post/story',
      'Verbal appreciation during the program',
      'Sponsor recognition on the event’s digital materials',
    ],
  },
  partner: {
    id: 'partner',
    label: 'Partner',
    price: 50000,
    description: 'For brands that want more visibility before and during the event.',
    benefits: [
      'Everything in Supporter',
      'Prominent logo placement on event promotional materials',
      'Dedicated social media feature',
      'Brand mention during selected event sessions',
      'Opportunity to provide flyers, discount cards or approved materials',
      'Brand included in post-event appreciation content',
    ],
  },
  featured: {
    id: 'featured',
    label: 'Featured Sponsor',
    price: 100000,
    description: 'For brands that want to be visibly associated with the program.',
    benefits: [
      'Everything in Partner',
      'Featured sponsor status',
      'Priority logo placement on major event materials',
      'Dedicated brand spotlight/content feature',
      'Opportunity for approved product sampling or display',
      'Opportunity to contribute branded materials/gifts',
      'Special recognition during the program',
    ],
  },
  title: {
    id: 'title',
    label: 'Title / Major Sponsor',
    price: 200000,
    slots: 2,
    description: 'Limited to 2 slots. Custom/limited so only true main sponsors claim the positioning.',
    benefits: [
      '“In partnership with…” or “Powered by…” positioning',
      'Highest-priority branding across approved event materials',
      'Dedicated promotional content',
      'Product/service activation opportunity',
      'Opportunity to address participants briefly',
      'Prominent recognition throughout the event',
      'Post-event brand feature',
      'Customized sponsorship benefits based on your objectives',
    ],
  },
  product: {
    id: 'product',
    label: 'Product Sponsor',
    price: 0,
    description: 'Beauty products, brushes, tools, gift items, etc.',
    benefits: ['Recognition based on contributions and agreement'],
  },
  service: {
    id: 'service',
    label: 'Service Sponsor',
    price: 0,
    description: 'Photography, videography, printing, refreshments, venue support, branding, etc.',
    benefits: ['Recognition based on contributions and agreement'],
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    price: 0,
    description: 'Custom sponsorship arrangement',
    benefits: ['Customized benefits based on agreement'],
  },
};

router.post('/', async (req: Request, res: Response) => {
  try {
    const b: any = req.body || {};
    const isNewShape = typeof b.fullName === 'string';

    const sanitizeText = (s: unknown, max: number): string =>
      String(s || '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
        .slice(0, max);

    const fullName = sanitizeText(b.fullName || b.brandName, 120);
    const contactName = sanitizeText(b.displayName || b.contactName || fullName, 120);
    const email = sanitizeText(b.email, 254).toLowerCase();
    const phone = normalizePhone(sanitizeText(b.phone, 24));

    if (!fullName || !email || !phone) {
      return res.status(400).json({ error: 'Full name, email and phone are required' });
    }
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (isNewShape) {
      const phoneErr = phoneErrorMessage(phone);
      if (phoneErr) {
        return res.status(400).json({ error: phoneErr });
      }
    } else if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Please enter a valid phone number with its country code' });
    }

    const sponsorType = sanitizeText(b.sponsorType, 30);
    const supportAreas = Array.isArray(b.supportAreas)
      ? b.supportAreas.map((a: unknown) => sanitizeText(a, 60))
      : [];
    const sponsorshipType = sanitizeText(b.sponsorshipType, 50);
    const usagePreference = sanitizeText(b.usagePreference, 60);
    const publicRecognition = b.publicRecognition === true;
    const displayName = publicRecognition ? sanitizeText(b.displayName, 120) : '';
    const consent = b.consent === true;
    const message = sanitizeText(b.message || b.notes, 2000);
    const country = sanitizeText(b.country, 60);
    const state = sanitizeText(b.state, 80);
    const address = sanitizeText(b.address, 200);

    if (isNewShape) {
      if (!fullName || !email || !phone) {
        return res.status(400).json({ error: 'Full name, email and phone are required' });
      }
      if (!SPONSOR_TYPES.includes(sponsorType)) {
        return res.status(400).json({ error: 'Please select a sponsor type' });
      }
      if (supportAreas.length === 0 || !supportAreas.every((a: string) => SUPPORT_AREAS.includes(a))) {
        return res.status(400).json({ error: 'Please select at least one area you would like to support' });
      }
      if (!SPONSORSHIP_TYPES.includes(sponsorshipType)) {
        return res.status(400).json({ error: 'Please select a sponsorship type' });
      }
      if (!USAGE_PREFERENCES.includes(usagePreference)) {
        return res.status(400).json({ error: 'Please indicate how you would like your sponsorship used' });
      }
      if (!consent) {
        return res.status(400).json({ error: 'Please accept the confirmation statement to continue' });
      }
      if (publicRecognition && !displayName) {
        return res.status(400).json({ error: 'Please provide the name you would like to be displayed' });
      }
    }

    let amount = 0;
    if (sponsorshipType === 'Financial Contribution') {
      const parsed = Number(b.amount);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({ error: 'Please enter a valid amount (₦)' });
      }
      amount = parsed;
    } else if (!isNewShape && typeof b.amount === 'number') {
      amount = b.amount;
    }

    let packageType: SponsorPackageType = 'custom';
    let featured = false;
    if (isNewShape) {
      packageType = LEGACY_PACKAGE_MAP[sponsorshipType] || 'custom';
      featured = b.featured === true;
    } else {
      const pkg = SPONSOR_PACKAGES[b.packageType as SponsorPackageType];
      if (!pkg) {
        return res.status(400).json({ error: 'Invalid sponsor package' });
      }
      packageType = b.packageType as SponsorPackageType;
      featured = packageType === 'featured' || packageType === 'title';
      if (amount === 0) amount = pkg.price;
    }

    const rawLogoBase64 = typeof b.logoBase64 === 'string' && b.logoBase64.length > 0 ? b.logoBase64 : undefined;
    let logoBase64Clean: string | undefined;
    let logoUrl: string | undefined;
    if (rawLogoBase64) {
      const up = await uploadAndStepDown(rawLogoBase64, {
        folder: 'shawty-beauty-studio/sponsors',
        maxWidth: 900,
      });
      if (up.ok && up.url) logoUrl = up.url;
      else logoBase64Clean = rawLogoBase64;
    }

    const reference = await generateReference();

    const sponsor: Sponsor = {
      id: uuid(),
      reference,
      brandName: fullName,
      contactName: contactName || fullName,
      email,
      phone,
      packageType,
      amount,
      notes: message,
      status: 'pending',
      featured,
      logoBase64: logoBase64Clean,
      logoUrl,
      createdAt: new Date().toISOString(),
      sponsorType: isNewShape ? sponsorType : undefined,
      supportAreas: isNewShape ? supportAreas : undefined,
      sponsorshipType: isNewShape ? sponsorshipType : undefined,
      usagePreference: isNewShape ? usagePreference : undefined,
      publicRecognition: isNewShape ? publicRecognition : undefined,
      displayName: displayName || undefined,
      consent: isNewShape ? consent : undefined,
      country: country || undefined,
      state: state || undefined,
      address: address || undefined,
    };

    await writeSponsor(sponsor);
    broadcastRealtime('sponsors', { id: sponsor.id });

    const mail = await deliverSponsorThankYouEmail({
      name: sponsor.brandName || sponsor.displayName || sponsor.contactName || 'Sponsor',
      email: sponsor.email,
      reference,
      eventTitle: undefined,
    });
    if (!mail.emailed) {
      console.warn('Sponsor thank-you email not sent:', mail.reason);
    }

    if (telegramConfigured()) {
      const msg = [
        `<b>🤝 New Sponsorship Application</b>`,
        ``,
        `<b>Reference:</b> ${reference}`,
        `<b>Sponsor:</b> ${escapeHtml(sponsor.brandName)}`,
        sponsor.sponsorType ? `<b>Type:</b> ${escapeHtml(sponsor.sponsorType)}` : '',
        `<b>Email:</b> ${escapeHtml(sponsor.email)}`,
        `<b>Phone:</b> ${escapeHtml(sponsor.phone)}`,
        sponsor.country ? `<b>Country:</b> ${escapeHtml(sponsor.country)}` : '',
        sponsor.state ? `<b>State:</b> ${escapeHtml(sponsor.state)}` : '',
        sponsor.supportAreas?.length ? `<b>Supporting:</b> ${escapeHtml(sponsor.supportAreas.join(', '))}` : '',
        sponsor.sponsorshipType ? `<b>Sponsorship:</b> ${escapeHtml(sponsor.sponsorshipType)}` : '',
        sponsor.amount > 0 ? `<b>Amount:</b> ₦${sponsor.amount.toLocaleString()}` : '<b>Contribution:</b> In-kind',
        sponsor.usagePreference ? `<b>Usage:</b> ${escapeHtml(sponsor.usagePreference)}` : '',
        sponsor.notes ? `<b>Message:</b> ${escapeHtml(sponsor.notes)}` : '',
        sponsor.displayName
          ? `<b>Recognition name:</b> ${escapeHtml(sponsor.displayName)}`
          : '<b>Recognition:</b> Anonymous',
        `<b>Status:</b> Pending`,
      ].filter(Boolean).join('\n');
      sendTelegramMessage(msg).catch(() => {});
    }

    res.status(201).json({ success: true, reference, message: 'Sponsorship application received' });
  } catch (err: any) {
    console.error('Failed to create sponsor:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

export default router;
