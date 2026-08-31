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

// ------------------------------------------------------------------
// Student Registrations (ticket purchases)
// ------------------------------------------------------------------

export type TicketType = 'early-bird' | 'student' | 'vip' | 'group';

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
  emergencyContact: string;
  ticketType: TicketType;
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
}

export async function readRegistrations(
  filter?: Partial<Registration>,
): Promise<Registration[]> {
  const col = getCollection<Registration>('registrations');
  if (!col) return [];
  const query: Record<string, any> = {};
  if (filter?.status) query.status = filter.status;
  if (filter?.ticketType) query.ticketType = filter.ticketType;
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

export async function deleteRegistration(id: string): Promise<boolean> {
  const col = getCollection<Registration>('registrations');
  if (!col) return false;
  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
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

export interface Sponsor {
  _id?: ObjectId;
  id: string;
  brandName: string;
  contactName: string;
  email: string;
  phone: string;
  packageType: SponsorPackageType;
  amount: number;
  notes: string;
  status: SponsorStatus;
  featured: boolean;
  logoBase64?: string;
  createdAt: string;
}

export async function readSponsors(): Promise<Sponsor[]> {
  const col = getCollection<Sponsor>('sponsors');
  if (!col) return [];
  const docs = await col.find().sort({ createdAt: -1 }).toArray();
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
