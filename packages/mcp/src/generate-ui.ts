import {
  parseOpenAPI,
  generateRoutes,
  groupRoutesByTag,
  generateMenu,
  type ParsedAPI,
  type RouteConfig,
} from '@agul/core';

export interface GenerateUIOptions {
  baseUrl?: string;
  previewBaseUrl?: string;
}

export interface GeneratedUIConfig {
  baseUrl: string;
  api: Pick<ParsedAPI, 'baseUrl' | 'basePath' | 'tags'>;
  routeCount: number;
  menu: ReturnType<typeof generateMenu>;
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

export async function generateUIFromOpenAPI(
  spec: Record<string, unknown>,
  options: GenerateUIOptions = {},
): Promise<GeneratedUIConfig> {
  const parsed = await parseOpenAPI(spec);
  if (options.baseUrl) {
    parsed.baseUrl = options.baseUrl;
  }

  const routes = generateRoutes(parsed);
  const grouped = groupRoutesByTag(routes);
  const menu = generateMenu(grouped);

  return {
    baseUrl: parsed.baseUrl,
    api: {
      baseUrl: parsed.baseUrl,
      basePath: parsed.basePath,
      tags: parsed.tags,
    },
    routeCount: routes.length,
    menu,
    routes: routes.map((route: RouteConfig) => ({
      path: route.path,
      component: route.component,
      method: route.method,
      summary: route.summary,
      apiEndpoint: route.apiEndpoint,
    })),
    embed: {
      react: `import { AGULRenderer } from '@agul/react';\n\n<AGULRenderer spec={openApiSpec} baseUrl="${parsed.baseUrl}" />`,
      install: 'npm install @agul/react antd axios swr react-router-dom',
    },
    previewUrl: options.previewBaseUrl
      ? `${options.previewBaseUrl.replace(/\/$/, '')}/`
      : undefined,
  };
}
