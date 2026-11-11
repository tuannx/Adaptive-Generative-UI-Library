import { describe, it, expect } from 'vite-plus/test';
import { hostnameOf, isAllowedHost, LOOPBACK_HOSTNAMES } from './host-check.js';

describe('host check', () => {
  it('reads the hostname without the port', () => {
    expect(hostnameOf('localhost:3333')).toBe('localhost');
    expect(hostnameOf('[::1]:3333')).toBe('[::1]');
    expect(hostnameOf('Example.TEST')).toBe('example.test');
    expect(hostnameOf(undefined)).toBeUndefined();
  });

  it('allows loopback names and blocks others', () => {
    expect(isAllowedHost('127.0.0.1:3333', LOOPBACK_HOSTNAMES)).toBe(true);
    expect(isAllowedHost('[::1]:80', LOOPBACK_HOSTNAMES)).toBe(true);
    expect(isAllowedHost('evil.example:3333', LOOPBACK_HOSTNAMES)).toBe(false);
    expect(isAllowedHost(undefined, LOOPBACK_HOSTNAMES)).toBe(false);
  });

  it('allows an extra hostname when listed', () => {
    expect(isAllowedHost('agul.tunnel.test', [...LOOPBACK_HOSTNAMES, 'agul.tunnel.test'])).toBe(true);
  });
});
