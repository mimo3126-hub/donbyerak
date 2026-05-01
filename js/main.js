(() => {
  // ── DOM refs ──
  const screens = {
    start:     document.getElementById('screen-start'),
    name:      document.getElementById('screen-name'),
    countdown: document.getElementById('screen-countdown'),
    game:      document.getElementById('screen-game'),
    gameover:  document.getElementById('screen-gameover')
  };
  const videoEl        = document.getElementById('webcam');
  const canvasEl       = document.getElementById('game-canvas');
  const countdownNum   = document.getElementById('countdown-number');
  const countdownTxt   = document.getElementById('countdown-text');
  const btnStart       = document.getElementById('btn-start');
  const btnRetry       = document.getElementById('btn-retry');
  const btnNameConfirm = document.getElementById('btn-name-confirm');
  const btnNameSkip    = document.getElementById('btn-name-skip');
  const nameInput      = document.getElementById('player-name-input');
  const bankTotal      = document.getElementById('bank-total');
  const missionText    = document.getElementById('mission-text');
  const gameoverScore  = document.getElementById('gameover-score-value');
  const rankingList    = document.getElementById('ranking-list');
  const lrList         = document.getElementById('lr-list');

  // ── 공유 랭킹 (PC + 모바일 동일 key) ──────────────────────
  const PLAYERS_KEY = 'donbyerak_mobile_ranking';
  const MAX_PLAYERS = 20;
  const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.', '6.', '7.'];

  let playerName = '';

  function getMobilePlayers() {
    try { return JSON.parse(localStorage.getItem(PLAYERS_KEY) || '[]'); } catch { return []; }
  }

  function saveMobilePlayer(name, score) {
    const players = getMobilePlayers();
    const entry = { name, score, date: new Date().toLocaleDateString('ko-KR') };
    players.push(entry);
    players.sort((a, b) => b.score - a.score);
    const top = players.slice(0, MAX_PLAYERS);
    try { localStorage.setItem(PLAYERS_KEY, JSON.stringify(top)); } catch {}
    return top.findIndex(p => p.name === name && p.score === score) + 1;
  }

  // ── 미션 상황 텍스트 ──────────────────────────────────────
  const MISSIONS = [
    { min: 5000000, cls: 'high', msg: '🏛️ 마을회관이 눈앞에!! 조금만 더!!' },
    { min: 3000000, cls: 'high', msg: '🎊 마을 잔치 한번 해볼 수 있겠는데?' },
    { min: 1000000, cls: 'high', msg: '🍗 온 동네 치킨 한 마리씩 쏜다!!' },
    { min:  500000, cls: '',     msg: '🛍️ 마트 장바구니 한가득 채우겠는걸~' },
    { min:  300000, cls: '',     msg: '🎤 마을 노래방 한 판은 충분하지!' },
    { min:  200000, cls: '',     msg: '☕ 이웃들한테 커피 한 잔씩 돌릴 수 있겠다' },
    { min:  100000, cls: '',     msg: '😅 에게~~ 이걸로 누구 코에 붙여?' },
    { min:   50000, cls: '',     msg: '🤔 오만원... 혼자 밥이나 먹어야겠다' },
    { min:   10000, cls: '',     msg: '😭 겨우 만원? 진심이야? 더 잡아!!' },
    { min:       1, cls: '',     msg: '😱 이게 다야... 빈손으로 갈 거야?' },
    { min:       0, cls: '',     msg: '💰 돈을 잡아라!' },
  ];

  function updateMission(total) {
    if (!missionText) return;
    const m = MISSIONS.find(m => total >= m.min) || MISSIONS[MISSIONS.length - 1];
    missionText.textContent = m.msg;
    missionText.className = 'mission-box' + (m.cls ? ' ' + m.cls : '');
  }

  const bankRows   = { 50000: document.getElementById('bank-50000'), 10000: document.getElementById('bank-10000'), 5000: document.getElementById('bank-5000'), 1000: document.getElementById('bank-1000'), 500: document.getElementById('bank-500'), 100: document.getElementById('bank-100') };
  const bankCounts = { 50000: document.getElementById('count-50000'), 10000: document.getElementById('count-10000'), 5000: document.getElementById('count-5000'), 1000: document.getElementById('count-1000'), 500: document.getElementById('count-500'), 100: document.getElementById('count-100') };
  const bankAmounts= { 50000: document.getElementById('amt-50000'), 10000: document.getElementById('amt-10000'), 5000: document.getElementById('amt-5000'), 1000: document.getElementById('amt-1000'), 500: document.getElementById('amt-500'), 100: document.getElementById('amt-100') };

  let webcamReady = false;
  let gameInited  = false;

  function showScreen(name) {
    Object.values(screens).forEach(s => { if (s) s.classList.remove('active'); });
    if (screens[name]) screens[name].classList.add('active');
  }

  // ── 실시간 랭킹 오버레이 업데이트 ─────────────────────────
  function updateLiveRanking() {
    if (!lrList) return;
    const currentScore = Score.getTotal();
    const currentName  = playerName || '나';
    const stored       = getMobilePlayers();

    const combined = stored.map(p => ({ ...p, _current: false }));
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

  // ── 웹캠 자동 초기화 ─────────────────────────────────────
  function initWebcam() {
    return HandTracker.init(videoEl, (results) => {
      Game.setHandResults(results);
    }).then(() => {
      webcamReady = true;
    }).catch(err => {
      console.warn('웹캠 초기화 실패:', err);
      webcamReady = false;
    });
  }

  window.addEventListener('load', () => { initWebcam(); });

  // ── Bank UI ──────────────────────────────────────────────
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
      if (bankAmounts[d]) bankAmounts[d].textContent  = amt > 0 ? Score.formatWon(amt) : '';
      if (bankRows[d] && denom === newDenom) {
        bankRows[d].classList.add('just-caught');
        setTimeout(() => bankRows[d] && bankRows[d].classList.remove('just-caught'), 600);
      }
    });
  }

  // ── Countdown ────────────────────────────────────────────
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
        countdownTxt.textContent = '손가락을 준비하세요!';
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

  // ── Game over ────────────────────────────────────────────
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
    if (nameInput) nameInput.value = '';
    showScreen('name');
    if (nameInput) setTimeout(() => nameInput.focus(), 300);
  }

  function confirmName() {
    playerName = (nameInput ? nameInput.value.trim() : '') || '익명';
    launchGame();
  }

  // ── 게임 실제 시작 ────────────────────────────────────────
  async function launchGame() {
    Sound.init();
    Sound.resume();

    if (!webcamReady) {
      await initWebcam();
      if (!webcamReady) {
        alert('웹캠을 사용할 수 없습니다.\n브라우저에서 카메라 권한을 허용해주세요.');
        return;
      }
    }

    if (!gameInited) {
      Game.init(canvasEl, videoEl);
      gameInited = true;
    }

    runCountdown(() => {
      showScreen('game');
      resetBankUI();
      Game.start(showGameOver, (denom) => updateBankUI(denom));
    });
  }

  // ── 이벤트 바인딩 ─────────────────────────────────────────
  btnStart.addEventListener('click', showNameScreen);
  btnRetry.addEventListener('click', showNameScreen);

  if (btnNameConfirm) btnNameConfirm.addEventListener('click', confirmName);
  if (btnNameSkip)    btnNameSkip.addEventListener('click', () => { playerName = '익명'; launchGame(); });
  if (nameInput)      nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmName(); });

  const hint = document.getElementById('gesture-hint');
  if (hint) hint.textContent = '☝️ 손가락으로 돈을 콕콕 찌르세요!';

  showScreen('start');
})();
