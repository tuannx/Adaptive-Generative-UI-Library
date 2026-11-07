/**
 * Data for the game widgets (`x-agul-widget: choice-cards | score-meter | progress-xp`).
 * Pure functions, so an antd renderer and a headless host draw the same thing.
 */
import type { SchemaObject } from './types.js';

export interface AgulChoice {
  value: string | number;
  label: string;
  description?: string;
  /** Short icon hint (an emoji or an icon name the host maps). */
  icon?: string;
}

export interface AgulScoreBand {
  min: number;
  label: string;
  tone?: 'positive' | 'neutral' | 'attention';
}

export interface AgulScore {
  value: number;
  min: number;
  max: number;
  percent: number;
  band?: AgulScoreBand;
}

export interface AgulLevel {
  at: number;
  label: string;
}

export interface AgulXp {
  percent: number;
  level?: AgulLevel;
  next?: AgulLevel;
}

const ext = (schema: SchemaObject, key: `x-${string}`): unknown => schema[key];
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** True when the field takes several choices (`type: array` with enum items). */
export function isMultiChoice(schema: SchemaObject): boolean {
  return schema.type === 'array';
}

/**
 * Options for a choice-cards field: `x-agul-choices` when given (label, description, icon),
 * otherwise the enum values with their own text as label. Multi-choice reads `items`.
 */
export function readChoices(schema: SchemaObject): AgulChoice[] {
  const source = isMultiChoice(schema) && schema.items ? schema.items : schema;
  const allowed = Array.isArray(source.enum) ? source.enum : undefined;
  const declared = ext(source, 'x-agul-choices') ?? ext(schema, 'x-agul-choices');

  if (Array.isArray(declared)) {
    const choices = declared.flatMap<AgulChoice>((raw) => {
      if (!isRecord(raw)) return [];
      const { value, label, description, icon } = raw;
      if (typeof value !== 'string' && typeof value !== 'number') return [];
      // a declared choice outside the enum would fail validation on the server
      if (allowed && !allowed.includes(value)) return [];
      const choice: AgulChoice = { value, label: typeof label === 'string' ? label : String(value) };
      if (typeof description === 'string') choice.description = description;
      if (typeof icon === 'string') choice.icon = icon;
      return [choice];
    });
    if (choices.length > 0) return choices;
  }

  return (allowed ?? [])
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .map((value) => ({ value, label: String(value) }));
}

function readBands(schema: SchemaObject): AgulScoreBand[] {
  const raw = ext(schema, 'x-agul-bands');
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap<AgulScoreBand>((band) => {
      if (!isRecord(band) || typeof band.min !== 'number' || typeof band.label !== 'string') return [];
      const parsed: AgulScoreBand = { min: band.min, label: band.label };
      if (band.tone === 'positive' || band.tone === 'neutral' || band.tone === 'attention') parsed.tone = band.tone;
      return [parsed];
    })
    .sort((left, right) => left.min - right.min);
}

/** A score inside `minimum`..`maximum` (default 0..100) and the highest `x-agul-bands` entry it reaches. */
export function readScore(schema: SchemaObject, value: unknown): AgulScore | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const min = schema.minimum ?? 0;
  const max = schema.maximum ?? 100;
  if (max <= min) return null;
  const clamped = clamp(value, min, max);
  const score: AgulScore = { value: clamped, min, max, percent: Math.round(((clamped - min) / (max - min)) * 100) };
  const band = readBands(schema).filter((entry) => clamped >= entry.min).pop();
  if (band) score.band = band;
  return score;
}

/** Progress 0..100 and the `x-agul-levels` reached and next, for an XP bar. */
export function readXp(schema: SchemaObject, percent: unknown): AgulXp | null {
  if (typeof percent !== 'number' || Number.isNaN(percent)) return null;
  const value = clamp(Math.round(percent), 0, 100);
  const raw = ext(schema, 'x-agul-levels');
  const levels = (Array.isArray(raw) ? raw : [])
    .flatMap<AgulLevel>((level) =>
      isRecord(level) && typeof level.at === 'number' && typeof level.label === 'string'
        ? [{ at: level.at, label: level.label }]
        : [],
    )
    .sort((left, right) => left.at - right.at);

  const xp: AgulXp = { percent: value };
  const reached = levels.filter((level) => value >= level.at).pop();
  const next = levels.find((level) => value < level.at);
  if (reached) xp.level = reached;
  if (next) xp.next = next;
  return xp;
}
