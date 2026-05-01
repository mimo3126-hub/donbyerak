(() => {
  // ── DOM refs ──────────────────────────────────────────────
  const screens = {
    start:     document.getElementById('screen-start'),
    name:      document.getElementById('screen-name'),
    countdown: document.getElementById('screen-countdown'),
    game:      document.getElementById('screen-game'),
    gameover:  document.getElementById('screen-gameover')
  };
  const canvasEl         = document.getElementById('game-canvas');
  const countdownNum     = document.getElementById('countdown-number');
  const countdownTxt     = document.getElementById('countdown-text');
  const btnStart         = document.getElementById('btn-start');
  const btnRetry         = document.getElementById('btn-retry');
  const btnNameConfirm   = document.getElementById('btn-name-confirm');
  const btnNameSkip      = document.getElementById('btn-name-skip');
  const nameInput        = document.getElementById('player-name-input');
  const bankTotal        = document.getElementById('bank-total');
  const missionText      = document.getElementById('mission-text');
  const gameoverScore    = document.getElementById('gameover-score-value');
  const rankingList      = document.getElementById('ranking-list');
  const lrList           = document.getElementById('lr-list');

  // ── 모바일 전용 랭킹 (이름 포함) ─────────────────────────
  const MOBILE_KEY  = 'donbyerak_mobile_ranking';
  const MAX_PLAYERS = 20;

  function getMobilePlayers() {
    try { return JSON.parse(localStorage.getItem(MOBILE_KEY) || '[]'); } catch { return []; }
  }

  function saveMobilePlayer(name, score) {
    const players = getMobilePlayers();
    const entry = { name, score, date: new Date().toLocaleDateString('ko-KR') };
    players.push(entry);
    players.sort((a, b) => b.score - a.score);
    const top = players.slice(0, MAX_PLAYERS);
    try { localStorage.setItem(MOBILE_KEY, JSON.stringify(top)); } catch {}
    return top.findIndex(p => p.name === name && p.score === score) + 1;
  }

  // ── 미션 텍스트 ───────────────────────────────────────────
  const MISSIONS = [
    { min: 5000000, cls: 'high', msg: '🏛️ 마을회관이 눈앞에!!' },
    { min: 3000000, cls: 'high', msg: '🎊 마을 잔치 해볼 수 있겠는데?' },
    { min: 1000000, cls: 'high', msg: '🍗 온 동네 치킨 한 마리씩 쏜다!!' },
    { min:  500000, cls: '',     msg: '🛍️ 마트 장바구니 한가득!' },
    { min:  300000, cls: '',     msg: '🎤 마을 노래방 한 판 충분!' },
    { min:  200000, cls: '',     msg: '☕ 커피 한 잔씩 돌릴 수 있겠다' },
    { min:  100000, cls: '',     msg: '😅 에게~~ 누구 코에 붙여?' },
    { min:   50000, cls: '',     msg: '🤔 오만원... 혼자 밥이나 먹어야지' },
    { min:   10000, cls: '',     msg: '😭 겨우 만원? 더 잡아!!' },
    { min:       1, cls: '',     msg: '😱 빈손으로 갈 거야?' },
    { min:       0, cls: '',     msg: '💰 돈을 잡아라!' },
  ];

  function updateMission(total) {
    if (!missionText) return;
    const m = MISSIONS.find(m => total >= m.min) || MISSIONS[MISSIONS.length - 1];
    missionText.textContent = m.msg;
    missionText.className = 'mission-box' + (m.cls ? ' ' + m.cls : '');
  }

  // ── 은행 UI ───────────────────────────────────────────────
  const bankRows   = {
    50000: document.getElementById('bank-50000'), 10000: document.getElementById('bank-10000'),
    5000:  document.getElementById('bank-5000'),  1000:  document.getElementById('bank-1000'),
    500:   document.getElementById('bank-500'),   100:   document.getElementById('bank-100')
  };
  const bankCounts = {
    50000: document.getElementById('count-50000'), 10000: document.getElementById('count-10000'),
    5000:  document.getElementById('count-5000'),  1000:  document.getElementById('count-1000'),
    500:   document.getElementById('count-500'),   100:   document.getElementById('count-100')
  };
  const bankAmounts = {
    50000: document.getElementById('amt-50000'), 10000: document.getElementById('amt-10000'),
    5000:  document.getElementById('amt-5000'),  1000:  document.getElementById('amt-1000'),
    500:   document.getElementById('amt-500'),   100:   document.getElementById('amt-100')
  };

  let gameInited = false;
  let playerName = '';

  // ── 실시간 랭킹 오버레이 업데이트 ─────────────────────────
  const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.', '6.', '7.'];

  function updateLiveRanking() {
    if (!lrList) return;
    const currentScore = Score.getTotal();
    const currentName  = playerName || '나';
    const stored       = getMobilePlayers();

    // 저장된 플레이어 + 현재 진행 중 점수 합산
    const combined = stored.map(p => ({ ...p, _current: false }));
    // 현재 플레이어가 이미 저장된 경우 제외 (게임 중이므로 아직 저장 안 됨)
    combined.push({ name: currentName, score: currentScore, _current: true });
    combined.sort((a, b) => b.score - a.score);

    const top = combined.slice(0, 7);
    lrList.innerHTML = '';
    top.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'lr-row' + (p._current ? ' lr-current' : '');
      row.innerHTML =
        `<span class="lr-rank">${MEDALS[i] || (i + 1) + '.'}</span>` +
        `<span class="lr-name">${p.name}</span>` +
        `<span class="lr-score">${Score.formatWon(p.score)}</span>`;
      lrList.appendChild(row);
    });
  }

  function showScreen(name) {
    Object.values(screens).forEach(s => { if (s) s.classList.remove('active'); });
    if (screens[name]) screens[name].classList.add('active');
  }

  function resetBankUI() {
    bankTotal.textContent = '₩0';
    Object.keys(bankRows).forEach(d => {
      if (bankCounts[d])  bankCounts[d].textContent  = '× 0';
      if (bankAmounts[d]) bankAmounts[d].textContent = '';
    });
    updateMission(0);
    updateLiveRanking();
  }

  function updateBankUI(newDenom) {
    const catches = Score.getCatches();
    const total   = Score.getTotal();
    bankTotal.textContent = Score.formatWon(total);
    bankTotal.classList.add('pop');
    setTimeout(() => bankTotal.classList.remove('pop'), 200);
    updateMission(total);
    updateLiveRanking();

    Object.keys(bankRows).forEach(d => {
      const denom = +d;
      const cnt = catches[denom] || 0;
      const amt = cnt * denom;
      if (bankCounts[d])  bankCounts[d].textContent  = `× ${cnt}`;
      if (bankAmounts[d]) bankAmounts[d].textContent = amt > 0 ? Score.formatWon(amt) : '';
      if (bankRows[d] && denom === newDenom) {
        bankRows[d].classList.add('just-caught');
        setTimeout(() => bankRows[d] && bankRows[d].classList.remove('just-caught'), 600);
      }
    });
  }

  // ── 카운트다운 ────────────────────────────────────────────
  function runCountdown(callback) {
    showScreen('countdown');
    let count = 3;
    function tick() {
      if (count > 0) {
        Sound.playCountdown(count);
        countdownNum.textContent = count;
        countdownNum.style.animation = 'none';
        void countdownNum.offsetHeight;
        countdownNum.style.animation = 'countPop 0.9s ease-out';
        countdownTxt.textContent = '화면을 준비하세요!';
        count--;
        setTimeout(tick, 950);
      } else {
        Sound.playCountdown(0);
        countdownNum.textContent = '찌르기!';
        countdownNum.style.animation = 'none';
        void countdownNum.offsetHeight;
        countdownNum.style.animation = 'countPop 0.5s ease-out';
        countdownTxt.textContent = '돈을 손가락으로 콕콕!';
        setTimeout(callback, 800);
      }
    }
    tick();
  }

  // ── 게임오버 ──────────────────────────────────────────────
  function showGameOver() {
    const total  = Score.getTotal();
    const myRank = saveMobilePlayer(playerName || '익명', total);
    const players = getMobilePlayers();

    gameoverScore.textContent = Score.formatWon(total);
    gameoverScore.className   = myRank === 1 ? 'gameover-score-value new-record' : 'gameover-score-value';

    rankingList.innerHTML = '';
    players.forEach((p, i) => {
      const rankNum   = i + 1;
      const isCurrent = (p.score === total && p.name === (playerName || '익명') && rankNum === myRank);
      const row = document.createElement('div');
      row.className = `ranking-row rank-${Math.min(rankNum, 3)}${isCurrent ? ' current' : ''}`;
      row.innerHTML =
        `<span class="rank">${rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : rankNum + '.'}</span>` +
        `<span class="score" style="margin-right:6px">${p.name}</span>` +
        `<span class="score">${Score.formatWon(p.score)}</span>` +
        `<span class="date">${p.date}</span>`;
      rankingList.appendChild(row);
    });

    showScreen('gameover');
  }

  // ── 이름 입력 화면 ────────────────────────────────────────
  function showNameScreen() {
    nameInput.value = '';
    showScreen('name');
    setTimeout(() => nameInput.focus(), 300);
  }

  function confirmName() {
    playerName = nameInput.value.trim() || '익명';
    launchGame();
  }

  // ── 전체화면 + 방향 고정 ──────────────────────────────────
  function requestFullscreenLandscape() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (fn) fn.call(el).catch(() => {});
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }

  // ── 게임 실제 시작 ────────────────────────────────────────
  function launchGame() {
    if (!gameInited) {
      GameMobile.init(canvasEl);
      gameInited = true;
    }
    runCountdown(() => {
      showScreen('game');
      resetBankUI();
      GameMobile.start(showGameOver, denom => updateBankUI(denom));
    });
  }

  // ── 홈 화면 추가 안내 ─────────────────────────────────────
  function showInstallHint() {
    const hint = document.getElementById('install-hint');
    if (!hint) return;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: fullscreen)').matches;
    if (isStandalone) { hint.style.display = 'none'; return; }
    if (isIOS)        hint.innerHTML = '📲 Safari 공유 버튼 → <strong>홈 화면에 추가</strong>하면 앱처럼 전체화면으로!';
    else if (isAndroid) hint.innerHTML = '📲 브라우저 메뉴 → <strong>홈 화면에 추가</strong>하면 앱처럼 전체화면으로!';
  }

  // ── 이벤트 바인딩 ─────────────────────────────────────────
  btnStart.addEventListener('click', () => {
    requestFullscreenLandscape();
    Sound.init();
    Sound.resume();
    showNameScreen();
  });

  btnRetry.addEventListener('click', () => {
    Sound.init();
    Sound.resume();
    showNameScreen();
  });

  btnNameConfirm.addEventListener('click', confirmName);

  btnNameSkip.addEventListener('click', () => {
    playerName = '익명';
    launchGame();
  });

  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmName();
  });

  showInstallHint();
  showScreen('start');
})();
