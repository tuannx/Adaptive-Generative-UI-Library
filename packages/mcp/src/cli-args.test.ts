import { describe, it, expect } from 'vite-plus/test';
import { parseCliArgs } from './cli-args.js';
import { DEFAULT_HTTP_PORT } from './transport/http.js';

describe('parseCliArgs', () => {
  it('defaults to stdio', () => {
    expect(parseCliArgs([])).toEqual({ transport: 'stdio' });
  });

  it('serves HTTP on loopback by default', () => {
    expect(parseCliArgs(['--http'])).toEqual({ transport: 'http', port: DEFAULT_HTTP_PORT, host: '127.0.0.1', allowedHosts: [] });
  });

  it('reads port, host and repeated allowed hosts', () => {
    expect(parseCliArgs(['--http', '--port', '8080', '--host', '0.0.0.0', '--allowed-host', 'a.test', '--allowed-host', 'b.test'])).toEqual({
      transport: 'http',
      port: 8080,
      host: '0.0.0.0',
      allowedHosts: ['a.test', 'b.test'],
    });
  });

  it('rejects bad input', () => {
    expect(() => parseCliArgs(['--http', '--port', 'abc'])).toThrow('Invalid --port');
    expect(() => parseCliArgs(['--port', '8080'])).toThrow('only apply with --http');
    expect(() => parseCliArgs(['--nope'])).toThrow();
  });
});
