const BEST_KEY = 'coastal-time-trial-best';

export class TimeTrial {
  constructor(track) {
    this.track = track;
    this.bestTime = Number(localStorage.getItem(BEST_KEY)) || null;
    this.reset();
  }

  reset() {
    this.mode = 'ready';
    this.countdown = 3;
    this.elapsed = 0;
    this.finishedTime = null;
    this.progress = 0;
    this.previousProgress = 0;
    this.crossedHalfway = false;
    this.newBest = false;
  }

  startCountdown() {
    if (this.mode === 'ready') {
      this.mode = 'countdown';
      this.countdown = 3;
    }
  }

  update(delta, carPosition) {
    this.previousProgress = this.progress;
    this.progress = this.track.getProgress(carPosition);

    if (this.mode === 'countdown') {
      this.countdown -= delta;
      if (this.countdown <= 0) {
        this.mode = 'running';
        this.elapsed = 0;
      }
    }

    if (this.mode !== 'running') return;

    this.elapsed += delta;
    if (this.progress > 0.48) this.crossedHalfway = true;

    const crossedFinish = this.crossedHalfway && this.previousProgress > 0.86 && this.progress < 0.14;
    if (crossedFinish && this.elapsed > 15) {
      this.finish();
    }
  }

  finish() {
    this.mode = 'finished';
    this.finishedTime = this.elapsed;
    this.newBest = !this.bestTime || this.finishedTime < this.bestTime;
    if (this.newBest) {
      this.bestTime = this.finishedTime;
      localStorage.setItem(BEST_KEY, String(this.bestTime));
    }
  }

  get canDrive() {
    return this.mode === 'running';
  }

  get statusLabel() {
    if (this.mode === 'ready') return 'Press W';
    if (this.mode === 'countdown') return Math.ceil(Math.max(0, this.countdown));
    if (this.mode === 'finished') return this.newBest ? 'New best' : 'Finished';
    return 'Run';
  }
}
