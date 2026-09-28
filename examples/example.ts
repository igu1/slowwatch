import * as sw from "../src/index";

const dim = (s: string) => `\x1b[90m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

let t = 0;
sw.configure({ now: () => t, output: "buffer" });
const take = () => {
  const msgs = sw.bufferMessages();
  sw.resetBuffer();
  return msgs;
};

console.log(dim("$ npm i slowwatch\n"));

console.log(green("1. fast — nothing is printed\n"));
t = 0;
const p1 = sw.slow("s-fast", () => "u", { warn: 200 });
t = 41;
await p1;
console.log(take()[0] ?? "(silent)");

console.log(green("\n2. slow — you get exactly one line + the budget\n"));
t = 0;
const p2 = sw.slow("s-slow", () => "u", { warn: 200 });
t = 842;
await p2;
console.log(take()[0]);

console.log(green("\n3. critical threshold\n"));
t = 0;
const p3 = sw.slow("s-crit", () => 1, { warn: 200, error: 1000 });
t = 1203;
await p3;
console.log(take()[0]);

console.log(green("\n4. regression detection after a few baseline runs\n"));
for (const sample of [100, 105, 110, 115, 112]) {
  t = 0;
  const p = sw.slow("s-reg", () => "u", { warn: 1000 });
  t = sample;
  await p;
}
t = 0;
const p4 = sw.slow("s-reg", () => "u", { warn: 1000 });
t = 391;
await p4;
for (const m of take()) console.log(m);

console.log(green("\n5. stats\n"));
const s = sw.stats("s-reg");
console.table({
  count: s.count,
  avg: Math.round(s.avg),
  median: s.median,
  p95: s.p95,
  max: s.max,
  latest: s.latest,
});
