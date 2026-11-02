export class VisibilityPause {
  constructor({ delay = 30000, onPause, onResume, onError = () => {}, schedule = setTimeout, cancel = clearTimeout }) {
    this.delay = delay;
    this.onPause = onPause;
    this.onResume = onResume;
    this.onError = onError;
    this.schedule = schedule;
    this.cancelTimer = cancel;
    this.hidden = false;
    this.paused = false;
    this.timer = null;
    this.transition = Promise.resolve();
  }

  setHidden(hidden) {
    this.hidden = hidden;
    if (hidden) {
      if (this.timer || this.paused) return;
      this.timer = this.schedule(() => {
        this.timer = null;
        if (!this.hidden || this.paused) return;
        this.paused = true;
        this.queue(this.onPause);
      }, this.delay);
      return;
    }

    this.clearTimer();
    if (!this.paused) return;
    this.paused = false;
    this.queue(this.onResume);
  }

  cancel() {
    this.hidden = false;
    this.paused = false;
    this.clearTimer();
  }

  whenIdle() {
    return this.transition;
  }

  clearTimer() {
    if (!this.timer) return;
    this.cancelTimer(this.timer);
    this.timer = null;
  }

  queue(callback) {
    this.transition = this.transition.then(() => callback()).catch((error) => this.onError(error));
  }
}
