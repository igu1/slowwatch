const isNode =
  typeof process !== "undefined" && typeof process.stderr !== "undefined";

export const supportsColor: boolean = isNode
  ? Boolean((process.stderr as { isTTY?: boolean }).isTTY)
  : false;

export const c = {
  gray: (s: string) => (supportsColor ? `\x1b[90m${s}\x1b[0m` : s),
  yellow: (s: string) => (supportsColor ? `\x1b[33m${s}\x1b[0m` : s),
  red: (s: string) => (supportsColor ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s: string) => (supportsColor ? `\x1b[2m${s}\x1b[0m` : s),
} as const;

/* ------------------------------------------------------------- outputs --- */

let output: NonNullable<import("./types").SlowConfig["output"]> = "console";
const buffer: string[] = [];

export function configureOutput(next: NonNullable<import("./types").SlowConfig["output"]>): void {
  output = next;
}

export function emit(message: string): void {
  if (output === "console") {
    console.error(`\n${message}`);
  } else if (output === "buffer") {
    buffer.push(message);
  } else if (typeof output === "function") {
    output(message);
  }
}

export function readBuffer(): string[] {
  return buffer.slice();
}

export function clearBuffer(): void {
  buffer.length = 0;
}

/* ------------------------------------------------------------ formatting --- */

export function ms(value: number): string {
  if (!Number.isFinite(value)) return "∞";
  if (value >= 60_000) {
    const m = Math.floor(value / 60_000);
    const s = Math.round((value % 60_000) / 1000);
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  if (value >= 10_000) return `${Math.round((value / 1000) * 10) / 10}s`;
  return `${value >= 100 ? Math.round(value) : Math.round(value * 10) / 10}ms`;
}

export function formatSlowWarning(label: string, took: number, warnMs: number): string {
  const head = c.yellow(`🐌 ${JSON.stringify(label)} took ${ms(took)}`);
  return `${head}\n\nExpected < ${ms(warnMs)}`;
}

export function formatSlowError(label: string, took: number, errorMs: number): string {
  const head = c.red(`🚨 ${JSON.stringify(label)} took ${ms(took)}`);
  return `${head}\n\nCritical threshold is ${ms(errorMs)}`;
}

export function formatRegression(
  label: string,
  previous: number,
  current: number,
): string {
  const pct = Math.round(((current - previous) / previous) * 100);
  const pad = (s: string) => s.padEnd(Math.max(0, 18 - s.length));
  return [
    c.yellow("Performance regression\n"),
    JSON.stringify(label),
    "",
    `${pad("Previous average:")}  ${ms(previous)}`,
    `${pad("Current:")}          ${ms(current)}`,
    "",
    `${pct}% slower`,
  ].join("\n");
}
