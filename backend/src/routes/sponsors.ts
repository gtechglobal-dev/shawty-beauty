import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import {
  writeSponsor,
  type Sponsor,
  type SponsorPackageType,
} from '../db.js';

const router = Router();

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
    const { brandName, contactName, email, phone, packageType, amount, notes, logoBase64 } = req.body;

    const cleanBrand = (brandName || '').trim();
    const cleanContact = (contactName || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').trim();

    if (!cleanBrand || !cleanContact || !cleanEmail || !cleanPhone || !packageType) {
      return res.status(400).json({ error: 'Brand name, contact name, email, phone and package are required' });
    }
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const pkg = SPONSOR_PACKAGES[packageType as SponsorPackageType];
    if (!pkg) {
      return res.status(400).json({ error: 'Invalid sponsor package' });
    }

    const sponsor: Sponsor = {
      id: uuid(),
      brandName: cleanBrand,
      contactName: cleanContact,
      email: cleanEmail,
      phone: cleanPhone,
      packageType: packageType as SponsorPackageType,
      amount: typeof amount === 'number' ? amount : pkg.price,
      notes: (notes || '').trim().slice(0, 2000),
      status: 'pending',
      featured: packageType === 'featured' || packageType === 'title',
      logoBase64: typeof logoBase64 === 'string' && logoBase64.length > 0 ? logoBase64.slice(0, 300000) : undefined,
      createdAt: new Date().toISOString(),
    };

    await writeSponsor(sponsor);

    res.status(201).json({ success: true, id: sponsor.id, message: 'Sponsorship application received' });
  } catch (err: any) {
    console.error('Failed to create sponsor:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

export default router;
