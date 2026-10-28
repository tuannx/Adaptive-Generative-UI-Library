import { describe, it, expect } from 'vitest';
import { describeApiError, describeResponseError } from './errors.js';

describe('describeResponseError', () => {
  it('turns status and body into one readable line', () => {
    expect(describeResponseError(403, { error: 'forbidden', message: 'Only admins can delete tickets' }).message).toBe(
      "You don't have permission (HTTP 403): Only admins can delete tickets",
    );
    expect(describeResponseError(500, '<html><body><h1>Oops</h1></body></html>').message).toBe('Server error (HTTP 500): Oops');
    expect(describeResponseError(404, undefined).message).toBe('Not found (HTTP 404)');
  });

  it('maps validation errors from common API shapes to form fields', () => {
    expect(describeResponseError(422, { errors: [{ field: 'title', message: 'too short' }] }).fieldErrors).toEqual([
      { name: ['title'], errors: ['too short'] },
    ]);
    expect(describeResponseError(422, { errors: { 'address.city': ['is required'] } }).fieldErrors).toEqual([
      { name: ['address', 'city'], errors: ['is required'] },
    ]);
    expect(describeResponseError(422, { detail: [{ loc: ['body', 'tags', 0], msg: 'bad tag' }] }).fieldErrors).toEqual([
      { name: ['tags', 0], errors: ['bad tag'] },
    ]);
    expect(describeResponseError(400, { violations: [{ propertyPath: 'email', message: 'invalid' }] }).fieldErrors).toEqual([
      { name: ['email'], errors: ['invalid'] },
    ]);
  });
});

describe('describeApiError', () => {
  it('reads axios errors and explains network failures', () => {
    expect(describeApiError({ response: { status: 401, data: { error: 'invalid_token' } } }).message).toBe(
      'Not signed in, or the session expired (HTTP 401): invalid_token',
    );
    expect(describeApiError(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })).message).toMatch(/CORS/);
  });
});
