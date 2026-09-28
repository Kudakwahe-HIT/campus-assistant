import { fill } from './copy';
import type { Reply } from './types';

export const CATEGORY_LABELS: Record<string, { title: string; description: string }> = {
  admissions: { title: 'Admissions', description: 'How to apply, requirements, intake' },
  fees: { title: 'Fees & payments', description: 'How to pay and where to ask' },
  registration: { title: 'Registration', description: 'Registering for your programme' },
  accommodation: { title: 'Accommodation', description: 'Residence and catering' },
  orientation: { title: 'Orientation', description: 'Settling in as a new student' },
  contacts: { title: 'Contact HIT', description: 'Phone, email, portals' },
};

// WhatsApp formatting: *bold* (single asterisk) and _italic_ (underscore), not markdown's ** and *.
const WELCOME =
  '👋🏽 *Hey there! Welcome to HIT! 🎓*\n\n' +
  "I'm *{bot_name}*, your friendly digital campus assistant. 🤖💚\n\n" +
  "Think of me as the person you can ask when you're thinking:\n\n" +
  '_"Umm… where do I even find that information?"_ 😅\n\n' +
  'I can help you with *admissions, programmes, fees, registration, accommodation, events, timetables, and more.*\n\n' +
  'So, what brings you here today? 👇🏽\n\n' +
  "Don't worry, I won't judge your choice. 😂";

export function roleChoice(): Reply {
  return {
    kind: 'buttons',
    body: fill(WELCOME),
    buttons: [
      { id: 'role:prospect', title: "I'm an Applicant" },
      { id: 'role:student', title: "I'm a Student" },
      { id: 'role:staff', title: "I'm HIT Staff" },
    ],
  };
}

export function mainMenu(): Reply {
  return {
    kind: 'list',
    body: fill('What do you need help with? Pick from the list, or just type your question.'),
    button: 'Open menu',
    sections: [
      {
        title: 'Help topics',
        rows: [
          { id: 'cat:admissions', ...CATEGORY_LABELS.admissions },
          { id: 'cat:fees', ...CATEGORY_LABELS.fees },
          { id: 'cat:registration', ...CATEGORY_LABELS.registration },
          { id: 'cat:accommodation', ...CATEGORY_LABELS.accommodation },
          { id: 'cat:orientation', ...CATEGORY_LABELS.orientation },
          { id: 'cat:programmes', title: 'Schools & programmes', description: 'What HIT offers' },
          { id: 'cat:contacts', ...CATEGORY_LABELS.contacts },
          { id: 'human', title: 'Talk to a person', description: 'Connect with HIT staff' },
        ],
      },
    ],
  };
}

/** Footer shown after every answer so the user is never stuck. */
export function afterAnswer(): Reply {
  return {
    kind: 'buttons',
    body: fill('Anything else?'),
    buttons: [
      { id: 'menu:main', title: 'Main menu' },
      { id: 'human', title: 'Talk to a person' },
    ],
  };
}
