import {
  DECISION_JSON_SCHEMA,
  DECISION_SYSTEM_PROMPT,
  generateRoutes,
  heuristicDecisions,
  mergeDecisions,
  parseJsonSchema,
  parseOpenAPI,
  planUi,
  summarizeOperations,
  type MenuItem,
  type OperationSummary,
  type ParsedAPI,
  type ProposedDecision,
  type RouteConfig,
  type SchemaObject,
  type UiKind,
} from '@ai-kit/agul-core';

export interface GenerateUIOptions {
  baseUrl?: string;
  previewBaseUrl?: string;
  /**
   * Layout decisions proposed by the calling agent (it is an LLM, so it can act as AGUL's decision
   * provider): `[{ operationId, kind: 'crud' | 'action' | 'chat' | 'hidden', label?, group?, chat? }]`.
   */
  decisions?: ProposedDecision[];
  /** Include per-operation summaries plus the decision schema/instructions, so the agent can decide. */
  includeOperationSummaries?: boolean;
}

export interface GeneratedUIConfig {
  baseUrl: string;
  api: Pick<ParsedAPI, 'title' | 'version' | 'baseUrl' | 'basePath' | 'tags'>;
  routeCount: number;
  menu: MenuItem[];
  resources: Array<{
    key: string;
    label: string;
    tag: string;
    operations: string[];
    fields: string[];
    /** Path params needed to reach this resource's list (e.g. `org` for /orgs/:org/members). */
    params: string[];
  }>;
  /** Action and chat pages for operations outside CRUD. */
  pages: Array<{
    operationId: string;
    kind: 'action' | 'chat';
    label: string;
    path: string;
    method: string;
    apiEndpoint: string;
    stream: string;
    chat?: { messageField: string; historyField?: string; sessionField?: string; replyPath?: string };
  }>;
  /** Operation id → presentation in effect, and who decided it. */
  decisions: Record<string, { kind: UiKind; source: string; label?: string }>;
  /** Present with `includeOperationSummaries`: what to decide on, and how. */
  decisionInput?: {
    instructions: string;
    schema: typeof DECISION_JSON_SCHEMA;
    operations: OperationSummary[];
  };
  routes: Array<{
    path: string;
    component: string;
    method: string;
    summary?: string;
    apiEndpoint: string;
  }>;
  embed: {
    react: string;
    install: string;
  };
  previewUrl?: string;
}

export interface GenerateUIFromJsonSchemaOptions {
  baseUrl: string;
  resourcePath?: string;
  title?: string;
  idParam?: string;
  tag?: string;
  previewBaseUrl?: string;
}

function buildGeneratedUIConfig(
  parsed: ParsedAPI,
  embedReact: string,
  options: Pick<GenerateUIOptions, 'previewBaseUrl' | 'decisions' | 'includeOperationSummaries'> = {},
): GeneratedUIConfig {
  const base = heuristicDecisions(parsed);
  const decided = options.decisions?.length ? mergeDecisions(parsed, base, options.decisions) : base;
  const plan = planUi(parsed, decided);
  const { resources } = plan;
  const routes = generateRoutes(parsed, plan);
  const previewBaseUrl = options.previewBaseUrl;

  return {
    baseUrl: parsed.baseUrl,
    api: {
      title: parsed.title,
      version: parsed.version,
      baseUrl: parsed.baseUrl,
      basePath: parsed.basePath,
      tags: parsed.tags,
    },
    routeCount: routes.length,
    menu: plan.menu as MenuItem[],
    resources: resources.map((resource) => ({
      key: resource.key,
      label: resource.label,
      tag: resource.tag,
      operations: (['list', 'detail', 'create', 'update', 'remove'] as const).filter((op) => resource[op]),
      fields: Object.keys(resource.recordSchema?.properties ?? {}),
      params: [...(resource.paths.list ?? '').matchAll(/:([^/]+)/g)].map((match) => match[1]),
    })),
    pages: plan.pages.map((page) => ({
      operationId: page.operationId,
      kind: page.kind,
      label: page.label,
      path: page.path,
      method: page.method,
      apiEndpoint: page.apiEndpoint,
      stream: page.stream,
      ...(page.chat ? { chat: page.chat } : {}),
    })),
    decisions: Object.fromEntries(
      [...plan.decisions.values()].map((decision) => [
        decision.operationId,
        { kind: decision.kind, source: decision.source, ...(decision.label ? { label: decision.label } : {}) },
      ]),
    ),
    decisionInput: options.includeOperationSummaries
      ? { instructions: DECISION_SYSTEM_PROMPT, schema: DECISION_JSON_SCHEMA, operations: summarizeOperations(parsed, base) }
      : undefined,
    routes: routes.map((route: RouteConfig) => ({
      path: route.path,
      component: route.component,
      method: route.method,
      summary: route.summary,
      apiEndpoint: route.apiEndpoint,
    })),
    embed: {
      react: embedReact,
      install: 'npm install @ai-kit/agul-react antd @ant-design/icons axios dayjs swr react-router-dom',
    },
    previewUrl: previewBaseUrl
      ? `${previewBaseUrl.replace(/\/$/, '')}/`
      : undefined,
  };
}

export async function generateUIFromOpenAPI(
  spec: Record<string, unknown>,
  options: GenerateUIOptions = {},
): Promise<GeneratedUIConfig> {
  const parsed = await parseOpenAPI(spec);
  if (options.baseUrl) {
    parsed.baseUrl = options.baseUrl;
  }

  const decisionsProp = options.decisions?.length
    ? `\n  decisionProvider={{ id: 'agent', decide: async () => ${JSON.stringify(options.decisions)} }}`
    : '';

  return buildGeneratedUIConfig(
    parsed,
    `import { AGULRenderer } from '@ai-kit/agul-react';\n\n<AGULRenderer spec={openApiSpec} baseUrl="${parsed.baseUrl}"${decisionsProp} />`,
    options,
  );
}

export async function generateUIFromJsonSchema(
  schema: SchemaObject,
  options: GenerateUIFromJsonSchemaOptions,
): Promise<GeneratedUIConfig> {
  const parsed = await parseJsonSchema(schema, {
    baseUrl: options.baseUrl,
    resourcePath: options.resourcePath,
    title: options.title,
    idParam: options.idParam,
    tag: options.tag,
  });

  const resourcePathAttr = options.resourcePath
    ? ` resourcePath="${options.resourcePath}"`
    : '';

  return buildGeneratedUIConfig(
    parsed,
    `import { AGULRenderer } from '@ai-kit/agul-react';\n\n<AGULRenderer jsonSchema={jsonSchema} baseUrl="${parsed.baseUrl}"${resourcePathAttr} />`,
    { previewBaseUrl: options.previewBaseUrl },
  );
}
