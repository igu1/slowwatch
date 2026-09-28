# slowwatch

**Only log something when it becomes slow.**

> One small problem. One obvious API. Very little setup. Immediate value.

`console.time` gives you raw numbers. Raw numbers don't tell you whether
performance is getting worse. `slowwatch` watches every labelled execution,
stays silent while things are fast, warns past a budget, and flags
regressions against your own baseline.

## Install

```bash
npm i slowwatch
```

## Usage

```ts
import { slow } from "slowwatch";

const user = await slow("load-user", () => getUser());
// fast → prints nothing
// slow → 🐌 "load-user" took 842ms  (Expected < 200ms)
```

### Thresholds

```ts
slow("load-user", getUser, { warn: 200, error: 1000 });
// 🐌  warning past 200ms
// 🚨  critical past 1s ("Critical threshold is 1s")
```

### Automatic regression detection

After a few baseline runs, a clearly slower execution is flagged:

```
Performance regression

"load-user"

Previous average:  112ms
Current:          391ms

249% slower
```

### Manual timer

```ts
import { start } from "slowwatch";

const timer = start("database-query");
await query();
timer.end(); // records + warns if slow
```

### Decorator

```ts
import { monitorSlow } from "slowwatch";

const loadUser = monitorSlow("load-user", originalLoadUser, { warn: 200 });
```

### Stats

```ts
import { stats } from "slowwatch";

stats("load-user");
// { count, avg, median, p95, min, max, latest }
```

### Configure

```ts
import { configure, slow } from "slowwatch";

configure({
  output: "console",      // or "silent" | "buffer" | your own logger
  defaults: { warn: 500, error: 5000, baseline: true },
});
```

Zero dependencies. ESM + CJS + `.d.ts`. Node >= 18.

## License

MIT
