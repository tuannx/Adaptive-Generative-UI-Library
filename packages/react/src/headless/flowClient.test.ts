import { describe, it, expect, vi } from 'vite-plus/test';
import { createFlowClient } from './flowClient.js';

const stepBody = (flowId: string, done = false) => ({
  success: true,
  data: {
    flow: {
      flowId,
      done,
      ...(done
        ? { result: { badge: 'builder' } }
        : { step: { id: 'q1', title: 'Team size?', schema: { type: 'object', properties: {} } } }),
      progress: { completed: done ? 3 : 1, total: 3 },
    },
  },
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('createFlowClient', () => {
  it('starts a flow and reads the step at the step path', async () => {
    const fetch = vi.fn(async () => jsonResponse(stepBody('s1')));
    const client = createFlowClient({
      startUrl: '/consult/sessions',
      answerUrl: (id) => `/consult/sessions/${id}/answers`,
      stepPath: 'data.flow',
      init: { credentials: 'include' },
      fetch,
    });

    const step = await client.start({ query: 'shop app' });

    expect(step.flowId).toBe('s1');
    expect(step.step?.id).toBe('q1');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/consult/sessions');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBe('{"query":"shop app"}');
  });

  it('posts answers to the running flow and shapes the body', async () => {
    const fetch = vi.fn(async () => jsonResponse(stepBody('s1', true)));
    const client = createFlowClient({
      startUrl: '/start',
      answerUrl: (id) => `/flows/${id}/answers`,
      stepPath: 'data.flow',
      toAnswerBody: (values, step) => ({ questionId: step.step?.id, answer: values }),
      fetch,
    });
    const current = { flowId: 's1', done: false, step: { id: 'q1', title: 'Team size?', schema: {} } };

    const next = await client.answer(current, { team_size: 'small' });

    expect(next.done).toBe(true);
    expect(next.result).toEqual({ badge: 'builder' });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/flows/s1/answers');
    expect(JSON.parse(String(init.body))).toEqual({ questionId: 'q1', answer: { team_size: 'small' } });
  });

  it('refuses to answer a finished flow', async () => {
    const fetch = vi.fn();
    const client = createFlowClient({ startUrl: '/s', answerUrl: () => '/a', fetch });
    await expect(client.answer({ flowId: 's1', done: true }, {})).rejects.toThrow('already finished');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('turns an error response into a readable error', async () => {
    const fetch = vi.fn(async () => jsonResponse({ error: { message: 'Session expired' } }, 410));
    const client = createFlowClient({ startUrl: '/s', answerUrl: () => '/a', fetch });
    await expect(client.start()).rejects.toThrow();
  });

  it('rejects a body that is not a flow step', async () => {
    const fetch = vi.fn(async () => jsonResponse({ ok: true }));
    const client = createFlowClient({ startUrl: '/s', answerUrl: () => '/a', fetch });
    await expect(client.start()).rejects.toThrow('not a flow step');
  });
});
