export interface SlowOptions {
  /** warn above this duration in ms (default 1000) */
  warn?: number;
  /** flag as error above this duration in ms (default 5000) */
  error?: number;
  /** enable regression detection against your own baseline (default true) */
  baseline?: boolean;
  /** suppress all printing (stats still recorded) */
  silent?: boolean;
}

export interface SlowStats {
  label: string;
  count: number;
  avg: number;
  median: number;
  p95: number;
  min: number;
  max: number;
  latest: number;
}

export type Output =
  | "console"
  | "silent"
  | "buffer"
  | ((message: string) => void);

export interface SlowConfig {
  output?: Output;
  /** inject a clock for tests */
  now?: () => number;
  defaults?: SlowOptions;
}
