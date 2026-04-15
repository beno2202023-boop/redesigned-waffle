import { renderSecurityHub, SECURITY_HUB_COLLIDERS } from './level_layout.js';
import { resolveWorldCollision, updateEchoBuffer, drawWeapon, intersectsAABB } from './engine_update.js';
import { HUD } from './ui_renderer.js';
import { InputHandler } from './input_handler.js';

const ECHO_DELAY_FRAMES = 30;
const RADIO_LINES = [
  "The drywall isn't a barrier. It's the equator...",
  'You are two hands on the same cosmic steering wheel.',
  "The physical form doesn't matter, it's the intention behind the swing.",
  'Pick up your fork, buddy. We got work to do.'
];

class Level {
  constructor(levelData) {
    this.name = levelData.name;
    this.edges = levelData.edges;
  }

  draw(ctx, canvasWidth, canvasHeight, vortexMeter) {
    renderSecurityHub(ctx, canvasWidth, canvasHeight, vortexMeter);
  }
}

class Fighter {
  constructor(config, isPlayer) {
    this.name = config.name;
    this.isPlayer = isPlayer;
    this.stats = config.stats;
    this.cashDrop = config.cash_drop || 0;

    this.w = 24;
    this.h = 44;
    this.x = isPlayer ? 80 : 760;
    this.y = 340;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = isPlayer ? 1 : -1;
    this.hp = Math.max(1, this.stats.stamina + this.stats.willpower);
    this.attackCooldown = 0;
    this.stunnedFrames = 0;
  }

  getHitbox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  update(dtMs, colliders) {
    const dt = Math.min(2.0, dtMs / 16.67 || 1);
    this.x += this.vx * dt;
    this.vx *= 0.9;

    resolveWorldCollision(this, colliders);

    if (this.attackCooldown > 0) {
      this.attackCooldown -= 1;
    }

    if (this.stunnedFrames > 0) {
      this.stunnedFrames -= 1;
    }
  }

  draw(ctx, vortexMeter) {
    const neon = vortexMeter > 50;
    ctx.fillStyle = this.isPlayer ? (neon ? '#5cf2ff' : '#c2c2c2') : (neon ? '#ff5e7c' : '#7a7a7a');
    ctx.fillRect(this.x, this.y, this.w, this.h);

    if (this.isPlayer) {
      drawWeapon(ctx, this.x, this.y, this.facing, vortexMeter);
    }
  }
}

class RCTweakerEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.lastTime = 0;

    this.currentLevel = null;
    this.entities = [];
    this.vortexMeter = 82;
    this.inputBuffer = [];
    this.playerEcho = { x: 80, y: 340, w: 24, h: 44 };
    this.hoardCount = 0;

    this.input = new InputHandler();
  }

  init(levelData, characterData) {
    this.currentLevel = new Level(levelData.security_hub);
    this.entities.push(new Fighter(characterData.jax, true));
    this.entities.push(new Fighter(characterData.boss_dan, false));

    requestAnimationFrame((time) => this.loop(time));
  }

  get player() {
    return this.entities[0];
  }

  get boss() {
    return this.entities[1];
  }

  loop(timestamp) {
    const deltaTime = Math.min(33, timestamp - this.lastTime || 16.67);
    this.lastTime = timestamp;

    this.update(deltaTime);
    this.draw();

    requestAnimationFrame((time) => this.loop(time));
  }

  update(dt) {
    this.recordInputState();
    this.updatePlayer(dt);
    this.updateEnemy(dt);

    for (let i = 0; i < this.entities.length; i += 1) {
      this.entities[i].update(dt, SECURITY_HUB_COLLIDERS);
    }

    this.handleCollisions();
    this.updateEcho();
  }

  updatePlayer(dt) {
    const moveLeft = this.input.isDown('a') || this.input.isDown('arrowleft');
    const moveRight = this.input.isDown('d') || this.input.isDown('arrowright');
    const jump = this.input.isDown('w') || this.input.isDown('arrowup') || this.input.isDown('l');
    const attackPrimary = this.input.isDown('j');
    const attackSecondary = this.input.isDown('k');
    const yardSale = this.input.isDown(' ');

    const player = this.player;
    const speed = Math.max(1.6, 3.8 - this.hoardCount * 0.12);

    if (moveLeft) {
      player.vx = Math.max(player.vx - 0.35, -speed);
      player.facing = -1;
    }

    if (moveRight) {
      player.vx = Math.min(player.vx + 0.35, speed);
      player.facing = 1;
    }

    if (jump && player.onGround) {
      player.vy = -9.2;
    }

    if (attackPrimary && player.attackCooldown <= 0) {
      this.attack(player, this.boss, this.vortexMeter > 50 ? 14 : 8);
      player.attackCooldown = 16;
      this.vortexMeter = Math.max(0, this.vortexMeter - 2.8);
    }

    if (attackSecondary && player.attackCooldown <= 0) {
      this.attack(player, this.boss, 5);
      this.boss.stunnedFrames = 18;
      player.attackCooldown = 20;
      this.vortexMeter = Math.max(0, this.vortexMeter - 1.5);
    }

    if (yardSale && this.hoardCount > 0) {
      this.vortexMeter = Math.min(100, this.vortexMeter + Math.min(12, this.hoardCount * 1.5));
      this.hoardCount = 0;
    }

    if (Math.floor(this.lastTime / 1000) % 2 === 0) {
      this.hoardCount = Math.min(10, this.hoardCount + 0.01 * dt);
    }

    this.vortexMeter = Math.max(0, Math.min(100, this.vortexMeter - 0.015 * dt));
  }

  updateEnemy() {
    const enemy = this.boss;
    const player = this.player;

    if (enemy.stunnedFrames > 0) {
      return;
    }

    const dir = player.x > enemy.x ? 1 : -1;
    enemy.vx += dir * 0.09;
    enemy.facing = dir;

    const close = Math.abs(player.x - enemy.x) < 30 && Math.abs(player.y - enemy.y) < 24;
    if (close && enemy.attackCooldown <= 0) {
      player.hp -= 3;
      enemy.attackCooldown = 45;
      this.vortexMeter = Math.max(0, this.vortexMeter - 4);
    }
  }

  attack(attacker, defender, damage) {
    const reach = attacker.facing > 0
      ? { x: attacker.x + attacker.w, y: attacker.y + 8, w: 28, h: 20 }
      : { x: attacker.x - 28, y: attacker.y + 8, w: 28, h: 20 };

    if (intersectsAABB(reach, defender.getHitbox())) {
      defender.hp -= damage;
      defender.vx += attacker.facing * 2.6;
      if (defender.hp <= 0) {
        defender.hp = 0;
      }
    }
  }

  handleCollisions() {
    const player = this.player;
    player.x = Math.max(this.currentLevel.edges[0], Math.min(this.currentLevel.edges[1] - player.w, player.x));

    const enemy = this.boss;
    enemy.x = Math.max(this.currentLevel.edges[0], Math.min(this.currentLevel.edges[1] - enemy.w, enemy.x));
  }

  recordInputState() {
    const snapshot = {
      x: this.player.x,
      y: this.player.y,
      facing: this.player.facing,
      vortex: this.vortexMeter
    };

    updateEchoBuffer(this.inputBuffer, snapshot, ECHO_DELAY_FRAMES + 2);
  }

  updateEcho() {
    if (this.inputBuffer.length <= ECHO_DELAY_FRAMES) {
      return;
    }

    const delayed = this.inputBuffer[0];
    this.playerEcho.x = delayed.x;
    this.playerEcho.y = delayed.y;
  }

  pickRadioText() {
    const index = Math.floor(this.lastTime / 4000) % RADIO_LINES.length;
    return RADIO_LINES[index];
  }

  draw() {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.currentLevel.draw(this.ctx, this.canvas.width, this.canvas.height, this.vortexMeter);

    this.ctx.globalAlpha = 0.35;
    this.ctx.fillStyle = this.vortexMeter > 50 ? '#8d53ff' : '#7c7c7c';
    this.ctx.fillRect(this.playerEcho.x, this.playerEcho.y, this.playerEcho.w, this.playerEcho.h);
    this.ctx.globalAlpha = 1;

    this.entities.sort((a, b) => a.y - b.y);
    for (let i = 0; i < this.entities.length; i += 1) {
      this.entities[i].draw(this.ctx, this.vortexMeter);
    }

    HUD.draw(this.ctx, this.canvas.width, this.canvas.height, this.vortexMeter, this.pickRadioText());

    this.ctx.fillStyle = '#e8e8e8';
    this.ctx.font = '12px monospace';
    this.ctx.fillText(`HOARD ${Math.floor(this.hoardCount)} / HP ${this.player.hp}`, 20, 58);

    if (this.player.hp <= 0) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.75)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '28px monospace';
      this.ctx.fillText('CLARITY CRASH // INSERT QUARTER', 180, 260);
    }
  }
}

async function bootstrap() {
  const [levelResponse, characterResponse] = await Promise.all([
    fetch('./levels.json'),
    fetch('./characters.json')
  ]);

  const levelData = await levelResponse.json();
  const characterData = await characterResponse.json();

  const engine = new RCTweakerEngine('game');
  engine.init(levelData, characterData);
}

bootstrap();
