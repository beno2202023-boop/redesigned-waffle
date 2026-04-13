import { renderSecurityHub, SECURITY_HUB_COLLIDERS } from './level_layout.js';
import { drawVortexMeter, drawNateRadio, drawInventoryAndHint } from './ui_renderer.js';
import { resolveWorldCollision, updateEchoBuffer, drawWeapon, intersectsAABB } from './engine_update.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const keys = new Set();
const DELAY_FRAMES = 30;
const MAX_PARTICLES = 24;

const jax = {
  x: 110,
  y: 380,
  w: 24,
  h: 44,
  vx: 0,
  vy: 0,
  onGround: false,
  facing: 1,
  focus: 82,
  focusMax: 100,
  inventory: 0,
  hp: 120,
  attackTick: 0
};

const echo = {
  x: jax.x,
  y: jax.y,
  w: jax.w,
  h: jax.h,
  active: true
};

const enemyPool = Array.from({ length: 12 }, (_, index) => ({
  id: `driller_${index}`,
  active: index < 4,
  x: 620 + index * 54,
  y: 380,
  w: 22,
  h: 40,
  hp: 52,
  vx: 0,
  vy: 0,
  onGround: false,
  facing: -1,
  attackCooldown: 0
}));

const shockwavePool = Array.from({ length: MAX_PARTICLES }, () => ({
  active: false,
  x: 0,
  y: 0,
  radius: 0,
  speed: 0
}));

const delayedSnapshots = [];
let tick = 0;

window.addEventListener('keydown', (event) => {
  keys.add(event.key.toLowerCase());

  if (event.code === 'Space') {
    event.preventDefault();
    triggerYardSaleShockwave();
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});

function clampWorld(entity) {
  entity.x = Math.max(0, Math.min(canvas.width - entity.w, entity.x));
  entity.y = Math.max(0, Math.min(canvas.height - entity.h, entity.y));
}

function collectTrash() {
  if (tick % 90 !== 0) {
    return;
  }

  jax.inventory = Math.min(jax.inventory + 1, 12);
}

function triggerYardSaleShockwave() {
  if (jax.inventory === 0) {
    return;
  }

  const scrapCount = jax.inventory;
  jax.inventory = 0;

  for (let i = 0; i < shockwavePool.length; i += 1) {
    const p = shockwavePool[i];
    if (!p.active) {
      p.active = true;
      p.x = jax.x + jax.w / 2;
      p.y = jax.y + jax.h / 2;
      p.radius = 10;
      p.speed = 3 + Math.min(scrapCount * 0.2, 3);
      break;
    }
  }

  enemyPool.forEach((enemy) => {
    if (!enemy.active) {
      return;
    }

    const dx = enemy.x - jax.x;
    const dist = Math.abs(dx);
    if (dist < 180) {
      enemy.vx += dx >= 0 ? 4.2 : -4.2;
      enemy.hp -= 8;
      if (enemy.hp <= 0) {
        enemy.active = false;
      }
    }
  });
}

function updateShockwaves() {
  for (let i = 0; i < shockwavePool.length; i += 1) {
    const p = shockwavePool[i];
    if (!p.active) {
      continue;
    }

    p.radius += p.speed;
    p.speed *= 0.92;

    if (p.radius > 160 || p.speed < 0.35) {
      p.active = false;
    }
  }
}

function updateJax() {
  const movingLeft = keys.has('a') || keys.has('arrowleft');
  const movingRight = keys.has('d') || keys.has('arrowright');
  const jump = keys.has('w') || keys.has('arrowup');
  const attack = keys.has('j');

  const agilityPenalty = jax.inventory * 0.08;
  const speed = Math.max(1.4, 3.6 - agilityPenalty);

  if (movingLeft) {
    jax.vx -= 0.36;
    jax.facing = -1;
  }
  if (movingRight) {
    jax.vx += 0.36;
    jax.facing = 1;
  }

  jax.vx = Math.max(-speed, Math.min(speed, jax.vx));

  if (jump && jax.onGround) {
    jax.vy = -9.5;
  }

  if (attack && jax.attackTick <= 0) {
    jax.attackTick = 16;
    jax.focus = Math.max(0, jax.focus - 3);

    const hitbox = {
      x: jax.facing > 0 ? jax.x + jax.w : jax.x - 24,
      y: jax.y + 8,
      w: 24,
      h: 22
    };

    enemyPool.forEach((enemy) => {
      if (enemy.active && intersectsAABB(hitbox, enemy)) {
        enemy.hp -= jax.focus > 50 ? 14 : 8;
        enemy.vx += jax.facing * 2.8;
        if (enemy.hp <= 0) {
          enemy.active = false;
          jax.focus = Math.min(jax.focusMax, jax.focus + 6);
        }
      }
    });
  }

  if (jax.attackTick > 0) {
    jax.attackTick -= 1;
  }

  jax.focus -= 0.03 + jax.inventory * 0.002;
  if ((movingLeft || movingRight) && Math.abs(jax.vx) > 2.2) {
    jax.focus += 0.05;
  }
  jax.focus = Math.max(0, Math.min(jax.focusMax, jax.focus));

  resolveWorldCollision(jax, SECURITY_HUB_COLLIDERS);
  clampWorld(jax);

  collectTrash();
}

function updateEnemies() {
  enemyPool.forEach((enemy) => {
    if (!enemy.active) {
      return;
    }

    const dir = jax.x > enemy.x ? 1 : -1;
    enemy.vx += dir * 0.11;
    enemy.vx = Math.max(-1.7, Math.min(1.7, enemy.vx));
    enemy.facing = dir;

    resolveWorldCollision(enemy, SECURITY_HUB_COLLIDERS);
    clampWorld(enemy);

    if (enemy.attackCooldown > 0) {
      enemy.attackCooldown -= 1;
    }

    const near = Math.abs(enemy.x - jax.x) < 28 && Math.abs(enemy.y - jax.y) < 20;
    if (near && enemy.attackCooldown <= 0) {
      jax.hp -= 3;
      jax.focus = Math.max(0, jax.focus - 2);
      enemy.attackCooldown = 40;
    }
  });
}

function updateEcho() {
  const snap = {
    x: jax.x,
    y: jax.y,
    facing: jax.facing,
    focus: jax.focus
  };

  updateEchoBuffer(delayedSnapshots, snap, DELAY_FRAMES + 2);

  if (delayedSnapshots.length > DELAY_FRAMES) {
    const delayed = delayedSnapshots[0];
    echo.x = delayed.x;
    echo.y = delayed.y;
  }
}

function drawEntity(entity, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(entity.x, entity.y, entity.w, entity.h);
  ctx.globalAlpha = 1;
}

function drawShockwaves() {
  for (let i = 0; i < shockwavePool.length; i += 1) {
    const p = shockwavePool[i];
    if (!p.active) {
      continue;
    }

    ctx.strokeStyle = '#ffd25f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function draw() {
  renderSecurityHub(ctx, canvas.width, canvas.height, jax.focus);

  const neon = jax.focus > 50;
  drawEntity(echo, neon ? '#8d53ff' : '#777', 0.3);

  enemyPool.forEach((enemy) => {
    if (enemy.active) {
      drawEntity(enemy, neon ? '#ff5e7c' : '#7e7e7e');
    }
  });

  drawEntity(jax, neon ? '#65fbff' : '#c9c9c9');
  drawWeapon(ctx, jax.x, jax.y, jax.facing, jax.focus);

  drawShockwaves();

  drawVortexMeter(ctx, jax.focus, jax.focusMax);
  drawNateRadio(ctx, jax.focus, tick);
  drawInventoryAndHint(ctx, jax.inventory, jax.inventory * 0.08);

  ctx.fillStyle = '#f1f4fa';
  ctx.font = '12px monospace';
  ctx.fillText(`HP ${Math.max(0, jax.hp)}`, 760, 84);

  if (jax.hp <= 0) {
    ctx.fillStyle = 'rgba(5, 5, 7, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '30px monospace';
    ctx.fillText('CLARITY CRASH // CONTINUE?', 220, 260);
  }
}

function gameLoop() {
  tick += 1;
  updateJax();
  updateEnemies();
  updateEcho();
  updateShockwaves();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
