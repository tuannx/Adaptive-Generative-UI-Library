/**
 * In-memory mock of the sample "Tarot Chat API" (public/examples/tarot-chat.json) so the deployed demo
 * works end to end, including a streamed chat. State lives per Worker isolate and resets on redeploy.
 */

export const TAROT_PREFIX = '/mock/tarot';

interface Card {
  id: string;
  name: string;
  arcana: 'major' | 'minor';
  suit: string;
  upright: string;
  reversed: string;
}

const CARDS: Card[] = [
  { id: 'the-fool', name: 'The Fool', arcana: 'major', suit: 'none', upright: 'new beginnings, spontaneity', reversed: 'recklessness, hesitation' },
  { id: 'the-magician', name: 'The Magician', arcana: 'major', suit: 'none', upright: 'skill, willpower', reversed: 'manipulation, untapped talent' },
  { id: 'the-high-priestess', name: 'The High Priestess', arcana: 'major', suit: 'none', upright: 'intuition, inner voice', reversed: 'secrets, disconnection' },
  { id: 'the-lovers', name: 'The Lovers', arcana: 'major', suit: 'none', upright: 'union, choices', reversed: 'imbalance, misalignment' },
  { id: 'the-star', name: 'The Star', arcana: 'major', suit: 'none', upright: 'hope, renewal', reversed: 'doubt, discouragement' },
  { id: 'the-moon', name: 'The Moon', arcana: 'major', suit: 'none', upright: 'illusion, dreams', reversed: 'clarity returning' },
  { id: 'ace-of-cups', name: 'Ace of Cups', arcana: 'minor', suit: 'cups', upright: 'new feelings, compassion', reversed: 'blocked emotions' },
  { id: 'three-of-swords', name: 'Three of Swords', arcana: 'minor', suit: 'swords', upright: 'heartbreak, truth', reversed: 'recovery, forgiveness' },
  { id: 'page-of-wands', name: 'Page of Wands', arcana: 'minor', suit: 'wands', upright: 'curiosity, a new message', reversed: 'scattered energy' },
  { id: 'ten-of-pentacles', name: 'Ten of Pentacles', arcana: 'minor', suit: 'pentacles', upright: 'legacy, stability', reversed: 'financial loss' },
];

const SPREADS: Record<string, string[]> = {
  'one-card': ['Answer'],
  'three-card': ['Past', 'Present', 'Future'],
  'celtic-cross': ['Present', 'Challenge', 'Past', 'Future', 'Above', 'Below', 'Advice', 'Influences', 'Hopes', 'Outcome'],
};

interface Reading {
  id: string;
  question: string;
  spread: string;
  cards: Array<{ position: string; card: string; reversed: boolean }>;
  summary: string;
  created_at: string;
}

interface Persona {
  id: string;
  name: string;
  tone: string;
  system_prompt?: string;
  active?: boolean;
}

const readings = new Map<string, Reading>();
const personas = new Map<string, Persona>([
  ['luna', { id: 'luna', name: 'Luna', tone: 'mystic', system_prompt: 'Speak softly, in images.', active: true }],
  ['max', { id: 'max', name: 'Max', tone: 'pragmatic', system_prompt: 'Be direct and practical.', active: false }],
]);
let counter = 1;

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
  });
}

function pick<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const chosen: T[] = [];
  while (chosen.length < count && pool.length > 0) chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return chosen;
}

function draw(question: string, spread: string, allowReversed: boolean): Reading {
  const positions = SPREADS[spread] ?? SPREADS['three-card'];
  const cards = pick(CARDS, positions.length).map((card, index) => ({
    position: positions[index],
    card: card.name,
    reversed: allowReversed && Math.random() < 0.3,
  }));
  const lead = CARDS.find((card) => card.name === cards[0].card)!;
  const reading: Reading = {
    id: `r${counter++}`,
    question,
    spread,
    cards,
    summary: `${lead.name} leads this ${spread} reading: ${cards[0].reversed ? lead.reversed : lead.upright}.`,
    created_at: new Date().toISOString(),
  };
  readings.set(reading.id, reading);
  return reading;
}

function chatStream(message: string, persona: string, sessionId: string): Response {
  const card = pick(CARDS, 1)[0];
  const voice: Record<string, string> = {
    mystic: 'The veil parts a little.',
    pragmatic: 'Here is the practical read.',
    playful: 'Ooh, the deck has opinions!',
  };
  const reply = `${voice[persona] ?? voice.mystic} You asked: "${message.slice(0, 120)}". I drew ${card.name}, which speaks of ${card.upright}. Sit with that, and ask me anything else.`;
  const words = reply.split(/(?<= )/);
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ session_id: sessionId })}\n\n`));
      for (const word of words) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: word })}\n\n`));
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
}

export async function handleTarotMock(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // the mock may live under a base path (GitHub Pages serves the demo from /<repo>/demo/)
  const at = url.pathname.indexOf(TAROT_PREFIX);
  const path = url.pathname.slice(at + TAROT_PREFIX.length).replace(/\/+$/, '') || '/';
  const method = request.method;
  const body = async () => (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (path === '/health' && method === 'GET') return json(200, { status: 'ok' });
  if (path === '/admin/cache/flush' && method === 'POST') return json(200, { flushed: Math.floor(Math.random() * 40) });

  if (path === '/chat' && method === 'POST') {
    const input = await body();
    const message = String(input.message ?? '').trim();
    if (!message) return json(422, { error: 'message is required' });
    return chatStream(message, String(input.persona ?? 'mystic'), String(input.session_id ?? `s${counter++}`));
  }

  if (path === '/cards' && method === 'GET') {
    const arcana = url.searchParams.get('arcana');
    return json(200, arcana ? CARDS.filter((card) => card.arcana === arcana) : CARDS);
  }
  const cardMatch = path.match(/^\/cards\/([^/]+)$/);
  if (cardMatch && method === 'GET') {
    const card = CARDS.find((item) => item.id === decodeURIComponent(cardMatch[1]));
    return card ? json(200, card) : json(404, { error: 'Card not found' });
  }

  if (path === '/readings/draw' && method === 'POST') {
    const input = await body();
    if (!input.question) return json(422, { error: 'question is required' });
    return json(200, draw(String(input.question), String(input.spread ?? 'three-card'), input.allow_reversed !== false));
  }
  if (path === '/readings' && method === 'GET') {
    const spread = url.searchParams.get('spread');
    const list = [...readings.values()].filter((reading) => !spread || reading.spread === spread).reverse();
    return json(200, { readings: list, total: list.length });
  }
  const readingMatch = path.match(/^\/readings\/([^/]+)$/);
  if (readingMatch) {
    const id = decodeURIComponent(readingMatch[1]);
    if (method === 'GET') return readings.has(id) ? json(200, readings.get(id)) : json(404, { error: 'Reading not found' });
    if (method === 'DELETE') return readings.delete(id) ? json(204) : json(404, { error: 'Reading not found' });
  }

  if (path === '/personas' && method === 'GET') return json(200, [...personas.values()]);
  if (path === '/personas' && method === 'POST') {
    const input = await body();
    if (!input.name || !input.tone) return json(422, { error: 'name and tone are required' });
    const persona: Persona = { ...(input as unknown as Persona), id: `p${counter++}` };
    personas.set(persona.id, persona);
    return json(201, persona);
  }
  const personaMatch = path.match(/^\/personas\/([^/]+)$/);
  if (personaMatch) {
    const id = decodeURIComponent(personaMatch[1]);
    const existing = personas.get(id);
    if (!existing) return json(404, { error: 'Persona not found' });
    if (method === 'GET') return json(200, existing);
    if (method === 'PATCH') {
      const updated = { ...existing, ...(await body()), id };
      personas.set(id, updated);
      return json(200, updated);
    }
    if (method === 'DELETE') {
      personas.delete(id);
      return json(204);
    }
  }

  return json(404, { error: `No mock route for ${method} ${path}` });
}
