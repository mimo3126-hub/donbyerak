const GameMobile = (() => {
  const GAME_DURATION = 60;
  const BANK_PANEL_WIDTH = 180; // exclude from touch zone

  // ── Explosion ──────────────────────────────────────────────
  class Explosion {
    constructor(x, y, denomination) {
      this.alive = true;
      this.particles = [];
      const big = denomination >= 10000;
      const count = big ? 65 : 38;
      const COLORS = ['#FFD700','#FF6B00','#FF4B4B','#FF69B4','#00E5FF','#76FF03','#FF1493','#FFA500','#E040FB','#FFFF00'];

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const speed = (big ? 7 : 4) + Math.random() * (big ? 11 : 8);
        const shape = Math.random() > 0.45 ? 'circle' : 'star';
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (big ? 3 : 1.5),
          life: 1, decay: 0.022 + Math.random() * 0.022,
          size: (big ? 7 : 4.5) + Math.random() * (big ? 9 : 6),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          shape, spin: Math.random() * Math.PI * 2, spinSpeed: (Math.random() - 0.5) * 0.3
        });
      }

      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2;
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * (big ? 18 : 12),
          vy: Math.sin(angle) * (big ? 18 : 12),
          life: 0.75, decay: 0.09,
          size: 4, color: '#FFFFFF', shape: 'circle', spin: 0, spinSpeed: 0
        });
      }

      if (denomination === 50000) {
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          this.particles.push({
            x, y,
            vx: Math.cos(angle) * (3 + Math.random() * 6),
            vy: Math.sin(angle) * (3 + Math.random() * 6) - 4,
            life: 1.2, decay: 0.012,
            size: 3, color: '#FFD700', shape: 'rect',
            spin: Math.random() * Math.PI, spinSpeed: (Math.random() - 0.5) * 0.4
          });
        }
      }
    }

    update() {
      this.particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.28; p.vx *= 0.94; p.vy *= 0.97;
        p.life -= p.decay; p.size *= 0.975; p.spin += p.spinSpeed;
      });
      this.particles = this.particles.filter(p => p.life > 0 && p.size > 0.5);
      this.alive = this.particles.length > 0;
    }

    draw(ctx) {
      this.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        if (p.shape === 'circle') {
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
        } else if (p.shape === 'star') {
          const s = p.size, r = s * 0.4;
          ctx.beginPath();
          for (let j = 0; j < 5; j++) {
            const a1 = (j / 5) * Math.PI * 2 - Math.PI / 2;
            const a2 = (j + 0.5) / 5 * Math.PI * 2 - Math.PI / 2;
            if (j === 0) ctx.moveTo(Math.cos(a1) * s, Math.sin(a1) * s);
            else          ctx.lineTo(Math.cos(a1) * s, Math.sin(a1) * s);
            ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
          }
          ctx.closePath(); ctx.fill();
        } else {
          ctx.fillRect(-p.size * 0.3, -p.size, p.size * 0.6, p.size * 2);
        }
        ctx.restore();
      });
    }
  }

  // ── Game state ──────────────────────────────────────────────
  let canvas, ctx;
  let rafId = null;
  let running = false;
  let startTime = 0;
  let timeLeft = GAME_DURATION;
  let lastFrameTime = 0;
  let manager = null;
  let explosions = [];
  let onEndCb = null;
  let onScoreChangeCb = null;
  let gameInitialized = false;
  let beatEffectTimer = 0;
  let beatBillImg = null;
  let lastBeatInterval = -1;
  let touchEffects = [];

  function getDifficultyConfig(elapsed) {
    if (elapsed < 20) return { billInterval: 700,  coinInterval: 2200, maxBills: 15, maxCoins: 4,  windStrength: 1.5, difficulty: 0, label: '보통', cls: '' };
    if (elapsed < 40) return { billInterval: 500,  coinInterval: 1600, maxBills: 30, maxCoins: 7,  windStrength: 1.8, difficulty: 1, label: '빠름', cls: 'medium' };
    return              { billInterval: 350,  coinInterval: 1100, maxBills: 30, maxCoins: 10, windStrength: 2.6, difficulty: 2, label: '폭풍', cls: 'hard' };
  }

  function init(canvasEl) {
    if (gameInitialized) return;
    gameInitialized = true;

    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    manager = new Money.MoneyManager();
    Money.preload('../assets/images/');

    beatBillImg = new Image();
    beatBillImg.src = '../assets/images/50000.png';

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('touchstart', handleTouch, { passive: false });
  }

  function handleTouch(e) {
    e.preventDefault();
    if (!running) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    for (const touch of e.changedTouches) {
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;

      // Ignore touches in bank panel area
      if (x > canvas.width - BANK_PANEL_WIDTH) continue;

      const center = { x, y };
      let caught = false;

      const billDenom = manager.tryGrabBill(center);
      if (billDenom !== null) {
        Score.add(billDenom);
        Sound.playBillCatch(billDenom);
        if (billDenom === 50000) Sound.playBigCatch();
        explosions.push(new Explosion(x, y, billDenom));
        spawnCatchEffect(x, y, billDenom);
        if (onScoreChangeCb) onScoreChangeCb(billDenom);
        caught = true;
      }

      const coinDenom = manager.tryCatchCoin(center, 80);
      if (coinDenom !== null) {
        Score.add(coinDenom);
        Sound.playCoinCatch();
        explosions.push(new Explosion(x, y, coinDenom));
        spawnCatchEffect(x, y, coinDenom);
        if (onScoreChangeCb) onScoreChangeCb(coinDenom);
        caught = true;
      }

      if (!caught) {
        explosions.push(new Explosion(x, y, 0));
      }

      touchEffects.push({ x, y, r: 0, alpha: 1, caught });
    }
  }

  function start(onEnd, onScoreChange) {
    onEndCb = onEnd;
    onScoreChangeCb = onScoreChange;
    running = true;
    startTime = performance.now();
    timeLeft = GAME_DURATION;
    lastFrameTime = startTime;
    explosions = [];
    touchEffects = [];
    beatEffectTimer = 0;
    lastBeatInterval = -1;
    manager.clear();
    Score.reset();
    Sound.startBGM();
    loop(startTime);
  }

  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    Sound.stopBGM();
  }

  function loop(timestamp) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);

    const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
    lastFrameTime = timestamp;
    const elapsed = (timestamp - startTime) / 1000;
    timeLeft = Math.max(0, GAME_DURATION - elapsed);
    const config = getDifficultyConfig(elapsed);

    // 1. Animated gradient background
    const t = timestamp * 0.0003;
    const grad = ctx.createLinearGradient(0, canvas.height, canvas.width, 0);
    grad.addColorStop(0,   `hsl(${230 + Math.sin(t) * 20}, 60%, 8%)`);
    grad.addColorStop(0.5, `hsl(${270 + Math.cos(t * 0.8) * 15}, 55%, 11%)`);
    grad.addColorStop(1,   `hsl(${200 + Math.sin(t * 1.2) * 18}, 65%, 9%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Beat interval check (every 20 seconds)
    const beatInterval = Math.floor(elapsed / 20);
    if (beatInterval > lastBeatInterval) {
      lastBeatInterval = beatInterval;
      beatEffectTimer = 1600;
    }

    // 3. Money
    manager.update(dt, timestamp, canvas.width, canvas.height, config);
    manager.draw(ctx);

    // 4. Explosions
    explosions.forEach(ex => { ex.update(); ex.draw(ctx); });
    explosions = explosions.filter(ex => ex.alive);

    // 4-1. Beat effect: flashing 5만원 bills left/right
    if (beatEffectTimer > 0) {
      beatEffectTimer -= dt * 1000;
      const visible = Math.floor(timestamp / 130) % 2 === 0;
      if (visible && beatBillImg && beatBillImg.complete) {
        const bw = 130 * 1.5, bh = bw * 0.5;
        const by = canvas.height / 2 - bh / 2;
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.drawImage(beatBillImg, 10, by, bw, bh);
        ctx.translate(canvas.width - BANK_PANEL_WIDTH - 10, by);
        ctx.scale(-1, 1);
        ctx.drawImage(beatBillImg, 0, 0, bw, bh);
        ctx.restore();
      }
    }

    // 5. Touch ripple feedback
    touchEffects = touchEffects.filter(te => te.alpha > 0);
    touchEffects.forEach(te => {
      te.r += 5;
      te.alpha -= 0.05;
      ctx.save();
      ctx.globalAlpha = te.alpha;
      ctx.strokeStyle = te.caught ? '#FFD700' : 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(te.x, te.y, te.r, 0, Math.PI * 2);
      ctx.stroke();
      if (te.r < 20) {
        ctx.globalAlpha = te.alpha * 0.4;
        ctx.fillStyle = te.caught ? '#FFD700' : '#fff';
        ctx.beginPath();
        ctx.arc(te.x, te.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 6. Timer HUD
    const timerEl = document.getElementById('timer-value');
    if (timerEl) {
      timerEl.textContent = Math.ceil(timeLeft);
      timerEl.className = timeLeft <= 10 ? 'urgent' : '';
    }

    const badge = document.getElementById('difficulty-badge');
    if (badge) { badge.textContent = '⚡ ' + config.label; badge.className = config.cls; }

    // 7. End check
    if (timeLeft <= 0) {
      running = false;
      Sound.stopBGM();
      Sound.playGameOver();
      if (onEndCb) setTimeout(onEndCb, 800);
    }
  }

  function spawnCatchEffect(x, y, denom) {
    const el = document.createElement('div');
    el.className = 'catch-effect';
    el.textContent = denom > 0 ? '+' + Score.formatWon(denom) : '💨';
    el.style.left = Math.min(Math.max(x - 40, 10), window.innerWidth - BANK_PANEL_WIDTH - 130) + 'px';
    el.style.top  = Math.max(y - 30, 10) + 'px';
    if (denom === 50000)      { el.style.color = '#FFD700'; el.style.fontSize = '32px'; }
    else if (denom >= 10000)  { el.style.color = '#A8F0A8'; }
    else if (denom >= 1000)   { el.style.color = '#FFF'; }
    else                      { el.style.color = '#88CCFF'; el.style.fontSize = '18px'; }
    document.getElementById('screen-game').appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function getTimeLeft() { return timeLeft; }

  return { init, start, stop, getTimeLeft };
})();
