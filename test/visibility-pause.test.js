import test from "node:test";
import assert from "node:assert/strict";
import { VisibilityPause } from "../src/assets/js/visibility-pause.js";

function setup() {
  let scheduled;
  let pauses = 0;
  let resumes = 0;
  const controller = new VisibilityPause({
    delay: 30000,
    onPause: () => { pauses += 1; },
    onResume: () => { resumes += 1; },
    schedule: (callback) => { scheduled = callback; return 1; },
    cancel: () => { scheduled = null; }
  });
  return { controller, runTimer: () => scheduled?.(), counts: () => ({ pauses, resumes }) };
}

test("does not pause when the page returns within the grace period", async () => {
  const { controller, runTimer, counts } = setup();
  controller.setHidden(true);
  controller.setHidden(false);
  runTimer();
  await controller.whenIdle();
  assert.deepEqual(counts(), { pauses: 0, resumes: 0 });
});

test("pauses after the grace period and resumes once visible", async () => {
  const { controller, runTimer, counts } = setup();
  controller.setHidden(true);
  runTimer();
  await controller.whenIdle();
  assert.deepEqual(counts(), { pauses: 1, resumes: 0 });

  controller.setHidden(false);
  await controller.whenIdle();
  assert.deepEqual(counts(), { pauses: 1, resumes: 1 });
});

test("serialises a resume behind an in-progress pause", async () => {
  let releasePause;
  const order = [];
  let scheduled;
  const controller = new VisibilityPause({
    onPause: async () => { order.push("pause-start"); await new Promise((resolve) => { releasePause = resolve; }); order.push("pause-end"); },
    onResume: () => { order.push("resume"); },
    schedule: (callback) => { scheduled = callback; return 1; },
    cancel: () => {}
  });

  controller.setHidden(true);
  scheduled();
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.setHidden(false);
  releasePause();
  await controller.whenIdle();
  assert.deepEqual(order, ["pause-start", "pause-end", "resume"]);
});
