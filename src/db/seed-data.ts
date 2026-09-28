import { contentItems, departments, schools } from './schema';

// Source: hit.ac.zw, compiled September 2026 (see hit-research-notes.md).
// Items marked DRAFT are unpublished until the owning office supplies the facts.

const STRUCTURE: Record<string, string[]> = {
  'School of Engineering & Technology': [
    'Chemical and Process Systems Engineering',
    'Industrial and Manufacturing Engineering',
    'Electronic Engineering',
    'Polymer Technology and Engineering',
    'Biomedical Engineering',
    'Materials Technology and Engineering',
  ],
  'School of Information Science & Technology': [
    'Information Technology',
    'Software Engineering',
    'Computer Science',
    'Information Security & Assurance',
  ],
  'School of Business and Management Sciences': [
    'Electronic Commerce',
    'Financial Engineering',
    'Forensic Accounting and Auditing',
    'Strategy and Innovation',
  ],
  'School of Industrial Sciences & Technology': ['Food Processing Technology', 'Biotechnology'],
  'School of Allied Health Sciences': [
    'Pharmaceutical Technology',
    'Radiography (BSc Hons)',
    'Medical Dosimetry (PG Diploma)',
    'Medical Ultrasound (PG Diploma)',
  ],
};


type Seed = {
  category: (typeof contentItems.$inferInsert)['category'];
  title: string;
  keywords: string[];
  body: string;
  ownerName: string;
  published: boolean;
};

const CONTENT: Seed[] = [
  {
    category: 'admissions',
    title: 'How to apply',
    keywords: ['apply', 'application', 'how to apply', 'admission', 'admissions', 'apply online', 'apply for hit'],
    body:
      'Apply online at apply.hit.ac.zw:\n' +
      '1. Fill in the application form.\n' +
      '2. Upload certified PDFs: O-Level and A-Level certificates, birth certificate, National ID (or first two pages of your passport), and transcripts if applicable.\n' +
      '3. Pay the application fee via Paynow (Visa or EcoCash).\n' +
      '4. Submit online.',
    ownerName: 'Admissions Office',
    published: true,
  },
  {
    category: 'admissions',
    title: 'Application fees',
    keywords: ['application fee', 'apply fee', 'how much to apply', 'fee for application', 'application cost'],
    body:
      'Undergraduate application fee: USD 20 for Zimbabwean citizens, USD 50 for international applicants. The fee is non-refundable.\n\n' +
      'Pay via Paynow (Visa or EcoCash) when applying online, or in person at the Finance Department on campus.',
    ownerName: 'Admissions Office',
    published: true,
  },
  {
    category: 'admissions',
    title: 'Entry requirements',
    keywords: ['entry requirements', 'requirements', 'o level', 'a level', 'qualify', 'qualifications', 'minimum'],
    body:
      'General entry: 5 O-Level passes at grade C or better, including Mathematics and English.\n\n' +
      'Some programmes also need specific A-Level subjects. Check the requirements for your programme on hit.ac.zw or ask to talk to a person.',
    ownerName: 'Admissions Office',
    published: true,
  },
  {
    category: 'admissions',
    title: 'Intake and calendar',
    keywords: ['intake', 'when do applications open', 'when does school start', 'lectures start', 'calendar', 'semester start'],
    body:
      'Applications normally open from mid-January each year, and lectures commence in August.\n\n' +
      'Undergraduate programmes run for 4 years full-time. Postgraduate programmes run for 2 years by block release.',
    ownerName: 'Admissions Office',
    published: true,
  },
  {
    category: 'fees',
    title: 'Paying fees',
    keywords: ['fees', 'pay fees', 'fee structure', 'tuition', 'how to pay', 'payment', 'pay'],
    body:
      'Fees are handled by the Finance Department. The current fee structure is published as a notice on hit.ac.zw each semester.\n\n' +
      'For payment methods, account details, or your balance, email studentaccounts@hit.ac.zw or ask to talk to a person.',
    ownerName: 'Finance Department',
    published: true,
  },
  {
    category: 'accommodation',
    title: 'Student accommodation',
    keywords: ['accommodation', 'hostel', 'residence', 'housing', 'room', 'where to stay', 'boarding'],
    body:
      'Accommodation and catering are managed by Student Affairs (Dean of Students). Application notices for each semester are published on hit.ac.zw.\n\n' +
      'For your specific application, ask to talk to a person.',
    ownerName: 'Student Affairs',
    published: true,
  },
  {
    category: 'contacts',
    title: 'Contact HIT',
    keywords: ['contact', 'phone', 'email', 'address', 'location', 'where is hit', 'portal', 'website', 'elearning'],
    body:
      'Harare Institute of Technology\nGanges Road, Belvedere, Harare\nP.O. Box BE 277, Belvedere\n\n' +
      'Tel: +263 242 741 422-36\nEmail: communications@hit.ac.zw\nFees: studentaccounts@hit.ac.zw\nWebsite: hit.ac.zw\n\n' +
      'Applications: apply.hit.ac.zw\nStudent portal: portal.hit.ac.zw\nE-learning: elearning.hit.ac.zw',
    ownerName: 'Communications Department',
    published: true,
  },
  // DRAFTS: dates and processes not published on the public site. Fill in with the owning office.
  {
    category: 'registration',
    title: 'DRAFT: Registration steps and dates',
    keywords: ['registration', 'register', 'registering', 'add drop', 'course registration'],
    body: 'TODO: get registration windows, steps, and deadlines from the Academic Registry.',
    ownerName: 'Academic Registry',
    published: false,
  },
  {
    category: 'orientation',
    title: 'DRAFT: Orientation programme',
    keywords: ['orientation', 'first year', 'freshers', 'new students', 'what to bring'],
    body: 'TODO: get orientation dates, schedule, and what to bring from Student Affairs.',
    ownerName: 'Student Affairs',
    published: false,
  },
];

export async function seedDatabase(db: any) {
  const now = new Date();

  const existing = await db.select().from(schools);
  if (existing.length === 0) {
    for (const [schoolName, depts] of Object.entries(STRUCTURE)) {
      const [school] = await db.insert(schools).values({ name: schoolName }).returning();
      await db.insert(departments).values(depts.map((name) => ({ schoolId: school.id, name })));
    }
    console.log(`Seeded ${Object.keys(STRUCTURE).length} schools`);
  } else {
    console.log('Schools already seeded, skipping');
  }

  const existingContent = await db.select({ id: contentItems.id }).from(contentItems).limit(1);
  if (existingContent.length === 0) {
    await db.insert(contentItems).values(
      CONTENT.map((c) => ({
        category: c.category,
        title: c.title,
        keywords: c.keywords,
        body: c.body,
        ownerName: c.ownerName,
        isPublished: c.published,
        lastReviewedAt: c.published ? now : null,
      })),
    );
    console.log(`Seeded ${CONTENT.length} content items`);
  } else {
    console.log('Content already seeded, skipping');
  }

}
