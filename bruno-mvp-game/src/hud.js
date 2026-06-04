import { formatTime } from './utils.js';

export class Hud {
  constructor() {
    this.speedLabel = document.querySelector('[data-speed]');
    this.nitroFill = document.querySelector('[data-nitro]');
    this.driftLabel = document.querySelector('[data-drift]');
    this.feelLabel = document.querySelector('[data-feel]');
    this.timerLabel = document.querySelector('[data-timer]');
    this.bestLabel = document.querySelector('[data-best]');
    this.runLabel = document.querySelector('[data-run]');
    this.progressFill = document.querySelector('[data-progress]');
    this.message = document.querySelector('#message');
  }

  update(car, trial) {
    const speed = car.state.speed;
    this.speedLabel.textContent = `${Math.round(speed * 3.4)}`;
    this.nitroFill.style.transform = `scaleX(${car.state.nitro})`;
    this.driftLabel.textContent = car.state.drifting ? 'drift' : car.state.onRoad ? 'grip' : 'sand';
    this.feelLabel.textContent = car.state.usingNitro ? 'nitro pull' : car.state.drifting ? 'slide control' : speed > 28 ? 'fast flow' : 'clean grip';
    this.timerLabel.textContent = formatTime(trial.finishedTime || trial.elapsed);
    this.bestLabel.textContent = trial.bestTime ? formatTime(trial.bestTime) : '--:--.---';
    this.runLabel.textContent = trial.statusLabel;
    const visibleProgress = trial.mode === 'ready' || trial.mode === 'countdown' ? 0 : trial.progress;
    this.progressFill.style.transform = `scaleX(${visibleProgress})`;

    if (trial.mode === 'ready') {
      this.showMessage('Coastal Break Run', 'Countdown starts automatically. W/↑ to drive when it drops.');
    } else if (trial.mode === 'countdown') {
      this.showMessage(`${Math.ceil(Math.max(0, trial.countdown))}`, 'Get ready.');
    } else if (trial.mode === 'finished') {
      this.showMessage(trial.newBest ? 'New best time' : 'Run complete', `${formatTime(trial.finishedTime)} · Press R to run it back.`);
    } else {
      this.hideMessage();
    }
  }

  showMessage(title, detail) {
    this.message.querySelector('[data-message-title]').textContent = title;
    this.message.querySelector('[data-message-detail]').textContent = detail;
    this.message.classList.add('show');
  }

  hideMessage() {
    this.message.classList.remove('show');
  }
}
