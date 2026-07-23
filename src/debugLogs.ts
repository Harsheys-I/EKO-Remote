import type { DebugLogEntry } from "./types";

export function mergeDebugLogs(
  current: DebugLogEntry[],
  incoming: DebugLogEntry[],
  limit = 1000,
): DebugLogEntry[] {
  const bySequence = new Map<number, DebugLogEntry>();
  for (const entry of current) bySequence.set(entry.sequence, entry);
  for (const entry of incoming) bySequence.set(entry.sequence, entry);
  return [...bySequence.values()]
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-Math.max(1, limit));
}
