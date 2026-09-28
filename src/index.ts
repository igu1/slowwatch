import {
  clearBuffer,
  configureOutput,
  emit,
  formatRegression,
  formatSlowError,
  formatSlowWarning,
  readBuffer,
} from "./format";
import type { SlowConfig, SlowOptions, SlowStats } from "./types";

const MAX_SAMPLES = 500;
const DEFAULT_WARN = 1000;
const DEFAULT_ERROR = 5000;
const REGRESSION_FACTOR = 2;
const REGRESSION_MIN_SAMPLES = 5;

interface LabelStats {
  samples: number[];
}

const history = new Map<string, LabelStats>();

let now: () => number = () => Date.now();
let defaults: SlowOptions = {};

/** Configure output, clock and default thresholds. */
export function configure(config: SlowConfig = {}) {
  if (config.output) configureOutput(config.output);
  if (config.now) now = config.now;
  if (config.defaults) defaults = { ...defaults, ...config.defaults };
}

/** Warnings/measurements collected in "buffer" mode. */
export function bufferMessages(): string[] {
  return readBuffer();
}

export function resetBuffer(): void {
  clearBuffer();
}

function statsFor(label: string): LabelStats {
  let s = history.get(label);
  if (!s) {
    s = { samples: [] };
    history.set(label, s);
  }
  return s;
}

function record(label: string, took: number): number[] {
  const s = statsFor(label);
  s.samples.push(took);
  if (s.samples.length > MAX_SAMPLES) s.samples.shift();
  return s.samples;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

/** Full stats snapshot for one label. */
export function stats(label: string): SlowStats {
  const samples = history.get(label)?.samples ?? [];
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, x) => acc + x, 0);
  const avg = n ? sum / n : 0;
  const median = percentile(sorted, 50);
  return {
    label,
    count: n,
    avg,
    median,
    p95: percentile(sorted, 95),
    min: n ? sorted[0] : 0,
    max: n ? sorted[n - 1] : 0,
    latest: n ? samples[n - 1] : 0,
  };
}

export function reset(label?: string): void {
  if (label === undefined) history.clear();
  else history.delete(label);
}

/* ------------------------------------------------------------- measure --- */

interface ReportContext {
  label: string;
  took: number;
}

function reportIfSlow({ label, took }: ReportContext, opts: SlowOptions): void {
  if (opts.silent) return;
  const warn = opts.warn ?? DEFAULT_WARN;
  const error = opts.error ?? DEFAULT_ERROR;

  if (error > 0 && took >= error) {
    emit(formatSlowError(label, took, error));
    return;
  }
  if (took >= warn) {
    emit(formatSlowWarning(label, took, warn));
  }
}

function regressionCheck(
  samples: number[],
  took: number,
  label: string,
  opts: SlowOptions,
): void {
  if (opts.baseline === false) return;
  if (samples.length - 1 < REGRESSION_MIN_SAMPLES) return;
  const previous = samples.slice(0, -1);
  const avgPrev = previous.reduce((a, x) => a + x, 0) / previous.length;
  if (avgPrev <= 0) return;
  if (took >= avgPrev * REGRESSION_FACTOR) {
    emit(formatRegression(label, avgPrev, took));
  }
}

/**
 * Time one execution of `fn` (sync or async) and report only when slow.
 *
 * ```ts
 * const user = await slow("load-user", () => getUser());
 * ```
 */
export interface SlowResult<T> {
  value: T;
  took: number;
}

export async function slow<T>(
  label: string,
  fn: () => T | Promise<T>,
  options: SlowOptions = {},
): Promise<T> {
  const opts = { ...defaults, ...options };
  const start = now();
  try {
    return await fn();
  } finally {
    const took = now() - start;
    const samples = record(label, took);
    reportIfSlow({ label, took }, opts);
    regressionCheck(samples, took, label, opts);
  }
}

/** Decorator form: wrap once, call many times. */
export function monitorSlow<ArgsT extends unknown[], R>(
  label: string,
  fn: (...args: ArgsT) => R,
  options: SlowOptions = {},
): (...args: ArgsT) => Promise<R> {
  return async (...args: ArgsT) => slow(label, () => fn(...args), options);
}

export interface Timer {
  end(): number;
}

/** Manual stopwatch label usage. */
export function start(label: string, options: SlowOptions = {}): Timer {
  const opts = { ...defaults, ...options };
  const t0 = now();
  let ended = false;
  return {
    end(): number {
      if (ended) return 0;
      ended = true;
      const took = now() - t0;
      const samples = record(label, took);
      reportIfSlow({ label, took }, opts);
      regressionCheck(samples, took, label, opts);
      return took;
    },
  };
}
