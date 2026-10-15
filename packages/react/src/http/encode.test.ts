import { describe, it, expect } from 'vitest';
import { encodeBody } from './encode.js';

describe('encodeBody', () => {
  it('passes JSON payloads through', () => {
    const payload = { name: 'Rex' };
    expect(encodeBody(payload)).toBe(payload);
  });

  it('uses bracket notation for urlencoded bodies', () => {
    const body = encodeBody(
      { email: 'a@b.co', metadata: { plan: 'pro' }, tags: ['x', 'y'], skip: undefined },
      'application/x-www-form-urlencoded',
    );
    expect(decodeURIComponent(body as string)).toBe('email=a@b.co&metadata[plan]=pro&tags[0]=x&tags[1]=y');
  });

  it('builds FormData for multipart bodies', () => {
    const body = encodeBody({ name: 'Rex', age: 3 }, 'multipart/form-data') as FormData;
    expect(body.get('name')).toBe('Rex');
    expect(body.get('age')).toBe('3');
  });
});
