/**
 * Declarative motion config (`x-agul-motion`): how AGUL pages, cards, stats and chat animate.
 *
 * The same shape comes from three places, later wins:
 *   host default (`AGULRenderer motion`) < style provider (LLM / your style API) < `x-agul-motion` in the spec.
 *
 * Every value is an enum or a clamped number, so an LLM can write it and can never inject CSS or JS.
 * Pure and framework-free: a CSS driver, a Motion plugin or a frame-based video driver all read the
 * same {@link ResolvedMotion}.
 */
import type { SchemaObject } from './types.js';

export const MOTION_PRESETS = ['none', 'subtle', 'smooth', 'playful', 'cinematic'] as const;
export type MotionPreset = (typeof MOTION_PRESETS)[number];

export const MOTION_ENTERS = ['none', 'fade', 'slide-up', 'slide-left', 'scale', 'blur-in'] as const;
export type MotionEnter = (typeof MOTION_ENTERS)[number];

export const MOTION_EASES = [
  'standard',
  'emphasized',
  'decelerate',
  'accelerate',
  'linear',
  'spring-soft',
  'spring-bouncy',
] as const;
export type MotionEase = (typeof MOTION_EASES)[number];

export const MOTION_CELEBRATIONS = ['none', 'pulse', 'confetti'] as const;
export type MotionCelebrate = (typeof MOTION_CELEBRATIONS)[number];

export const MOTION_LIST_CHANGES = ['none', 'auto'] as const;
export type MotionListChanges = (typeof MOTION_LIST_CHANGES)[number];

export const MOTION_REDUCED = ['user', 'always', 'never'] as const;
export type MotionReducedMotion = (typeof MOTION_REDUCED)[number];

/** Parts of the UI that can animate differently. */
export const MOTION_REGIONS = ['route', 'cards', 'list', 'stats', 'timeline', 'chat', 'result', 'form'] as const;
export type MotionRegion = (typeof MOTION_REGIONS)[number];

/** Limits applied to every number, whoever wrote it. */
export const MOTION_LIMITS = {
  durationMs: { min: 0, max: 1200 },
  staggerMs: { min: 0, max: 150 },
  /** Items after this index appear together, so long lists stay fast. */
  maxStaggerItems: 24,
  /** Duration cap when the user asked for reduced motion. */
  reducedDurationMs: 150,
} as const;

/** One region's settings; every field optional. */
export interface MotionSettings {
  enter?: MotionEnter;
  ease?: MotionEase;
  /** Milliseconds, clamped to 0–1200. */
  duration?: number;
  /** Milliseconds between items, clamped to 0–150. */
  stagger?: number;
  /** Numbers count up to their value (stats). */
  countUp?: boolean;
  /** Feedback when an action succeeds. */
  celebrate?: MotionCelebrate;
  /** Animate items added, removed or reordered in a list. */
  listChanges?: MotionListChanges;
}

/** The `x-agul-motion` value: settings for every region, plus optional per-region overrides. */
export interface MotionConfig extends MotionSettings {
  preset?: MotionPreset;
  reducedMotion?: MotionReducedMotion;
  regions?: Partial<Record<MotionRegion, MotionSettings>>;
}

/** Concrete values for one region, ready for a driver. */
export interface ResolvedMotion {
  region: MotionRegion;
  enabled: boolean;
  /** True when reduced motion is in effect (user setting or `always`). */
  reduced: boolean;
  enter: MotionEnter;
  ease: MotionEase;
  durationMs: number;
  staggerMs: number;
  countUp: boolean;
  celebrate: MotionCelebrate;
  listChanges: MotionListChanges;
}

type FullSettings = Required<MotionSettings>;

const OFF: FullSettings = {
  enter: 'none',
  ease: 'standard',
  duration: 0,
  stagger: 0,
  countUp: false,
  celebrate: 'none',
  listChanges: 'none',
};

/** Region-wide defaults of each preset. `subtle` is the default when nothing is set. */
export const MOTION_PRESET_SETTINGS: Record<MotionPreset, FullSettings> = {
  none: OFF,
  subtle: { enter: 'fade', ease: 'standard', duration: 180, stagger: 20, countUp: false, celebrate: 'none', listChanges: 'auto' },
  smooth: { enter: 'slide-up', ease: 'decelerate', duration: 260, stagger: 35, countUp: true, celebrate: 'pulse', listChanges: 'auto' },
  playful: { enter: 'scale', ease: 'spring-bouncy', duration: 420, stagger: 45, countUp: true, celebrate: 'confetti', listChanges: 'auto' },
  cinematic: { enter: 'blur-in', ease: 'emphasized', duration: 600, stagger: 70, countUp: true, celebrate: 'pulse', listChanges: 'auto' },
};

export const DEFAULT_MOTION_PRESET: MotionPreset = 'subtle';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function pickEnum<T extends string>(allowed: readonly T[], value: unknown): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function clampNumber(value: unknown, limits: { min: number; max: number }): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.round(Math.min(Math.max(value, limits.min), limits.max));
}

function normalizeSettings(raw: Record<string, unknown>): MotionSettings {
  const settings: MotionSettings = {};
  const enter = pickEnum(MOTION_ENTERS, raw.enter);
  const ease = pickEnum(MOTION_EASES, raw.ease);
  const duration = clampNumber(raw.duration, MOTION_LIMITS.durationMs);
  const stagger = clampNumber(raw.stagger, MOTION_LIMITS.staggerMs);
  const celebrate = pickEnum(MOTION_CELEBRATIONS, raw.celebrate);
  const listChanges = pickEnum(MOTION_LIST_CHANGES, raw.listChanges);
  if (enter) settings.enter = enter;
  if (ease) settings.ease = ease;
  if (duration !== undefined) settings.duration = duration;
  if (stagger !== undefined) settings.stagger = stagger;
  if (typeof raw.countUp === 'boolean') settings.countUp = raw.countUp;
  if (celebrate) settings.celebrate = celebrate;
  if (listChanges) settings.listChanges = listChanges;
  return settings;
}

/**
 * Keeps only valid fields of an untrusted value (spec extension, LLM answer, host prop).
 * A preset name alone (`"playful"`) is accepted as shorthand. Unknown values are dropped, numbers clamped.
 */
export function normalizeMotionConfig(raw: unknown): MotionConfig | undefined {
  if (typeof raw === 'string') {
    const preset = pickEnum(MOTION_PRESETS, raw);
    return preset ? { preset } : undefined;
  }
  if (!isRecord(raw)) return undefined;

  const config: MotionConfig = normalizeSettings(raw);
  const preset = pickEnum(MOTION_PRESETS, raw.preset);
  const reducedMotion = pickEnum(MOTION_REDUCED, raw.reducedMotion);
  if (preset) config.preset = preset;
  if (reducedMotion) config.reducedMotion = reducedMotion;

  if (isRecord(raw.regions)) {
    const regions: Partial<Record<MotionRegion, MotionSettings>> = {};
    for (const region of MOTION_REGIONS) {
      const value = raw.regions[region];
      if (!isRecord(value)) continue;
      const settings = normalizeSettings(value);
      if (Object.keys(settings).length > 0) regions[region] = settings;
    }
    if (Object.keys(regions).length > 0) config.regions = regions;
  }

  return Object.keys(config).length > 0 ? config : undefined;
}

/** Reads `x-agul-motion` from a spec root, an operation's extensions or a schema. */
export function readMotionConfig(source: SchemaObject | Record<string, unknown> | undefined): MotionConfig | undefined {
  return source ? normalizeMotionConfig((source as Record<string, unknown>)['x-agul-motion']) : undefined;
}

/**
 * Merges configs, later wins: pass `(hostDefault, providerAnswer, specConfig)`.
 * A config that names a `preset` starts a new look: fields and regions set before it are dropped,
 * except `reducedMotion`, which is an accessibility choice and carries over unless set again.
 */
export function mergeMotionConfigs(...configs: Array<MotionConfig | undefined>): MotionConfig | undefined {
  const present = configs.filter((config): config is MotionConfig => !!config);
  if (present.length === 0) return undefined;

  let merged: MotionConfig = {};
  for (const config of present) {
    if (config.preset) {
      merged = merged.reducedMotion ? { reducedMotion: merged.reducedMotion } : {};
    }
    const { regions, ...rest } = config;
    Object.assign(merged, rest);
    if (regions) {
      merged.regions = { ...merged.regions };
      for (const [region, settings] of Object.entries(regions) as Array<[MotionRegion, MotionSettings]>) {
        merged.regions[region] = { ...merged.regions[region], ...settings };
      }
    }
  }
  return merged;
}

export interface ResolveMotionOptions {
  /** The viewer's `prefers-reduced-motion: reduce`; hosts read it with `matchMedia`. */
  prefersReducedMotion?: boolean;
}

/**
 * Concrete settings for one region: preset defaults, then the config's own fields, then its region
 * override. Reduced motion keeps at most a short fade and turns off stagger, springs, count-up and celebrations.
 */
export function resolveMotion(
  config: MotionConfig | undefined,
  region: MotionRegion,
  options: ResolveMotionOptions = {},
): ResolvedMotion {
  const preset = config?.preset ?? DEFAULT_MOTION_PRESET;
  const reducedMotion = config?.reducedMotion ?? 'user';
  const own: MotionSettings = config ? normalizeSettings(config as Record<string, unknown>) : {};
  const override = normalizeSettings({ ...config?.regions?.[region] });
  const settings: FullSettings = { ...MOTION_PRESET_SETTINGS[preset], ...own, ...override };

  const reduced = reducedMotion === 'always' || (reducedMotion === 'user' && !!options.prefersReducedMotion);
  const enabled = settings.enter !== 'none' && settings.duration > 0;

  if (reduced) {
    return {
      region,
      enabled,
      reduced,
      enter: enabled ? 'fade' : 'none',
      ease: 'standard',
      durationMs: Math.min(settings.duration, MOTION_LIMITS.reducedDurationMs),
      staggerMs: 0,
      countUp: false,
      celebrate: 'none',
      listChanges: 'none',
    };
  }

  return {
    region,
    enabled,
    reduced,
    enter: settings.enter,
    ease: settings.ease,
    durationMs: settings.duration,
    staggerMs: settings.stagger,
    countUp: settings.countUp,
    celebrate: settings.celebrate,
    listChanges: settings.listChanges,
  };
}

/** Delay before item `index` enters; items past {@link MOTION_LIMITS.maxStaggerItems} share the last delay. */
export function staggerDelayMs(motion: ResolvedMotion, index: number): number {
  if (!motion.enabled || index <= 0) return 0;
  return Math.min(index, MOTION_LIMITS.maxStaggerItems) * motion.staggerMs;
}
