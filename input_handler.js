export class InputHandler {
  constructor() {
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      j: false,
      k: false,
      l: false,
      ' ': false,
      arrowup: false,
      arrowleft: false,
      arrowdown: false,
      arrowright: false
    };

    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      this.handleKey(key, true);
      if (key === ' ') {
        event.preventDefault();
      }
    });

    window.addEventListener('keyup', (event) => {
      this.handleKey(event.key.toLowerCase(), false);
    });
  }

  handleKey(key, isPressed) {
    if (Object.prototype.hasOwnProperty.call(this.keys, key)) {
      this.keys[key] = isPressed;
    }
  }

  isDown(key) {
    return Boolean(this.keys[key]);
  }
}
