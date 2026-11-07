import type { StreamFormat } from '@aikitstudio/agul-core';

const TEXT_PATHS: string[][] = [
  ['delta', 'text'],
  ['delta', 'content'],
  ['choices', '0', 'delta', 'content'],
  ['choices', '0', 'text'],
  ['choices', '0', 'message', 'content'],
  ['delta'],
  ['text'],
  ['content'],
  ['token'],
  ['message'],
  ['reply'],
  ['answer'],
  ['output'],
];

export function readPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>(
    (node, key) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined),
    value,
  );
}

/** Pulls the text out of one stream chunk: OpenAI/Anthropic-style deltas or common `{ text | content | token }` shapes. */
export function extractChunkText(chunk: unknown): string | undefined {
  if (typeof chunk === 'string') return chunk;
  for (const path of TEXT_PATHS) {
    const value = readPath(chunk, path);
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function parseData(data: string): { done: boolean; text?: string; value?: unknown } {
  if (data === '[DONE]') return { done: true };
  try {
    const value = JSON.parse(data);
    return { done: false, text: extractChunkText(value), value };
  } catch {
    return { done: false, text: data };
  }
}

export interface StreamHandlers {
  onText: (text: string) => void;
  /** Every parsed JSON chunk, e.g. to pick up a `session_id`. */
  onChunk?: (value: unknown) => void;
}

/**
 * Reads a streaming response body. `sse`: `data:` lines (multi-line events joined, `[DONE]` ends);
 * `ndjson`: one JSON value per line; `text`: raw text chunks.
 */
export async function readStream(response: Response, format: StreamFormat, handlers: StreamHandlers): Promise<void> {
  if (!response.body) {
    handlers.onText(await response.text());
    return;
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let eventData: string[] = [];

  const emit = (data: string) => {
    const parsed = parseData(data);
    if (parsed.value !== undefined) handlers.onChunk?.(parsed.value);
    if (parsed.text) handlers.onText(parsed.text);
    return parsed.done;
  };

  const handleLine = (line: string): boolean => {
    if (format === 'ndjson') return line.trim() ? emit(line.trim()) : false;
    if (line === '') {
      const done = eventData.length > 0 && emit(eventData.join('\n'));
      eventData = [];
      return done;
    }
    if (line.startsWith('data:')) eventData.push(line.slice(5).replace(/^ /, ''));
    return false;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (format === 'text' || format === 'none') {
      handlers.onText(value);
      continue;
    }
    buffer += value;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (handleLine(line)) {
        await reader.cancel();
        return;
      }
    }
  }

  if (buffer) handleLine(buffer);
  if (eventData.length > 0) emit(eventData.join('\n'));
}
