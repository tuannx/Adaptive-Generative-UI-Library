/** Helpers to write the agent's message: each app is one `x-agul-widget: app-step` object field. */
type Schema = Record<string, unknown>;

export interface AppStepInput {
  app: string;
  icon: string;
  title: string;
  /** Fields the user can edit, with the agent's proposal as `default`. */
  fields: Record<string, Schema>;
  include?: boolean;
}

export function appStep({ app, icon, title, fields, include = true }: AppStepInput): Schema {
  return {
    type: 'object',
    title,
    'x-agul-widget': 'app-step',
    'x-agul-app': { name: app, icon },
    properties: {
      include: { type: 'boolean', title: 'Include', default: include },
      ...fields,
    },
  };
}

export const choice = (title: string, options: string[], value: string): Schema => ({
  type: 'string',
  title,
  enum: options,
  default: value,
});

export const choices = (title: string, options: string[], value: string[]): Schema => ({
  type: 'array',
  title,
  items: { type: 'string', enum: options },
  default: value,
});

export const text = (title: string, value: string, long = false): Schema => ({
  type: 'string',
  title,
  default: value,
  ...(long ? { 'x-agul-widget': 'textarea' } : {}),
});

/** An OpenAPI document with one action the user confirms. */
export function actionSpec(input: {
  title: string;
  path: string;
  operationId: string;
  summary: string;
  description: string;
  submit: string;
  body: Schema;
}): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: { title: input.title, version: '1' },
    paths: {
      [input.path]: {
        post: {
          operationId: input.operationId,
          summary: input.summary,
          description: input.description,
          'x-agul-view': 'action',
          'x-agul-submit': input.submit,
          requestBody: { required: true, content: { 'application/json': { schema: input.body } } },
          responses: { '200': { description: 'What was done' } },
        },
      },
    },
  };
}

/** Rows for the result table: one per app, done or skipped. */
export function stepResults(body: Record<string, unknown>, describe: Record<string, (step: Schema) => string>) {
  return Object.entries(describe).map(([key, line]) => {
    const step = (body[key] ?? {}) as Schema;
    const included = step.include !== false;
    return { step: key, result: included ? line(step) : 'Skipped', status: included ? 'done' : 'skipped' };
  });
}
