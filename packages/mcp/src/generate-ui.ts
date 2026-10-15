import {
  parseOpenAPI,
  parseJsonSchema,
  generateRoutes,
  buildResources,
  buildMenu,
  type MenuItem,
  type ParsedAPI,
  type RouteConfig,
  type SchemaObject,
} from '@agul/core';

export interface GenerateUIOptions {
  baseUrl?: string;
  previewBaseUrl?: string;
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
  routes: RouteConfig[],
  embedReact: string,
  previewBaseUrl?: string,
): GeneratedUIConfig {
  const resources = buildResources(parsed);

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
    menu: buildMenu(resources),
    resources: resources.map((resource) => ({
      key: resource.key,
      label: resource.label,
      tag: resource.tag,
      operations: (['list', 'detail', 'create', 'update', 'remove'] as const).filter((op) => resource[op]),
      fields: Object.keys(resource.recordSchema?.properties ?? {}),
      params: [...(resource.paths.list ?? '').matchAll(/:([^/]+)/g)].map((match) => match[1]),
    })),
    routes: routes.map((route: RouteConfig) => ({
      path: route.path,
      component: route.component,
      method: route.method,
      summary: route.summary,
      apiEndpoint: route.apiEndpoint,
    })),
    embed: {
      react: embedReact,
      install: 'npm install @agul/react antd @ant-design/icons axios dayjs swr react-router-dom',
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

  const routes = generateRoutes(parsed);

  return buildGeneratedUIConfig(
    parsed,
    routes,
    `import { AGULRenderer } from '@agul/react';\n\n<AGULRenderer spec={openApiSpec} baseUrl="${parsed.baseUrl}" />`,
    options.previewBaseUrl,
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

  const routes = generateRoutes(parsed);
  const resourcePathAttr = options.resourcePath
    ? ` resourcePath="${options.resourcePath}"`
    : '';

  return buildGeneratedUIConfig(
    parsed,
    routes,
    `import { AGULRenderer } from '@agul/react';\n\n<AGULRenderer jsonSchema={jsonSchema} baseUrl="${parsed.baseUrl}"${resourcePathAttr} />`,
    options.previewBaseUrl,
  );
}
