export class IntervalTicker {
  constructor(callback, delay, scheduler = globalThis) {
    this.callback = callback;
    this.delay = delay;
    this.scheduler = scheduler;
    this.timer = null;
  }

  start() {
    if (this.timer !== null) return;
    this.timer = this.scheduler.setInterval(this.callback, this.delay);
  }

  stop() {
    if (this.timer === null) return;
    this.scheduler.clearInterval(this.timer);
    this.timer = null;
  }

  get running() {
    return this.timer !== null;
  }
}
