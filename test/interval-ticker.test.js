import test from "node:test";
import assert from "node:assert/strict";
import { IntervalTicker } from "../src/assets/js/interval-ticker.js";

function setup() {
  let callback;
  let starts = 0;
  let stops = 0;
  const scheduler = {
    setInterval(next) { starts += 1; callback = next; return starts; },
    clearInterval() { stops += 1; callback = null; }
  };
  let ticks = 0;
  const ticker = new IntervalTicker(() => { ticks += 1; }, 60000, scheduler);
  return { ticker, run: () => callback?.(), counts: () => ({ starts, stops, ticks }) };
}

test("starts only one interval and stops it cleanly", () => {
  const { ticker, run, counts } = setup();
  ticker.start();
  ticker.start();
  run();
  assert.equal(ticker.running, true);
  assert.deepEqual(counts(), { starts: 1, stops: 0, ticks: 1 });

  ticker.stop();
  ticker.stop();
  run();
  assert.equal(ticker.running, false);
  assert.deepEqual(counts(), { starts: 1, stops: 1, ticks: 1 });
});

test("can restart after being stopped", () => {
  const { ticker, counts } = setup();
  ticker.start();
  ticker.stop();
  ticker.start();
  assert.equal(ticker.running, true);
  assert.deepEqual(counts(), { starts: 2, stops: 1, ticks: 0 });
});
