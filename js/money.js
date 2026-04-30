const Money = (() => {
  // Preload images
  const images = {};
  const denominations = [50000, 10000, 5000, 1000, 500, 100];

  function preload(basePath) {
    denominations.forEach(d => {
      const img = new Image();
      img.src = basePath + d + '.png';
      images[d] = img;
    });
  }

  // ── Bill (지폐) ──────────────────────────────────────────
  class Bill {
    constructor(canvasW, canvasH, windStrength) {
      // Denomination probabilities
      const r = Math.random();
      if (r < 0.30)      this.denom = 1000;
      else if (r < 0.55) this.denom = 5000;
      else if (r < 0.75) this.denom = 10000;
      else               this.denom = 50000;

      const baseW = this.denom === 50000 ? 130 : 115;
      const scale = 0.6 + Math.random() * 1.0;  // 0.6 ~ 1.6배 랜덤
      this.w = baseW * scale;
      this.h = this.w * 0.5;

      // 60% 확률로 화면 중앙 영역, 40% 확률로 가장자리 진입
      if (Math.random() < 0.6) {
        this.x = canvasW * 0.15 + Math.random() * canvasW * 0.7;
        this.y = canvasH * 0.1  + Math.random() * canvasH * 0.8;
      } else {
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) { this.x = Math.random() * canvasW; this.y = -this.h; }
        else if (edge === 1) { this.x = canvasW + this.w; this.y = Math.random() * canvasH; }
        else if (edge === 2) { this.x = Math.random() * canvasW; this.y = canvasH + this.h; }
        else { this.x = -this.w; this.y = Math.random() * canvasH; }
      }

      // 5단계 속도 — 기존 대비 3~5배 상향
      const speedTiers = [4.0, 7.0, 11.0, 16.0, 22.0];
      const speed = speedTiers[Math.floor(Math.random() * speedTiers.length)];
      this.vx = (Math.random() - 0.5) * speed * 2;
      this.vy = (Math.random() - 0.5) * speed * 2;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.025;
      this.windPhase = Math.random() * Math.PI * 2;
      this.windStrength = windStrength;
      this.alive = true;
      this.caught = false;
      this.catchAnim = 0;    // 0..1 for catch animation
      this.catchTarget = null;
      this.alpha = 1;
      this.shimmer = this.denom === 50000;
      this.shimmerT = 0;
      this.waveT = Math.random() * Math.PI * 2;
      this.beatScale = 1.0;   // 박자 반응 스케일 (50000 전용)
    }

    update(dt, time, canvasW, canvasH, windStrength) {
      if (this.caught) {
        this.catchAnim += dt * 4;
        this.alpha = Math.max(0, 1 - this.catchAnim);
        this.rotation += 0.15;
        if (this.catchAnim >= 1) this.alive = false;
        return;
      }

      // Wind force
      const targetVx = Math.sin(time * 0.0008 + this.windPhase) * windStrength;
      const targetVy = Math.cos(time * 0.0006 + this.windPhase + 1) * windStrength * 0.6;
      this.vx += (targetVx - this.vx) * 0.04;
      this.vy += (targetVy - this.vy) * 0.04;

      this.x += this.vx;
      this.y += this.vy;
      this.rotation += this.rotSpeed;

      this.waveT += dt * 3.5;
      if (this.shimmer) this.shimmerT += dt * 2;
      // beatScale 서서히 1.0으로 복귀
      if (this.beatScale !== 1.0) this.beatScale += (1.0 - this.beatScale) * 0.07;

      // Wrap around edges (stay on screen)
      const pad = 60;
      if (this.x < -pad) this.x = canvasW + pad;
      if (this.x > canvasW + pad) this.x = -pad;
      if (this.y < -pad) this.y = canvasH + pad;
      if (this.y > canvasH + pad) this.y = -pad;
    }

    draw(ctx) {
      if (!this.alive) return;
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      // 박자 반응: 5만원권만 스케일 확대
      if (this.denom === 50000 && !this.caught) ctx.scale(this.beatScale, this.beatScale);

      const hw = this.w / 2, hh = this.h / 2;
      const img = images[this.denom];

      if (img && img.complete && img.naturalWidth > 0) {
        // Wavy strip rendering — 세로 슬라이스마다 사인파로 y 오프셋
        const STRIPS = 18;
        const stripW  = this.w / STRIPS;
        const srcStripW = img.naturalWidth / STRIPS;
        const amplitude = 5;  // 파동 높이(px)
        const freq = 2.2;     // 파동 주기

        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 4;

        for (let i = 0; i < STRIPS; i++) {
          const t   = i / STRIPS;
          const dy  = Math.sin(t * Math.PI * freq + this.waveT) * amplitude;
          const dh  = this.h + Math.abs(Math.sin((i + 0.5) / STRIPS * Math.PI * freq + this.waveT)) * amplitude * 0.4;
          ctx.drawImage(
            img,
            i * srcStripW, 0, srcStripW + 1, img.naturalHeight,
            -hw + i * stripW, -hh + dy, stripW + 0.6, dh
          );
          ctx.shadowColor = 'transparent'; // 첫 슬라이스만 그림자
        }

        // 오만원 shimmer
        if (this.shimmer) {
          const sx = Math.sin(this.shimmerT) * this.w;
          const grad = ctx.createLinearGradient(sx - 30, -hh, sx + 30, hh);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(0.5, 'rgba(255,255,255,0.28)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(-hw, -hh - amplitude, this.w, this.h + amplitude * 2);
        }

      } else {
        // Fallback colored rect (이미지 로드 전)
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 4;
        const colors = { 1000: '#90B8D8', 5000: '#D4B898', 10000: '#96C8A0', 50000: '#EDD890' };
        ctx.fillStyle = colors[this.denom] || '#ccc';
        ctx.beginPath();
        ctx.roundRect(-hw, -hh, this.w, this.h, 4);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#333';
        ctx.font = `bold ${this.h * 0.35}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.denom.toLocaleString(), 0, 0);
      }

      ctx.restore();
    }

    hitTest(px, py) {
      // Transform point to local space
      const cos = Math.cos(-this.rotation), sin = Math.sin(-this.rotation);
      const lx = (px - this.x) * cos - (py - this.y) * sin;
      const ly = (px - this.x) * sin + (py - this.y) * cos;
      const hw = this.w / 2 + 20, hh = this.h / 2 + 20;
      return lx >= -hw && lx <= hw && ly >= -hh && ly <= hh;
    }

    catch() {
      if (this.caught) return;
      this.caught = true;
      this.catchAnim = 0;
    }
  }

  // ── Coin (동전) ──────────────────────────────────────────
  class Coin {
    constructor(canvasW, canvasH, difficulty) {
      this.denom = Math.random() < 0.6 ? 100 : 500;
      this.r = this.denom === 500 ? 56 : 66;  // 500원 2배(28→56), 100원 3배(22→66)

      this.x = this.r + Math.random() * (canvasW - this.r * 2);
      this.startX = this.x;
      this.y = -this.r;

      const baseSpeed = this.denom === 500 ? 10 : 8;
      const randomMult = 2.0 + Math.random() * 2.0;  // 2.0 ~ 4.0배 랜덤
      this.vy = (baseSpeed + difficulty * 1.5) * randomMult;
      this.alive = true;
      this.caught = false;
      this.catchAnim = 0;
      this.alpha = 1;
      this.spin = 0;
      this.spinSpeed = (Math.random() - 0.5) * 0.1;
    }

    update(dt, canvasH) {
      if (this.caught) {
        this.catchAnim += dt * 4;
        this.alpha = Math.max(0, 1 - this.catchAnim);
        if (this.catchAnim >= 1) this.alive = false;
        return;
      }
      this.y += this.vy;
      this.spin += this.spinSpeed;
      if (this.y > canvasH + this.r) this.alive = false;
    }

    draw(ctx) {
      if (!this.alive) return;
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.spin);

      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      const img = images[this.denom];
      const d = this.r * 2;
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -this.r, -this.r, d, d);
      } else {
        ctx.fillStyle = this.denom === 500 ? '#C8B040' : '#A0A0A0';
        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${this.r * 0.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.denom, 0, 0);
      }

      ctx.restore();
    }

    hitTest(palmCenter, palmRadius) {
      const dx = this.x - palmCenter.x;
      const dy = this.y - palmCenter.y;
      return Math.sqrt(dx * dx + dy * dy) < palmRadius + this.r;
    }

    catch() {
      if (this.caught) return;
      this.caught = true;
    }
  }

  // ── Manager ──────────────────────────────────────────────
  class MoneyManager {
    constructor() {
      this.bills = [];
      this.coins = [];
      this.lastBillSpawn = 0;
      this.lastCoinSpawn = 0;
    }

    update(dt, time, canvasW, canvasH, config) {
      const { billInterval, coinInterval, maxBills, maxCoins, windStrength, difficulty } = config;

      // Spawn bills
      if (time - this.lastBillSpawn > billInterval && this.bills.filter(b => b.alive && !b.caught).length < maxBills) {
        this.bills.push(new Bill(canvasW, canvasH, windStrength));
        this.lastBillSpawn = time;
      }

      // Spawn coins
      if (time - this.lastCoinSpawn > coinInterval && this.coins.filter(c => c.alive && !c.caught).length < maxCoins) {
        this.coins.push(new Coin(canvasW, canvasH, difficulty));
        this.lastCoinSpawn = time;
      }

      // Update entities
      this.bills.forEach(b => b.update(dt, time, canvasW, canvasH, windStrength));
      this.coins.forEach(c => c.update(dt, canvasH));

      // Clean dead
      this.bills = this.bills.filter(b => b.alive);
      this.coins = this.coins.filter(c => c.alive);
    }

    draw(ctx) {
      this.coins.forEach(c => c.draw(ctx));
      this.bills.forEach(b => b.draw(ctx));
    }

    // Try to catch bills near palm center (fist event)
    tryGrabBill(palmCenter) {
      let closest = null, closestDist = Infinity;
      this.bills.forEach(b => {
        if (!b.caught && b.alive && b.hitTest(palmCenter.x, palmCenter.y)) {
          const dx = b.x - palmCenter.x, dy = b.y - palmCenter.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) { closestDist = dist; closest = b; }
        }
      });
      if (closest) { closest.catch(); return closest.denom; }
      return null;
    }

    // Try to catch a coin at poke position
    tryCatchCoin(pokeCenter, radius = 65) {
      let caught = null;
      for (const c of this.coins) {
        if (c.caught || !c.alive) continue;
        const dx = c.x - pokeCenter.x;
        const dy = c.y - pokeCenter.y;
        if (Math.sqrt(dx * dx + dy * dy) < radius + c.r) {
          c.catch();
          caught = c.denom;
          break;
        }
      }
      return caught;
    }

    // 박자 감지 시 5만원권 크게
    triggerBeat() {
      this.bills.forEach(b => {
        if (b.denom === 50000 && b.alive && !b.caught) b.beatScale = 3.0;
      });
    }

    clear() { this.bills = []; this.coins = []; }
  }

  return { preload, MoneyManager };
})();
