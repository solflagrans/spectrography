import { round } from "./math.js";

export function matchPeaks(peaks, database, tolerance) {
  const matches = peaks.map((peak) => {
    let best = null;
    database.forEach((element) => {
      element.lines.forEach((line) => {
        const delta = Math.abs(peak.wavelength - line);
        if (delta <= tolerance && (!best || delta < best.delta)) {
          best = { ...element, line, delta };
        }
      });
    });
    return { ...peak, match: best };
  });

  const elementScores = new Map();
  matches.forEach((item) => {
    if (!item.match) return;
    const key = item.match.symbol;
    const current = elementScores.get(key) || {
      symbol: item.match.symbol,
      name: item.match.name,
      score: 0,
      peaks: [],
    };
    const closeness = 1 - item.match.delta / tolerance;
    current.score += 1 + closeness + item.intensity / 1000;
    current.peaks.push(item);
    elementScores.set(key, current);
  });

  const elementsRanked = [...elementScores.values()]
    .map((item) => ({ ...item, score: round(item.score, 2) }))
    .sort((a, b) => b.score - a.score || b.peaks.length - a.peaks.length);

  return { matches, elementsRanked };
}

export function getConfidence(item) {
  if (item.peaks.length >= 2 && item.score >= 3) return { level: "high", label: "Высокая уверенность" };
  if (item.peaks.length >= 1 && item.score >= 1.5) return { level: "medium", label: "Средняя уверенность" };
  return { level: "low", label: "Низкая уверенность" };
}
