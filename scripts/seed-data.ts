/**
 * Static content for the seed: the service catalogue, staff roster and the
 * name pools used to generate patients. Kept apart from seed.ts so the
 * insertion logic stays readable.
 *
 * Context is Nigerian throughout — Port Harcourt / Rivers State addresses,
 * Nigerian names, NGN pricing (stored in kobo).
 */

export const CATEGORIES = [
  {
    name: 'Home Care',
    slug: 'home-care',
    description: 'Skilled nursing and daily-living support delivered in your own home.',
    icon: 'home',
    accent: 'crimson',
    sortOrder: 1,
  },
  {
    name: 'Consultation',
    slug: 'consultation',
    description: 'See a doctor in our clinic or from wherever you are.',
    icon: 'stethoscope',
    accent: 'blue',
    sortOrder: 2,
  },
  {
    name: 'Rehabilitation',
    slug: 'rehabilitation',
    description: 'Physiotherapy and recovery programmes for injury and post-surgery care.',
    icon: 'activity',
    accent: 'purple',
    sortOrder: 3,
  },
  {
    name: 'Diagnostics',
    slug: 'diagnostics',
    description: 'Laboratory testing with sample collection at home or in clinic.',
    icon: 'test-tube',
    accent: 'amber',
    sortOrder: 4,
  },
  {
    name: 'Pharmacy',
    slug: 'pharmacy',
    description: 'Prescription fulfilment and medication delivered to your door.',
    icon: 'pill',
    accent: 'rose',
    sortOrder: 5,
  },
  {
    name: 'Preventive Care',
    slug: 'preventive-care',
    description: 'Screenings, vaccinations and health checks that catch problems early.',
    icon: 'shield',
    accent: 'emerald',
    sortOrder: 6,
  },
];

export interface SeedService {
  name: string;
  slug: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  icon: string;
  priceNaira: number;
  homeVisitSurchargeNaira: number;
  durationMinutes: number;
  bufferMinutes: number;
  serviceType: 'clinic' | 'home' | 'virtual' | 'hybrid';
  whatsIncluded: string[];
  requirements: string[];
  preparation: string[];
  faqs: { question: string; answer: string }[];
  isFeatured: boolean;
}

export const SERVICES: SeedService[] = [
  {
    name: 'Home Nursing',
    slug: 'home-nursing',
    categorySlug: 'home-care',
    shortDescription: 'Skilled nursing care in the comfort of your home.',
    description:
      'Our registered nurses deliver clinical care at home — wound dressing, injections, ' +
      'catheter care, vital-sign monitoring and post-discharge support. Each visit is carried ' +
      'out by a nurse on our own staff, supervised by our clinical lead, with a written ' +
      'summary shared with you and your doctor afterwards.',
    icon: 'home',
    priceNaira: 25_000,
    homeVisitSurchargeNaira: 0,
    durationMinutes: 60,
    bufferMinutes: 30,
    serviceType: 'home',
    whatsIncluded: [
      'Full assessment of vital signs',
      'Prescribed clinical procedures (dressing, injections, catheter care)',
      'Medication administration and adherence review',
      'Written visit summary shared with you',
      'Escalation to a doctor where needed',
    ],
    requirements: [
      'A valid prescription or referral for any clinical procedure',
      'Someone aged 18+ present at the address',
      'Any existing medication available for review',
    ],
    preparation: [
      'Have your medication and any recent test results to hand',
      'Clear a well-lit space where the nurse can work',
      'Keep pets in a separate room during the visit',
    ],
    faqs: [
      {
        question: 'How quickly can a nurse reach me?',
        answer:
          'Same-day visits are usually available within Port Harcourt when booked before 2pm. ' +
          'Availability is shown live during booking, so what you see is what is genuinely free.',
      },
      {
        question: 'Can the same nurse attend each visit?',
        answer:
          'Yes. When you book, you can select a specific nurse from those qualified for this ' +
          'service, and we will keep that assignment where their schedule allows.',
      },
    ],
    isFeatured: true,
  },
  {
    name: 'Doctor Consultation',
    slug: 'doctor-consultation',
    categorySlug: 'consultation',
    shortDescription: 'Consult a licensed doctor in clinic or from home.',
    description:
      'A full consultation with one of our doctors covering history, examination, diagnosis ' +
      'and a treatment plan. Choose our GRA clinic for an in-person examination, or a virtual ' +
      'appointment when a conversation is enough. Prescriptions are issued electronically and ' +
      'can be fulfilled through our pharmacy service.',
    icon: 'stethoscope',
    priceNaira: 15_000,
    homeVisitSurchargeNaira: 10_000,
    durationMinutes: 30,
    bufferMinutes: 15,
    serviceType: 'hybrid',
    whatsIncluded: [
      'Full clinical history and examination',
      'Diagnosis and written treatment plan',
      'Electronic prescription where indicated',
      'Referral for tests or specialist care if needed',
      'One follow-up message within 7 days',
    ],
    requirements: ['Photo ID for a first visit', 'A list of current medication'],
    preparation: [
      'Write down your symptoms and when they started',
      'Bring recent test results if you have them',
      'For virtual visits, find a quiet, well-lit spot',
    ],
    faqs: [
      {
        question: 'Can I get a prescription from a virtual consultation?',
        answer:
          'Yes, where clinically appropriate. Some conditions require a physical examination ' +
          'first — the doctor will tell you during the consultation and help you book one.',
      },
    ],
    isFeatured: true,
  },
  {
    name: 'Physiotherapy',
    slug: 'physiotherapy',
    categorySlug: 'rehabilitation',
    shortDescription: 'Recovery and mobility programmes, at home or in clinic.',
    description:
      'Assessment and hands-on treatment for pain, injury and post-surgical recovery. Your ' +
      'physiotherapist builds a programme around your goals — walking unaided again, returning ' +
      'to sport, managing chronic back pain — and adjusts it at each session as you progress.',
    icon: 'activity',
    priceNaira: 20_000,
    homeVisitSurchargeNaira: 5_000,
    durationMinutes: 45,
    bufferMinutes: 15,
    serviceType: 'hybrid',
    whatsIncluded: [
      'Movement and pain assessment',
      'Hands-on manual therapy',
      'A personalised exercise programme',
      'Progress review at every session',
    ],
    requirements: ['Comfortable, loose clothing', 'Any imaging or specialist reports you hold'],
    preparation: [
      'Avoid a heavy meal in the hour before your session',
      'Bring or wear clothing you can move freely in',
    ],
    faqs: [
      {
        question: 'How many sessions will I need?',
        answer:
          'Most recovery plans run between 4 and 12 sessions. Your physiotherapist will give ' +
          'you a realistic estimate after the first assessment.',
      },
    ],
    isFeatured: true,
  },
  {
    name: 'Lab Tests',
    slug: 'lab-tests',
    categorySlug: 'diagnostics',
    shortDescription: 'Sample collection at home, results within 24–48 hours.',
    description:
      'A trained phlebotomist collects your samples at home or in clinic and our partner ' +
      'laboratory processes them under standard turnaround times. Results are uploaded to your ' +
      'patient dashboard, and any result outside the normal range is reviewed by a doctor ' +
      'before it reaches you.',
    icon: 'test-tube',
    priceNaira: 8_000,
    homeVisitSurchargeNaira: 3_000,
    durationMinutes: 30,
    bufferMinutes: 15,
    serviceType: 'hybrid',
    whatsIncluded: [
      'Professional sample collection',
      'Laboratory processing',
      'Digital results in your dashboard',
      'Doctor review of any abnormal result',
    ],
    requirements: ['A test request form, where your doctor has issued one'],
    preparation: [
      'Fast for 8–12 hours if your test requires it — we will tell you when booking',
      'Drink water normally unless told otherwise',
      'Have your ID ready for sample labelling',
    ],
    faqs: [
      {
        question: 'When will I get my results?',
        answer:
          'Most routine panels are back within 24–48 hours. You receive a notification the ' +
          'moment results are available in your dashboard.',
      },
    ],
    isFeatured: true,
  },
  {
    name: 'Medication Delivery',
    slug: 'medication-delivery',
    categorySlug: 'pharmacy',
    shortDescription: 'Prescriptions filled and delivered to your door.',
    description:
      'Send us your prescription and our pharmacist dispenses and delivers it across Port ' +
      'Harcourt. Every order is checked for interactions against the medication we already ' +
      'hold on your record, and the pharmacist calls you if anything needs clarifying.',
    icon: 'pill',
    priceNaira: 5_500,
    homeVisitSurchargeNaira: 0,
    durationMinutes: 30,
    bufferMinutes: 15,
    serviceType: 'home',
    whatsIncluded: [
      'Pharmacist review of your prescription',
      'Dispensing of prescribed medication',
      'Delivery within Port Harcourt',
      'Counselling call on how to take it',
    ],
    requirements: ['A valid prescription', 'An adult available to receive the delivery'],
    preparation: ['Upload a clear photo of your prescription when booking'],
    faqs: [
      {
        question: 'Does the price include the medication?',
        answer:
          'No — this fee covers pharmacist review and delivery. The cost of the medication ' +
          'itself is confirmed with you by phone before dispensing.',
      },
    ],
    isFeatured: true,
  },
  {
    name: 'Elderly Care',
    slug: 'elderly-care',
    categorySlug: 'home-care',
    shortDescription: 'Compassionate daily support for older adults at home.',
    description:
      'Regular visits supporting older adults with personal care, mobility, medication ' +
      'routines and companionship. We keep the same carer wherever possible, because ' +
      'familiarity matters more than almost anything else in this kind of care.',
    icon: 'elderly',
    priceNaira: 30_000,
    homeVisitSurchargeNaira: 0,
    durationMinutes: 120,
    bufferMinutes: 30,
    serviceType: 'home',
    whatsIncluded: [
      'Personal care and hygiene support',
      'Medication reminders and administration',
      'Mobility assistance and light exercise',
      'Companionship and wellbeing check',
      'Family update after each visit',
    ],
    requirements: ['An initial care assessment before the first visit'],
    preparation: ['Prepare a list of routines, preferences and medication times'],
    faqs: [
      {
        question: 'Can we arrange recurring visits?',
        answer:
          'Yes. Book the first visit online and our care coordinator will call to set up a ' +
          'recurring schedule that suits the family.',
      },
    ],
    isFeatured: false,
  },
  {
    name: 'Health Checkup',
    slug: 'health-checkup',
    categorySlug: 'preventive-care',
    shortDescription: 'A full-body screening that catches problems early.',
    description:
      'A comprehensive screening covering vital signs, blood work, cardiovascular and ' +
      'metabolic markers, finishing with a doctor consultation to walk you through the ' +
      'results and what to do about them.',
    icon: 'heart-pulse',
    priceNaira: 40_000,
    homeVisitSurchargeNaira: 8_000,
    durationMinutes: 90,
    bufferMinutes: 30,
    serviceType: 'hybrid',
    whatsIncluded: [
      'Full vital-sign assessment',
      'Comprehensive blood panel',
      'Cardiovascular and metabolic screening',
      'Doctor consultation on your results',
      'A written health report',
    ],
    requirements: ['Fast for 10–12 hours before your appointment'],
    preparation: [
      'Do not eat for 10–12 hours beforehand; water is fine',
      'Avoid alcohol for 24 hours before',
      'Bring previous health records if you have them',
    ],
    faqs: [
      {
        question: 'How often should I have a full check-up?',
        answer:
          'Once a year for most adults, and every six months from age 50 or if you manage a ' +
          'chronic condition.',
      },
    ],
    isFeatured: true,
  },
  {
    name: 'Wound Care',
    slug: 'wound-care',
    categorySlug: 'home-care',
    shortDescription: 'Specialist dressing and management of complex wounds.',
    description:
      'Assessment and dressing of surgical wounds, ulcers and diabetic foot wounds by nurses ' +
      'trained in wound management. We photograph and document healing at each visit so ' +
      'progress — or deterioration — is caught early.',
    icon: 'wound-care',
    priceNaira: 18_000,
    homeVisitSurchargeNaira: 0,
    durationMinutes: 45,
    bufferMinutes: 20,
    serviceType: 'home',
    whatsIncluded: [
      'Wound assessment and photography',
      'Cleaning and sterile dressing',
      'Infection monitoring',
      'Healing progress documentation',
    ],
    requirements: ['Any dressing materials prescribed by your doctor'],
    preparation: ['Keep the existing dressing dry and in place until the nurse arrives'],
    faqs: [
      {
        question: 'What if the wound looks infected?',
        answer:
          'Our nurse escalates to a doctor the same day and we will arrange an urgent ' +
          'consultation at no additional booking fee.',
      },
    ],
    isFeatured: false,
  },
  {
    name: 'Vaccination',
    slug: 'vaccination',
    categorySlug: 'preventive-care',
    shortDescription: 'Routine and travel vaccinations for adults and children.',
    description:
      'Routine childhood immunisations, adult boosters and travel vaccinations administered ' +
      'by our nurses, with your record updated and a certificate issued where required.',
    icon: 'vaccination',
    priceNaira: 12_000,
    homeVisitSurchargeNaira: 4_000,
    durationMinutes: 20,
    bufferMinutes: 10,
    serviceType: 'hybrid',
    whatsIncluded: [
      'Pre-vaccination screening',
      'Vaccine administration',
      'Immunisation record update',
      '15-minute observation period',
    ],
    requirements: ['Your immunisation card, if you have one'],
    preparation: ['Wear a short-sleeved top', 'Eat and drink normally beforehand'],
    faqs: [
      {
        question: 'Is the vaccine cost included?',
        answer:
          'The administration fee is shown here. Vaccine cost varies by type and is confirmed ' +
          'with you before the appointment.',
      },
    ],
    isFeatured: false,
  },
  {
    name: 'Antenatal Care',
    slug: 'antenatal-care',
    categorySlug: 'consultation',
    shortDescription: 'Pregnancy monitoring and support, at home or in clinic.',
    description:
      'Scheduled antenatal checks covering maternal vitals, foetal monitoring, nutrition and ' +
      'birth planning, delivered by midwives and doctors on our own team.',
    icon: 'baby',
    priceNaira: 22_000,
    homeVisitSurchargeNaira: 6_000,
    durationMinutes: 45,
    bufferMinutes: 15,
    serviceType: 'hybrid',
    whatsIncluded: [
      'Maternal vital signs and weight',
      'Foetal heart-rate monitoring',
      'Nutrition and wellbeing guidance',
      'Birth-plan discussion',
    ],
    requirements: ['Your antenatal card and any scan reports'],
    preparation: ['Bring all previous scan and test results', 'Wear comfortable clothing'],
    faqs: [
      {
        question: 'Can I have antenatal visits at home?',
        answer:
          'Yes, for routine monitoring. Some checks need clinic equipment, and your midwife ' +
          'will tell you well in advance which visits those are.',
      },
    ],
    isFeatured: false,
  },
  {
    name: 'Mental Health Consultation',
    slug: 'mental-health-consultation',
    categorySlug: 'consultation',
    shortDescription: 'Confidential talking therapy, in person or online.',
    description:
      'A private, judgement-free consultation with a clinician experienced in anxiety, ' +
      'depression, grief and stress. Sessions are confidential and can be held virtually if ' +
      'that feels easier.',
    icon: 'brain',
    priceNaira: 18_000,
    homeVisitSurchargeNaira: 0,
    durationMinutes: 50,
    bufferMinutes: 10,
    serviceType: 'virtual',
    whatsIncluded: [
      'A confidential 50-minute session',
      'Assessment and coping strategies',
      'A written care plan',
      'Onward referral where appropriate',
    ],
    requirements: ['A private space and a stable internet connection'],
    preparation: [
      'Find somewhere you will not be interrupted',
      'Note anything you want to make sure you cover',
    ],
    faqs: [
      {
        question: 'Is what I say kept private?',
        answer:
          'Yes. Sessions are confidential and notes are restricted to your treating clinician, ' +
          'except where there is a risk to life that we are legally required to act on.',
      },
    ],
    isFeatured: false,
  },
  {
    name: 'Post-Surgery Care',
    slug: 'post-surgery-care',
    categorySlug: 'home-care',
    shortDescription: 'Structured recovery support after an operation.',
    description:
      'Nursing visits following discharge: wound checks, pain management, mobility support and ' +
      'watching for complications, coordinated with your surgical team.',
    icon: 'bandage',
    priceNaira: 28_000,
    homeVisitSurchargeNaira: 0,
    durationMinutes: 60,
    bufferMinutes: 30,
    serviceType: 'home',
    whatsIncluded: [
      'Surgical wound assessment',
      'Pain management review',
      'Mobility and rehabilitation support',
      'Complication monitoring',
      'Coordination with your surgical team',
    ],
    requirements: ['Your discharge summary', 'Prescribed medication available'],
    preparation: ['Have your discharge paperwork and medication to hand'],
    faqs: [
      {
        question: 'How soon after discharge should the first visit be?',
        answer:
          'Usually within 24–48 hours. Book the earliest slot available and we will call to ' +
          'confirm the timing suits your recovery.',
      },
    ],
    isFeatured: false,
  },
];

export interface SeedStaff {
  name: string;
  email: string;
  phone: string;
  title: 'doctor' | 'nurse' | 'physiotherapist' | 'pharmacist' | 'lab_technician' | 'care_coordinator';
  department: 'nursing' | 'medical' | 'physiotherapy' | 'pharmacy' | 'laboratory' | 'operations';
  bio: string;
  qualifications: string[];
  specialisations: string[];
  yearsOfExperience: number;
  serviceSlugs: string[];
  /** Working days keyed by weekday name; omitted days are days off. */
  schedule: Record<string, { start: string; end: string; breakStart?: string; breakEnd?: string }>;
}

const STANDARD_WEEK = {
  monday: { start: '08:00', end: '17:00', breakStart: '13:00', breakEnd: '14:00' },
  tuesday: { start: '08:00', end: '17:00', breakStart: '13:00', breakEnd: '14:00' },
  wednesday: { start: '08:00', end: '17:00', breakStart: '13:00', breakEnd: '14:00' },
  thursday: { start: '08:00', end: '17:00', breakStart: '13:00', breakEnd: '14:00' },
  friday: { start: '08:00', end: '17:00', breakStart: '13:00', breakEnd: '14:00' },
  saturday: { start: '09:00', end: '14:00' },
};

const LATE_WEEK = {
  monday: { start: '10:00', end: '18:00', breakStart: '14:00', breakEnd: '15:00' },
  tuesday: { start: '10:00', end: '18:00', breakStart: '14:00', breakEnd: '15:00' },
  wednesday: { start: '10:00', end: '18:00', breakStart: '14:00', breakEnd: '15:00' },
  thursday: { start: '10:00', end: '18:00', breakStart: '14:00', breakEnd: '15:00' },
  friday: { start: '10:00', end: '18:00', breakStart: '14:00', breakEnd: '15:00' },
};

export const STAFF: SeedStaff[] = [
  {
    name: 'Mary Jane Okafor',
    email: 'maryjane.okafor@nurseoncall.ng',
    phone: '08031234567',
    title: 'nurse',
    department: 'nursing',
    bio:
      'Mary Jane has spent twelve years in community nursing across Rivers State, most of it ' +
      'in patients’ homes. She leads our home-nursing team and mentors every nurse who joins it.',
    qualifications: ['RN, University of Port Harcourt', 'BNSc Nursing Science', 'Wound Care Certification'],
    specialisations: ['Home nursing', 'Wound management', 'Post-operative care'],
    yearsOfExperience: 12,
    serviceSlugs: ['home-nursing', 'elderly-care', 'wound-care', 'post-surgery-care', 'vaccination'],
    schedule: STANDARD_WEEK,
  },
  {
    name: 'Dr. Daniel Adeyemi',
    email: 'daniel.adeyemi@nurseoncall.ng',
    phone: '08032345678',
    title: 'doctor',
    department: 'medical',
    bio:
      'A family physician with fifteen years in general practice, Dr. Adeyemi is our clinical ' +
      'lead and reviews every abnormal result before it reaches a patient.',
    qualifications: ['MBBS, University of Ibadan', 'MWACP Family Medicine', 'MPH'],
    specialisations: ['Family medicine', 'Chronic disease management', 'Preventive care'],
    yearsOfExperience: 15,
    serviceSlugs: ['doctor-consultation', 'health-checkup', 'antenatal-care', 'mental-health-consultation'],
    schedule: STANDARD_WEEK,
  },
  {
    name: 'Patricia Amadi',
    email: 'patricia.amadi@nurseoncall.ng',
    phone: '08033456789',
    title: 'physiotherapist',
    department: 'physiotherapy',
    bio:
      'Patricia specialises in getting people moving again after surgery and sports injury. ' +
      'She built our home-based rehabilitation programme.',
    qualifications: ['BPhysio, University of Nigeria', 'Sports Rehabilitation Certification'],
    specialisations: ['Post-operative rehabilitation', 'Sports injury', 'Chronic pain'],
    yearsOfExperience: 9,
    serviceSlugs: ['physiotherapy', 'post-surgery-care'],
    schedule: LATE_WEEK,
  },
  {
    name: 'James Tamunobelema',
    email: 'james.tamuno@nurseoncall.ng',
    phone: '08034567890',
    title: 'lab_technician',
    department: 'laboratory',
    bio:
      'James handles sample collection across Port Harcourt and has an unbroken record of ' +
      'correctly labelled, correctly stored samples over eight years.',
    qualifications: ['BMLS Medical Laboratory Science', 'AMLSCN Licensed'],
    specialisations: ['Phlebotomy', 'Sample handling', 'Point-of-care testing'],
    yearsOfExperience: 8,
    serviceSlugs: ['lab-tests', 'health-checkup'],
    schedule: STANDARD_WEEK,
  },
  {
    name: 'David Nwachukwu',
    email: 'david.nwachukwu@nurseoncall.ng',
    phone: '08035678901',
    title: 'pharmacist',
    department: 'pharmacy',
    bio:
      'David reviews every prescription that passes through our pharmacy service and calls ' +
      'patients directly whenever an interaction needs discussing.',
    qualifications: ['PharmD, University of Benin', 'PCN Licensed Pharmacist'],
    specialisations: ['Medication therapy management', 'Drug interaction review'],
    yearsOfExperience: 7,
    serviceSlugs: ['medication-delivery'],
    schedule: STANDARD_WEEK,
  },
  {
    name: 'Grace Ibiere',
    email: 'grace.ibiere@nurseoncall.ng',
    phone: '08036789012',
    title: 'nurse',
    department: 'nursing',
    bio:
      'Grace is a midwife and community nurse whose antenatal clinics have followed hundreds ' +
      'of Rivers State pregnancies from first visit to delivery.',
    qualifications: ['RN, RM', 'BNSc Nursing Science', 'Antenatal Care Certification'],
    specialisations: ['Antenatal care', 'Maternal health', 'Immunisation'],
    yearsOfExperience: 10,
    serviceSlugs: ['antenatal-care', 'vaccination', 'home-nursing', 'elderly-care'],
    schedule: STANDARD_WEEK,
  },
  {
    name: 'Dr. Chidinma Eze',
    email: 'chidinma.eze@nurseoncall.ng',
    phone: '08037890123',
    title: 'doctor',
    department: 'medical',
    bio:
      'Dr. Eze runs our virtual consultation service and holds a particular interest in ' +
      'mental health care, which she believes is badly under-served locally.',
    qualifications: ['MBBS, University of Port Harcourt', 'Diploma in Mental Health'],
    specialisations: ['Telemedicine', 'Mental health', 'General practice'],
    yearsOfExperience: 6,
    serviceSlugs: ['doctor-consultation', 'mental-health-consultation', 'health-checkup'],
    schedule: LATE_WEEK,
  },
];

export const ADMINS = [
  {
    name: 'Alexander Okoji',
    email: 'admin@nurseoncall.ng',
    phone: '08030000001',
    role: 'super_admin' as const,
  },
  {
    name: 'Ngozi Abara',
    email: 'ngozi.abara@nurseoncall.ng',
    phone: '08030000002',
    role: 'admin' as const,
  },
  {
    name: 'Tunde Bakare',
    email: 'tunde.bakare@nurseoncall.ng',
    phone: '08030000003',
    role: 'operations_manager' as const,
  },
  {
    name: 'Halima Yusuf',
    email: 'halima.yusuf@nurseoncall.ng',
    phone: '08030000004',
    role: 'finance' as const,
  },
];

/** Name pools used to generate the patient roster. */
export const FIRST_NAMES = [
  'Chinedu', 'Amina', 'Emeka', 'Grace', 'Blessing', 'Taiwo', 'Kehinde', 'Ifeoma',
  'Olumide', 'Zainab', 'Chukwuemeka', 'Adaeze', 'Ibrahim', 'Funmilayo', 'Tochukwu',
  'Aisha', 'Segun', 'Chiamaka', 'Nnamdi', 'Yetunde', 'Obinna', 'Halima', 'Uche',
  'Folake', 'Kelechi', 'Maryam', 'Bassey', 'Ngozi', 'Tamunotonye', 'Ijeoma',
  'Sopuruchi', 'Aisosa', 'Ebiere', 'Chukwudi', 'Rukayat',
];

export const LAST_NAMES = [
  'Okafor', 'Adeyemi', 'Nwachukwu', 'Bello', 'Eze', 'Adewale', 'Obi', 'Yusuf',
  'Amadi', 'Okonkwo', 'Danjuma', 'Ogunleye', 'Wike', 'Briggs', 'Jaja', 'Peterside',
  'Amaechi', 'Ibrahim', 'Balogun', 'Onyeka', 'Tamuno', 'Iheanacho', 'Abara',
  'Chukwu', 'Lawal', 'Ekpo', 'Uzoma', 'Sanusi', 'Georgewill', 'Nsirim',
];

/** Rivers State neighbourhoods used for home-visit addresses. */
export const PH_AREAS = [
  { area: 'GRA Phase 2', city: 'Port Harcourt' },
  { area: 'Rumuola', city: 'Port Harcourt' },
  { area: 'D/Line', city: 'Port Harcourt' },
  { area: 'Rumuokoro', city: 'Port Harcourt' },
  { area: 'Ada George', city: 'Port Harcourt' },
  { area: 'Woji', city: 'Port Harcourt' },
  { area: 'Rumuomasi', city: 'Port Harcourt' },
  { area: 'Eliozu', city: 'Port Harcourt' },
  { area: 'Trans-Amadi', city: 'Port Harcourt' },
  { area: 'Rumuigbo', city: 'Port Harcourt' },
  { area: 'Oroazi', city: 'Port Harcourt' },
  { area: 'Choba', city: 'Port Harcourt' },
];

export const STREETS = [
  'Aba Road', 'Ikwerre Road', 'Olu Obasanjo Road', 'Stadium Road', 'Emenike Street',
  'Woji Road', 'Peter Odili Road', 'Elelenwo Street', 'Forces Avenue', 'Tombia Street',
  'Evo Road', 'Okporo Road',
];

export const REVIEW_COMMENTS = [
  'The nurse was professional, kind and arrived exactly on time. The whole experience was far easier than going to a hospital.',
  'Booking took two minutes and the doctor called through everything clearly. I finally understood my own results.',
  'They came to the house for my mother and treated her with real dignity. We have booked them again.',
  'Sample collection at home saved me a whole morning of queuing. Results were in my dashboard the next day.',
  'My physiotherapist explained every exercise and adjusted the plan when my knee was still sore. Genuinely helpful.',
  'Medication arrived the same afternoon and the pharmacist rang to check I understood the dosage.',
  'Very organised. I got a reminder the day before and the nurse arrived within the booked window.',
  'The virtual consultation worked better than I expected. No travel, no waiting room, same quality of attention.',
  'Wound dressing was handled carefully and they photographed the progress each visit so we could see it healing.',
  'Prices were clear before I paid. No surprise charges at the end, which has not been my experience elsewhere.',
  'The antenatal visits at home made a stressful pregnancy much calmer. Grace was wonderful throughout.',
  'Booked a full check-up and got a proper written report, not just a stack of numbers. Worth the money.',
];

export const ARTICLES = [
  {
    title: 'Managing Hypertension at Home: A Practical Guide',
    slug: 'managing-hypertension-at-home',
    category: 'Chronic Conditions',
    excerpt:
      'High blood pressure rarely announces itself. Here is how to monitor it properly at home, ' +
      'what the numbers actually mean, and when to call a doctor.',
    readMinutes: 6,
    tags: ['hypertension', 'chronic care', 'monitoring'],
    content: `Hypertension affects roughly one in three Nigerian adults, and most people who have it do not know. It causes no reliable symptoms until it has already done damage, which is why measuring it matters more than waiting to feel unwell.

## Measuring properly at home

A home reading is only useful if it is taken correctly. Sit quietly for five minutes first. Keep your back supported and both feet flat on the floor. Rest your arm on a table so the cuff sits level with your heart. Take two readings a minute apart and record both.

Measure at the same two times each day — typically morning before medication and evening before your meal. A single high reading means very little; a pattern across a week means a great deal.

## What the numbers mean

- **Below 120/80** — normal.
- **120–129 / below 80** — elevated. Worth watching, not yet treating.
- **130–139 / 80–89** — stage 1 hypertension. Lifestyle change, and a conversation with your doctor.
- **140/90 or above** — stage 2. This needs medical treatment.
- **180/120 or above** — seek care immediately.

## Changes that genuinely move the number

Reducing salt has the largest single effect for most people, and in Nigerian cooking that usually means seasoning cubes and processed meats rather than the salt shaker. Thirty minutes of brisk walking on most days lowers systolic pressure meaningfully. Losing even five kilograms shows up on the monitor.

Medication is not a failure of willpower. For many people the genetics are simply stacked against them, and treating hypertension early prevents the stroke, kidney disease and heart failure that follow it untreated.

## When to call us

Book a consultation if your readings sit consistently above 140/90, if they swing wildly between readings, or if you experience headaches, visual changes or chest discomfort. Our doctors can review your home readings with you and adjust treatment without you needing to travel.`,
  },
  {
    title: 'Caring for an Older Parent at Home: Where to Start',
    slug: 'caring-for-an-older-parent-at-home',
    category: 'Elderly Care',
    excerpt:
      'Taking on a parent’s care is rarely a decision you plan for. A practical framework for ' +
      'the first few weeks, from safety to medication to your own limits.',
    readMinutes: 7,
    tags: ['elderly care', 'family', 'home care'],
    content: `Most families arrive at home care suddenly — after a fall, a discharge, or a slow accumulation of small worries that finally becomes undeniable. Here is a way to structure the first few weeks.

## Start with the house, not the person

Falls are the single largest cause of serious injury in older adults, and most happen in the bathroom or on stairs. Before anything else: remove loose rugs, add grab rails beside the toilet and in the shower, light the route from bed to bathroom, and make sure frequently used items sit between waist and shoulder height so nothing requires reaching or stooping.

## Get the medication straight

Collect every medication in the house — including anything bought over the counter — and lay it out. Older adults commonly accumulate duplicate prescriptions from different doctors, and interactions between them cause confusion, dizziness and falls that get mistaken for ageing.

A weekly pill organiser filled every Sunday removes most dosing errors. A pharmacist review removes the rest.

## Watch for what people hide

Older adults frequently conceal difficulty, either from pride or from fear of losing independence. Watch for weight loss, unexplained bruises, unopened post, food past its date, and a shrinking social world. These signal more than any answer to "are you managing?" will.

## Accept your own limits

Family carers burn out quietly and then suddenly. Bringing in professional visits — even twice a week — is not an abdication. It preserves your relationship as son or daughter rather than making you solely a nurse, and that relationship is usually what the person actually needs from you.

Our elderly care service starts with an assessment visit at home, and the care coordinator builds a schedule around what your family can realistically sustain.`,
  },
  {
    title: 'Preparing for Blood Tests: What Fasting Actually Means',
    slug: 'preparing-for-blood-tests',
    category: 'Diagnostics',
    excerpt:
      'Fasting instructions are often given vaguely and followed loosely, which is how results ' +
      'get repeated. Here is exactly what to do.',
    readMinutes: 4,
    tags: ['lab tests', 'preparation', 'diagnostics'],
    content: `A surprising share of repeated blood tests are repeated because the preparation was wrong, not because anything was wrong with the patient.

## What fasting means

Fasting means no food and no drinks other than plain water, for the stated period — usually 8 to 12 hours. That includes tea, coffee (with or without sugar), juice, sweets and chewing gum. Water is not only allowed but helpful: mild dehydration makes veins harder to find and can concentrate some results.

## Which tests need it

- **Fasting blood glucose** — 8 hours.
- **Lipid profile (cholesterol)** — 9 to 12 hours.
- **Liver function tests** — often 8 hours, depending on the panel.
- **Full blood count, thyroid function, most others** — no fasting needed.

If you are unsure, ask when booking rather than fasting unnecessarily. Fasting when you did not need to is uncomfortable; not fasting when you did means coming back.

## Medication

Keep taking prescribed medication unless your doctor has specifically told you otherwise — particularly blood pressure and heart medication. If you take diabetes medication, ask before fasting, because the combination can drop your blood sugar dangerously.

## On the day

Book a morning slot so you sleep through most of the fast. Drink water. Wear something with sleeves you can push above the elbow. Eat immediately afterwards — bring something with you if the appointment is at our clinic.

Our phlebotomist confirms your preparation before taking any sample, and will reschedule rather than take a sample that will produce a result nobody can trust.`,
  },
  {
    title: 'When a Virtual Consultation Is Enough — and When It Isn’t',
    slug: 'when-a-virtual-consultation-is-enough',
    category: 'General Health',
    excerpt:
      'Telemedicine is genuinely useful for some problems and genuinely inadequate for others. ' +
      'A straightforward guide to telling them apart.',
    readMinutes: 5,
    tags: ['telemedicine', 'consultation'],
    content: `Virtual consultations save time and travel, and for a good range of problems they are clinically equivalent to sitting in a room. For others they are not, and it helps to know which is which before you book.

## Well suited to a virtual visit

Medication reviews and repeat prescriptions. Results discussions. Follow-up after a diagnosis already made in person. Mental health consultations, which many people find easier from home. Skin complaints where a clear photograph tells the story. General advice on symptoms you are trying to make sense of.

## Needs an in-person examination

Chest pain of any kind. Abdominal pain that is severe or localised. Anything requiring listening to the chest, palpating the abdomen, or examining ears, throat or eyes properly. Injuries where the joint needs handling. Any new lump. Pregnancy checks beyond the routine conversation.

## The honest middle ground

Plenty of problems start virtually and become physical. A good doctor will tell you within a few minutes that you need to be seen, and that is not a wasted appointment — it is triage that saved you a trip you would have made anyway.

## Making the most of it

Find a quiet, well-lit place. Sit facing a window if you can, so your face is visible. Have your medication list and any recent results with you. Write down your three most important questions in advance; consultations run short and it is easy to leave having forgotten the thing you most wanted to ask.

If your consultation reveals you need to be examined, we will book the in-person slot for you and the virtual fee is credited against it.`,
  },
  {
    title: 'Wound Care at Home: Signs of Infection You Should Not Ignore',
    slug: 'wound-care-signs-of-infection',
    category: 'Home Care',
    excerpt:
      'Most wounds heal without drama. Recognising the ones that are not is a skill worth ' +
      'having, particularly in a humid climate.',
    readMinutes: 5,
    tags: ['wound care', 'infection', 'home care'],
    content: `Wounds in a hot, humid climate carry a higher infection risk than the guidance written for temperate countries assumes. Knowing the warning signs matters.

## Normal healing

Expect mild redness at the edges for the first few days, slight swelling, clear or lightly straw-coloured fluid, and discomfort that steadily decreases. A healing wound looks a little better each day, even if slowly.

## Signs of infection

- **Spreading redness**, particularly streaks moving away from the wound.
- **Increasing pain** after day three, rather than decreasing.
- **Thick, cloudy or foul-smelling discharge.**
- **Warmth** noticeably greater than the surrounding skin.
- **Fever** above 38°C.
- **Swelling that worsens** rather than settles.

Any two of these together warrant a call the same day. Spreading red streaks or a fever warrant urgent attention regardless.

## Higher-risk wounds

Diabetes changes everything about wound care: reduced sensation means injuries go unnoticed, and reduced circulation means they heal slowly. Anyone with diabetes should have foot wounds assessed professionally rather than managed at home.

Surgical wounds, bites, deep punctures and burns also fall outside home management.

## Between visits

Keep the dressing dry and intact. Do not apply powders, herbs or antiseptics unless prescribed — several traditional preparations delay healing and some cause chemical burns. Wash hands before touching anything near the wound. Photograph it daily in the same light, which makes gradual change far easier to see.

Our wound care nurses document healing with photographs at each visit precisely because deterioration is easier to miss day by day than week by week.`,
  },
];
