/**
 * Additional catalogue: categories and services beyond the original twelve.
 *
 * Kept separate from seed-data.ts because this set is meant for real
 * deployments — `seed-catalogue.ts` adds it without any of the demo patients,
 * bookings or payments that the development seed creates.
 *
 * Prices are in naira and reflect Port Harcourt private-practice rates. They
 * are a starting point an administrator is expected to adjust in Settings, not
 * a quote.
 */

import type { SeedService } from './seed-data';

export const EXTRA_CATEGORIES = [
  {
    name: 'Maternal & Child Health',
    slug: 'maternal-child',
    description: 'Care for mothers, newborns and children, at home or in clinic.',
    icon: 'baby',
    accent: 'crimson',
    sortOrder: 7,
  },
  {
    name: 'Chronic Care',
    slug: 'chronic-care',
    description: 'Ongoing support for diabetes, hypertension, sickle cell and asthma.',
    icon: 'activity',
    accent: 'blue',
    sortOrder: 8,
  },
  {
    name: 'Wellness & Nutrition',
    slug: 'wellness',
    description: 'Diet, lifestyle and recovery plans built around how you actually live.',
    icon: 'leaf',
    accent: 'blue',
    sortOrder: 9,
  },
  {
    name: 'Workplace Health',
    slug: 'workplace-health',
    description: 'Screening, first-aid cover and health talks for teams and sites.',
    icon: 'briefcase',
    accent: 'crimson',
    sortOrder: 10,
  },
];

export const EXTRA_SERVICES: SeedService[] = [
  {
    name: 'Newborn & Postnatal Home Care',
    slug: 'newborn-postnatal-care',
    categorySlug: 'maternal-child',
    shortDescription: 'Nursing visits for mother and baby in the first six weeks.',
    description:
      'A midwife or paediatric nurse visits you at home during the weeks that matter most. ' +
      'We check the baby’s weight, feeding, cord and jaundice, and we check you too — blood ' +
      'pressure, bleeding, wound or caesarean site, mood and sleep. Everything is written up ' +
      'and shared with your doctor, and anything that needs escalating is escalated the same day.',
    icon: 'baby',
    priceNaira: 30_000,
    homeVisitSurchargeNaira: 0,
    durationMinutes: 60,
    bufferMinutes: 30,
    serviceType: 'home',
    whatsIncluded: [
      'Newborn weight, feeding, cord and jaundice assessment',
      'Mother’s blood pressure, bleeding and wound or caesarean site check',
      'Postnatal mood and sleep review',
      'Feeding and settling guidance for whoever is at home',
      'Written visit summary shared with you and your doctor',
    ],
    requirements: [
      'Discharge summary from the delivery hospital, if you have one',
      'Baby’s immunisation card where one has been issued',
      'An adult aged 18+ present at the address',
    ],
    preparation: [
      'Have the baby’s card and any hospital notes to hand',
      'Clear a flat, well-lit surface for weighing and examination',
    ],
    faqs: [
      {
        question: 'How soon after delivery can you visit?',
        answer:
          'From day one. Most families book the first visit within 48 hours of discharge, then ' +
          'weekly through the first six weeks.',
      },
      {
        question: 'Can you weigh the baby and track growth?',
        answer:
          'Yes. We bring calibrated scales and record each weight so you can see the trend ' +
          'rather than a single number.',
      },
    ],
    isFeatured: true,
  },
  {
    name: 'Lactation & Breastfeeding Support',
    slug: 'lactation-support',
    categorySlug: 'maternal-child',
    shortDescription: 'Practical help with latch, supply and feeding pain.',
    description:
      'A one-to-one session with a lactation-trained nurse, at home or by video. We watch a ' +
      'real feed, correct the latch, and work through supply, engorgement, mastitis pain or ' +
      'returning to work. You leave with a plan for your situation rather than general advice.',
    icon: 'heart',
    priceNaira: 15_000,
    homeVisitSurchargeNaira: 5_000,
    durationMinutes: 45,
    bufferMinutes: 15,
    serviceType: 'hybrid',
    whatsIncluded: [
      'Observation of a full feed and latch correction',
      'Supply assessment and a plan to build or regulate it',
      'Pain, engorgement and mastitis management',
      'Expressing, storage and return-to-work planning',
    ],
    requirements: ['Baby present and due a feed during the session'],
    preparation: [
      'Try to time the session for when your baby would normally feed',
      'Have your pump and bottles to hand if you use them',
    ],
    faqs: [
      {
        question: 'Does video really work for this?',
        answer:
          'For latch and positioning, yes — we need to see the feed, not touch it. We will say ' +
          'plainly if your situation needs someone in the room.',
      },
    ],
    isFeatured: false,
  },
  {
    name: 'Child Immunisation at Home',
    slug: 'child-immunisation',
    categorySlug: 'maternal-child',
    shortDescription: 'Routine childhood vaccines given at your address.',
    description:
      'Routine childhood immunisations administered at home by a paediatric nurse, following ' +
      'the Nigerian national schedule. The cold chain is maintained in a monitored carrier, ' +
      'the batch number of every dose is recorded on your child’s card, and we stay for the ' +
      'observation period afterwards.',
    icon: 'syringe',
    priceNaira: 18_000,
    homeVisitSurchargeNaira: 0,
    durationMinutes: 30,
    bufferMinutes: 15,
    serviceType: 'home',
    whatsIncluded: [
      'Pre-vaccination health check',
      'Vaccines given per the national schedule',
      'Batch numbers recorded on the immunisation card',
      'Post-dose observation before we leave',
      'Fever and soreness guidance for the next 48 hours',
    ],
    requirements: [
      'Child’s immunisation card',
      'A parent or legal guardian present to consent',
    ],
    preparation: [
      'Have the immunisation card ready',
      'Dress your child so arms and thighs are easy to reach',
    ],
    faqs: [
      {
        question: 'Which vaccines do you carry?',
        answer:
          'Those on the national routine schedule. Tell us your child’s age and last dose when ' +
          'booking and we will confirm exactly what is due before the visit.',
      },
      {
        question: 'How do you keep vaccines cold?',
        answer:
          'In a temperature-monitored carrier. If a carrier ever reads outside range the dose ' +
          'is discarded, not given.',
      },
    ],
    isFeatured: false,
  },
  {
    name: 'Diabetes Management Programme',
    slug: 'diabetes-management',
    categorySlug: 'chronic-care',
    shortDescription: 'A month of monitoring, review and coaching for type 1 or 2 diabetes.',
    description:
      'A structured month rather than a single appointment: a baseline review, fortnightly ' +
      'nurse checks, and a diet plan built around Nigerian food you already eat. We track ' +
      'blood glucose, blood pressure, weight and feet, flag anything that needs a doctor, and ' +
      'send a written summary to whoever manages your care.',
    icon: 'activity',
    priceNaira: 35_000,
    homeVisitSurchargeNaira: 5_000,
    durationMinutes: 60,
    bufferMinutes: 15,
    serviceType: 'hybrid',
    whatsIncluded: [
      'Baseline review of glucose, blood pressure, weight and feet',
      'Two follow-up checks within the month',
      'Diet plan using foods available in Port Harcourt markets',
      'Medication adherence and injection technique review',
      'Written summary for your doctor',
    ],
    requirements: [
      'Recent blood glucose or HbA1c results if you have them',
      'Your current medication available for review',
    ],
    preparation: [
      'Bring or have ready any glucose readings you have been recording',
      'Note down a typical day’s meals before the first session',
    ],
    faqs: [
      {
        question: 'Do you prescribe insulin?',
        answer:
          'Prescribing is done by a doctor. Our nurses monitor, coach and escalate, and we can ' +
          'book you a doctor consultation in the same programme.',
      },
      {
        question: 'Is a glucometer included?',
        answer:
          'No, but we will advise which to buy and teach you to use it properly, which matters ' +
          'more than the brand.',
      },
    ],
    isFeatured: true,
  },
  {
    name: 'Hypertension Monitoring',
    slug: 'hypertension-monitoring',
    categorySlug: 'chronic-care',
    shortDescription: 'Regular blood pressure checks at home, with a trend your doctor can use.',
    description:
      'Blood pressure measured properly, at home, where it is most representative — correct ' +
      'cuff, seated and rested, both arms at baseline. We record every reading so your doctor ' +
      'sees a trend instead of one clinic measurement, review your medication and salt intake, ' +
      'and escalate immediately if a reading is dangerous.',
    icon: 'heart-pulse',
    priceNaira: 22_000,
    homeVisitSurchargeNaira: 0,
    durationMinutes: 30,
    bufferMinutes: 15,
    serviceType: 'home',
    whatsIncluded: [
      'Blood pressure measured with the correct cuff, both arms at baseline',
      'Pulse, weight and swelling check',
      'Medication adherence and side-effect review',
      'Salt and lifestyle guidance',
      'A recorded trend shared with your doctor',
    ],
    requirements: ['Your current medication available for review'],
    preparation: [
      'Avoid coffee and strenuous activity in the 30 minutes before the visit',
      'Wear a top with a sleeve that rolls up easily',
    ],
    faqs: [
      {
        question: 'What happens if my reading is very high?',
        answer:
          'We repeat it after rest, and if it stays in the danger range we contact a doctor ' +
          'while we are still with you and advise you on getting seen urgently.',
      },
    ],
    isFeatured: false,
  },
  {
    name: 'IV Infusion at Home',
    slug: 'iv-infusion-home',
    categorySlug: 'home-care',
    shortDescription: 'Prescribed drips and IV medication administered at your address.',
    description:
      'A registered nurse administers a prescribed infusion at home and stays for the whole ' +
      'thing. We confirm the prescription, site the cannula, monitor you throughout for any ' +
      'reaction, and dispose of everything safely before leaving. We do not supply or ' +
      'administer anything without a valid prescription.',
    icon: 'droplet',
    priceNaira: 18_000,
    homeVisitSurchargeNaira: 0,
    durationMinutes: 90,
    bufferMinutes: 30,
    serviceType: 'home',
    whatsIncluded: [
      'Prescription verification before anything is given',
      'Cannula sited and secured',
      'Continuous monitoring for the duration of the infusion',
      'Safe disposal of sharps and consumables',
      'Written record of what was given and when',
    ],
    requirements: [
      'A valid prescription from a licensed doctor',
      'The prescribed infusion, unless we have agreed to source it',
      'Someone aged 18+ present at the address',
    ],
    preparation: [
      'Eat and drink normally beforehand unless told otherwise',
      'Have the prescription and the medication ready',
    ],
    faqs: [
      {
        question: 'Can I book a drip without a prescription?',
        answer:
          'No. Infusions carry real risk and we will not give one without a prescription from a ' +
          'licensed doctor. We can book you a consultation to get one.',
      },
    ],
    isFeatured: false,
  },
  {
    name: 'ECG at Home',
    slug: 'ecg-at-home',
    categorySlug: 'diagnostics',
    shortDescription: 'A 12-lead ECG recorded at home and read by a doctor.',
    description:
      'A technician records a 12-lead ECG at your address and a doctor reports on it. You get ' +
      'the trace and a written interpretation, usually the same day, which is often what a ' +
      'cardiology or pre-operative referral is waiting on.',
    icon: 'activity',
    priceNaira: 25_000,
    homeVisitSurchargeNaira: 0,
    durationMinutes: 30,
    bufferMinutes: 15,
    serviceType: 'home',
    whatsIncluded: [
      '12-lead ECG recorded at home',
      'Doctor’s written interpretation',
      'The trace itself, as a file you keep',
      'Escalation the same day if the trace is concerning',
    ],
    requirements: ['A referral where your doctor has asked for one'],
    preparation: [
      'Avoid heavy moisturiser or oil on the chest that day',
      'Wear something easy to open at the front',
    ],
    faqs: [
      {
        question: 'How quickly do I get the report?',
        answer:
          'Usually the same day. If the trace shows anything urgent we call you before the ' +
          'report is written.',
      },
    ],
    isFeatured: false,
  },
  {
    name: 'Malaria Test & Treat',
    slug: 'malaria-test-treat',
    categorySlug: 'diagnostics',
    shortDescription: 'Rapid malaria test, with treatment started the same visit if positive.',
    description:
      'A rapid diagnostic test with a result in about twenty minutes, in clinic or at home. If ' +
      'it is positive and uncomplicated, a doctor prescribes and we start treatment in the same ' +
      'visit. If the test is negative we look for another cause rather than treating anyway.',
    icon: 'thermometer',
    priceNaira: 9_500,
    homeVisitSurchargeNaira: 3_000,
    durationMinutes: 30,
    bufferMinutes: 15,
    serviceType: 'hybrid',
    whatsIncluded: [
      'Rapid diagnostic test with a result in about 20 minutes',
      'Temperature, pulse and hydration assessment',
      'Doctor review of the result',
      'Treatment started the same visit where appropriate',
      'Clear advice on what warrants going to hospital',
    ],
    requirements: [],
    preparation: ['Nothing — you do not need to fast for this test'],
    faqs: [
      {
        question: 'Is the medication included in the price?',
        answer:
          'The test, the assessment and the doctor review are. Any prescribed medication is ' +
          'charged separately, and we tell you the cost before dispensing.',
      },
      {
        question: 'What if the test is negative but I still feel unwell?',
        answer:
          'Then it is not malaria and treating for it would waste time. The doctor will work ' +
          'through other causes and order further tests if needed.',
      },
    ],
    isFeatured: true,
  },
  {
    name: 'Nutrition & Dietetics Consultation',
    slug: 'nutrition-consultation',
    categorySlug: 'wellness',
    shortDescription: 'A diet plan built around Nigerian food and your actual budget.',
    description:
      'A video or clinic consultation with a dietitian who will not hand you a plan built on ' +
      'food you cannot buy. We work from what you eat now — swallow, rice, beans, soups, ' +
      'street food — and adjust portions, timing and combinations for your goal, whether that ' +
      'is weight, diabetes, blood pressure, pregnancy or recovery.',
    icon: 'leaf',
    priceNaira: 12_000,
    homeVisitSurchargeNaira: 0,
    durationMinutes: 45,
    bufferMinutes: 15,
    serviceType: 'virtual',
    whatsIncluded: [
      'Review of what you currently eat, in detail',
      'A written plan using food available locally',
      'Portion and timing guidance you can follow without weighing everything',
      'A follow-up message channel for two weeks',
    ],
    requirements: [
      'Recent test results where your goal is clinical (HbA1c, lipids, etc.)',
    ],
    preparation: [
      'Write down everything you ate for three ordinary days beforehand — honestly',
    ],
    faqs: [
      {
        question: 'Will you tell me to stop eating swallow?',
        answer:
          'No. A plan you abandon in a week is worthless. We adjust portions and what goes ' +
          'alongside it rather than removing the food you actually live on.',
      },
    ],
    isFeatured: false,
  },
  {
    name: 'Workplace Health Screening',
    slug: 'workplace-health-screening',
    categorySlug: 'workplace-health',
    shortDescription: 'On-site screening for your team, with an anonymised report for you.',
    description:
      'We bring the clinic to your office or site: blood pressure, blood sugar, BMI, vision ' +
      'and a brief nurse consultation per employee. Each person gets their own results ' +
      'privately. You get an anonymised summary of the risks across the group — never ' +
      'individual results, which belong to the employee.',
    icon: 'briefcase',
    priceNaira: 50_000,
    homeVisitSurchargeNaira: 0,
    durationMinutes: 240,
    bufferMinutes: 60,
    serviceType: 'clinic',
    whatsIncluded: [
      'On-site station set up by our team',
      'Blood pressure, blood sugar, BMI and vision per employee',
      'Brief one-to-one nurse consultation',
      'Private individual results for each person',
      'Anonymised group risk summary for the employer',
    ],
    requirements: [
      'A private room or screened area on site',
      'An agreed employee list and schedule',
    ],
    preparation: [
      'Tell staff whether to fast, which we will confirm when booking',
      'Book a room where conversations cannot be overheard',
    ],
    faqs: [
      {
        question: 'Do we see our employees’ individual results?',
        answer:
          'No. Those are confidential medical information belonging to the employee. You ' +
          'receive an anonymised summary of risks across the group.',
      },
      {
        question: 'How is this priced for a larger team?',
        answer:
          'The listed price covers a standard half-day session. Tell us your headcount when ' +
          'booking and we will confirm how many sessions it needs.',
      },
    ],
    isFeatured: false,
  },
];
