export const siteConfig = {
  name: 'Shawty Beauty Studio',
  owner: 'Makeup Artist & Lash Tech Professional',
  tagline: 'Makeup Available and Reachable for All',
  email: 'shawtybeautystudio@gmail.com',
  phone: '+234 916 321 98567',
  phoneRaw: '+23491632198567',
  whatsapp: 'https://wa.me/23491632198567',
  instagram: 'https://instagram.com/shawtys_beauty_studio',
  instagramHandle: '@shawtys_beauty_studio',
}

// --- Beauty services (the core business) ---
export interface Service {
  title: string
  desc: string
  long: string
  image: string
}

export const lashServices: Service[] = [
  {
    title: 'Classic Lashes',
    desc: 'Natural, one-to-one lashes that enhance your eyes every day.',
    long: 'Classic lashes are applied lash-by-lash — one lightweight extension on every natural lash — for a clean, refined enhancement. They are gentle, comfortable and ideal for everyday wear, adding subtle length and definition without ever looking heavy or overdone.',
    image: '/images/classic lashes.jpg',
  },
  {
    title: 'Hybrid Lashes',
    desc: 'A textured mix of classic and volume for a soft, fuller look.',
    long: 'Hybrid lashes blend classic single extensions with volume fans for a textured look that is fuller than classic but still soft and natural. It is the perfect middle ground — a flirty, feathery set that frames the eyes beautifully.',
    image: '/images/hybrid-lash-extensions-vs-classic.jpg',
  },
  {
    title: 'Volume Lashes',
    desc: 'Fluffy, dramatic volume lashes for a glam, stand-out finish.',
    long: 'Volume lashes apply several ultra-fine extensions in a fan onto each natural lash, creating a fluffy, full and dramatically glamorous set. Lightweight yet striking, they are made for anyone who wants a bold, camera-ready look.',
    image: '/images/volume lashes.jpeg',
  },
  {
    title: 'Wispy Set / Bottom Lashes',
    desc: 'Wispy lash sets and bottom lashes to complete your look.',
    long: 'Wispy lash sets use varying lengths to create an airy, fluttery finish that looks effortless and textured. Add bottom lashes to open up and fully frame the eyes for an unexpected, striking finish.',
    image: '/images/wispy set lashes.jpg',
  },
]

export const makeupServices: Service[] = [
  {
    title: 'Soft Glam',
    desc: 'Everyday elegant glam that keeps you looking fresh and radiant.',
    long: 'Soft glam enhances your natural features with luminous skin, neutral shadows and a graceful finish. It is the everyday elegant look — fresh, wearable and radiant enough for any occasion.',
    image: '/images/soft glam.png',
  },
  {
    title: 'Full Glam',
    desc: 'High-impact, camera-ready glam for events and nights out.',
    long: 'Full glam is high-impact and unapologetic — sculpted cheeks, defined, smoky eyes and a flawless, long-wearing base built for events, parties and nights out. Every detail is perfected to look stunning in person and on camera.',
    image: '/images/full glam.png',
  },
  {
    title: 'Bridal Glam',
    desc: 'Long-lasting bridal makeup designed to glow through your big day.',
    long: 'Bridal glam is crafted to last from the ceremony to the last dance. We design a timeless, glowing look around your dress and personality, use long-wear products, and make sure every photograph captures your best light.',
    image: '/images/bridal glam.png',
  },
  {
    title: 'Photoshoot Makeup',
    desc: 'Makeup that photographs beautifully for shoots and content.',
    long: 'Photoshoot makeup is tailored to read beautifully on camera — studio or natural light, video or stills. Skin texture is perfected, shine is controlled and features are sculpted so you look your best in every frame.',
    image: '/images/photoshoot makeup.png',
  },
  {
    title: 'Makeup Training (1-on-1)',
    desc: 'Personal one-on-one lessons to build your own skills and confidence.',
    long: 'Learn makeup at your own pace with personal, one-on-one coaching. Whether you are starting from zero or brushing up your technique, you will practice on live models and leave with the confidence to do your own makeup — or even client work.',
    image: '/images/studio1.png',
  },
]

// --- The 3-day event (an advert hosted by Shawty Beauty Studio) ---
export const program = {
  title: '3-Day Beginner Makeup Class',
  theme: 'Making Makeup Available and Reachable for All',
  dates: '4th – 6th February 2027',
  duration: '3 Days',
  time: {
    morning: '9:00 AM',
    evening: '3:00 PM',
  },
  venue: 'Disclosed to registered students after ticket purchase.',
  whoFor: ['Makeup lovers', 'Beginner makeup artists'],
  learn: [
    'How to do your own personal makeup',
    'How to recreate basic makeup looks on friends',
    'Fundamental beginner makeup techniques',
    'The difference between being a Makeup Artist and becoming a Beauty CEO',
  ],
  plus: "Participants will also be introduced to the business and mindset side of the beauty industry—understanding the difference between simply being a makeup artist and building yourself into a Beauty CEO.",
  bring: 'Participants should come with their own personal makeup products/tools.',
}

export interface Ticket {
  id: 'early-bird' | 'student' | 'vip' | 'group'
  label: string
  price: number
  unitName: string
  includes: string[]
  highlighted?: boolean
  slot?: string
}

export const tickets: Ticket[] = [
  { id: 'early-bird', label: 'Early Bird', price: 3000, unitName: 'person', includes: ['Full 3-day class'] },
  { id: 'student', label: 'Student', price: 5000, unitName: 'person', includes: ['Full 3-day class'], highlighted: true },
  { id: 'vip', label: 'VIP', price: 10000, unitName: 'person', includes: ['Full 3-day class', 'Branded shirt / cap'] },
  { id: 'group', label: 'Group', price: 10000, unitName: 'group of 4', includes: ['Full 3-day class for 4 persons'] },
]

export interface SponsorPkg {
  id: 'supporter' | 'partner' | 'featured' | 'title' | 'product' | 'service'
  label: string
  price: number
  desc: string
  benefits: string[]
  slot?: string
}

export const sponsorPackages: SponsorPkg[] = [
  {
    id: 'supporter', label: 'Supporter', price: 20000,
    desc: 'For individuals, small businesses, and emerging beauty brands that simply want to support the initiative.',
    benefits: [
      'Name/logo on the official sponsor appreciation graphic',
      'Social media appreciation post/story',
      'Verbal appreciation during the program',
      'Sponsor recognition on the event’s digital materials',
    ],
  },
  {
    id: 'partner', label: 'Partner', price: 50000,
    desc: 'For brands that want more visibility before and during the event.',
    benefits: [
      'Everything in Supporter',
      'Prominent logo placement on event promotional materials',
      'Dedicated social media feature',
      'Brand mention during selected event sessions',
      'Opportunity to provide flyers, discount cards or approved materials',
      'Brand included in post-event appreciation content',
    ],
  },
  {
    id: 'featured', label: 'Featured Sponsor', price: 100000,
    desc: 'For brands that want to be visibly associated with the program.',
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
  {
    id: 'title', label: 'Title / Major Sponsor', price: 200000, slot: '2 slots only',
    desc: 'Limited to 2 slots, custom/limited so only true main sponsors claim the positioning.',
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
  {
    id: 'product', label: 'Product Sponsor', price: 0,
    desc: 'Beauty products, brushes, tools, gift items, etc.',
    benefits: ['Recognition and benefits based on your contributions and agreement'],
  },
  {
    id: 'service', label: 'Service Sponsor', price: 0,
    desc: 'Photography, videography, printing, refreshments, venue support, branding, etc.',
    benefits: ['Recognition and benefits based on your contributions and agreement'],
  },
]

export const nationalities: Record<string, string[]> = {
  Nigerian: [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
    'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
    'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
    'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
    'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
    'Federal Capital Territory (Abuja)',
  ],
  Ghanaian: [
    'Greater Accra', 'Ashanti', 'Western', 'Western North', 'Eastern', 'Central',
    'Volta', 'Oti', 'Northern', 'Savannah', 'North East', 'Upper East',
    'Upper West', 'Bono', 'Bono East', 'Ahafo',
  ],
  Kenyan: [
    'Mombasa', 'Kwale', 'Kilifi', 'Tana River', 'Lamu', 'Taita-Taveta',
    'Garissa', 'Wajir', 'Mandera', 'Marsabit', 'Isiolo', 'Meru', 'Tharaka-Nithi',
    'Embu', 'Kitui', 'Machakos', 'Makueni', 'Nyandarua', 'Nyeri', 'Kirinyaga',
    "Murang'a", 'Kiambu', 'Turkana', 'West Pokot', 'Samburu', 'Trans Nzoia',
    'Uasin Gishu', 'Elgeyo-Marakwet', 'Nandi', 'Baringo', 'Laikipia', 'Nakuru',
    'Narok', 'Kajiado', 'Kericho', 'Bomet', 'Kakamega', 'Vihiga', 'Bungoma',
    'Busia', 'Siaya', 'Kisumu', 'Homa Bay', 'Migori', 'Kisii', 'Nyamira', 'Nairobi City',
  ],
  'South African': [
    'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
    'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
  ],
  Togolese: ['Maritime', 'Plateaux', 'Centrale', 'Kara', 'Savanes'],
  Beninese: [
    'Alibori', 'Atacora', 'Atlantique', 'Borgou', 'Collines', 'Couffo',
    'Donga', 'Littoral', 'Mono', 'Ouémé', 'Plateau', 'Zou',
  ],
  Cameroonian: [
    'Adamawa', 'Centre', 'East', 'Far North', 'Littoral', 'North',
    'North West', 'South', 'South West', 'West',
  ],
  Ivorian: [
    'Abidjan', 'Bas-Sassandra', 'Comoé', 'Denguélé', 'Gôh-Djiboua', 'Lacs',
    'Lagunes', 'Montagnes', 'Sassandra-Marahoué', 'Savanes',
    'Vallée du Bandama', 'Woroba', 'Yamoussoukro', 'Zanzan',
  ],
  Senegalese: [
    'Dakar', 'Diourbel', 'Fatick', 'Kaffrine', 'Kaolack', 'Kédougou',
    'Kolda', 'Louga', 'Matam', 'Saint-Louis', 'Sédhiou', 'Tambacounda',
    'Thiès', 'Ziguinchor',
  ],
  British: ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  French: [
    'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Brittany',
    'Centre-Val de Loire', 'Corsica', 'Grand Est', 'Hauts-de-France',
    'Île-de-France', 'Normandy', 'Nouvelle-Aquitaine', 'Occitanie',
    'Pays de la Loire', 'Provence-Alpes-Côte d’Azur',
  ],
  German: [
    'Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen',
    'Hamburg', 'Hesse', 'Lower Saxony', 'Mecklenburg-Vorpommern',
    'North Rhine-Westphalia', 'Rhineland-Palatinate', 'Saarland', 'Saxony',
    'Saxony-Anhalt', 'Schleswig-Holstein', 'Thuringia',
  ],
  Emirati: ['Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain'],
  Indian: [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
    'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi (NCT)',
    'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
  ],
  American: [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
    'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia',
    'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
    'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
    'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
    'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
    'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
    'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
  ],
  Canadian: [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
    'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia',
    'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon',
  ],
}

export const nationalityNames = Object.keys(nationalities)

export function formatNgn(n: number): string {
  return '₦' + n.toLocaleString('en-NG')
}

export const apiUrl = '/api'

export const galleryImages = [
  '/images/makeup1.jpg',
  '/images/makeup2.jpg',
  '/images/lashes.jpg',
  '/images/face.png',
  '/images/brushes.png',
]
