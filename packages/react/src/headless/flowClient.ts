import { readFlowStep, type AgulFlowStep } from '@aikitstudio/agul-core';
import { responseError } from '../http/errors.js';

export interface FlowClientOptions {
  /** URL of the flow's start operation. */
  startUrl: string;
  /** URL of the answer operation for a running flow. */
  answerUrl: (flowId: string) => string;
  /** Dot path to the step envelope inside the response body (`x-agul-flow.stepPath`). */
  stepPath?: string;
  /** Request init merged into every call (credentials, headers). */
  init?: RequestInit;
  /** Shapes the answer body; defaults to the step's values as they are. */
  toAnswerBody?: (values: Record<string, unknown>, step: AgulFlowStep) => unknown;
  fetch?: typeof fetch;
}

export interface FlowClient {
  start(body?: unknown): Promise<AgulFlowStep>;
  answer(step: AgulFlowStep, values: Record<string, unknown>): Promise<AgulFlowStep>;
}

/** Talks to a server-driven flow over `fetch`; no React and no UI library. */
export function createFlowClient(options: FlowClientOptions): FlowClient {
  const call = async (url: string, body: unknown): Promise<AgulFlowStep> => {
    const doFetch = options.fetch ?? fetch;
    const headers = new Headers(options.init?.headers);
    headers.set('Content-Type', 'application/json');
    const response = await doFetch(url, {
      ...options.init,
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
    });
    if (!response.ok) throw await responseError(response);

    const step = readFlowStep(await response.json(), options.stepPath);
    if (!step) throw new Error('The server answered with something that is not a flow step.');
    return step;
  };

  return {
    start: (body) => call(options.startUrl, body),
    answer: (step, values) => {
      if (step.done) return Promise.reject(new Error('This flow is already finished.'));
      const body = options.toAnswerBody ? options.toAnswerBody(values, step) : values;
      return call(options.answerUrl(step.flowId), body);
    },
  };
}
