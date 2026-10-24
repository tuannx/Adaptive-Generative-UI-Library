/**
 * Route Generator - Converts parsed API to React Router routes
 */

import type {
  ComponentType,
  ParsedAPI,
  RouteConfig,
  GroupedRoutes,
  MenuItem
} from './types.js';
import type { ResourceOperation } from './resources.js';
import { planUi, type UiPlan } from './decisions.js';

/**
 * Generate React Router routes from parsed API (one per generated page, plus delete operations).
 */
export function generateRoutes(parsed: ParsedAPI, plan: UiPlan = planUi(parsed)): RouteConfig[] {
  const routes: RouteConfig[] = [];

  for (const resource of plan.resources) {
    const add = (operation: ResourceOperation | undefined, component: ComponentType, path?: string) => {
      if (!operation || !path) return;
      routes.push({
        path,
        component,
        apiEndpoint: operation.apiEndpoint,
        method: operation.method,
        schema: component === 'list' ? resource.recordSchema : operation.schema,
        summary: operation.summary,
        description: operation.description,
        parameters: operation.parameters,
        tag: resource.tag,
        operationId: operation.operationId,
      });
    };

    add(resource.list, 'list', resource.paths.list);
    add(resource.detail, 'detail', resource.paths.detail);
    add(resource.create, 'create', resource.paths.create);
    add(resource.update, 'edit', resource.paths.edit);
    add(resource.remove, 'delete', resource.paths.detail ?? resource.paths.list);
  }

  for (const page of plan.pages) {
    routes.push({
      path: page.path,
      component: page.kind,
      apiEndpoint: page.apiEndpoint,
      method: page.method,
      schema: page.body,
      summary: page.label,
      description: page.description,
      parameters: page.parameters,
      tag: page.group,
      operationId: page.operationId,
    });
  }

  return routes;
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
    const listRoutes = routes.filter(r => r.component === 'list' && !r.path.includes(':'));

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
 * Join a base URL and an API path without dropping the base path
 * (`new URL('/pet', 'https://host/v2')` would yield `https://host/pet`).
 */
export function joinUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * Substitute `{param}` placeholders, URL-encoding each value.
 */
export function fillPathParams(apiEndpoint: string, pathParams: Record<string, string | undefined>): string {
  return apiEndpoint.replace(/\{([^}]+)\}/g, (placeholder, name: string) => {
    const value = pathParams[name];
    return value === undefined ? placeholder : encodeURIComponent(value);
  });
}

/**
 * Build API URL with path parameters
 */
export function buildApiUrl(
  baseUrl: string,
  apiEndpoint: string,
  pathParams: Record<string, string | undefined> = {}
): string {
  return joinUrl(baseUrl, fillPathParams(apiEndpoint, pathParams));
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
