import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as sw from "../src/index";

beforeEach(() => {
  sw.reset();
  sw.configure({ output: "buffer", now: () => 0 } as never);
});

afterEach(() => {
  sw.resetBuffer();
});

type Ctx = { t: number };

function useClock(ctx: Ctx) {
  sw.configure({ output: "buffer", now: () => ctx.t });
}

function take(): string[] {
  const m = sw.bufferMessages();
  sw.resetBuffer();
  return m;
}

describe("slowwatch", () => {
  it("stays silent for fast executions", async () => {
    const ctx = { t: 0 };
    useClock(ctx);
    ctx.t = 5;
    await sw.slow("fast-task", () => "ok");
    expect(take()).toHaveLength(0);
  });

  it("warns above the warn threshold with expected wording", async () => {
    const ctx = { t: 0 };
    useClock(ctx);
    const p = sw.slow("load-user", () => "u", { warn: 200 });
    ctx.t = 842;
    await p;
    const warned = take();
    expect(warned).toHaveLength(1);
    expect(warned[0]).toContain('"load-user" took 842ms');
    expect(warned[0]).toContain("Expected < 200ms");
  });

  it("escalates to error wording above the error threshold", async () => {
    const ctx = { t: 0 };
    useClock(ctx);
    const p = sw.slow("db-query", () => 1, { warn: 100, error: 500 });
    ctx.t = 1200;
    await p;
    const warned = take();
    expect(warned).toHaveLength(1);
    expect(warned[0]).toContain("🚨");
    expect(warned[0]).toContain("Critical threshold is 500ms");
  });

  it("detects a regression against the running average", async () => {
    const ctx = { t: 0 };
    useClock(ctx);
    // five executions around 100–120ms
    for (const took of [100, 105, 110, 115, 112]) {
      ctx.t = 0;
      const pr = sw.slow("load-user", () => 1);
      ctx.t = took;
      await pr;
      sw.resetBuffer();
    }
    // now a clearly slower run
    ctx.t = 0;
    const pr = sw.slow("load-user", () => 1);
    ctx.t = 391;
    await pr;
    const warned = take();
    expect(warned.some((m) => m.includes("Performance regression"))).toBe(true);
    expect(warned.some((m) => m.includes("% slower"))).toBe(true);
  });

  it("no regression warning with baseline disabled", async () => {
    const ctx = { t: 0 };
    useClock(ctx);
    for (let i = 0; i < 7; i++) {
      ctx.t = 0;
      const pr = sw.slow("t", () => 1, { baseline: false, warn: 10_000 });
      ctx.t = 50;
      await pr;
    }
    expect(take().some((m) => m.includes("regression"))).toBe(false);
  });

  it("timer.end() records and warns manually", () => {
    const ctx = { t: 0 };
    useClock(ctx);
    const timer = sw.start("manual-task", { warn: 100 });
    ctx.t = 320;
    timer.end();
    const warned = take();
    expect(warned).toHaveLength(1);
    expect(warned[0]).toContain('"manual-task" took 320ms');
    expect(sw.stats("manual-task").count).toBe(1);
  });

  it("timer.end() only records once", () => {
    const ctx = { t: 0 };
    useClock(ctx);
    const timer = sw.start("manual-once", { warn: 5 });
    ctx.t = 50;
    const t1 = timer.end();
    const t2 = timer.end();
    expect(t1).toBe(50);
    expect(t2).toBe(0);
  });

  it("monitorSlow wraps and forwards result value", async () => {
    const ctx = { t: 0 };
    useClock(ctx);
    const fn = sw.monitorSlow("wrapped", (x: number) => x * 2);
    ctx.t = 2;
    const out = await fn(21);
    expect(out).toBe(42);
    expect(sw.stats("wrapped").count).toBe(1);
  });

  it("stats computes avg/median/p95/max", async () => {
    const ctx = { t: 0 };
    useClock(ctx);
    for (const took of [10, 20, 30]) {
      ctx.t = 0;
      const pr = sw.slow("s", () => 1);
      ctx.t = took;
      await pr;
    }
    const s = sw.stats("s");
    expect(s.count).toBe(3);
    expect(s.avg).toBe(20);
    expect(s.median).toBe(20);
    expect(s.p95).toBe(30);
    expect(s.max).toBe(30);
    expect(s.latest).toBe(30);
  });

  it("stats for unknown label is zeroed", () => {
    const s = sw.stats("never-seen");
    expect(s.count).toBe(0);
    expect(s.avg).toBe(0);
  });

  it("resets one label or everything", async () => {
    const ctx = { t: 0 };
    useClock(ctx);
    ctx.t = 1;
    await sw.slow("a", () => 1);
    await sw.slow("b", () => 1);
    sw.reset("a");
    expect(sw.stats("a").count).toBe(0);
    expect(sw.stats("b").count).toBe(1);
    sw.reset();
    expect(sw.stats("b").count).toBe(0);
  });

  it("silence option keeps printing off but still records", async () => {
    const ctx = { t: 0 };
    useClock(ctx);
    const pr = sw.slow("quiet", () => 1, { warn: 1, silent: true });
    ctx.t = 900;
    await pr;
    expect(take()).toHaveLength(0);
    expect(sw.stats("quiet").count).toBe(1);
  });
});
