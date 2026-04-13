const GRAVITY = 0.48;
const GROUND_FRICTION = 0.8;
const AIR_FRICTION = 0.96;

export function intersectsAABB(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function updateEchoBuffer(buffer, snapshot, maxFrames) {
  if (buffer.length >= maxFrames) {
    buffer.shift();
  }
  buffer.push(snapshot);
}

export function resolveWorldCollision(entity, colliders) {
  entity.vy += GRAVITY;
  entity.x += entity.vx;
  entity.y += entity.vy;
  entity.onGround = false;

  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    if (!intersectsAABB(entity, c)) {
      continue;
    }

    const prevBottom = entity.y + entity.h - entity.vy;
    const colliderTop = c.y;

    if (prevBottom <= colliderTop + 2 && entity.vy >= 0) {
      entity.y = c.y - entity.h;
      entity.vy = 0;
      entity.onGround = true;
    }
  }

  if (entity.onGround) {
    entity.vx *= GROUND_FRICTION;
  } else {
    entity.vx *= AIR_FRICTION;
  }
}

export function drawWeapon(ctx, x, y, facing, focus) {
  ctx.strokeStyle = focus > 50 ? '#59f3ff' : '#d8d8d8';
  ctx.lineWidth = focus > 50 ? 4 : 3;
  ctx.beginPath();

  const dir = facing >= 0 ? 1 : -1;
  const startX = x + 12;
  const startY = y + 20;

  ctx.moveTo(startX, startY);

  if (focus > 50) {
    ctx.lineTo(startX + dir * 26, startY - 6);
    ctx.lineTo(startX + dir * 40, startY - 1);
  } else {
    ctx.lineTo(startX + dir * 18, startY + 2);
    ctx.lineTo(startX + dir * 28, startY + 10);
  }

  ctx.stroke();
}
