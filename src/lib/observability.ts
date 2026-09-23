type Metric = string | number | boolean | null | undefined;

/** Pass only identifiers, counters and timings. Never pass prompts, code or errors. */
export function logEvent(
  event: string,
  fields: Record<string, Metric> = {},
): void {
  console.info(
    JSON.stringify({ event, timestamp: new Date().toISOString(), ...fields }),
  );
}
