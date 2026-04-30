const Gesture = (() => {
  let pokeCallbacks = [];

  // Per-hand tracking state
  const handState = {
    Left:  { prevTip: null, lastPokeTime: 0, pokeFlash: 0 },
    Right: { prevTip: null, lastPokeTime: 0, pokeFlash: 0 }
  };

  let fingerTips = []; // Active index-finger tip positions (mirrored canvas coords)

  function onPoke(cb) { pokeCallbacks.push(cb); }

  function update(results, canvasW, canvasH, timestamp) {
    fingerTips = [];
    if (!results.multiHandLandmarks) return;

    results.multiHandLandmarks.forEach((lm, i) => {
      const label = results.multiHandedness?.[i]?.label || 'Right';
      const state = handState[label] || handState.Right;

      // Index finger tip — mirrored x
      const tipLm = lm[8];
      const tip = {
        x: (1 - tipLm.x) * canvasW,
        y: tipLm.y * canvasH,
        handId: label
      };
      fingerTips.push(tip);

      // ── Poke detection: high velocity of index tip ──
      const timeSincePoke = timestamp - state.lastPokeTime;
      if (state.prevTip && timeSincePoke > 320) {
        const dx = tip.x - state.prevTip.x;
        const dy = tip.y - state.prevTip.y;
        const speed = Math.sqrt(dx * dx + dy * dy);

        if (speed > 16) {               // fast finger movement threshold
          state.lastPokeTime = timestamp;
          state.pokeFlash   = timestamp;
          pokeCallbacks.forEach(cb => cb({ center: { x: tip.x, y: tip.y }, handId: label }));
        }
      }

      state.prevTip = { x: tip.x, y: tip.y };
    });
  }

  function getFingerTips() { return fingerTips; }

  // Draw glowing cursor at index finger tip
  function drawCursors(ctx, timestamp) {
    fingerTips.forEach(tip => {
      const label = tip.handId;
      const state = handState[label] || handState.Right;
      const sinceFlash = timestamp - state.pokeFlash;
      const isFlashing = sinceFlash < 200;

      ctx.save();

      // Poke flash ring
      if (isFlashing) {
        const flashAlpha = 1 - sinceFlash / 200;
        const flashR = 18 + (sinceFlash / 200) * 40;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, flashR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 230, 0, ${flashAlpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Outer glow
      const pulse = (Math.sin(timestamp * 0.009) + 1) * 0.5;
      const grd = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 24 + pulse * 6);
      grd.addColorStop(0,   'rgba(255,255,80,0.35)');
      grd.addColorStop(0.5, 'rgba(255,200,0,0.18)');
      grd.addColorStop(1,   'rgba(255,200,0,0)');
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 24 + pulse * 6, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Inner dot
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, isFlashing ? 11 : 8, 0, Math.PI * 2);
      ctx.fillStyle = isFlashing ? '#FFF' : 'rgba(255,235,0,0.92)';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 14;
      ctx.fill();

      // White center point
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Cross-hair lines
      ctx.strokeStyle = 'rgba(255,240,0,0.65)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(tip.x - 18, tip.y); ctx.lineTo(tip.x - 11, tip.y);
      ctx.moveTo(tip.x + 11, tip.y); ctx.lineTo(tip.x + 18, tip.y);
      ctx.moveTo(tip.x, tip.y - 18); ctx.lineTo(tip.x, tip.y - 11);
      ctx.moveTo(tip.x, tip.y + 11); ctx.lineTo(tip.x, tip.y + 18);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    });
  }

  return { onPoke, update, getFingerTips, drawCursors };
})();
