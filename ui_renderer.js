export class HUD {
  static draw(ctx, canvasWidth, canvasHeight, vortexValue, radioText) {
    const safeVortex = Math.max(0, Math.min(100, vortexValue));

    const meterX = 20;
    const meterY = 20;
    const meterWidth = 200;
    const meterHeight = 15;

    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(meterX, meterY, meterWidth, meterHeight);

    const fillPercentage = safeVortex / 100;
    ctx.fillStyle = fillPercentage > 0.8 ? '#ff00ff' : '#39ff14';
    ctx.fillRect(meterX, meterY, meterWidth * fillPercentage, meterHeight);

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);

    ctx.fillStyle = '#a1a1a1';
    ctx.font = '12px monospace';
    ctx.fillText(`VORTEX ${Math.round(safeVortex)}%`, meterX, meterY + 30);

    if (!radioText) {
      return;
    }

    const boxHeight = 60;
    const boxY = canvasHeight - boxHeight - 20;

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#050505';
    ctx.fillRect(20, boxY, canvasWidth - 40, boxHeight);
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = '#39ff14';
    ctx.font = '16px monospace';

    const text = `NATE (RADIO): ${radioText}`;
    const maxWidth = canvasWidth - 70;
    const words = text.split(' ');
    let line = '';
    let y = boxY + 25;

    for (let i = 0; i < words.length; i += 1) {
      const testLine = `${line}${words[i]} `;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line.trim(), 35, y);
        line = `${words[i]} `;
        y += 18;
        if (y > boxY + boxHeight - 8) {
          return;
        }
      } else {
        line = testLine;
      }
    }

    if (line) {
      ctx.fillText(line.trim(), 35, y);
    }
  }
}
