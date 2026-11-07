import type { DisplayTone } from '@agul/core';

/** antd preset colours follow the theme tokens, so no hex values here. */
export function toneColor(tone: DisplayTone): string {
  switch (tone) {
    case 'positive':
      return 'success';
    case 'negative':
      return 'error';
    case 'attention':
      return 'warning';
    default:
      return 'default';
  }
}
