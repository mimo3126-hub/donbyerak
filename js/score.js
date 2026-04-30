const Score = (() => {
  const KEY = 'donbyerak_ranking';
  const MAX_RANKS = 5;

  let catches = { 50000: 0, 10000: 0, 5000: 0, 1000: 0, 500: 0, 100: 0 };
  let total = 0;

  function reset() {
    catches = { 50000: 0, 10000: 0, 5000: 0, 1000: 0, 500: 0, 100: 0 };
    total = 0;
  }

  function add(denomination) {
    catches[denomination] = (catches[denomination] || 0) + 1;
    total += denomination;
    return total;
  }

  function getTotal() { return total; }
  function getCatches() { return { ...catches }; }

  function getRankings() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch { return []; }
  }

  function saveRanking(score) {
    const rankings = getRankings();
    const entry = { score, date: new Date().toLocaleDateString('ko-KR') };
    rankings.push(entry);
    rankings.sort((a, b) => b.score - a.score);
    const top = rankings.slice(0, MAX_RANKS);
    try { localStorage.setItem(KEY, JSON.stringify(top)); } catch {}
    // Return rank (1-based), or 0 if not in top 5
    const myIdx = top.findIndex(r => r.score === score && r.date === entry.date);
    return myIdx + 1;
  }

  function formatWon(n) {
    return '₩' + n.toLocaleString('ko-KR');
  }

  return { reset, add, getTotal, getCatches, getRankings, saveRanking, formatWon };
})();
