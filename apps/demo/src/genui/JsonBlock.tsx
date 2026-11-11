/** Read-only, pretty-printed JSON. */
export function JsonBlock({ value }: { value: unknown }) {
  return <pre className="genui-json">{JSON.stringify(value, null, 2)}</pre>;
}
