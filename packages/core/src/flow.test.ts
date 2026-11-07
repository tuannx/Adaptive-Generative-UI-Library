import { describe, it, expect } from 'vite-plus/test';
import { parseOpenAPISync } from './parser.js';
import { findFlows, flowPercent, readFlowStep } from './flow.js';

const json = (schema: object) => ({ content: { 'application/json': { schema } } });
const ok = { '200': { description: 'OK', ...json({ type: 'object' }) } };

const spec = {
  openapi: '3.0.3',
  info: { title: 'Consult', version: '1' },
  paths: {
    '/consult/sessions': {
      post: {
        operationId: 'startConsult',
        'x-agul-view': 'flow',
        'x-agul-flow': { id: 'consult', role: 'start', stepPath: 'data.flow' },
        responses: ok,
      },
    },
    '/consult/sessions/{id}/answers': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: {
        operationId: 'answerConsult',
        'x-agul-view': 'flow',
        'x-agul-flow': { id: 'consult', role: 'answer' },
        responses: ok,
      },
    },
    '/orphan': {
      post: { operationId: 'orphan', 'x-agul-view': 'flow', 'x-agul-flow': { id: 'lonely', role: 'start' }, responses: ok },
    },
  },
};

const step = {
  flowId: 's1',
  done: false,
  step: { id: 'team_size', title: 'How big is your team?', schema: { type: 'object', properties: { team_size: { type: 'string' } } } },
  progress: { completed: 1, total: 4 },
};

describe('findFlows', () => {
  it('pairs start and answer operations by flow id', () => {
    const flows = findFlows(parseOpenAPISync(spec));
    expect(flows).toHaveLength(1);
    expect(flows[0]!.id).toBe('consult');
    expect(flows[0]!.start.operationId).toBe('startConsult');
    expect(flows[0]!.answer.path).toBe('/consult/sessions/{id}/answers');
    expect(flows[0]!.stepPath).toBe('data.flow');
  });

  it('skips a flow that has no answer operation', () => {
    expect(findFlows(parseOpenAPISync(spec)).map((flow) => flow.id)).not.toContain('lonely');
  });
});

describe('readFlowStep', () => {
  it('reads the envelope at a dot path', () => {
    expect(readFlowStep({ success: true, data: { flow: step } }, 'data.flow')).toEqual(step);
  });

  it('rejects an unfinished flow without a next step', () => {
    expect(readFlowStep({ flowId: 's1', done: false })).toBeNull();
  });

  it('drops the step once the flow is done and keeps the result', () => {
    const done = readFlowStep({ ...step, done: true, result: { fitScore: 72 } });
    expect(done).toEqual({ flowId: 's1', done: true, progress: { completed: 1, total: 4 }, result: { fitScore: 72 } });
  });

  it('clamps progress into range', () => {
    expect(readFlowStep({ ...step, progress: { completed: 9, total: 4 } })?.progress).toEqual({ completed: 4, total: 4 });
  });

  it('rejects bodies that are not flow envelopes', () => {
    expect(readFlowStep(null)).toBeNull();
    expect(readFlowStep({ flowId: 1, done: false })).toBeNull();
  });
});

describe('flowPercent', () => {
  it('turns progress into a percentage', () => {
    expect(flowPercent({ done: false, progress: { completed: 1, total: 4 } })).toBe(25);
    expect(flowPercent({ done: true })).toBe(100);
    expect(flowPercent({ done: false })).toBe(0);
  });
});
