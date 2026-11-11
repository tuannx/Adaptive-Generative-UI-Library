import { sickDay } from './sick-day.js';
import { dinner } from './dinner.js';
import type { GenUiScenario } from './types.js';

export type { GenUiScenario } from './types.js';
export const scenarios: GenUiScenario[] = [sickDay, dinner];
