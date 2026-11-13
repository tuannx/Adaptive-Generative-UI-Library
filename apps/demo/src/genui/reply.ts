/** Turns the confirm call's rows ({ step, result, status }) into a short chat reply. */
export interface ReplyLine {
  text: string;
  done: boolean;
}

export interface Reply {
  lead: string;
  lines: ReplyLine[];
}

const isRow = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function summarizeSteps(value: unknown): Reply | null {
  if (!Array.isArray(value) || !value.every(isRow)) return null;
  const lines = value.map((row) => ({ text: typeof row.result === 'string' ? row.result : '', done: row.status === 'done' }));
  const done = lines.filter((line) => line.done).length;
  const lead =
    done === lines.length
      ? `Done. All ${done} are taken care of.`
      : done === 0
        ? 'Nothing was sent.'
        : `Done. ${done} of ${lines.length} sent, the rest skipped as you asked.`;
  return { lead, lines };
}
