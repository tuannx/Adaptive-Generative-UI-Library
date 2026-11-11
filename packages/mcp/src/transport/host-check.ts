/** Hostnames a local server answers to by default. Blocks DNS rebinding from web pages. */
export const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];

/** Hostname of a Host header without its port; IPv6 keeps its brackets. */
export function hostnameOf(hostHeader: string | undefined): string | undefined {
  if (!hostHeader) return undefined;
  const value = hostHeader.trim().toLowerCase();
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    return end === -1 ? undefined : value.slice(0, end + 1);
  }
  return value.split(':')[0] || undefined;
}

export function isAllowedHost(hostHeader: string | undefined, allowedHostnames: readonly string[]): boolean {
  const hostname = hostnameOf(hostHeader);
  return !!hostname && allowedHostnames.some((allowed) => allowed.toLowerCase() === hostname);
}
