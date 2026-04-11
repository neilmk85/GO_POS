import { PrismaClient, CustomerSegment } from '@prisma/client'

const prisma = new PrismaClient()

const OUTLET_ID = 1
const TAX_5 = 2   // GST 5%
const TAX_12 = 3  // GST 12%

// ─── 10 Vendors ──────────────────────────────────────────────────────────────
const vendors = [
  { name: 'Welspun India Ltd',        contactPerson: 'Ramesh Mehta',   phone: '9821001001', email: 'sales@welspun.com',       city: 'Mumbai',    state: 'Maharashtra', gstin: '27AABCW1234A1Z5', paymentTerms: 'Net 30' },
  { name: 'D\'Décor Exports Pvt Ltd', contactPerson: 'Priya Sharma',   phone: '9821002002', email: 'orders@ddecor.in',         city: 'Surat',     state: 'Gujarat',     gstin: '24AABCD5678B1Z3', paymentTerms: 'Net 15' },
  { name: 'Trident Limited',          contactPerson: 'Sunil Gupta',    phone: '9821003003', email: 'trade@tridentindia.com',   city: 'Barnala',   state: 'Punjab',      gstin: '03AABCT9012C1Z1', paymentTerms: 'Net 30' },
  { name: 'Raymond Home',             contactPerson: 'Anjali Verma',   phone: '9821004004', email: 'home@raymond.in',          city: 'Thane',     state: 'Maharashtra', gstin: '27AABCR3456D1Z9', paymentTerms: 'Net 45' },
  { name: 'Spaces Home & Beyond',     contactPerson: 'Vikram Nair',    phone: '9821005005', email: 'b2b@spaces.in',            city: 'Bengaluru', state: 'Karnataka',   gstin: '29AABCS7890E1Z7', paymentTerms: 'Advance' },
  { name: 'Portico New York India',   contactPerson: 'Neha Joshi',     phone: '9821006006', email: 'supply@porticony.in',      city: 'Mumbai',    state: 'Maharashtra', gstin: '27AABCP2345F1Z5', paymentTerms: 'Net 30' },
  { name: 'Story@Home Pvt Ltd',       contactPerson: 'Arjun Das',      phone: '9821007007', email: 'vendor@storyathome.com',   city: 'Delhi',     state: 'Delhi',       gstin: '07AABCS6789G1Z3', paymentTerms: 'Net 15' },
  { name: 'Casa Décor Creations',     contactPerson: 'Sunita Pillai',  phone: '9821008008', email: 'info@casadecor.in',        city: 'Jaipur',    state: 'Rajasthan',   gstin: '08AABCC0123H1Z1', paymentTerms: 'Net 30' },
  { name: 'HomeCraft Textiles',       contactPerson: 'Manish Agarwal', phone: '9821009009', email: 'sales@homecrafttex.com',   city: 'Panipat',   state: 'Haryana',     gstin: '06AABCH4567I1Z9', paymentTerms: 'Net 45' },
  { name: 'Saravana Bhavan Exports',  contactPerson: 'Kavita Reddy',   phone: '9821010010', email: 'export@sbe.in',            city: 'Chennai',   state: 'Tamil Nadu',  gstin: '33AABCS8901J1Z7', paymentTerms: 'Net 30' },
]

// ─── 40 Customers ─────────────────────────────────────────────────────────────
const customers: Array<{
  name: string; phone: string; email?: string; city: string; state: string;
  segment: CustomerSegment; creditLimit: number; discountPercent: number;
}> = [
  { name: 'Aarti Sharma',       phone: '9711100001', email: 'aarti.sharma@gmail.com',     city: 'Mumbai',    state: 'Maharashtra', segment: 'GOLD',      creditLimit: 10000, discountPercent: 5 },
  { name: 'Bharat Kumar',       phone: '9711100002', email: 'bharat.k@yahoo.com',          city: 'Delhi',     state: 'Delhi',       segment: 'SILVER',    creditLimit: 5000,  discountPercent: 3 },
  { name: 'Chitra Nair',        phone: '9711100003', email: 'chitra.nair@outlook.com',     city: 'Bengaluru', state: 'Karnataka',   segment: 'REGULAR',   creditLimit: 0,     discountPercent: 0 },
  { name: 'Deepak Verma',       phone: '9711100004',                                       city: 'Pune',      state: 'Maharashtra', segment: 'REGULAR',   creditLimit: 0,     discountPercent: 0 },
  { name: 'Ekta Gupta',         phone: '9711100005', email: 'ekta.gupta@gmail.com',        city: 'Jaipur',    state: 'Rajasthan',   segment: 'SILVER',    creditLimit: 5000,  discountPercent: 3 },
  { name: 'Farhan Shaikh',      phone: '9711100006', email: 'farhan.s@gmail.com',          city: 'Surat',     state: 'Gujarat',     segment: 'GOLD',      creditLimit: 15000, discountPercent: 5 },
  { name: 'Geeta Pillai',       phone: '9711100007',                                       city: 'Chennai',   state: 'Tamil Nadu',  segment: 'REGULAR',   creditLimit: 0,     discountPercent: 0 },
  { name: 'Harish Menon',       phone: '9711100008', email: 'harish.m@outlook.com',        city: 'Kochi',     state: 'Kerala',      segment: 'VIP',       creditLimit: 50000, discountPercent: 10 },
  { name: 'Isha Patel',         phone: '9711100009', email: 'isha.patel@gmail.com',        city: 'Ahmedabad', state: 'Gujarat',     segment: 'GOLD',      creditLimit: 10000, discountPercent: 5 },
  { name: 'Jatin Mehta',        phone: '9711100010',                                       city: 'Indore',    state: 'Madhya Pradesh', segment: 'REGULAR', creditLimit: 0,    discountPercent: 0 },
  { name: 'Kavya Reddy',        phone: '9711100011', email: 'kavya.r@gmail.com',           city: 'Hyderabad', state: 'Telangana',   segment: 'SILVER',    creditLimit: 7500,  discountPercent: 3 },
  { name: 'Lalit Agarwal',      phone: '9711100012', email: 'lalit.a@businessmail.com',    city: 'Lucknow',   state: 'Uttar Pradesh', segment: 'WHOLESALE', creditLimit: 100000, discountPercent: 15 },
  { name: 'Meena Singh',        phone: '9711100013',                                       city: 'Bhopal',    state: 'Madhya Pradesh', segment: 'REGULAR', creditLimit: 0,    discountPercent: 0 },
  { name: 'Nikhil Joshi',       phone: '9711100014', email: 'nikhil.j@gmail.com',          city: 'Nagpur',    state: 'Maharashtra', segment: 'SILVER',    creditLimit: 5000,  discountPercent: 3 },
  { name: 'Omkar Desai',        phone: '9711100015', email: 'omkar.d@yahoo.com',           city: 'Nashik',    state: 'Maharashtra', segment: 'REGULAR',   creditLimit: 0,     discountPercent: 0 },
  { name: 'Pooja Iyer',         phone: '9711100016', email: 'pooja.iyer@gmail.com',        city: 'Coimbatore',state: 'Tamil Nadu',  segment: 'GOLD',      creditLimit: 10000, discountPercent: 5 },
  { name: 'Qasim Ali',          phone: '9711100017',                                       city: 'Bhopal',    state: 'Madhya Pradesh', segment: 'REGULAR', creditLimit: 0,    discountPercent: 0 },
  { name: 'Riya Kapoor',        phone: '9711100018', email: 'riya.k@gmail.com',            city: 'Mumbai',    state: 'Maharashtra', segment: 'VIP',       creditLimit: 50000, discountPercent: 10 },
  { name: 'Suresh Yadav',       phone: '9711100019', email: 'suresh.y@gmail.com',          city: 'Patna',     state: 'Bihar',       segment: 'REGULAR',   creditLimit: 0,     discountPercent: 0 },
  { name: 'Tanvi Bhatt',        phone: '9711100020', email: 'tanvi.b@outlook.com',         city: 'Vadodara',  state: 'Gujarat',     segment: 'SILVER',    creditLimit: 5000,  discountPercent: 3 },
  { name: 'Uday Rao',           phone: '9711100021',                                       city: 'Mysuru',    state: 'Karnataka',   segment: 'REGULAR',   creditLimit: 0,     discountPercent: 0 },
  { name: 'Vanita Kulkarni',    phone: '9711100022', email: 'vanita.k@gmail.com',          city: 'Aurangabad',state: 'Maharashtra', segment: 'GOLD',      creditLimit: 12000, discountPercent: 5 },
  { name: 'Wasim Khan',         phone: '9711100023', email: 'wasim.khan@biz.com',          city: 'Jodhpur',   state: 'Rajasthan',   segment: 'WHOLESALE', creditLimit: 80000, discountPercent: 12 },
  { name: 'Xena D\'Souza',      phone: '9711100024', email: 'xena.d@gmail.com',            city: 'Goa',       state: 'Goa',         segment: 'SILVER',    creditLimit: 6000,  discountPercent: 3 },
  { name: 'Yogesh Tiwari',      phone: '9711100025',                                       city: 'Varanasi',  state: 'Uttar Pradesh', segment: 'REGULAR', creditLimit: 0,    discountPercent: 0 },
  { name: 'Zara Qureshi',       phone: '9711100026', email: 'zara.q@gmail.com',            city: 'Lucknow',   state: 'Uttar Pradesh', segment: 'GOLD',    creditLimit: 10000, discountPercent: 5 },
  { name: 'Anil Pandey',        phone: '9711100027', email: 'anil.pandey@gmail.com',       city: 'Allahabad', state: 'Uttar Pradesh', segment: 'REGULAR', creditLimit: 0,    discountPercent: 0 },
  { name: 'Bindu Krishnan',     phone: '9711100028', email: 'bindu.k@yahoo.com',           city: 'Thrissur',  state: 'Kerala',      segment: 'SILVER',    creditLimit: 5000,  discountPercent: 3 },
  { name: 'Chirag Shah',        phone: '9711100029',                                       city: 'Rajkot',    state: 'Gujarat',     segment: 'REGULAR',   creditLimit: 0,     discountPercent: 0 },
  { name: 'Divya Menon',        phone: '9711100030', email: 'divya.m@gmail.com',           city: 'Bengaluru', state: 'Karnataka',   segment: 'VIP',       creditLimit: 50000, discountPercent: 10 },
  { name: 'Eshan Malik',        phone: '9711100031', email: 'eshan.m@outlook.com',         city: 'Ludhiana',  state: 'Punjab',      segment: 'GOLD',      creditLimit: 10000, discountPercent: 5 },
  { name: 'Falguni Trivedi',    phone: '9711100032', email: 'falguni.t@gmail.com',         city: 'Anand',     state: 'Gujarat',     segment: 'REGULAR',   creditLimit: 0,     discountPercent: 0 },
  { name: 'Gaurav Saxena',      phone: '9711100033', email: 'gaurav.s@biz.com',            city: 'Gurgaon',   state: 'Haryana',     segment: 'WHOLESALE', creditLimit: 120000, discountPercent: 15 },
  { name: 'Heena Bose',         phone: '9711100034',                                       city: 'Kolkata',   state: 'West Bengal', segment: 'REGULAR',   creditLimit: 0,     discountPercent: 0 },
  { name: 'Irfan Siddiqui',     phone: '9711100035', email: 'irfan.s@gmail.com',           city: 'Kanpur',    state: 'Uttar Pradesh', segment: 'SILVER',  creditLimit: 5000,  discountPercent: 3 },
  { name: 'Jyoti Rawat',        phone: '9711100036', email: 'jyoti.r@yahoo.com',           city: 'Dehradun',  state: 'Uttarakhand', segment: 'GOLD',      creditLimit: 10000, discountPercent: 5 },
  { name: 'Kiran Murthy',       phone: '9711100037',                                       city: 'Mangaluru', state: 'Karnataka',   segment: 'REGULAR',   creditLimit: 0,     discountPercent: 0 },
  { name: 'Laxmi Chaudhary',    phone: '9711100038', email: 'laxmi.c@gmail.com',           city: 'Jodhpur',   state: 'Rajasthan',   segment: 'SILVER',    creditLimit: 6000,  discountPercent: 3 },
  { name: 'Mihir Thakkar',      phone: '9711100039', email: 'mihir.t@outlook.com',         city: 'Surat',     state: 'Gujarat',     segment: 'REGULAR',   creditLimit: 0,     discountPercent: 0 },
  { name: 'Nisha Goyal',        phone: '9711100040', email: 'nisha.g@gmail.com',           city: 'Jaipur',    state: 'Rajasthan',   segment: 'VIP',       creditLimit: 40000, discountPercent: 8 },
]

// ─── 10 Categories ────────────────────────────────────────────────────────────
const categories = [
  { name: 'Bed Linen',         description: 'Bedsheets, pillow covers, fitted sheets and bed sets',     displayOrder: 1 },
  { name: 'Curtains & Drapes', description: 'Window curtains, blinds, sheers and door drapes',         displayOrder: 2 },
  { name: 'Towels & Bath',     description: 'Bath towels, hand towels, face towels and bath sets',     displayOrder: 3 },
  { name: 'Cushions & Pillows',description: 'Decorative cushions, throw pillows, pillow inserts',      displayOrder: 4 },
  { name: 'Blankets & Quilts', description: 'Comforters, duvets, quilts, throws and AC blankets',      displayOrder: 5 },
  { name: 'Rugs & Doormats',   description: 'Area rugs, bath mats, runners and anti-skid doormats',    displayOrder: 6 },
  { name: 'Table Linen',       description: 'Table covers, placemats, napkins and table runners',      displayOrder: 7 },
  { name: 'Wall Décor',        description: 'Wall art, mirrors, hangings, clocks and photo frames',    displayOrder: 8 },
  { name: 'Candles & Fragrance', description: 'Scented candles, diffusers, potpourri and incense',    displayOrder: 9 },
  { name: 'Storage & Organizer', description: 'Baskets, boxes, racks, hangers and closet organizers', displayOrder: 10 },
]

// ─── 50 Products ──────────────────────────────────────────────────────────────
// catIndex = 0-based index into categories array (resolved after creation)
const productDefs: Array<{
  name: string; sku: string; sellingPrice: number; costPrice: number; mrp: number;
  catIndex: number; taxId: number; unitOfMeasure: string; reorderLevel: number;
  description?: string; featured?: boolean;
}> = [
  // Bed Linen (cat 0)
  { name: 'King Size Cotton Bedsheet Set (6 pcs)', sku: 'BL-001', sellingPrice: 1499, costPrice: 850, mrp: 1999, catIndex: 0, taxId: TAX_5,  unitOfMeasure: 'set',  reorderLevel: 10, description: '1 king sheet + 2 pillow covers + 2 cushion covers + 1 fitted sheet, 220 TC', featured: true },
  { name: 'Double Bedsheet 180 TC (3 pcs)',         sku: 'BL-002', sellingPrice: 799,  costPrice: 420, mrp: 999,  catIndex: 0, taxId: TAX_5,  unitOfMeasure: 'set',  reorderLevel: 15 },
  { name: 'Single Bedsheet Floral Print',           sku: 'BL-003', sellingPrice: 449,  costPrice: 230, mrp: 599,  catIndex: 0, taxId: TAX_5,  unitOfMeasure: 'pcs',  reorderLevel: 20 },
  { name: 'Pillow Cover Pair (2 pcs) 16x24"',       sku: 'BL-004', sellingPrice: 199,  costPrice: 100, mrp: 299,  catIndex: 0, taxId: TAX_5,  unitOfMeasure: 'pair', reorderLevel: 25 },
  { name: 'King Fitted Sheet 400 TC White',         sku: 'BL-005', sellingPrice: 699,  costPrice: 380, mrp: 899,  catIndex: 0, taxId: TAX_5,  unitOfMeasure: 'pcs',  reorderLevel: 10 },
  { name: 'Waterproof Mattress Protector King',     sku: 'BL-006', sellingPrice: 999,  costPrice: 550, mrp: 1399, catIndex: 0, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 8 },

  // Curtains (cat 1)
  { name: 'Blackout Curtain 7ft (Set of 2)',        sku: 'CR-001', sellingPrice: 1299, costPrice: 700, mrp: 1799, catIndex: 1, taxId: TAX_5,  unitOfMeasure: 'set',  reorderLevel: 10, featured: true },
  { name: 'Sheer Voile Curtain 5ft Single Panel',   sku: 'CR-002', sellingPrice: 499,  costPrice: 250, mrp: 699,  catIndex: 1, taxId: TAX_5,  unitOfMeasure: 'pcs',  reorderLevel: 15 },
  { name: 'Door Curtain Jacquard 7ft',              sku: 'CR-003', sellingPrice: 699,  costPrice: 380, mrp: 999,  catIndex: 1, taxId: TAX_5,  unitOfMeasure: 'pcs',  reorderLevel: 12 },
  { name: 'Eyelet Curtain Printed 5ft (Set of 2)',  sku: 'CR-004', sellingPrice: 999,  costPrice: 540, mrp: 1299, catIndex: 1, taxId: TAX_5,  unitOfMeasure: 'set',  reorderLevel: 10 },
  { name: 'Bamboo Roller Blind 3x5ft',              sku: 'CR-005', sellingPrice: 799,  costPrice: 450, mrp: 1099, catIndex: 1, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 8 },

  // Towels (cat 2)
  { name: 'Premium Cotton Bath Towel 600 GSM',      sku: 'TW-001', sellingPrice: 599,  costPrice: 300, mrp: 799,  catIndex: 2, taxId: TAX_5,  unitOfMeasure: 'pcs',  reorderLevel: 20, featured: true },
  { name: 'Hand Towel Set of 4',                    sku: 'TW-002', sellingPrice: 499,  costPrice: 250, mrp: 699,  catIndex: 2, taxId: TAX_5,  unitOfMeasure: 'set',  reorderLevel: 15 },
  { name: 'Face Towel Pack of 6',                   sku: 'TW-003', sellingPrice: 349,  costPrice: 175, mrp: 499,  catIndex: 2, taxId: TAX_5,  unitOfMeasure: 'set',  reorderLevel: 20 },
  { name: 'Bath Towel Set (1 Bath + 1 Hand + 2 Face)', sku: 'TW-004', sellingPrice: 999, costPrice: 520, mrp: 1399, catIndex: 2, taxId: TAX_5,  unitOfMeasure: 'set',  reorderLevel: 12 },
  { name: 'Bamboo Fibre Bath Towel',                sku: 'TW-005', sellingPrice: 749,  costPrice: 390, mrp: 999,  catIndex: 2, taxId: TAX_5,  unitOfMeasure: 'pcs',  reorderLevel: 10 },
  { name: 'Bath Sheet Extra Large 90x180cm',        sku: 'TW-006', sellingPrice: 899,  costPrice: 480, mrp: 1199, catIndex: 2, taxId: TAX_5,  unitOfMeasure: 'pcs',  reorderLevel: 8 },

  // Cushions (cat 3)
  { name: 'Velvet Cushion Cover 16x16" Set of 5',  sku: 'CS-001', sellingPrice: 799,  costPrice: 400, mrp: 1099, catIndex: 3, taxId: TAX_12, unitOfMeasure: 'set',  reorderLevel: 15, featured: true },
  { name: 'Jute Embroidered Cushion Cover 18x18"', sku: 'CS-002', sellingPrice: 299,  costPrice: 150, mrp: 449,  catIndex: 3, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 20 },
  { name: 'Throw Pillow Insert 16x16"',            sku: 'CS-003', sellingPrice: 199,  costPrice: 90,  mrp: 299,  catIndex: 3, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 20 },
  { name: 'Floor Cushion Round 24" Bohemian',      sku: 'CS-004', sellingPrice: 899,  costPrice: 480, mrp: 1199, catIndex: 3, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 8 },

  // Blankets (cat 4)
  { name: 'Microfibre AC Blanket Double',           sku: 'BQ-001', sellingPrice: 999,  costPrice: 520, mrp: 1399, catIndex: 4, taxId: TAX_5,  unitOfMeasure: 'pcs',  reorderLevel: 10, featured: true },
  { name: 'Reversible Comforter King 300 GSM',      sku: 'BQ-002', sellingPrice: 2499, costPrice: 1400, mrp: 3499, catIndex: 4, taxId: TAX_5, unitOfMeasure: 'pcs',  reorderLevel: 5 },
  { name: 'Cotton Dohar Double Bed',                sku: 'BQ-003', sellingPrice: 1299, costPrice: 700, mrp: 1799, catIndex: 4, taxId: TAX_5,  unitOfMeasure: 'pcs',  reorderLevel: 8 },
  { name: 'Sherpa Fleece Throw Blanket 60x80"',     sku: 'BQ-004', sellingPrice: 899,  costPrice: 480, mrp: 1199, catIndex: 4, taxId: TAX_5,  unitOfMeasure: 'pcs',  reorderLevel: 10 },
  { name: 'Electric Blanket Double Bed',            sku: 'BQ-005', sellingPrice: 3999, costPrice: 2400, mrp: 5499, catIndex: 4, taxId: TAX_12, unitOfMeasure: 'pcs', reorderLevel: 5 },

  // Rugs (cat 5)
  { name: 'Cotton Dhurrie Rug 4x6 ft',             sku: 'RG-001', sellingPrice: 1499, costPrice: 800, mrp: 1999, catIndex: 5, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 8, featured: true },
  { name: 'Non-Slip Doormat 16x24"',               sku: 'RG-002', sellingPrice: 299,  costPrice: 150, mrp: 449,  catIndex: 5, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 20 },
  { name: 'Microfibre Bath Mat 17x24"',             sku: 'RG-003', sellingPrice: 399,  costPrice: 200, mrp: 599,  catIndex: 5, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 15 },
  { name: 'Jute Braided Area Rug 5x7 ft',          sku: 'RG-004', sellingPrice: 2999, costPrice: 1700, mrp: 3999, catIndex: 5, taxId: TAX_12, unitOfMeasure: 'pcs', reorderLevel: 5 },
  { name: 'Coir Welcome Mat 14x24"',               sku: 'RG-005', sellingPrice: 199,  costPrice: 90,  mrp: 299,  catIndex: 5, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 25 },

  // Table Linen (cat 6)
  { name: 'PVC Table Cover 4 Seater 54x54"',       sku: 'TL-001', sellingPrice: 349,  costPrice: 175, mrp: 499,  catIndex: 6, taxId: TAX_5,  unitOfMeasure: 'pcs',  reorderLevel: 15 },
  { name: 'Cotton Table Runner 13x72"',            sku: 'TL-002', sellingPrice: 499,  costPrice: 250, mrp: 699,  catIndex: 6, taxId: TAX_5,  unitOfMeasure: 'pcs',  reorderLevel: 12 },
  { name: 'Placemat Set of 6 Jute',               sku: 'TL-003', sellingPrice: 599,  costPrice: 300, mrp: 799,  catIndex: 6, taxId: TAX_5,  unitOfMeasure: 'set',  reorderLevel: 10 },
  { name: 'Cotton Napkin Set of 6',               sku: 'TL-004', sellingPrice: 399,  costPrice: 200, mrp: 599,  catIndex: 6, taxId: TAX_5,  unitOfMeasure: 'set',  reorderLevel: 15 },

  // Wall Décor (cat 7)
  { name: 'Mandala Wall Hanging 18" Round',        sku: 'WD-001', sellingPrice: 699,  costPrice: 350, mrp: 999,  catIndex: 7, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 10, featured: true },
  { name: 'Wooden Photo Frame Set of 3',          sku: 'WD-002', sellingPrice: 899,  costPrice: 480, mrp: 1299, catIndex: 7, taxId: TAX_12, unitOfMeasure: 'set',  reorderLevel: 8 },
  { name: 'Round Decorative Mirror 18"',          sku: 'WD-003', sellingPrice: 1499, costPrice: 820, mrp: 1999, catIndex: 7, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 5 },
  { name: 'Analog Wall Clock Wooden 12"',         sku: 'WD-004', sellingPrice: 799,  costPrice: 420, mrp: 1099, catIndex: 7, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 8 },
  { name: 'Canvas Wall Art Triptych 12x18"',      sku: 'WD-005', sellingPrice: 1199, costPrice: 650, mrp: 1699, catIndex: 7, taxId: TAX_12, unitOfMeasure: 'set',  reorderLevel: 6 },

  // Candles (cat 8)
  { name: 'Soy Wax Scented Candle 200g Lavender', sku: 'CD-001', sellingPrice: 499,  costPrice: 240, mrp: 699,  catIndex: 8, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 15, featured: true },
  { name: 'Reed Diffuser Set 100ml',              sku: 'CD-002', sellingPrice: 699,  costPrice: 350, mrp: 999,  catIndex: 8, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 12 },
  { name: 'Tealight Candle Pack of 50',           sku: 'CD-003', sellingPrice: 299,  costPrice: 140, mrp: 449,  catIndex: 8, taxId: TAX_12, unitOfMeasure: 'pack', reorderLevel: 20 },
  { name: 'Aroma Diffuser Ultrasonic 300ml',      sku: 'CD-004', sellingPrice: 1999, costPrice: 1200, mrp: 2799, catIndex: 8, taxId: TAX_12, unitOfMeasure: 'pcs', reorderLevel: 5 },

  // Storage (cat 9)
  { name: 'Seagrass Storage Basket Medium',        sku: 'ST-001', sellingPrice: 799,  costPrice: 420, mrp: 1099, catIndex: 9, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 10 },
  { name: 'Fabric Wardrobe Organizer 9 Shelf',    sku: 'ST-002', sellingPrice: 1299, costPrice: 720, mrp: 1799, catIndex: 9, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 8 },
  { name: 'Under-Bed Storage Bag Zippered',       sku: 'ST-003', sellingPrice: 499,  costPrice: 250, mrp: 699,  catIndex: 9, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 12 },
  { name: 'Wooden Key Holder 6 Hooks Wall Mount', sku: 'ST-004', sellingPrice: 599,  costPrice: 300, mrp: 849,  catIndex: 9, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 10 },
  { name: 'Foldable Laundry Bag 35L',             sku: 'ST-005', sellingPrice: 349,  costPrice: 175, mrp: 499,  catIndex: 9, taxId: TAX_12, unitOfMeasure: 'pcs',  reorderLevel: 15 },
]

async function main() {
  console.log('🌱 Seeding home decor data...\n')

  // 1. Vendors
  console.log('Creating vendors...')
  for (const v of vendors) {
    await prisma.supplier.upsert({
      where: { name: v.name } as any,
      update: {},
      create: { ...v, createdBy: 'seed' },
    }).catch(async () => {
      // upsert by name may fail if no unique constraint — use findFirst + create
      const existing = await prisma.supplier.findFirst({ where: { name: v.name } })
      if (!existing) await prisma.supplier.create({ data: { ...v, createdBy: 'seed' } })
    })
  }
  const vendorCount = await prisma.supplier.count()
  console.log(`  ✓ ${vendorCount} vendors total`)

  // 2. Customers
  console.log('Creating customers...')
  let custCreated = 0
  for (const c of customers) {
    const existing = await prisma.customer.findFirst({ where: { phone: c.phone } })
    if (!existing) {
      await prisma.customer.create({ data: { ...c, createdBy: 'seed' } })
      custCreated++
    }
  }
  const customerCount = await prisma.customer.count()
  console.log(`  ✓ ${custCreated} customers created (${customerCount} total)`)

  // 3. Categories
  console.log('Creating categories...')
  const createdCategories: { id: number }[] = []
  for (const cat of categories) {
    let existing = await prisma.category.findFirst({ where: { name: cat.name } })
    if (!existing) {
      existing = await prisma.category.create({ data: { ...cat, createdBy: 'seed' } })
    }
    createdCategories.push({ id: existing.id })
  }
  console.log(`  ✓ ${createdCategories.length} categories ready`)

  // 4. Products
  console.log('Creating products...')
  let prodCreated = 0
  for (const p of productDefs) {
    const { catIndex, taxId, ...rest } = p
    const categoryId = createdCategories[catIndex]?.id
    const existing = await prisma.product.findFirst({ where: { sku: p.sku } })
    if (!existing) {
      const product = await prisma.product.create({
        data: {
          ...rest,
          categoryId,
          taxGroupId: taxId,
          productType: 'PHYSICAL',
          trackInventory: true,
          featured: p.featured ?? false,
          createdBy: 'seed',
        },
      })
      // Seed initial inventory at main outlet
      const existingInv = await prisma.inventory.findFirst({
        where: { productId: product.id, outletId: OUTLET_ID, variantId: null },
      })
      if (!existingInv) {
        await prisma.inventory.create({
          data: {
            outletId: OUTLET_ID,
            productId: product.id,
            quantityOnHand: Math.floor(Math.random() * 40) + 20, // 20–60
            reorderLevel: p.reorderLevel,
          },
        })
      }
      prodCreated++
    }
  }
  const productCount = await prisma.product.count()
  console.log(`  ✓ ${prodCreated} products created (${productCount} total)`)

  console.log('\n✅ Seed complete!')
  console.log(`   Vendors: ${await prisma.supplier.count()}`)
  console.log(`   Customers: ${await prisma.customer.count()}`)
  console.log(`   Categories: ${await prisma.category.count()}`)
  console.log(`   Products: ${await prisma.product.count()}`)
  console.log(`   Inventory records: ${await prisma.inventory.count()}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
