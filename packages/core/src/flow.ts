/**
 * Server-driven flows (`x-agul-view: flow`): a branching wizard where the server answers each
 * submitted step with the schema of the next one. No React here; renderers read these shapes.
 */
import type { ParsedAPI, ParsedEndpoint, SchemaObject } from './types.js';

export type FlowRole = 'start' | 'answer';

export interface AgulFlowStepView {
  id: string;
  title: string;
  description?: string;
  /** Object schema of the fields this step asks for (`x-agul-widget` picks how each is drawn). */
  schema: SchemaObject;
}

export interface AgulFlowProgress {
  completed: number;
  total: number;
}

/** What a start or answer operation returns (at `stepPath` inside the body). */
export interface AgulFlowStep {
  flowId: string;
  done: boolean;
  step?: AgulFlowStepView;
  progress?: AgulFlowProgress;
  result?: Record<string, unknown>;
}

export interface AgulFlowBinding {
  id: string;
  start: ParsedEndpoint;
  answer: ParsedEndpoint;
  /** Dot path to the step envelope inside the response body, e.g. `data.flow`. Empty means the body itself. */
  stepPath: string;
}

interface FlowExtension {
  id: string;
  role: FlowRole;
  stepPath?: string;
}

function readFlowExtension(endpoint: ParsedEndpoint): FlowExtension | null {
  if (endpoint.extensions?.['x-agul-view'] !== 'flow') return null;
  const raw = endpoint.extensions?.['x-agul-flow'];
  if (!raw || typeof raw !== 'object') return null;
  const { id, role, stepPath } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || (role !== 'start' && role !== 'answer')) return null;
  return { id, role, stepPath: typeof stepPath === 'string' ? stepPath : undefined };
}

/** Pairs each flow's start and answer operations; a flow missing either is skipped. */
export function findFlows(api: ParsedAPI): AgulFlowBinding[] {
  const parts = new Map<string, Partial<Record<FlowRole, ParsedEndpoint>> & { stepPath?: string }>();
  for (const endpoint of api.endpoints) {
    const flow = readFlowExtension(endpoint);
    if (!flow) continue;
    const entry = parts.get(flow.id) ?? {};
    entry[flow.role] ??= endpoint;
    entry.stepPath ??= flow.stepPath;
    parts.set(flow.id, entry);
  }

  const flows: AgulFlowBinding[] = [];
  for (const [id, entry] of parts) {
    if (entry.start && entry.answer) {
      flows.push({ id, start: entry.start, answer: entry.answer, stepPath: entry.stepPath ?? '' });
    }
  }
  return flows;
}

function pick(body: unknown, path: string): unknown {
  if (!path) return body;
  return path.split('.').reduce<unknown>((value, key) => {
    return value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
  }, body);
}

function readStepView(raw: unknown): AgulFlowStepView | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const { id, title, description, schema } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || typeof title !== 'string') return undefined;
  if (!schema || typeof schema !== 'object') return undefined;
  const view: AgulFlowStepView = { id, title, schema: schema as SchemaObject };
  if (typeof description === 'string') view.description = description;
  return view;
}

function readProgress(raw: unknown): AgulFlowProgress | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const { completed, total } = raw as Record<string, unknown>;
  if (typeof completed !== 'number' || typeof total !== 'number' || total <= 0) return undefined;
  return { completed: Math.min(Math.max(completed, 0), total), total };
}

/** Validates a response body against the flow contract. Returns null when it does not match. */
export function readFlowStep(body: unknown, stepPath = ''): AgulFlowStep | null {
  const raw = pick(body, stepPath);
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.flowId !== 'string' || typeof record.done !== 'boolean') return null;

  const step = readStepView(record.step);
  // a flow that is not done must say what to ask next
  if (!record.done && !step) return null;

  const parsed: AgulFlowStep = { flowId: record.flowId, done: record.done };
  if (step && !record.done) parsed.step = step;
  const progress = readProgress(record.progress);
  if (progress) parsed.progress = progress;
  if (record.result && typeof record.result === 'object') parsed.result = record.result as Record<string, unknown>;
  return parsed;
}

/** Share of the flow answered so far, 0 to 100. */
export function flowPercent(step: Pick<AgulFlowStep, 'done' | 'progress'>): number {
  if (step.done) return 100;
  if (!step.progress) return 0;
  return Math.round((step.progress.completed / step.progress.total) * 100);
}
