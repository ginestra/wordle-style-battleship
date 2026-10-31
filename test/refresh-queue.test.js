import test from "node:test";
import assert from "node:assert/strict";
import { RefreshQueue } from "../src/assets/js/refresh-queue.js";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test("coalesces a burst of scheduled refreshes", async () => {
  let calls = 0;
  const queue = new RefreshQueue(() => { calls += 1; }, { delay: 10 });
  queue.schedule();
  queue.schedule();
  queue.schedule();
  await wait(30);
  assert.equal(calls, 1);
});

test("runs exactly one follow-up when events arrive during a refresh", async () => {
  let calls = 0;
  let releaseFirst;
  const firstRun = new Promise((resolve) => { releaseFirst = resolve; });
  const queue = new RefreshQueue(async () => {
    calls += 1;
    if (calls === 1) await firstRun;
  }, { delay: 10 });

  const running = queue.runNow();
  await wait(0);
  queue.schedule();
  queue.schedule();
  releaseFirst();
  await running;
  await wait(20);
  assert.equal(calls, 2);
});

test("cancels a refresh that has not started", async () => {
  let calls = 0;
  const queue = new RefreshQueue(() => { calls += 1; }, { delay: 10 });
  queue.schedule();
  queue.cancel();
  await wait(20);
  assert.equal(calls, 0);
});
