(() => {
  const screens = {
    start:     document.getElementById('screen-start'),
    countdown: document.getElementById('screen-countdown'),
    game:      document.getElementById('screen-game'),
    gameover:  document.getElementById('screen-gameover')
  };
  const canvasEl      = document.getElementById('game-canvas');
  const countdownNum  = document.getElementById('countdown-number');
  const countdownTxt  = document.getElementById('countdown-text');
  const btnStart      = document.getElementById('btn-start');
  const btnRetry      = document.getElementById('btn-retry');
  const bankTotal     = document.getElementById('bank-total');
  const missionText   = document.getElementById('mission-text');
  const gameoverScore = document.getElementById('gameover-score-value');
  const rankingList   = document.getElementById('ranking-list');

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

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function resetBankUI() {
    bankTotal.textContent = '₩0';
    Object.keys(bankRows).forEach(d => {
      if (bankCounts[d])  bankCounts[d].textContent  = '× 0';
      if (bankAmounts[d]) bankAmounts[d].textContent = '';
    });
    updateMission(0);
  }

  function updateBankUI(newDenom) {
    const catches = Score.getCatches();
    const total   = Score.getTotal();
    bankTotal.textContent = Score.formatWon(total);
    bankTotal.classList.add('pop');
    setTimeout(() => bankTotal.classList.remove('pop'), 200);
    updateMission(total);

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

  function showGameOver() {
    const total    = Score.getTotal();
    const myRank   = Score.saveRanking(total);
    const rankings = Score.getRankings();

    gameoverScore.textContent = Score.formatWon(total);
    gameoverScore.className   = myRank === 1 ? 'gameover-score-value new-record' : 'gameover-score-value';

    rankingList.innerHTML = '';
    rankings.forEach((r, i) => {
      const rankNum = i + 1;
      const isCurrent = (r.score === total && myRank === rankNum);
      const row = document.createElement('div');
      row.className = `ranking-row rank-${rankNum}${isCurrent ? ' current' : ''}`;
      row.innerHTML = `
        <span class="rank">${rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : rankNum + '.'}</span>
        <span class="score">${Score.formatWon(r.score)}</span>
        <span class="date">${r.date}</span>`;
      rankingList.appendChild(row);
    });

    showScreen('gameover');
  }

  function startGame() {
    Sound.init();
    Sound.resume();

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

  btnStart.addEventListener('click', startGame);
  btnRetry.addEventListener('click', startGame);

  showScreen('start');
})();
