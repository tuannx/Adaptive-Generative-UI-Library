import type { GenUiScenario } from './types.js';
import { actionSpec, appStep, choice, choices, stepResults, text } from './app-step.js';

const MEETINGS = ['9:00 AM Standup', '11:00 AM Design review', '2:00 PM 1:1 with Sam'];

const body = {
  type: 'object',
  required: ['visit', 'meetings', 'team', 'outOfOffice', 'pickup', 'soup'],
  properties: {
    visit: appStep({
      app: 'Clinic',
      icon: '🩺',
      title: 'Book a video visit',
      fields: {
        slot: choice('Time', ['9:30 AM', '10:15 AM', '11:00 AM'], '9:30 AM'),
        reason: text('Reason', 'Fever and sore throat since last night'),
      },
    }),
    meetings: appStep({
      app: 'Calendar',
      icon: '📅',
      title: 'Move your meetings',
      fields: {
        which: choices('Meetings', MEETINGS, MEETINGS),
        to: choice('Move to', ['Tomorrow, same time', 'Next free slot', 'Cancel them'], 'Tomorrow, same time'),
      },
    }),
    team: appStep({
      app: 'Team chat',
      icon: '💬',
      title: 'Tell your team',
      fields: {
        channel: choice('Channel', ['#design-team', '#general'], '#design-team'),
        message: text('Message', "I'm sick today and offline to rest. Meetings moved to tomorrow. Back online tomorrow morning.", true),
      },
    }),
    outOfOffice: appStep({
      app: 'Mail',
      icon: '✉️',
      title: 'Turn on out-of-office',
      fields: {
        until: choice('Until', ['End of today', 'Tomorrow 9:00 AM'], 'Tomorrow 9:00 AM'),
        reply: text('Auto-reply', "I'm out sick today and will reply tomorrow.", true),
      },
    }),
    pickup: appStep({
      app: 'Messages',
      icon: '🧒',
      title: 'Ask Alex to do school pickup',
      fields: {
        message: text('Message to Alex', "I'm sick today. Can you do school pickup at 3:15?", true),
      },
    }),
    soup: appStep({
      app: 'Food delivery',
      icon: '🍲',
      title: 'Order soup',
      fields: {
        soup: choice('Soup', ['Chicken noodle', 'Tomato basil', 'Miso'], 'Chicken noodle'),
        when: choice('Deliver', ['As soon as possible', 'At 12:30 PM'], 'At 12:30 PM'),
      },
    }),
  },
};

const s = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');
const list = (value: unknown) => (Array.isArray(value) ? value.length : 0);

export const sickDay: GenUiScenario = {
  id: 'sick-day',
  prompt: "I'm sick today. Can you sort out my morning?",
  textAnswer: `Sorry you're feeling sick! Here's what I can do:

1. Book a video visit with Clinic. Open slots: 9:30 AM, 10:15 AM and 11:00 AM. Which one do you want?
2. Move your 3 meetings (9:00 AM Standup, 11:00 AM Design review, 2:00 PM 1:1 with Sam) to tomorrow, same time. Or should I find the next free slot, or cancel them?
3. Post in #design-team: "I'm sick today and offline to rest. Meetings moved to tomorrow." Do you want to change the wording or the channel?
4. Turn on an out-of-office reply in Mail until tomorrow 9:00 AM. Is that the right end time?
5. Text Alex: "I'm sick today. Can you do school pickup at 3:15?"
6. Order chicken noodle soup for 12:30 PM. Tomato basil and miso are also available.

Which of these should I do? Reply with the numbers, and tell me any changes.`,
  spec: actionSpec({
    title: 'Sick day',
    path: '/plans/sick-day',
    operationId: 'confirmSickDay',
    summary: 'Your sick day, in one view',
    description: 'Six things across six apps. Switch off what you don’t want, edit the rest. Nothing is sent until you confirm.',
    submit: 'Confirm and send',
    body,
  }),
  respond: (input) =>
    stepResults(input, {
      visit: (step) => `Video visit booked for ${s(step.slot)}`,
      meetings: (step) => `${list(step.which)} meeting${list(step.which) === 1 ? "" : "s"}: ${s(step.to).toLowerCase()}`,
      team: (step) => `Posted in ${s(step.channel)}`,
      outOfOffice: (step) => `Out-of-office on until ${s(step.until)}`,
      pickup: () => 'Asked Alex about the 3:15 pickup',
      soup: (step) => `${s(step.soup)} soup ordered, ${s(step.when).toLowerCase()}`,
    }, {
      visit: 'No video visit booked',
      meetings: 'Meetings left as they are',
      team: 'Nothing posted to your team',
      outOfOffice: 'Out-of-office left off',
      pickup: 'Alex not asked about pickup',
      soup: 'No soup ordered',
    }),
};
