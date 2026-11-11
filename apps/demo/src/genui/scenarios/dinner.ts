import type { GenUiScenario } from './types.js';
import { actionSpec } from './app-step.js';

type Choice = { value: string; label: string; description: string; icon: string };

const cards = (title: string, options: Choice[], value: string) => ({
  type: 'string',
  title,
  enum: options.map((option) => option.value),
  default: value,
  'x-agul-widget': 'choice-cards',
  'x-agul-choices': options,
});

const TIMES: Choice[] = [
  { value: '19:00', label: '7:00 PM', description: 'You and Priya are both free', icon: '✅' },
  { value: '19:30', label: '7:30 PM', description: 'Free, but your gym class ends at 7:15', icon: '🟡' },
  { value: '20:00', label: '8:00 PM', description: 'Priya has a call until 7:45', icon: '🟡' },
];
const TABLES: Choice[] = [
  { value: 'lumen', label: 'Lumen Bistro', description: 'Table for 2 at 7:00 PM · 0.8 mi', icon: '🍝' },
  { value: 'saffron', label: 'Saffron House', description: 'Table for 2 at 7:15 PM · 1.4 mi', icon: '🍛' },
  { value: 'sole', label: 'Trattoria Sole', description: 'Your original place · Friday 8:00 PM only', icon: '🍕' },
];
const RIDES: Choice[] = [
  { value: 'standard', label: 'Standard · $14', description: 'Pickup 6:40 PM, 12 min', icon: '🚗' },
  { value: 'comfort', label: 'Comfort · $19', description: 'Pickup 6:42 PM, 12 min', icon: '🚙' },
  { value: 'none', label: 'No ride', description: 'I will get there myself', icon: '🚶' },
];

const labelOf = (options: Choice[], value: unknown) => options.find((option) => option.value === value)?.label ?? (typeof value === 'string' ? value : '');

const body = {
  type: 'object',
  required: ['time', 'table', 'ride'],
  properties: {
    time: cards('Friday: when you are both free', TIMES, '19:00'),
    table: cards('Open tables near you', TABLES, 'lumen'),
    ride: cards('Ride there', RIDES, 'standard'),
    message: {
      type: 'string',
      title: 'Message to Priya',
      default: 'Moved our dinner to Friday 7:00 PM at Lumen Bistro. See you there!',
      'x-agul-widget': 'textarea',
    },
  },
};


export const dinner: GenUiScenario = {
  id: 'dinner',
  prompt: 'Move dinner with Priya to Friday.',
  textAnswer: `Sure! On Friday, you and Priya are both free at 7:00 PM. 7:30 PM also works, but your gym class ends at 7:15, and Priya has a call until 7:45, so 8:00 PM is possible too.

Trattoria Sole only has a table at 8:00 PM on Friday. Other options: Lumen Bistro has a table for 2 at 7:00 PM (0.8 mi) and Saffron House at 7:15 PM (1.4 mi).

For the ride: Standard is $14 with pickup at 6:40 PM, Comfort is $19 with pickup at 6:42 PM.

Which time, which restaurant and which ride do you want? And should I text Priya when it's booked?`,
  spec: actionSpec({
    title: 'Move dinner',
    path: '/plans/dinner',
    operationId: 'moveDinner',
    summary: 'Dinner with Priya, Friday',
    description: 'Calendar, tables and rides in one view. Pick, then confirm. Nothing is booked until you do.',
    submit: 'Book and tell Priya',
    body,
  }),
  respond: (input) => [
    { step: 'calendar', result: `Dinner moved to Friday ${labelOf(TIMES, input.time)}`, status: 'done' },
    { step: 'table', result: `Table booked at ${labelOf(TABLES, input.table)}`, status: 'done' },
    { step: 'ride', result: input.ride === 'none' ? 'No ride booked' : `Ride booked: ${labelOf(RIDES, input.ride)}`, status: 'done' },
    { step: 'message', result: 'Texted Priya', status: 'done' },
  ],
};
