const Game = (() => {
  const GAME_DURATION = 60;

  // ── Explosion particle system ──────────────────────────────
  class Explosion {
    constructor(x, y, denomination) {
      this.alive = true;
      this.particles = [];
      const big = denomination >= 10000;
      const count = big ? 65 : 38;
      const COLORS = ['#FFD700','#FF6B00','#FF4B4B','#FF69B4','#00E5FF','#76FF03','#FF1493','#FFA500','#E040FB','#FFFF00'];

      // Burst particles
      for (let i = 0; i < count; i++) {
        const angle  = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const speed  = (big ? 7 : 4) + Math.random() * (big ? 11 : 8);
        const shape  = Math.random() > 0.45 ? 'circle' : 'star';
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (big ? 3 : 1.5),
          life: 1,
          decay: 0.022 + Math.random() * 0.022,
          size: (big ? 7 : 4.5) + Math.random() * (big ? 9 : 6),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          shape,
          spin: Math.random() * Math.PI * 2,
          spinSpeed: (Math.random() - 0.5) * 0.3
        });
      }

      // Radial ring flash
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2;
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * (big ? 18 : 12),
          vy: Math.sin(angle) * (big ? 18 : 12),
          life: 0.75, decay: 0.09,
          size: 4, color: '#FFFFFF', shape: 'circle',
          spin: 0, spinSpeed: 0
        });
      }

      // 오만원 special: gold streamers
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
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.28;   // gravity
        p.vx *= 0.94;
        p.vy *= 0.97;
        p.life -= p.decay;
        p.size *= 0.975;
        p.spin += p.spinSpeed;
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
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'star') {
          const s = p.size, r = s * 0.4;
          ctx.beginPath();
          for (let j = 0; j < 5; j++) {
            const a1 = (j / 5)       * Math.PI * 2 - Math.PI / 2;
            const a2 = (j + 0.5) / 5 * Math.PI * 2 - Math.PI / 2;
            if (j === 0) ctx.moveTo(Math.cos(a1) * s, Math.sin(a1) * s);
            else          ctx.lineTo(Math.cos(a1) * s, Math.sin(a1) * s);
            ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-p.size * 0.3, -p.size, p.size * 0.6, p.size * 2);
        }
        ctx.restore();
      });
    }
  }

  // ── Game state ─────────────────────────────────────────────
  let canvas, ctx, videoEl;
  let rafId = null;
  let running = false;
  let startTime = 0;
  let timeLeft = GAME_DURATION;
  let lastFrameTime = 0;
  let handResults = null;
  let manager = null;
  let explosions = [];
  let onEndCb = null;
  let onScoreChangeCb = null;
  let gameInitialized = false;
  let lastBeatTime = 0;
  let beatAvg = 0;
  let beatEffectTimer = 0;    // ms 남은 시간
  let beatBillImg = null;     // 5만원 이미지 (비트 연출용)
  let lastBeatInterval = -1;  // 20초 단위 인터벌 추적

  function getDifficultyConfig(elapsed) {
    if (elapsed < 20) return { billInterval:700,  coinInterval:2200, maxBills:30, maxCoins:4,  windStrength:1.5, difficulty:0, label:'보통', cls:'' };
    if (elapsed < 40) return { billInterval:500,  coinInterval:1600, maxBills:35, maxCoins:7,  windStrength:1.8, difficulty:1, label:'빠름', cls:'medium' };
    return              { billInterval:350,  coinInterval:1100, maxBills:50, maxCoins:10, windStrength:2.6, difficulty:2, label:'폭풍', cls:'hard' };
  }

  function init(canvasEl, videoElement) {
    if (gameInitialized) return;
    gameInitialized = true;

    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    videoEl = videoElement;
    manager = new Money.MoneyManager();
    Money.preload('assets/images/');

    // 비트 연출용 5만원 이미지 사전 로드
    beatBillImg = new Image();
    beatBillImg.src = 'assets/images/50000.png';

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    // ── 콕콕 찌르기: 지폐 + 동전 모두 잡기 ──
    Gesture.onPoke(({ center }) => {
      if (!running) return;

      let caught = false;

      // Try bill
      const billDenom = manager.tryGrabBill(center);
      if (billDenom !== null) {
        Score.add(billDenom);
        Sound.playBillCatch(billDenom);
        if (billDenom === 50000) Sound.playBigCatch();
        explosions.push(new Explosion(center.x, center.y, billDenom));
        spawnCatchEffect(center.x, center.y, billDenom);
        if (onScoreChangeCb) onScoreChangeCb(billDenom);
        caught = true;
      }

      // Try coin
      const coinDenom = manager.tryCatchCoin(center, 65);
      if (coinDenom !== null) {
        Score.add(coinDenom);
        Sound.playCoinCatch();
        explosions.push(new Explosion(center.x, center.y, coinDenom));
        spawnCatchEffect(center.x, center.y, coinDenom);
        if (onScoreChangeCb) onScoreChangeCb(coinDenom);
        caught = true;
      }

      // Miss effect (small poke burst even if nothing caught)
      if (!caught) {
        explosions.push(new Explosion(center.x, center.y, 0));
      }
    });
  }

  function start(onEnd, onScoreChange) {
    onEndCb = onEnd;
    onScoreChangeCb = onScoreChange;
    running = true;
    startTime = performance.now();
    timeLeft = GAME_DURATION;
    lastFrameTime = startTime;
    explosions = [];
    lastBeatTime = 0;
    beatAvg = 0;
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

  function setHandResults(results) { handResults = results; }

  function loop(timestamp) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);

    const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
    lastFrameTime = timestamp;
    const elapsed = (timestamp - startTime) / 1000;
    timeLeft = Math.max(0, GAME_DURATION - elapsed);
    const config = getDifficultyConfig(elapsed);

    // 1. Webcam (mirrored)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(videoEl, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Update gesture
    if (handResults) {
      Gesture.update(handResults, canvas.width, canvas.height, timestamp);
    }

    // 2-1. 매 20초마다 좌우 5만원권 깜빡이 연출
    const beatInterval = Math.floor(elapsed / 20);
    if (beatInterval > lastBeatInterval) {
      lastBeatInterval = beatInterval;
      beatEffectTimer = 1600; // 1.6초간 연출
    }

    // 3. Update & draw money
    manager.update(dt, timestamp, canvas.width, canvas.height, config);
    manager.draw(ctx);

    // 4. Update & draw explosions
    explosions.forEach(ex => { ex.update(); ex.draw(ctx); });
    explosions = explosions.filter(ex => ex.alive);

    // 4-1. 비트 연출: 좌우 5만원권 깜빡이
    if (beatEffectTimer > 0) {
      beatEffectTimer -= dt * 1000;
      const visible = Math.floor(timestamp / 130) % 2 === 0; // 130ms마다 깜빡
      if (visible && beatBillImg && beatBillImg.complete) {
        const bw = 130 * 3;   // 3배 크기
        const bh = bw * 0.5;
        const by = canvas.height / 2 - bh / 2;
        ctx.save();
        ctx.globalAlpha = 0.92;
        // 왼쪽
        ctx.drawImage(beatBillImg, 10, by, bw, bh);
        // 오른쪽 (좌우 반전)
        ctx.translate(canvas.width - 10, by);
        ctx.scale(-1, 1);
        ctx.drawImage(beatBillImg, 0, 0, bw, bh);
        ctx.restore();
      }
    }

    // 5. Draw finger cursors
    Gesture.drawCursors(ctx, timestamp);

    // 6. Timer HUD
    const timerEl = document.getElementById('timer-value');
    if (timerEl) {
      timerEl.textContent = Math.ceil(timeLeft);
      timerEl.className = timeLeft <= 10 ? 'urgent' : '';
    }

    // 7. Difficulty badge
    const badge = document.getElementById('difficulty-badge');
    if (badge) { badge.textContent = '⚡ ' + config.label; badge.className = config.cls; }

    // 8. End check
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
    el.style.left = Math.min(Math.max(x - 40, 10), window.innerWidth - 130) + 'px';
    el.style.top  = Math.max(y - 30, 10) + 'px';
    if (denom === 50000)      { el.style.color = '#FFD700'; el.style.fontSize = '40px'; }
    else if (denom >= 10000)  { el.style.color = '#A8F0A8'; }
    else if (denom >= 1000)   { el.style.color = '#FFF'; }
    else                      { el.style.color = '#88CCFF'; el.style.fontSize = '22px'; }
    document.getElementById('screen-game').appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function getTimeLeft() { return timeLeft; }

  return { init, start, stop, setHandResults, getTimeLeft };
})();
