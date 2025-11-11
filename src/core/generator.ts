/**
 * Route Generator - Converts parsed API to React Router routes
 */

import type {
  ParsedAPI,
  ParsedEndpoint,
  RouteConfig,
  GroupedRoutes,
  MenuItem
} from './types';
import { getResponseSchema, getRequestSchema } from './parser';

/**
 * Generate React Router routes from parsed API
 */
export function generateRoutes(parsed: ParsedAPI): RouteConfig[] {
  const routes: RouteConfig[] = [];

  parsed.endpoints.forEach(endpoint => {
    const generatedRoutes = generateRoutesForEndpoint(endpoint, parsed);
    routes.push(...generatedRoutes);
  });

  return routes;
}

/**
 * Generate routes for a single endpoint
 */
function generateRoutesForEndpoint(
  endpoint: ParsedEndpoint,
  _parsed: ParsedAPI
): RouteConfig[] {
  const routes: RouteConfig[] = [];
  const { path, method, operationId, tags, summary, description, parameters, requestBody, responses } = endpoint;

  // Convert OpenAPI path to React Router path
  // /pet/{petId} -> /pet/:petId
  const routerPath = convertPathToRouterFormat(path);

  // Determine component type based on method and path
  const hasPathParam = path.includes('{');

  switch (method) {
    case 'get':
      if (hasPathParam) {
        // GET /resource/{id} -> DetailView
        routes.push({
          path: routerPath,
          component: 'detail',
          apiEndpoint: path,
          method,
          schema: getResponseSchema(responses) || undefined,
          summary,
          description,
          parameters,
          tag: tags?.[0] || 'default',
          operationId
        });
      } else {
        // GET /resource -> ListView
        routes.push({
          path: routerPath,
          component: 'list',
          apiEndpoint: path,
          method,
          schema: getResponseSchema(responses) || undefined,
          summary,
          description,
          parameters,
          tag: tags?.[0] || 'default',
          operationId
        });
      }
      break;

    case 'post':
      // POST /resource -> Create Form
      routes.push({
        path: `${routerPath}/new`,
        component: 'create',
        apiEndpoint: path,
        method,
        schema: getRequestSchema(requestBody) || undefined,
        summary,
        description,
        parameters,
        requestBody,
        tag: tags?.[0] || 'default',
        operationId
      });
      break;

    case 'put':
    case 'patch':
      // PUT /resource/{id} -> Edit Form
      routes.push({
        path: `${routerPath}/edit`,
        component: 'edit',
        apiEndpoint: path,
        method,
        schema: getRequestSchema(requestBody) || undefined,
        summary,
        description,
        parameters,
        requestBody,
        tag: tags?.[0] || 'default',
        operationId
      });
      break;

    case 'delete':
      // DELETE handled in ListView/DetailView, no separate route
      break;
  }

  return routes;
}

/**
 * Convert OpenAPI path format to React Router format
 * /pet/{petId} -> /pet/:petId
 */
function convertPathToRouterFormat(path: string): string {
  return path.replace(/\{([^}]+)\}/g, ':$1');
}

/**
 * Group routes by tag
 */
export function groupRoutesByTag(routes: RouteConfig[]): GroupedRoutes {
  const grouped: GroupedRoutes = {};

  routes.forEach(route => {
    const tag = route.tag || 'default';
    if (!grouped[tag]) {
      grouped[tag] = [];
    }
    grouped[tag].push(route);
  });

  return grouped;
}

/**
 * Generate navigation menu from grouped routes
 */
export function generateMenu(grouped: GroupedRoutes): MenuItem[] {
  const menu: MenuItem[] = [];

  Object.entries(grouped).forEach(([tag, routes]) => {
    // Get unique base paths (list views only)
    const listRoutes = routes.filter(r => r.component === 'list');

    if (listRoutes.length === 0) {
      return;
    }

    const menuItem: MenuItem = {
      key: tag,
      label: formatTagName(tag),
      children: listRoutes.map(route => ({
        key: route.path,
        label: route.summary || formatPathName(route.path)
      }))
    };

    menu.push(menuItem);
  });

  return menu;
}

/**
 * Format tag name for display
 */
function formatTagName(tag: string): string {
  return tag
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format path name for display
 */
function formatPathName(path: string): string {
  // Remove leading slash and parameters
  const cleaned = path
    .replace(/^\//, '')
    .replace(/\/:.+$/, '')
    .replace(/\//g, ' > ');

  return cleaned
    .split(/[-_\s]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract path parameters from route
 */
export function extractPathParams(path: string): string[] {
  const matches = path.matchAll(/:([^/]+)/g);
  return Array.from(matches, m => m[1]);
}

/**
 * Build API URL with path parameters
 */
export function buildApiUrl(
  baseUrl: string,
  apiEndpoint: string,
  pathParams: Record<string, string>
): string {
  let url = apiEndpoint;

  // Replace {param} with actual values
  Object.entries(pathParams).forEach(([key, value]) => {
    url = url.replace(`{${key}}`, encodeURIComponent(value));
  });

  // Combine with base URL
  const fullUrl = new URL(url, baseUrl).toString();
  return fullUrl;
}

/**
 * Get CRUD operations for a resource
 */
export function getCrudOperations(
  resourcePath: string,
  routes: RouteConfig[]
): {
  list?: RouteConfig;
  detail?: RouteConfig;
  create?: RouteConfig;
  edit?: RouteConfig;
  delete?: ParsedEndpoint;
} {
  const operations: any = {};

  routes.forEach(route => {
    const basePath = route.apiEndpoint.replace(/\{[^}]+\}/g, '').replace(/\/$/, '');
    const targetPath = resourcePath.replace(/\{[^}]+\}/g, '').replace(/\/$/, '');

    if (basePath === targetPath || route.apiEndpoint === resourcePath) {
      switch (route.component) {
        case 'list':
          operations.list = route;
          break;
        case 'detail':
          operations.detail = route;
          break;
        case 'create':
          operations.create = route;
          break;
        case 'edit':
          operations.edit = route;
          break;
      }
    }
  });

  return operations;
}
