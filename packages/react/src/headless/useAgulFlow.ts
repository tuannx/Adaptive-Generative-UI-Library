import React from 'react';
import { flowPercent, type AgulFlowStep } from '@ai-kit/agul-core';
import { createFlowClient, type FlowClientOptions } from './flowClient.js';

export type FlowStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseAgulFlowResult {
  /** The last step the server sent; kept while the next one loads. */
  flow: AgulFlowStep | null;
  status: FlowStatus;
  error: Error | null;
  /** 0 to 100, for a progress bar or an XP meter. */
  percent: number;
  start(body?: unknown): Promise<void>;
  answer(values: Record<string, unknown>): Promise<void>;
  reset(): void;
}

/**
 * State for a server-driven flow, with no UI attached: the host draws each step with its own
 * components. Only the newest request may update state, so a slow answer never overwrites a newer one.
 */
export function useAgulFlow(options: FlowClientOptions): UseAgulFlowResult {
  const [flow, setFlow] = React.useState<AgulFlowStep | null>(null);
  const [status, setStatus] = React.useState<FlowStatus>('idle');
  const [error, setError] = React.useState<Error | null>(null);
  const optionsRef = React.useRef(options);
  optionsRef.current = options;
  const flowRef = React.useRef(flow);
  flowRef.current = flow;
  const requestId = React.useRef(0);

  const run = React.useCallback(async (send: (client: ReturnType<typeof createFlowClient>) => Promise<AgulFlowStep>) => {
    const id = ++requestId.current;
    setStatus('loading');
    setError(null);
    try {
      const next = await send(createFlowClient(optionsRef.current));
      if (id !== requestId.current) return;
      setFlow(next);
      setStatus('ready');
    } catch (caught) {
      if (id !== requestId.current) return;
      setError(caught instanceof Error ? caught : new Error(String(caught)));
      setStatus('error');
    }
  }, []);

  const start = React.useCallback((body?: unknown) => run((client) => client.start(body)), [run]);

  const answer = React.useCallback(
    (values: Record<string, unknown>) => {
      const current = flowRef.current;
      if (!current) return Promise.reject(new Error('Start the flow before answering.'));
      return run((client) => client.answer(current, values));
    },
    [run],
  );

  const reset = React.useCallback(() => {
    requestId.current += 1;
    setFlow(null);
    setStatus('idle');
    setError(null);
  }, []);

  return { flow, status, error, percent: flow ? flowPercent(flow) : 0, start, answer, reset };
}
