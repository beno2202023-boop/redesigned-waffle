const POLARITY_LINES = [
  "The drywall isn't a barrier. It's the equator...",
  'Two hands on the same cosmic steering wheel.'
];

const CLARITY_LINES = [
  "The form doesn't matter.",
  "Pick up your fork, buddy. We got work to do."
];

export function drawVortexMeter(ctx, focus, maxFocus) {
  const meterW = 260;
  const meterH = 18;
  const x = 18;
  const y = 14;

  ctx.fillStyle = '#000';
  ctx.fillRect(x - 2, y - 2, meterW + 4, meterH + 4);

  const pct = Math.max(0, Math.min(1, focus / maxFocus));
  ctx.fillStyle = pct > 0.5 ? '#59f3ff' : '#9f9f9f';
  ctx.fillRect(x, y, Math.floor(meterW * pct), meterH);

  ctx.fillStyle = '#e8ebef';
  ctx.font = '14px monospace';
  ctx.fillText(`VORTEX ${Math.round(pct * 100)}%`, x, y + 34);
}

export function drawNateRadio(ctx, focus, tick) {
  const lines = focus > 35 ? POLARITY_LINES : CLARITY_LINES;
  const reveal = Math.floor((tick / 18) % (lines.length + 1));

  ctx.fillStyle = '#101621';
  ctx.fillRect(16, 452, 720, 74);

  ctx.strokeStyle = '#26324d';
  ctx.strokeRect(16, 452, 720, 74);

  ctx.fillStyle = '#8de8ff';
  ctx.font = '12px monospace';
  ctx.fillText('NATE // RADIO', 24, 470);

  ctx.fillStyle = '#d8dfec';
  for (let i = 0; i < reveal; i += 1) {
    ctx.fillText(lines[i], 24, 490 + i * 18);
  }
}

export function drawInventoryAndHint(ctx, inventoryCount, agilityPenalty) {
  ctx.fillStyle = '#d6dbe6';
  ctx.font = '12px monospace';
  ctx.fillText(`HOARD: ${inventoryCount} scraps`, 760, 28);
  ctx.fillText(`AGI PENALTY: -${agilityPenalty.toFixed(1)}`, 760, 46);
  ctx.fillText('SPACE: Yard Sale Shockwave', 760, 64);
}
