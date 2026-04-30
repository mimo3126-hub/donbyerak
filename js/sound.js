const Sound = (() => {
  let ctx = null;
  let bgmNodes = [];
  let bgmPlaying = false;
  let masterGain = null;
  let bgmAudio = null;
  let bgmSource = null;   // MediaElementSourceNode
  let analyser  = null;   // AnalyserNode for beat detection
  const BGM_SRC   = (window.BGM_BASE || '') + 'bgm.mp3';
  const BGM_SPEED = 1.2;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.6;
    masterGain.connect(ctx.destination);
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function playTone(freq, type, duration, vol, startDelay = 0) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(masterGain);
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime + startDelay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  function playCoinCatch() {
    if (!ctx) return;
    resume();
    playTone(1200, 'sine', 0.12, 0.4);
    playTone(1600, 'sine', 0.18, 0.25, 0.04);
    playTone(2000, 'sine', 0.1, 0.15, 0.08);
  }

  function playBillCatch(denomination) {
    if (!ctx) return;
    resume();
    // Paper rustle: white noise burst + low thud
    const bufSize = ctx.sampleRate * 0.15;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 1800;
    bpf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    noise.connect(bpf);
    bpf.connect(ng);
    ng.connect(masterGain);
    noise.start();
    noise.stop(ctx.currentTime + 0.15);

    // Pitch based on denomination
    const freqMap = { 1000: 220, 5000: 280, 10000: 340, 50000: 440 };
    const f = freqMap[denomination] || 280;
    playTone(f, 'triangle', 0.2, 0.3, 0.02);
  }

  function playBigCatch() {
    if (!ctx) return;
    resume();
    // 오만원 special fanfare
    [523, 659, 784, 1047].forEach((f, i) => playTone(f, 'sine', 0.3, 0.4, i * 0.08));
    playTone(1047, 'triangle', 0.5, 0.3, 0.32);
  }

  function playGameOver() {
    if (!ctx) return;
    resume();
    const melody = [523, 440, 349, 261];
    melody.forEach((f, i) => playTone(f, 'triangle', 0.4, 0.35, i * 0.18));
  }

  function playCountdown(num) {
    if (!ctx) return;
    resume();
    const f = num === 0 ? 880 : 440;
    playTone(f, 'square', 0.2, 0.3);
  }

  function startBGM() {
    if (bgmPlaying) return;
    bgmPlaying = true;

    if (!bgmAudio) {
      bgmAudio = new Audio(BGM_SRC);
      bgmAudio.loop = true;
      bgmAudio.playbackRate = BGM_SPEED;
      bgmAudio.volume = 0.55;
    }

    // Web Audio API 분석기 연결 (최초 1회)
    if (ctx && !bgmSource) {
      try {
        bgmSource = ctx.createMediaElementSource(bgmAudio);
        analyser  = ctx.createAnalyser();
        analyser.fftSize = 256;                 // 128 frequency bins
        analyser.smoothingTimeConstant = 0.72;
        bgmSource.connect(analyser);
        analyser.connect(ctx.destination);      // 오디오 출력 유지
      } catch(e) {
        console.warn('Beat analyser setup 실패:', e);
      }
    }

    bgmAudio.currentTime = 0;
    bgmAudio.play().catch(e => console.warn('BGM 재생 실패:', e));
  }

  // 현재 프레임의 보컬 주파수 에너지 반환 (0~1)
  function getBeatLevel() {
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    // 보컬·멜로디 범위 bins 3~22 (≈500~3700Hz)
    let sum = 0;
    for (let i = 3; i < 22; i++) sum += data[i];
    return sum / (19 * 255);
  }

  function stopBGM() {
    bgmPlaying = false;
    if (bgmAudio) {
      bgmAudio.pause();
      bgmAudio.currentTime = 0;
    }
    bgmNodes.forEach(n => { try { n.osc.stop(); } catch(e) {} });
    bgmNodes = [];
  }

  return { init, resume, playCoinCatch, playBillCatch, playBigCatch, playGameOver, playCountdown, startBGM, stopBGM, getBeatLevel };
})();
