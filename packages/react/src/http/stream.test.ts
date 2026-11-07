import { describe, it, expect } from 'vite-plus/test';
import { extractChunkText, readStream } from './stream.js';

function responseFrom(chunks: string[], type: string): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'content-type': type } });
}

async function collect(response: Response, format: Parameters<typeof readStream>[1]) {
  let text = '';
  const chunks: unknown[] = [];
  await readStream(response, format, { onText: (t) => (text += t), onChunk: (c) => chunks.push(c) });
  return { text, chunks };
}

describe('readStream', () => {
  it('joins SSE deltas split across network chunks and stops at [DONE]', async () => {
    const response = responseFrom(
      ['data: {"delta":"The Sta', 'r"}\n\n', 'data: {"delta":" shines"}\n\ndata: [DONE]\n\n', 'data: {"delta":"ignored"}\n\n'],
      'text/event-stream',
    );
    expect((await collect(response, 'sse')).text).toBe('The Star shines');
  });

  it('reads OpenAI- and Anthropic-style chunks and plain data lines', async () => {
    const response = responseFrom(
      [
        'event: message\ndata: {"choices":[{"delta":{"content":"A"}}]}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"B"}}\n\n',
        'data: C\n\n',
      ],
      'text/event-stream',
    );
    expect((await collect(response, 'sse')).text).toBe('ABC');
  });

  it('reads NDJSON and surfaces chunks (e.g. a session id)', async () => {
    const response = responseFrom(['{"session_id":"s1","token":"Hel"}\n{"tok', 'en":"lo"}\n'], 'application/x-ndjson');
    const { text, chunks } = await collect(response, 'ndjson');
    expect(text).toBe('Hello');
    expect(chunks[0]).toMatchObject({ session_id: 's1' });
  });

  it('passes plain text through', async () => {
    expect((await collect(responseFrom(['one ', 'two'], 'text/plain'), 'text')).text).toBe('one two');
  });
});

describe('extractChunkText', () => {
  it('ignores chunks without text', () => {
    expect(extractChunkText({ usage: { tokens: 3 } })).toBeUndefined();
  });
});
