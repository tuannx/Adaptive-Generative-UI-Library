import type {
  HttpMethod,
  MenuItem,
  ParameterObject,
  ParsedAPI,
  ParsedEndpoint,
  SchemaObject,
} from './types.js';
import { getRequestSchema, getResponseSchema } from './parser.js';
import { dereferenceSchema, findListRows, isPrimitiveSchema } from './schema.js';

export interface ResourceOperation {
  method: HttpMethod;
  apiEndpoint: string;
  operationId: string;
  summary?: string;
  description?: string;
  parameters?: ParameterObject[];
  /** Response schema for list/detail, request body schema for create/update (dereferenced). */
  schema?: SchemaObject;
  /** Media type of the request body (create/update), e.g. `application/x-www-form-urlencoded`. */
  contentType?: string;
  /** List only: property path from the response body to the rows array (`[]` = body is the array). */
  rowsPath?: string[];
}

export interface ResourcePaths {
  list?: string;
  detail?: string;
  create?: string;
  edit?: string;
}

/**
 * A REST resource assembled from the endpoints that act on it.
 * `list` absent + `detail` without `idParam` means a singleton (e.g. GET /store/inventory).
 */
export interface Resource {
  key: string;
  tag: string;
  label: string;
  idParam?: string;
  list?: ResourceOperation;
  detail?: ResourceOperation;
  create?: ResourceOperation;
  update?: ResourceOperation;
  remove?: ResourceOperation;
  recordSchema?: SchemaObject;
  /** React Router paths of the generated pages. */
  paths: ResourcePaths;
}

interface EndpointGroup {
  key: string;
  collection: Partial<Record<HttpMethod, ParsedEndpoint>>;
  item: Partial<Record<HttpMethod, ParsedEndpoint>>;
  idParam?: string;
}

const ITEM_SUFFIX = /\/\{([^}]+)\}$/;
const STATIC_LAST_SEGMENT = /\/[^/{}]+$/;

/** Grouping key for an API path: no trailing slash (Django REST) or format suffix (`/calls.json`). */
function normalizePath(apiPath: string): string {
  return apiPath.replace(/\/+$/, '').replace(/\.(json|xml)$/i, '') || '/';
}

export function toRouterPath(apiPath: string): string {
  return apiPath.replace(/\{([^}]+)\}/g, ':$1');
}

function groupEndpoints(endpoints: ParsedEndpoint[]): Map<string, EndpointGroup> {
  const groups = new Map<string, EndpointGroup>();
  const groupFor = (key: string) => {
    let group = groups.get(key);
    if (!group) {
      group = { key, collection: {}, item: {} };
      groups.set(key, group);
    }
    return group;
  };

  for (const endpoint of endpoints) {
    const path = normalizePath(endpoint.path);
    const match = path.match(ITEM_SUFFIX);
    if (match) {
      const group = groupFor(path.slice(0, -match[0].length));
      group.item[endpoint.method] = endpoint;
      group.idParam = match[1];
    } else {
      groupFor(path).collection[endpoint.method] = endpoint;
    }
  }

  return groups;
}

function toOperation(
  endpoint: ParsedEndpoint | undefined,
  schema: SchemaObject | undefined,
  extra: Partial<ResourceOperation> = {},
): ResourceOperation | undefined {
  if (!endpoint) return undefined;
  return {
    method: endpoint.method,
    apiEndpoint: endpoint.path,
    operationId: endpoint.operationId,
    summary: endpoint.summary,
    description: endpoint.description,
    parameters: endpoint.parameters,
    schema,
    ...extra,
  };
}

const PREFERRED_BODY_TYPES = ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data'];

function requestContentType(endpoint: ParsedEndpoint | undefined): string | undefined {
  const types = Object.keys(endpoint?.requestBody?.content ?? {});
  return PREFERRED_BODY_TYPES.find((type) => types.includes(type)) ?? types[0];
}

function hasFormFields(schema: SchemaObject | undefined): boolean {
  return !!schema && Object.keys(schema.properties ?? {}).length > 0;
}

function humanize(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '')
    .split(/[/_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function buildResources(parsed: ParsedAPI): Resource[] {
  const { schemas } = parsed;
  const deref = (schema: SchemaObject | null | undefined) =>
    dereferenceSchema(schema ?? undefined, schemas);
  const responseOf = (endpoint?: ParsedEndpoint) =>
    endpoint ? deref(getResponseSchema(endpoint.responses ?? {})) : undefined;
  const bodyOf = (endpoint?: ParsedEndpoint) => {
    const schema = endpoint ? deref(getRequestSchema(endpoint.requestBody)) : undefined;
    if (hasFormFields(schema)) return schema;
    return [...(schema?.oneOf ?? []), ...(schema?.anyOf ?? [])].find(hasFormFields);
  };
  const writeOperation = (endpoint?: ParsedEndpoint) => {
    const schema = bodyOf(endpoint);
    return schema ? toOperation(endpoint, schema, { contentType: requestContentType(endpoint) }) : undefined;
  };

  const groups = groupEndpoints(parsed.endpoints);
  const borrowed = new Set<string>();
  const resources: Resource[] = [];

  for (const group of groups.values()) {
    const listEndpoint = group.collection.get;
    if (!listEndpoint) continue;

    const response = responseOf(listEndpoint);
    if (isPrimitiveSchema(response)) continue;

    const rows = findListRows(response);
    const rowSchema = rows?.schema;
    const isSingleton = !!response && !rows && (response.type === 'object' || !!response.properties);

    let source = group;
    if (!isSingleton && !hasItemOperations(group) && STATIC_LAST_SEGMENT.test(group.key)) {
      const parent = groups.get(group.key.replace(STATIC_LAST_SEGMENT, ''));
      const parentRecord = parent && (responseOf(parent.item.get) ?? bodyOf(parent.collection.post));
      if (parent && rowSchema?.title && parentRecord?.title === rowSchema.title) {
        source = parent;
        borrowed.add(parent.key);
      }
    }

    resources.push(
      isSingleton
        ? assembleSingleton(group, response!)
        : assemble(group, source, {
            list: toOperation(listEndpoint, response, { rowsPath: rows?.path ?? [] }),
            rowSchema,
          }),
    );
  }

  for (const group of groups.values()) {
    if (group.collection.get || borrowed.has(group.key) || group.key.includes('{')) continue;
    if (!hasItemOperations(group) && !bodyOf(group.collection.post)) continue;
    resources.push(assemble(group, group, {}));
  }

  return resources;

  function hasItemOperations(group: EndpointGroup): boolean {
    return Object.keys(group.item).length > 0;
  }

  function assembleSingleton(group: EndpointGroup, response: SchemaObject): Resource {
    const endpoint = group.collection.get!;
    return {
      key: group.key,
      tag: endpoint.tags?.[0] ?? 'default',
      label: endpoint.summary ?? humanize(group.key),
      detail: toOperation(endpoint, response),
      recordSchema: response,
      paths: { detail: toRouterPath(group.key) },
    };
  }

  function assemble(
    group: EndpointGroup,
    source: EndpointGroup,
    extra: { list?: ResourceOperation; rowSchema?: SchemaObject },
  ): Resource {
    const base = toRouterPath(group.key);
    const idParam = source.idParam;
    const detailEndpoint = source.item.get;
    const createEndpoint = group.collection.post ?? source.collection.post;
    const updateEndpoint =
      source.item.put ??
      source.item.patch ??
      source.collection.put ??
      source.collection.patch ??
      source.item.post;

    const detail = toOperation(detailEndpoint, responseOf(detailEndpoint));
    const create = writeOperation(createEndpoint);
    const update = idParam ? writeOperation(updateEndpoint) : undefined;
    const remove = toOperation(source.item.delete, undefined);

    const primary = extra.list ?? detail ?? create;
    const tagSource = group.collection.get ?? detailEndpoint ?? createEndpoint;

    return {
      key: group.key,
      tag: tagSource?.tags?.[0] ?? 'default',
      label: primary?.summary ?? humanize(group.key),
      idParam,
      list: extra.list,
      detail,
      create,
      update,
      remove,
      recordSchema: detail?.schema ?? extra.rowSchema ?? update?.schema ?? create?.schema,
      paths: {
        list: extra.list ? base : undefined,
        detail: detail && idParam ? `${base}/:${idParam}` : undefined,
        create: create ? `${base}/new` : undefined,
        edit: update ? `${base}/:${idParam}/edit` : undefined,
      },
    };
  }
}

/**
 * Sidebar menu grouped by tag. Entries under nested paths (`/orgs/:org/members`) carry `params`
 * so the UI can ask for them; entries needing no params come first within each tag.
 */
export function buildMenu(resources: Resource[]): MenuItem[] {
  const byTag = new Map<string, MenuItem[]>();

  for (const resource of resources) {
    const target = resource.paths.list ?? (resource.idParam ? resource.paths.create : resource.paths.detail);
    if (!target) continue;

    const label = resource.list || !resource.idParam ? resource.label : resource.create?.summary ?? `Create ${resource.label}`;
    const params = [...target.matchAll(/:([^/]+)/g)].map((match) => match[1]);
    const items = byTag.get(resource.tag) ?? [];
    items.push(params.length > 0 ? { key: target, label, params } : { key: target, label });
    byTag.set(resource.tag, items);
  }

  for (const items of byTag.values()) {
    items.sort((a, b) => (a.params?.length ?? 0) - (b.params?.length ?? 0));
  }

  return [...byTag].map(([tag, children]) => ({ key: tag, label: humanize(tag), children }));
}
