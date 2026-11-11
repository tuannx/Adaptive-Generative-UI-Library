/**
 * One generative-UI scenario: what the user asks, what a text-only agent answers,
 * and what an AGUL agent sends instead (an OpenAPI operation the host renders).
 */
export interface GenUiScenario {
  id: string;
  /** What the user types. */
  prompt: string;
  /** The same answer as a text-only agent would write it. */
  textAnswer: string;
  /** The agent's UI message: an OpenAPI document with one `x-agul-view: action` operation. */
  spec: Record<string, unknown>;
  /** Mock backend: what the confirm call returns. Nothing leaves the page. */
  respond: (body: Record<string, unknown>) => unknown;
}
