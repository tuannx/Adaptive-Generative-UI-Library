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
      if (hasPathParam) {
        routes.push({
          path: routerPath,
          component: 'delete',
          apiEndpoint: path,
          method,
          summary,
          description,
          parameters,
          tag: tags?.[0] || 'default',
          operationId,
        });
      }
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

const COMMON_ID_FIELDS = ['id', '_id', 'uuid', 'ID', 'Id'];

/**
 * Map an OpenAPI/React Router path param name to a field on a record object.
 * e.g. petId on /pet/{petId} maps to record.id
 */
export function resolveRecordIdField(
  record: Record<string, unknown>,
  paramName: string,
): string {
  if (paramName in record) {
    return paramName;
  }

  for (const field of COMMON_ID_FIELDS) {
    if (field in record) {
      return field;
    }
  }

  return Object.keys(record)[0];
}

/**
 * Substitute React Router path params from a data record.
 */
export function buildRouterPath(
  routerPath: string,
  record: Record<string, unknown>,
): string {
  let path = routerPath;

  for (const paramName of extractPathParams(routerPath)) {
    const field = resolveRecordIdField(record, paramName);
    const value = record[field];

    if (value !== null && value !== undefined) {
      path = path.replace(`:${paramName}`, String(value));
    }
  }

  return path;
}

/**
 * Build OpenAPI path parameter values from a data record.
 */
export function buildPathParamsFromRecord(
  apiEndpoint: string,
  record: Record<string, unknown>,
): Record<string, string> {
  const params: Record<string, string> = {};
  const matches = apiEndpoint.matchAll(/\{([^}]+)\}/g);

  for (const match of matches) {
    const paramName = match[1];
    const field = resolveRecordIdField(record, paramName);
    const value = record[field];

    if (value !== null && value !== undefined) {
      params[paramName] = String(value);
    }
  }

  return params;
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
 * Extract resource root segment from an API path.
 * /pet/findByStatus → /pet, /pet/{petId} → /pet
 */
export function getResourceRoot(apiEndpoint: string): string {
  const segments = apiEndpoint.split('/').filter(Boolean);
  return segments.length > 0 ? `/${segments[0]}` : '';
}

/**
 * Whether two API paths belong to the same resource group.
 */
export function routesShareResource(apiEndpointA: string, apiEndpointB: string): boolean {
  return getResourceRoot(apiEndpointA) === getResourceRoot(apiEndpointB);
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
  delete?: RouteConfig;
} {
  const operations: {
    list?: RouteConfig;
    detail?: RouteConfig;
    create?: RouteConfig;
    edit?: RouteConfig;
    delete?: RouteConfig;
  } = {};

  routes.forEach((route) => {
    if (!routesShareResource(route.apiEndpoint, resourcePath)) {
      return;
    }

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

    if (route.method === 'delete') {
      operations.delete = route;
    }
  });

  return operations;
}
