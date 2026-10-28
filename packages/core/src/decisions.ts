import type { HttpMethod, MenuItem, ParameterObject, ParsedAPI, ParsedEndpoint, SchemaObject } from './types.js';
import { getRequestSchema, getResponseSchema } from './parser.js';
import { buildMenu, buildResources, type Resource } from './resources.js';
import { dereferenceSchema, findListRows } from './schema.js';
import { canAccessEndpoint, type AccessGrants } from './security.js';

/**
 * How an operation is presented:
 * - `crud`: wired into a resource's list/detail/create/edit/delete pages
 * - `action`: a form that calls the endpoint and shows the result (streamed if the response streams)
 * - `chat`: a conversation UI over a message-in / reply-out endpoint
 * - `hidden`: not shown
 */
export type UiKind = 'crud' | 'action' | 'chat' | 'hidden';
export const UI_KINDS: readonly UiKind[] = ['crud', 'action', 'chat', 'hidden'];

export type StreamFormat = 'sse' | 'ndjson' | 'text' | 'none';

export interface ChatBinding {
  /** Request body field that carries the user's message. */
  messageField: string;
  /** Request body field that takes prior turns as `[{ role, content }]`. */
  historyField?: string;
  /** Request/response field that keeps a conversation id between turns. */
  sessionField?: string;
  /** Dot path to the reply text in a JSON response (ignored when streaming). */
  replyPath?: string;
}

export type DecisionSource = 'spec' | 'provider' | 'heuristic';

export interface UiDecision {
  operationId: string;
  kind: UiKind;
  label?: string;
  /** Menu group; defaults to the operation's first tag. */
  group?: string;
  chat?: ChatBinding;
  source: DecisionSource;
}

/** What a decision provider sees about one operation: compact enough to send to an LLM. */
export interface OperationSummary {
  operationId: string;
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  queryParams: string[];
  pathParams: string[];
  body?: { contentType: string; fields: FieldSummary[] };
  response?: { contentType: string; stream: StreamFormat; isList: boolean; fields: string[] };
  /** What AGUL would do without the provider. */
  current: { kind: UiKind; chat?: ChatBinding };
}

export interface FieldSummary {
  name: string;
  type: string;
  required: boolean;
  enum?: unknown[];
}

/** A provider's verdict for one operation; anything invalid is dropped during validation. */
export interface ProposedDecision {
  operationId: string;
  kind: UiKind;
  label?: string;
  group?: string;
  chat?: Partial<ChatBinding>;
}

export interface DecisionContext {
  title: string;
  version?: string;
  signal?: AbortSignal;
}

/**
 * Decides how operations are presented. Called once per spec with every operation's summary;
 * may return decisions for any subset. Implementations: {@link createHttpDecisionProvider}
 * (your own decision API, or the AGUL Worker's `/decide` route backed by an LLM) and
 * {@link createLlmDecisionProvider} (any LLM client you pass in).
 */
export interface UiDecisionProvider {
  id: string;
  decide(operations: OperationSummary[], context: DecisionContext): Promise<ProposedDecision[]>;
}

const MESSAGE_FIELDS = ['message', 'prompt', 'question', 'query', 'input', 'text', 'content', 'msg', 'user_message'];
const HISTORY_FIELDS = ['messages', 'history', 'conversation', 'chat_history', 'context'];
const SESSION_FIELDS = ['session_id', 'sessionId', 'conversation_id', 'conversationId', 'thread_id', 'threadId', 'chat_id', 'chatId'];
const REPLY_FIELDS = ['reply', 'answer', 'response', 'output', 'message', 'content', 'text', 'completion', 'reading'];
const CHAT_WORDS = new Set([
  'chat', 'chats', 'message', 'messages', 'ask', 'converse', 'conversation', 'conversations',
  'completion', 'completions', 'reply', 'assistant', 'oracle', 'advice', 'respond', 'response', 'responses',
]);

function words(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isChatMessageArray(schema: SchemaObject | undefined): boolean {
  const item = schema?.type === 'array' ? schema.items : undefined;
  const variants = [item, ...(item?.oneOf ?? []), ...(item?.anyOf ?? [])];
  return variants.some((variant) => {
    const keys = Object.keys(variant?.properties ?? {});
    return keys.includes('role') && keys.includes('content');
  });
}

function isRecordLike(schema: SchemaObject | undefined): schema is SchemaObject {
  return !!schema && (schema.type === 'object' || !!schema.properties);
}

function pickField(schema: SchemaObject | undefined, names: string[], test: (field: SchemaObject) => boolean): string | undefined {
  const properties = schema?.properties ?? {};
  const lower = new Map(Object.keys(properties).map((key) => [key.toLowerCase(), key]));
  for (const name of names) {
    const key = lower.get(name.toLowerCase());
    if (key && test(properties[key])) return key;
  }
  return undefined;
}

export function streamFormatOf(endpoint: ParsedEndpoint): StreamFormat {
  if (endpoint.extensions?.['x-agul-stream']) return endpoint.extensions['x-agul-stream'] as StreamFormat;
  const types = Object.values(endpoint.responses ?? {}).flatMap((response) => Object.keys(response?.content ?? {}));
  if (types.some((type) => type.includes('event-stream'))) return 'sse';
  if (types.some((type) => /ndjson|jsonl|json-seq/.test(type))) return 'ndjson';
  if (types.length > 0 && types.every((type) => type.startsWith('text/plain'))) return 'text';
  return 'none';
}

function requestContentType(endpoint: ParsedEndpoint): string | undefined {
  return Object.keys(endpoint.requestBody?.content ?? {})[0];
}

function responseContentType(endpoint: ParsedEndpoint): string | undefined {
  const success = Object.entries(endpoint.responses ?? {}).find(([code]) => /^2/.test(code))?.[1];
  return Object.keys(success?.content ?? {})[0];
}

/**
 * Detects message-in / reply-out endpoints and works out which fields carry what. Requires a JSON body
 * with a message field (or an OpenAI-style `messages: [{ role, content }]` array), a chat-like name, and a
 * reply: a stream, a reply-ish response field, or `choices`.
 */
export function detectChatBinding(endpoint: ParsedEndpoint, schemas: Record<string, SchemaObject>): ChatBinding | undefined {
  if (endpoint.method !== 'post') return undefined;
  const contentType = requestContentType(endpoint);
  if (contentType && !contentType.includes('json')) return undefined;
  const body = dereferenceSchema(getRequestSchema(endpoint.requestBody) ?? undefined, schemas);
  if (!isRecordLike(body)) return undefined;

  const conversationField = pickField(body, ['messages', 'conversation', 'history'], isChatMessageArray);
  const messageField =
    pickField(body, MESSAGE_FIELDS, (field) => field.type === 'string' || !field.type) ?? conversationField;
  if (!messageField) return undefined;

  const stream = streamFormatOf(endpoint);
  const named = words(`${endpoint.path} ${endpoint.operationId} ${endpoint.summary ?? ''}`).some((word) => CHAT_WORDS.has(word));
  if (!named && stream === 'none') return undefined;

  const response = dereferenceSchema(getResponseSchema(endpoint.responses ?? {}) ?? undefined, schemas);
  const replyPath = pickField(response, REPLY_FIELDS, (field) => field.type === 'string' || !field.type);
  const hasChoices = response?.properties?.choices?.type === 'array';
  if (stream === 'none' && !replyPath && !hasChoices) return undefined;

  return {
    messageField,
    historyField:
      messageField === conversationField
        ? conversationField
        : pickField(body, HISTORY_FIELDS, (field) => field.type === 'array'),
    sessionField:
      pickField(body, SESSION_FIELDS, () => true) ?? pickField(response, SESSION_FIELDS, () => true),
    replyPath: replyPath ?? (hasChoices ? 'choices.0.message.content' : undefined),
  };
}

function readExtensionKind(endpoint: ParsedEndpoint): UiKind | undefined {
  const value = endpoint.extensions?.['x-agul-view'];
  return typeof value === 'string' && (UI_KINDS as readonly string[]).includes(value) ? (value as UiKind) : undefined;
}

function readExtensionChat(endpoint: ParsedEndpoint): Partial<ChatBinding> | undefined {
  const value = endpoint.extensions?.['x-agul-chat'];
  return value && typeof value === 'object' ? (value as Partial<ChatBinding>) : undefined;
}

function crudOperationIds(resources: Resource[]): Set<string> {
  const ids = new Set<string>();
  for (const resource of resources) {
    for (const operation of [resource.list, resource.detail, resource.create, resource.update, resource.remove]) {
      if (operation) ids.add(operation.operationId);
    }
  }
  return ids;
}

/**
 * Decisions AGUL makes on its own: `x-agul-view` / `x-agul-chat` from the spec first, then
 * CRUD wiring from the resource model, then chat detection, and an action page for the rest.
 */
export function heuristicDecisions(api: ParsedAPI): Map<string, UiDecision> {
  const decisions = new Map<string, UiDecision>();
  const forced = new Set<string>();

  for (const endpoint of api.endpoints) {
    const kind = readExtensionKind(endpoint);
    if (kind && kind !== 'crud') {
      forced.add(endpoint.operationId);
      const chat = kind === 'chat' ? mergeChat(detectChatBinding(endpoint, api.schemas), readExtensionChat(endpoint)) : undefined;
      decisions.set(endpoint.operationId, {
        operationId: endpoint.operationId,
        kind: kind === 'chat' && !chat ? 'action' : kind,
        chat,
        source: 'spec',
      });
    }
  }

  // a non-streaming POST that creates rows of a listed resource is CRUD even if it carries a message field
  const listedCreates = new Set(
    buildResources(api, { exclude: forced })
      .filter((resource) => resource.list && resource.create)
      .map((resource) => resource.create!.operationId),
  );

  for (const endpoint of api.endpoints) {
    if (decisions.has(endpoint.operationId)) continue;
    if (listedCreates.has(endpoint.operationId) && streamFormatOf(endpoint) === 'none') continue;
    const chat = detectChatBinding(endpoint, api.schemas);
    if (chat && readExtensionKind(endpoint) !== 'crud') {
      forced.add(endpoint.operationId);
      decisions.set(endpoint.operationId, { operationId: endpoint.operationId, kind: 'chat', chat, source: 'heuristic' });
    }
  }

  const resources = buildResources(api, { exclude: forced });
  const crud = crudOperationIds(resources);
  for (const resource of resources) {
    if (isCreateOnly(resource) && !createEchoesRecord(resource, api)) crud.delete(resource.create!.operationId);
  }

  for (const endpoint of api.endpoints) {
    if (decisions.has(endpoint.operationId)) continue;
    const pinned = readExtensionKind(endpoint) === 'crud';
    if (crud.has(endpoint.operationId) || pinned) {
      decisions.set(endpoint.operationId, { operationId: endpoint.operationId, kind: 'crud', source: pinned ? 'spec' : 'heuristic' });
      continue;
    }
    decisions.set(endpoint.operationId, {
      operationId: endpoint.operationId,
      kind: endpoint.deprecated ? 'hidden' : 'action',
      source: 'heuristic',
    });
  }

  return decisions;
}

function isCreateOnly(resource: Resource): boolean {
  return !!resource.create && !resource.list && !resource.detail && !resource.update && !resource.remove;
}

/**
 * A POST with no other operations on its path is a "create" only if it answers with the kind of record
 * it was sent (`POST /orders` → Order). `POST /readings/draw` → Reading is an action.
 */
function createEchoesRecord(resource: Resource, api: ParsedAPI): boolean {
  const endpoint = api.endpoints.find((candidate) => candidate.operationId === resource.create!.operationId);
  const body = resource.create!.schema;
  const response = endpoint && dereferenceSchema(getResponseSchema(endpoint.responses ?? {}) ?? undefined, api.schemas);
  if (!body || !response?.properties) return !response;
  if (body.title && response.title) return body.title === response.title;
  const bodyKeys = new Set(Object.keys(body.properties ?? {}));
  const responseKeys = Object.keys(response.properties);
  const shared = responseKeys.filter((key) => bodyKeys.has(key)).length;
  const union = new Set([...bodyKeys, ...responseKeys]).size;
  return union > 0 && shared / union >= 0.6;
}

function mergeChat(base: ChatBinding | undefined, override: Partial<ChatBinding> | undefined): ChatBinding | undefined {
  const merged = { ...base, ...override };
  return merged.messageField ? (merged as ChatBinding) : undefined;
}

function fieldSummaries(schema: SchemaObject | undefined): FieldSummary[] {
  const required = new Set(schema?.required ?? []);
  return Object.entries(schema?.properties ?? {}).map(([name, field]) => ({
    name,
    type: field.type ?? (field.properties ? 'object' : 'any'),
    required: required.has(name),
    ...(field.enum ? { enum: field.enum.slice(0, 12) } : {}),
  }));
}

function paramNames(parameters: ParameterObject[] | undefined, location: ParameterObject['in']): string[] {
  return (parameters ?? []).filter((param) => param.in === location).map((param) => param.name);
}

export function summarizeOperations(api: ParsedAPI, decisions: Map<string, UiDecision>): OperationSummary[] {
  return api.endpoints.map((endpoint) => {
    const body = dereferenceSchema(getRequestSchema(endpoint.requestBody) ?? undefined, api.schemas);
    const response = dereferenceSchema(getResponseSchema(endpoint.responses ?? {}) ?? undefined, api.schemas);
    const rows = findListRows(response);
    const current = decisions.get(endpoint.operationId);
    return {
      operationId: endpoint.operationId,
      method: endpoint.method,
      path: endpoint.path,
      summary: endpoint.summary,
      description: endpoint.description?.slice(0, 300),
      tags: endpoint.tags ?? [],
      queryParams: paramNames(endpoint.parameters, 'query'),
      pathParams: paramNames(endpoint.parameters, 'path'),
      body: body ? { contentType: requestContentType(endpoint) ?? 'application/json', fields: fieldSummaries(body) } : undefined,
      response: response || streamFormatOf(endpoint) !== 'none'
        ? {
            contentType: responseContentType(endpoint) ?? 'application/json',
            stream: streamFormatOf(endpoint),
            isList: !!rows,
            fields: Object.keys((rows?.schema ?? response)?.properties ?? {}).slice(0, 30),
          }
        : undefined,
      current: { kind: current?.kind ?? 'action', chat: current?.chat },
    };
  });
}

/**
 * Merges provider proposals into the heuristic decisions. Spec decisions are never overridden;
 * proposals naming unknown operations, unknown kinds, or chat fields the body doesn't have are dropped.
 */
export function mergeDecisions(
  api: ParsedAPI,
  base: Map<string, UiDecision>,
  proposals: ProposedDecision[],
): Map<string, UiDecision> {
  const merged = new Map(base);
  const endpoints = new Map(api.endpoints.map((endpoint) => [endpoint.operationId, endpoint]));

  for (const proposal of proposals) {
    const endpoint = endpoints.get(proposal?.operationId);
    const existing = merged.get(proposal?.operationId);
    if (!endpoint || !existing || existing.source === 'spec') continue;
    if (!(UI_KINDS as readonly string[]).includes(proposal.kind)) continue;

    let chat: ChatBinding | undefined;
    if (proposal.kind === 'chat') {
      chat = validateChat(endpoint, api, mergeChat(detectChatBinding(endpoint, api.schemas), stripEmpty(proposal.chat)));
      if (!chat) continue;
    }

    merged.set(endpoint.operationId, {
      operationId: endpoint.operationId,
      kind: proposal.kind,
      label: proposal.label?.trim() || undefined,
      group: proposal.group?.trim() || undefined,
      chat,
      source: 'provider',
    });
  }

  return merged;
}

function stripEmpty(chat: Partial<ChatBinding> | undefined): Partial<ChatBinding> | undefined {
  if (!chat) return undefined;
  return Object.fromEntries(Object.entries(chat).filter(([, value]) => typeof value === 'string' && value.trim())) as Partial<ChatBinding>;
}

function validateChat(endpoint: ParsedEndpoint, api: ParsedAPI, chat: ChatBinding | undefined): ChatBinding | undefined {
  const body = dereferenceSchema(getRequestSchema(endpoint.requestBody) ?? undefined, api.schemas);
  const fields = body?.properties ?? {};
  if (!chat || !(chat.messageField in fields)) return undefined;
  return {
    messageField: chat.messageField,
    historyField: chat.historyField && chat.historyField in fields ? chat.historyField : undefined,
    sessionField: chat.sessionField,
    replyPath: chat.replyPath,
  };
}

/** Runs providers in order (later ones override earlier ones); a failing provider is skipped. */
export async function resolveDecisions(
  api: ParsedAPI,
  providers: UiDecisionProvider[],
  options: { signal?: AbortSignal; onError?: (provider: UiDecisionProvider, error: unknown) => void } = {},
): Promise<Map<string, UiDecision>> {
  let decisions = heuristicDecisions(api);
  for (const provider of providers) {
    try {
      const proposals = await provider.decide(summarizeOperations(api, decisions), {
        title: api.title,
        version: api.version,
        signal: options.signal,
      });
      decisions = mergeDecisions(api, decisions, Array.isArray(proposals) ? proposals : []);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      options.onError?.(provider, error);
    }
  }
  return decisions;
}

/** A page for an operation that isn't part of CRUD wiring. */
export interface OperationPage {
  operationId: string;
  kind: 'action' | 'chat';
  label: string;
  group: string;
  /** Router path of the page (`/_/<operationId>`). */
  path: string;
  method: HttpMethod;
  apiEndpoint: string;
  summary?: string;
  description?: string;
  parameters: ParameterObject[];
  /** Dereferenced request body schema. */
  body?: SchemaObject;
  contentType?: string;
  /** Dereferenced success response schema. */
  response?: SchemaObject;
  stream: StreamFormat;
  chat?: ChatBinding;
  decidedBy: DecisionSource;
}

export interface UiPlan {
  decisions: Map<string, UiDecision>;
  resources: Resource[];
  pages: OperationPage[];
  menu: MenuItem[];
}

function slug(text: string): string {
  return text.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'op';
}

function humanizeOperation(endpoint: ParsedEndpoint): string {
  if (endpoint.summary) return endpoint.summary;
  return endpoint.operationId
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
}

export interface PlanOptions {
  /** What the signed-in user may do; operations they can't call are left out of pages, buttons and menu. */
  grants?: AccessGrants;
}

/** Turns decisions into resources (CRUD pages), operation pages (action/chat) and the menu. */
export function planUi(
  api: ParsedAPI,
  decisions: Map<string, UiDecision> = heuristicDecisions(api),
  options: PlanOptions = {},
): UiPlan {
  const nonCrud = new Set(
    [...decisions.values()].filter((decision) => decision.kind !== 'crud').map((decision) => decision.operationId),
  );
  const byId = new Map(api.endpoints.map((endpoint) => [endpoint.operationId, endpoint]));
  const allowed = (operationId: string | undefined) => {
    const endpoint = operationId ? byId.get(operationId) : undefined;
    return !endpoint || canAccessEndpoint(endpoint, api.securitySchemes ?? {}, options.grants);
  };
  const resources = buildResources(api, { exclude: nonCrud })
    .map((resource) => (options.grants ? restrictResource(resource, allowed) : resource))
    .filter((resource): resource is Resource => !!resource);
  const used = new Set<string>();

  const pages: OperationPage[] = [];
  for (const endpoint of api.endpoints) {
    const decision = decisions.get(endpoint.operationId);
    if (!decision || (decision.kind !== 'action' && decision.kind !== 'chat')) continue;
    if (!allowed(endpoint.operationId)) continue;
    let path = `/_/${slug(endpoint.operationId)}`;
    while (used.has(path)) path += '-';
    used.add(path);

    pages.push({
      operationId: endpoint.operationId,
      kind: decision.kind,
      label: decision.label ?? humanizeOperation(endpoint),
      group: decision.group ?? endpoint.tags?.[0] ?? 'default',
      path,
      method: endpoint.method,
      apiEndpoint: endpoint.path,
      summary: endpoint.summary,
      description: endpoint.description,
      parameters: endpoint.parameters ?? [],
      body: dereferenceSchema(getRequestSchema(endpoint.requestBody) ?? undefined, api.schemas),
      contentType: requestContentType(endpoint),
      response: dereferenceSchema(getResponseSchema(endpoint.responses ?? {}) ?? undefined, api.schemas),
      stream: streamFormatOf(endpoint),
      chat: decision.chat,
      decidedBy: decision.source,
    });
  }

  const tagOrder = new Map(api.tags.map((tag, index) => [tag, index]));
  const menu = buildNavigation(resources, pages)
    .map((group, index) => ({ group, rank: tagOrder.get(group.key) ?? api.tags.length + index }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ group }) => group);
  return { decisions, resources, pages, menu };
}

/** Drops the operations (and their pages) the user may not call; `undefined` when nothing is left. */
function restrictResource(resource: Resource, allowed: (operationId: string | undefined) => boolean): Resource | undefined {
  const keep = <T extends { operationId: string }>(operation: T | undefined) =>
    operation && allowed(operation.operationId) ? operation : undefined;
  const list = keep(resource.list);
  const detail = keep(resource.detail);
  const create = keep(resource.create);
  const update = keep(resource.update);
  const remove = keep(resource.remove);
  const paths = {
    list: list ? resource.paths.list : undefined,
    detail: detail ? resource.paths.detail : undefined,
    create: create ? resource.paths.create : undefined,
    edit: update ? resource.paths.edit : undefined,
  };
  if (!paths.list && !paths.detail && !paths.create && !paths.edit) return undefined;
  return { ...resource, list, detail, create, update, remove, paths };
}

/** CRUD menu plus action/chat pages, grouped by tag; chat pages first in their group. */
export function buildNavigation(resources: Resource[], pages: OperationPage[]): MenuItem[] {
  const menu = buildMenu(resources);
  const byKey = new Map(menu.map((group) => [group.key, group]));

  const ordered = [...pages].sort((a, b) => Number(b.kind === 'chat') - Number(a.kind === 'chat'));
  for (const page of ordered) {
    let group = byKey.get(page.group);
    if (!group) {
      group = { key: page.group, label: page.group.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase()), children: [] };
      byKey.set(page.group, group);
      menu.push(group);
    }
    group.children!.push({ key: page.path, label: page.kind === 'chat' ? `💬 ${page.label}` : page.label });
  }

  return menu;
}

