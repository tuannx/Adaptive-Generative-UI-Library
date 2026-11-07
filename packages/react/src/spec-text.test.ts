import { describe, expect, it } from 'vite-plus/test';
import { parseSpecText } from './AGULRenderer.js';

describe('parseSpecText', () => {
  it('reads JSON', async () => {
    expect(await parseSpecText('{"openapi":"3.0.0"}')).toEqual({ openapi: '3.0.0' });
  });

  it('reads YAML and applies << merge keys', async () => {
    const doc = await parseSpecText('base: &b {type: string}\nname:\n  <<: *b\n  maxLength: 5\n');
    expect(doc.name).toEqual({ type: 'string', maxLength: 5 });
  });

  it('keeps dates as strings, like JSON', async () => {
    expect((await parseSpecText('example: 2024-01-01\n')).example).toBe('2024-01-01');
  });

  it('rejects a YAML scalar', async () => {
    await expect(parseSpecText('just text\n')).rejects.toThrow();
  });
});
