import { MongoClient, Collection, ObjectId } from 'mongodb';

const DB_NAME = 'shawty-beauty-studio';

let client: MongoClient | null = null;
let db: ReturnType<MongoClient['db']> | null = null;

export async function connectDB(): Promise<void> {
  if (db) return;
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  if (!MONGODB_URI) {
    console.warn('MONGODB_URI not set - data will not persist');
    return;
  }
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`Connected to MongoDB: ${DB_NAME}`);
  } catch (err: any) {
    console.error('MongoDB connection failed:', err.message);
    db = null;
  }
}

export function isDbConnected(): boolean {
  return db !== null;
}

function getCollection<T extends { _id?: ObjectId }>(name: string): Collection<T> | null {
  return db ? db.collection<T>(name) : null;
}

// Guard against NoSQL operator injection in query filters. Only plain
// primitives (string | number | boolean) are ever allowed as filter values;
// any object ($gt, $regex, ...) or empty value is stripped. Routes that need
// richer queries must build their own whitelisted query objects.
function buildSafeQuery(filter: Record<string, unknown>): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  for (const key of Object.keys(filter)) {
    if (key.startsWith('$')) continue; // never trust operator keys
    const v = filter[key];
    if (v === undefined || v === null) continue;
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') {
      query[key] = v;
    }
  }
  return query;
}

// ------------------------------------------------------------------
// Student Registrations (ticket purchases)
// ------------------------------------------------------------------

export type TicketType = 'student' | 'gold';

export type RegistrationStatus =
  | 'pending'
  | 'paid'
  | 'approved'
  | 'cancelled';

export interface Registration {
  _id?: ObjectId;
  id: string;
  fullName: string;
  phone: string;
  email: string;
  instagram: string;
  dateOfBirth: string;
  state: string;
  nationality: string;
  address: string;
  experienceLevel: string;
  emergencyContactName: string;
  emergencyContact: string;
  ticketType: TicketType;
  ticketLabel?: string;
  quantity: number;
  amount: number;
  status: RegistrationStatus;
  paystackRef?: string;
  paystackReference?: string;
  paymentConfirmation?: string;
  reason: string;
  hearAbout: string;
  createdAt: string;
  unitPrice: number;
  subtotal?: number;
  processingFee?: number;
  photoBase64?: string;
  telegramPaidNotified?: boolean;
  // Shawty's Diary: which event this registration belongs to (live event id by default)
  eventId?: string;
  // Attendance tracking. Keys are dynamic day slugs (d1, d2, ...) that the
  // owning event defines via its `attendanceLabels`.
  attendance?: Record<string, boolean>;
  present?: boolean;
  // Ticket delivery: unique token embedded in the ticket QR code (identifies
  // this registrant when they scan it), and when the ticket email was last sent.
  ticketToken?: string;
  ticketEmailedAt?: string;
  // Photo hosted on Cloudinary (photoBase64 is kept for legacy/fallback rows).
  photoUrl?: string;
}

export async function readRegistrations(
  filter?: Partial<Registration>,
): Promise<Registration[]> {
  const col = getCollection<Registration>('registrations');
  if (!col) return [];
  const query = buildSafeQuery((filter || {}) as Record<string, unknown>);
  const docs = await col.find(query).sort({ createdAt: -1 }).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

export async function findRegistration(id: string): Promise<Registration | null> {
  const col = getCollection<Registration>('registrations');
  if (!col) return null;
  const doc = await col.findOne({ id });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

export async function findRegistrationByReference(
  ref: string,
): Promise<Registration | null> {
  const col = getCollection<Registration>('registrations');
  if (!col) return null;
  const doc = await col.findOne({
    $or: [{ paystackRef: ref }, { paystackReference: ref }],
  });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

export async function findRegistrationByTicketToken(
  token: string,
): Promise<Registration | null> {
  const col = getCollection<Registration>('registrations');
  if (!col) return null;
  const doc = await col.findOne({ ticketToken: token });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

export async function writeRegistration(reg: Registration): Promise<void> {
  const col = getCollection<Registration>('registrations');
  if (!col) throw new Error('Database not connected');
  await col.insertOne({
    ...reg,
    status: reg.status ?? 'pending',
  } as any);
}

export async function updateRegistration(
  id: string,
  update: Partial<Registration>,
): Promise<Registration | null> {
  const col = getCollection<Registration>('registrations');
  if (!col) return null;
  const doc = await col.findOneAndUpdate(
    { id },
    { $set: update },
    { returnDocument: 'after' },
  );
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

// Admin-only correction: clear one day's attendance for a registrant. The
// dotted-path $unset removes just that day key from the embedded attendance map.
export async function unmarkAttendance(id: string, day: string): Promise<Registration | null> {
  const col = getCollection<Registration>('registrations');
  if (!col) return null;
  const doc = await col.findOneAndUpdate(
    { id },
    { $unset: { [`attendance.${day}`]: '' } },
    { returnDocument: 'after' },
  );
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

export async function deleteRegistration(id: string): Promise<boolean> {
  const col = getCollection<Registration>('registrations');
  if (!col) return false;
  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}

// Remove legacy registrations that were created before events carried their
// own id and so can never be grouped under any event (the "Unassigned" list).
export async function deleteUnassignedRegistrations(): Promise<number> {
  const col = getCollection<Registration>('registrations');
  if (!col) return 0;
  const result = await col.deleteMany({
    $or: [
      { eventId: { $exists: false } },
      { eventId: null },
      { eventId: '' },
    ],
  } as any);
  return result.deletedCount || 0;
}

// ------------------------------------------------------------------
// Sponsors
// ------------------------------------------------------------------

export type SponsorPackageType =
  | 'supporter'
  | 'partner'
  | 'featured'
  | 'title'
  | 'product'
  | 'service'
  | 'custom';

export type SponsorStatus = 'pending' | 'confirmed' | 'cancelled';

export interface SocialHandle {
  platform: string;
  handle: string;
}

export interface Sponsor {
  _id?: ObjectId;
  id: string;
  reference?: string;
  brandName: string;
  contactName: string;
  email: string;
  phone: string;
  website?: string;
  socials?: SocialHandle[];
  packageType: SponsorPackageType;
  amount: number;
  notes: string;
  status: SponsorStatus;
  featured: boolean;
  logoBase64?: string;
  // Logo hosted on Cloudinary (logoBase64 kept for legacy/fallback rows).
  logoUrl?: string;
  eventId?: string;
  createdAt: string;
  sponsorType?: string;
  supportAreas?: string[];
  sponsorshipType?: string;
  usagePreference?: string;
  publicRecognition?: boolean;
  displayName?: string;
  consent?: boolean;
  country?: string;
  state?: string;
  address?: string;
  // Hidden from the public sponsors page until reactivated in the diary.
  deactivated?: boolean;
}

export async function readSponsors(filter?: Partial<Sponsor>): Promise<Sponsor[]> {
  const col = getCollection<Sponsor>('sponsors');
  if (!col) return [];
  const query = buildSafeQuery((filter || {}) as Record<string, unknown>);
  const docs = await col.find(query).sort({ createdAt: -1 }).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

export async function writeSponsor(sp: Sponsor): Promise<void> {
  const col = getCollection<Sponsor>('sponsors');
  if (!col) throw new Error('Database not connected');
  await col.insertOne({
    ...sp,
    status: sp.status ?? 'pending',
    featured: sp.featured ?? false,
  } as any);
}

export async function updateSponsor(
  id: string,
  update: Partial<Sponsor>,
): Promise<Sponsor | null> {
  const col = getCollection<Sponsor>('sponsors');
  if (!col) return null;
  const doc = await col.findOneAndUpdate(
    { id },
    { $set: update },
    { returnDocument: 'after' },
  );
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

export async function deleteSponsor(id: string): Promise<boolean> {
  const col = getCollection<Sponsor>('sponsors');
  if (!col) return false;
  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}

// ------------------------------------------------------------------
// Contact / Newsletter
// ------------------------------------------------------------------

export interface ContactMessage {
  _id?: ObjectId;
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  phone?: string;
  read: boolean;
  createdAt: string;
}

export async function readContacts(): Promise<ContactMessage[]> {
  const col = getCollection<ContactMessage>('contacts');
  if (!col) return [];
  const docs = await col.find().sort({ createdAt: -1 }).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

export async function writeContact(msg: ContactMessage): Promise<void> {
  const col = getCollection<ContactMessage>('contacts');
  if (!col) throw new Error('Database not connected');
  await col.insertOne(msg as any);
}

export async function markContactRead(id: string): Promise<boolean> {
  const col = getCollection<ContactMessage>('contacts');
  if (!col) return false;
  const result = await col.updateOne({ id }, { $set: { read: true } });
  return result.modifiedCount > 0;
}

export async function deleteContact(id: string): Promise<boolean> {
  const col = getCollection<ContactMessage>('contacts');
  if (!col) return false;
  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}

export interface Subscriber {
  _id?: ObjectId;
  email: string;
  createdAt: string;
}

export async function addSubscriber(email: string): Promise<boolean> {
  const col = getCollection<Subscriber>('subscribers');
  if (!col) throw new Error('Database not connected');
  try {
    await col.insertOne({ email, createdAt: new Date().toISOString() } as any);
  } catch (e: any) {
    if (e?.code === 11000) return false;
    throw e;
  }
  return true;
}

export async function readSubscribers(): Promise<Subscriber[]> {
  const col = getCollection<Subscriber>('subscribers');
  if (!col) return [];
  const docs = await col.find().sort({ createdAt: -1 }).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

export interface Unsubscribed {
  _id?: ObjectId;
  email: string;
  createdAt: string;
}

/** Record a platform-wide opt-out (newsletter, registrations, sponsors, contacts). */
export async function addUnsubscribed(email: string): Promise<boolean> {
  const col = getCollection<Unsubscribed>('unsubscribed');
  if (!col) throw new Error('Database not connected');
  try {
    await col.insertOne({ email, createdAt: new Date().toISOString() } as any);
  } catch (e: any) {
    if (e?.code === 11000) return false;
    throw e;
  }
  return true;
}

export async function readUnsubscribed(): Promise<Unsubscribed[]> {
  const col = getCollection<Unsubscribed>('unsubscribed');
  if (!col) return [];
  const docs = await col.find().sort({ createdAt: -1 }).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

// ------------------------------------------------------------------
// Sent emails (log of every broadcast sent from the Diary)
// ------------------------------------------------------------------

export interface SentEmailRecipient {
  email: string;
  name?: string;
  status: 'sent' | 'failed';
  error?: string;
}

export interface SentEmail {
  _id?: ObjectId;
  id: string;
  subject: string;
  scope: 'event' | 'sponsors' | 'global';
  eventId?: string;
  eventTitle?: string;
  blocks: { type: 'text' | 'image'; text?: string; width?: string }[];
  recipients: SentEmailRecipient[];
  createdAt: string;
}

export async function saveSentEmail(entry: SentEmail): Promise<void> {
  const col = getCollection<SentEmail>('sentEmails');
  if (!col) throw new Error('Database not connected');
  await col.insertOne(entry as any);
}

export async function readSentEmails(): Promise<SentEmail[]> {
  const col = getCollection<SentEmail>('sentEmails');
  if (!col) return [];
  const docs = await col.find().sort({ createdAt: -1 }).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

export async function deleteSentEmail(id: string): Promise<boolean> {
  const col = getCollection<SentEmail>('sentEmails');
  if (!col) return false;
  const res = await col.deleteOne({ id });
  return (res.deletedCount ?? 0) > 0;
}

// ------------------------------------------------------------------
// Hidden emails (admin removed an address from the registered-email registry)
// ------------------------------------------------------------------

export interface HiddenEmail {
  _id?: ObjectId;
  email: string;
  createdAt: string;
}

export async function addHiddenEmail(email: string): Promise<boolean> {
  const col = getCollection<HiddenEmail>('hiddenEmails');
  if (!col) throw new Error('Database not connected');
  try {
    await col.insertOne({ email, createdAt: new Date().toISOString() } as any);
  } catch (e: any) {
    if (e?.code === 11000) return false;
    throw e;
  }
  return true;
}

export async function readHiddenEmails(): Promise<HiddenEmail[]> {
  const col = getCollection<HiddenEmail>('hiddenEmails');
  if (!col) return [];
  const docs = await col.find().toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

// ------------------------------------------------------------------
// Events (the central "happening" — site content is driven by events)
// ------------------------------------------------------------------

export type EventStatus = 'live' | 'scheduled' | 'ended';

export interface EventTicket {
  id: string;
  label: string;
  price: number;
  originalPrice?: number;
  promoDeadline?: number;
  unitName: string;
  includes: string[];
  highlighted?: boolean;
}

export interface StudioEvent {
  _id?: ObjectId;
  id: string;
  slug: string;
  title: string;
  status: EventStatus;
  bannerImage?: string;
  theme?: string;
  datesLabel?: string;
  durationLabel?: string;
  timeLabel?: string;
  venueNote?: string;
  whoFor: string[];
  learn: string[];
  plus?: string;
  bring?: string;
  attendanceDays: number;
  attendanceLabels: string[];
  tickets: EventTicket[];
  createdAt: string;
  updatedAt: string;
}

export function isValidEventStatus(s: string): s is EventStatus {
  return s === 'live' || s === 'scheduled' || s === 'ended';
}

export async function readEvents(filter?: Partial<StudioEvent>): Promise<StudioEvent[]> {
  const col = getCollection<StudioEvent>('events');
  if (!col) return [];
  const query = buildSafeQuery((filter || {}) as Record<string, unknown>);
  const docs = await col.find(query).sort({ createdAt: -1 }).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

export async function findEvent(id: string): Promise<StudioEvent | null> {
  const col = getCollection<StudioEvent>('events');
  if (!col) return null;
  const doc = await col.findOne({ id });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

export async function findEventBySlug(slug: string): Promise<StudioEvent | null> {
  const col = getCollection<StudioEvent>('events');
  if (!col) return null;
  const doc = await col.findOne({ slug });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

export async function findLiveEvent(): Promise<StudioEvent | null> {
  const col = getCollection<StudioEvent>('events');
  if (!col) return null;
  const doc = await col.findOne({ status: 'live' });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

export async function writeEvent(ev: StudioEvent): Promise<void> {
  const col = getCollection<StudioEvent>('events');
  if (!col) throw new Error('Database not connected');
  await col.insertOne(ev as any);
}

export async function updateEvent(
  id: string,
  update: Partial<StudioEvent>,
): Promise<StudioEvent | null> {
  const col = getCollection<StudioEvent>('events');
  if (!col) return null;
  const doc = await col.findOneAndUpdate(
    { id },
    { $set: update },
    { returnDocument: 'after' },
  );
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const col = getCollection<StudioEvent>('events');
  if (!col) return false;
  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}

// ------------------------------------------------------------------
// Site settings (single document: _id 'site') — homepage scrolling ticker
// ------------------------------------------------------------------

export interface TickerSettings {
  enabled: boolean;
  messages: string[];
  bgColor: string;
  textColor: string;
}

export interface SiteSettings {
  ticker: TickerSettings;
}

export const DEFAULT_TICKER: TickerSettings = {
  enabled: true,
  messages: [
    '3BMC — 3 Days Beginner Makeup Class',
    'Registrations Open Now!',
    'Early Bird Offer Ends Soon!',
    'Partnership open for brands that wish to collaborate',
    'Partner With Us',
  ],
  bgColor: '#5f2436',
  textColor: '#fdf0f2',
};

interface SettingsDoc {
  _id?: ObjectId;
  id?: string;
  ticker?: Partial<TickerSettings>;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const col = getCollection<SettingsDoc>('settings');
  if (!col) return { ticker: { ...DEFAULT_TICKER, messages: [...DEFAULT_TICKER.messages] } };
  const doc = await col.findOne({ id: 'site' });
  const t = doc?.ticker;
  return {
    ticker: {
      enabled: typeof t?.enabled === 'boolean' ? t.enabled : DEFAULT_TICKER.enabled,
      messages: Array.isArray(t?.messages)
        ? t.messages.map((m: any) => String(m).trim()).filter(Boolean)
        : [...DEFAULT_TICKER.messages],
      bgColor: typeof t?.bgColor === 'string' && t.bgColor ? t.bgColor : DEFAULT_TICKER.bgColor,
      textColor: typeof t?.textColor === 'string' && t.textColor ? t.textColor : DEFAULT_TICKER.textColor,
    },
  };
}

export async function updateSiteSettings(update: Partial<SiteSettings>): Promise<SiteSettings> {
  const col = getCollection<SettingsDoc>('settings');
  if (!col) return { ticker: { ...DEFAULT_TICKER, messages: [...DEFAULT_TICKER.messages] } };
  const existing = await getSiteSettings();
  const ticker: TickerSettings = {
    enabled:
      typeof update.ticker?.enabled === 'boolean' ? update.ticker.enabled : existing.ticker.enabled,
    messages: Array.isArray(update.ticker?.messages)
      ? update.ticker.messages.map((m: any) => String(m).trim()).filter(Boolean)
      : existing.ticker.messages,
    bgColor: update.ticker?.bgColor || existing.ticker.bgColor,
    textColor: update.ticker?.textColor || existing.ticker.textColor,
  };
  await col.updateOne(
    { id: 'site' },
    { $set: { ticker, updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
  return { ticker };
}

// The default event that ships with the site — used to seed the database so
// the diary, homepage, program page and registration all work out of the box.
export const DEFAULT_EVENT: StudioEvent = {
  id: 'evt-beginner-makeup-class',
  slug: '3-day-beginner-makeup-class',
  title: '3-Days Beginner Makeup Class',
  status: 'live',
  theme: 'Making Makeup Available and Reachable for All',
  datesLabel: '4th – 6th February 2027',
  durationLabel: '3 Days',
  timeLabel: '9:00 AM / 3:00 PM',
  venueNote: 'Venue is disclosed to registered students after ticket purchase.',
  whoFor: ['Makeup lovers', 'Beginner makeup artists'],
  learn: [
    'How to do your own personal makeup',
    'How to recreate basic makeup looks on friends',
    'Fundamental beginner makeup techniques',
    'The difference between being a Makeup Artist and becoming a Beauty CEO',
  ],
  plus:
    'Participants will also be introduced to the business and mindset side of the beauty industry — understanding the difference between simply being a makeup artist and building yourself into a Beauty CEO.',
  bring: 'Participants should come with their own personal makeup products/tools.',
  attendanceDays: 3,
  attendanceLabels: ['Day 1', 'Day 2', 'Day 3'],
  tickets: [
    {
      id: 'student',
      label: 'Student',
      price: 3000,
      originalPrice: 5000,
      promoDeadline: new Date('2026-12-31T23:59:59').getTime(),
      unitName: 'person',
      includes: ['Full 3-day class'],
      highlighted: true,
    },
    {
      id: 'gold',
      label: 'Gold',
      price: 10000,
      unitName: 'person',
      includes: ['Full 3-day class', 'Branded shirt / cap'],
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Seed a default live event on first ever start so the site always has one
 * happening to automate. Called after a successful DB connection.
 */
export async function ensureSeedEvents(): Promise<void> {
  const col = getCollection<StudioEvent>('events');
  if (!col) return;
  const count = await col.countDocuments();
  if (count === 0) {
    await col.insertOne({ ...DEFAULT_EVENT } as any);
    console.log('Seeded default live event.');
  }
  // NOTE: we intentionally never auto-promote a "most recent" event to live.
  // That would undo an admin's "End event" (leaving no live event shows the
  // site's "coming soon" state) on the next server restart. Going live is an
  // explicit admin action via the Make Live button.
}

// ------------------------------------------------------------------
// Settings (e.g. stored admin password after a reset)
// ------------------------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  const col = getCollection<{ _id?: ObjectId; key: string; value: string }>('settings');
  if (!col) return null;
  const doc = await col.findOne({ key });
  return doc?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const col = getCollection<{ _id?: ObjectId; key: string; value: string }>('settings');
  if (!col) throw new Error('Database not connected');
  await col.updateOne({ key }, { $set: { value } }, { upsert: true });
}

// ------------------------------------------------------------------
// Password-reset tokens (Shawty's Diary)
// ------------------------------------------------------------------

export async function saveResetToken(token: string, expiresAt: string): Promise<void> {
  const col = getCollection<{ _id?: ObjectId; token: string; expiresAt: string }>('adminResetTokens');
  if (!col) throw new Error('Database not connected');
  await col.insertOne({ token, expiresAt });
}

/**
 * Validate and consume a reset token. Returns true only once per token,
 * and rejects tokens that are past their expiry.
 */
export async function consumeResetToken(token: string): Promise<boolean> {
  const col = getCollection<{ _id?: ObjectId; token: string; expiresAt: string }>('adminResetTokens');
  if (!col) return false;
  const doc = await col.findOne({ token });
  if (!doc) return false;
  await col.deleteOne({ token });
  return new Date(doc.expiresAt).getTime() > Date.now();
}

// ------------------------------------------------------------------
// Attendance codes (one shared code per event-day, used with the ticket QR)
// ------------------------------------------------------------------

export interface AttendanceCode {
  _id?: ObjectId;
  eventId: string;
  day: string; // d1, d2, ...
  codeHash: string;
  // Plaintext code kept for admin display (the shared code is meant to be
  // shown to attendees, so storing it is safe); check-in always compares
  // against `codeHash`.
  code?: string;
  createdAt: string;
}

/**
 * Store (or replace) the daily attendance code for an event. Both the bcrypt
 * hash (used for check-in) and the plaintext (used for admin display) are
 * kept — generating a new one invalidates the old.
 */
export async function setAttendanceCode(
  eventId: string,
  day: string,
  codeHash: string,
  code?: string,
): Promise<AttendanceCode> {
  const col = getCollection<AttendanceCode>('attendanceCodes');
  if (!col) throw new Error('Database not connected');
  const doc = {
    eventId,
    day,
    codeHash,
    code,
    createdAt: new Date().toISOString(),
  };
  await col.updateOne(
    { eventId, day },
    { $set: doc },
    { upsert: true },
  );
  return doc;
}

export async function listAttendanceCodes(
  eventId: string,
): Promise<{ day: string; createdAt: string }[]> {
  const col = getCollection<AttendanceCode>('attendanceCodes');
  if (!col) return [];
  const docs = await col.find({ eventId }).toArray();
  return docs.map(({ _id, codeHash, code, ...rest }) => rest);
}

/** Admin-facing view that also includes the plaintext code for display. */
export async function listAttendanceCodeViews(
  eventId: string,
): Promise<{ day: string; createdAt: string; code?: string }[]> {
  const col = getCollection<AttendanceCode>('attendanceCodes');
  if (!col) return [];
  const docs = await col.find({ eventId }).toArray();
  return docs.map(({ _id, codeHash, ...rest }) => rest);
}

export async function revokeAttendanceCode(eventId: string, day: string): Promise<boolean> {
  const col = getCollection<AttendanceCode>('attendanceCodes');
  if (!col) return false;
  const res = await col.deleteOne({ eventId, day });
  return (res.deletedCount ?? 0) > 0;
}

/** Server-side variant that includes the bcrypt hash (never expose publicly). */
export async function readAttendanceCodes(
  eventId: string,
): Promise<AttendanceCode[]> {
  const col = getCollection<AttendanceCode>('attendanceCodes');
  if (!col) return [];
  const docs = await col.find({ eventId }).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

export async function findAttendanceCode(
  eventId: string,
  day: string,
): Promise<AttendanceCode | null> {
  const col = getCollection<AttendanceCode>('attendanceCodes');
  if (!col) return null;
  return col.findOne({ eventId, day });
}
