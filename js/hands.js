const HandTracker = (() => {
  let hands = null;
  let camera = null;
  let lastResults = null;
  let onResultsCb = null;
  let initialized = false;

  function init(videoEl, onResults) {
    onResultsCb = onResults;

    hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.5
    });

    hands.onResults((results) => {
      lastResults = results;
      if (onResultsCb) onResultsCb(results);
    });

    camera = new Camera(videoEl, {
      onFrame: async () => {
        if (hands) await hands.send({ image: videoEl });
      },
      width: 1280,
      height: 720
    });

    return camera.start().then(() => {
      initialized = true;
    }).catch(err => {
      console.error('Camera start failed:', err);
      throw err;
    });
  }

  function stop() {
    if (camera) camera.stop();
    camera = null;
    hands = null;
    initialized = false;
    lastResults = null;
  }

  function getLastResults() { return lastResults; }
  function isReady() { return initialized; }

  return { init, stop, getLastResults, isReady };
})();
