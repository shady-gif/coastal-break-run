export class InputController {
  constructor() {
    this.keys = new Set();
    this.held = {
      throttle: false,
      brake: false,
      left: false,
      right: false,
      drift: false,
      nitro: false
    };
    this.latched = { ...this.held };
    this.restartRequested = false;
    this.startRequested = false;

    window.addEventListener('keydown', (event) => this.setKey(event, true));
    window.addEventListener('keyup', (event) => this.setKey(event, false));
    document.addEventListener('keydown', (event) => this.setKey(event, true));
    document.addEventListener('keyup', (event) => this.setKey(event, false));
    window.addEventListener('blur', () => this.releaseAll());

    for (const button of document.querySelectorAll('[data-hold]')) {
      const action = button.dataset.hold;
      const updateButton = () => {
        button.classList.toggle('active', this.held[action] || this.latched[action]);
      };
      const setHeld = (value) => {
        this.held[action] = value;
        updateButton();
      };

      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        setHeld(true);
        if (action === 'nitro') this.startRequested = true;
      });
      button.addEventListener('click', (event) => {
        event.preventDefault();
        this.latched[action] = !this.latched[action];
        if (action === 'nitro') this.startRequested = true;
        updateButton();
      });
      button.addEventListener('pointerup', () => setHeld(false));
      button.addEventListener('pointercancel', () => setHeld(false));
      button.addEventListener('lostpointercapture', () => setHeld(false));
    }

    document.body.tabIndex = 0;
    document.body.focus();
  }

  setKey(event, isDown) {
    const key = event.key.toLowerCase();
    this.keys[isDown ? 'add' : 'delete'](key);

    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
    }
    if (isDown && key === 'r') this.restartRequested = true;
    if (isDown && (key === 'enter' || key === ' ' || key === 'w' || key === 'arrowup')) {
      this.startRequested = true;
    }
  }

  getInputs(canDrive = true) {
    const throttle = this.keys.has('w') || this.keys.has('arrowup') || this.held.throttle || this.latched.throttle;
    const brake = this.keys.has('s') || this.keys.has('arrowdown') || this.held.brake || this.latched.brake;
    const steerLeft = this.keys.has('a') || this.keys.has('arrowleft') || this.held.left || this.latched.left;
    const steerRight = this.keys.has('d') || this.keys.has('arrowright') || this.held.right || this.latched.right;

    return {
      throttle: canDrive && throttle ? 1 : 0,
      brake: canDrive && brake ? 1 : 0,
      steer: canDrive ? (steerLeft ? 1 : 0) - (steerRight ? 1 : 0) : 0,
      handbrake: canDrive && (this.keys.has('shift') || this.held.drift || this.latched.drift),
      nitro: canDrive && (this.keys.has(' ') || this.held.nitro || this.latched.nitro)
    };
  }

  consumeRestart() {
    const requested = this.restartRequested;
    this.restartRequested = false;
    return requested;
  }

  consumeStart() {
    const requested = this.startRequested;
    this.startRequested = false;
    return requested;
  }

  releaseAll() {
    this.keys.clear();
    Object.keys(this.held).forEach((key) => {
      this.held[key] = false;
      this.latched[key] = false;
    });
    for (const button of document.querySelectorAll('[data-hold]')) {
      button.classList.remove('active');
    }
  }
}
