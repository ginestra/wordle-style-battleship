export class RefreshQueue {
  constructor(task, { delay = 100 } = {}) {
    this.task = task;
    this.delay = delay;
    this.timer = null;
    this.pending = false;
    this.active = null;
  }

  schedule() {
    this.pending = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.drain();
    }, this.delay);
  }

  async runNow() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = true;
    await this.drain();
  }

  cancel() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = false;
  }

  async drain() {
    if (this.active) {
      await this.active;
      if (this.pending) await this.drain();
      return;
    }
    if (!this.pending) return;

    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = false;
    this.active = Promise.resolve().then(() => this.task());
    try {
      await this.active;
    } finally {
      this.active = null;
    }
    if (this.pending) await this.drain();
  }
}
