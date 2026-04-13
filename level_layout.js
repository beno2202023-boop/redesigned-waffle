export function renderSecurityHub(ctx, width, height, focus) {
  const neon = focus > 50;

  ctx.fillStyle = neon ? '#0b1020' : '#4f555e';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = neon ? '#151a2f' : '#606872';
  ctx.fillRect(0, 86, width, 340);

  ctx.fillStyle = neon ? '#141a25' : '#6c737d';
  ctx.fillRect(0, 426, width, height - 426);

  ctx.fillStyle = neon ? '#1a2a55' : '#737b86';
  ctx.fillRect(108, 318, 132, 18);
  ctx.fillRect(472, 300, 120, 14);
  ctx.fillRect(740, 270, 144, 14);

  ctx.fillStyle = neon ? '#5cf2ff' : '#888';
  ctx.fillRect(30, 26, 200, 8);
  ctx.fillStyle = neon ? '#f93fd2' : '#8f8f8f';
  ctx.fillRect(250, 26, 100, 8);
  ctx.fillStyle = neon ? '#ffd65c' : '#9e9e9e';
  ctx.fillRect(370, 26, 140, 8);
}

export const SECURITY_HUB_COLLIDERS = [
  { x: 0, y: 426, w: 960, h: 114 },
  { x: 108, y: 318, w: 132, h: 18 },
  { x: 472, y: 300, w: 120, h: 14 },
  { x: 740, y: 270, w: 144, h: 14 }
];
