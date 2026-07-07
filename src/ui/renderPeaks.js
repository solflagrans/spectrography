import { round } from "../core/math.js";
import { getConfidence } from "../core/matching.js";
import { selectFilteredPeaks } from "../state/selectors.js";
import { readPeakFilters } from "./dom.js";

export function renderPeakTable(elements, state) {
  updateSortHeaders(state);
  const filteredPeaks = selectFilteredPeaks(state, readPeakFilters(elements));
  if (!filteredPeaks.length) {
    elements.peakTable.innerHTML = '<tr><td colspan="4">Пики по текущим фильтрам не найдены</td></tr>';
    return;
  }

  elements.peakTable.innerHTML = filteredPeaks
    .map((peak) => {
      const match = peak.match;
      return `
        <tr class="${match ? "is-matched" : "is-unmatched"}">
          <td><span class="mono-value">${round(peak.wavelength, 3)}</span></td>
          <td><span class="mono-value">${round(peak.intensity, 3)}</span></td>
          <td>
            ${
              match
                ? `<span class="match-badge matched">Совпадение</span> <strong>${match.symbol}</strong> · ${match.name}`
                : '<span class="match-badge unmatched">Без совпадения</span>'
            }
          </td>
          <td>
            ${
              match
                ? `<span class="mono-value">${round(match.line, 3)} нм</span> <span class="delta-badge">Δ ${round(match.delta, 3)}</span>`
                : "—"
            }
          </td>
        </tr>
      `;
    })
    .join("");
}

export function renderAnalysisPeakTable(elements, state) {
  const peaks = [...state.peaks].sort((a, b) => compareAnalysisPeaks(a, b, state));
  elements.analysisPeakCount.textContent = `${peaks.length.toLocaleString("ru-RU")} пиков`;

  if (!peaks.length) {
    elements.analysisPeakTable.innerHTML = '<tr><td colspan="7">Пики появятся после анализа данных</td></tr>';
    return;
  }

  elements.analysisPeakTable.innerHTML = peaks
    .map((peak, index) => {
      const match = peak.match;
      const confidence = getPeakConfidence(peak, state);
      return `
        <tr class="${match ? "is-matched" : "is-unmatched"}">
          <td>${index + 1}</td>
          <td><span class="mono-value">${round(peak.wavelength, 3)}</span></td>
          <td><span class="mono-value">${round(peak.intensity, 3)}</span></td>
          <td>${match ? `<strong>${match.symbol}</strong> · ${match.name}` : "—"}</td>
          <td>${match ? `<span class="mono-value">${round(match.line, 3)}</span>` : "—"}</td>
          <td>${match ? `<span class="delta-badge">Δ ${round(match.delta, 3)}</span>` : "—"}</td>
          <td><span class="confidence-dot ${confidence.level}"></span>${confidence.label}</td>
        </tr>
      `;
    })
    .join("");
}

export function createPeakTableCsv(state) {
  const rows = [
    ["№", "λ найдено, нм", "Интенсивность", "Элемент", "λ справочно, нм", "Разница, нм", "Уверенность"],
    ...[...state.peaks].sort((a, b) => compareAnalysisPeaks(a, b, state)).map((peak, index) => {
      const match = peak.match;
      const confidence = getPeakConfidence(peak, state);
      return [
        index + 1,
        round(peak.wavelength, 3),
        round(peak.intensity, 3),
        match ? `${match.symbol} ${match.name}` : "",
        match ? round(match.line, 3) : "",
        match ? round(match.delta, 3) : "",
        confidence.label,
      ];
    }),
  ];
  return rows.map((row) => row.map(escapeCsvCell).join(";")).join("\n");
}

function updateSortHeaders(state) {
  document.querySelectorAll("th[data-sort]").forEach((header) => {
    const active = header.dataset.sort === state.sort.key;
    header.setAttribute("aria-sort", active ? (state.sort.direction === "asc" ? "ascending" : "descending") : "none");
    header.dataset.direction = active ? state.sort.direction : "";
  });
}

function compareAnalysisPeaks(a, b, state) {
  const sort = state.analysisPeakSort || "intensity-desc";
  if (sort === "wavelength-asc") return a.wavelength - b.wavelength;
  if (sort === "element-asc") return getElementName(a).localeCompare(getElementName(b), "ru");
  if (sort === "confidence-desc") return getConfidenceRank(b, state) - getConfidenceRank(a, state);
  return b.intensity - a.intensity;
}

function getPeakConfidence(peak, state) {
  if (!peak.match) return { level: "low", label: "Нет совпадения" };
  const elementMatch = state.matches.find((item) => item.symbol === peak.match.symbol);
  return elementMatch ? getConfidence(elementMatch) : { level: "medium", label: "Средняя уверенность" };
}

function getConfidenceRank(peak, state) {
  const level = getPeakConfidence(peak, state).level;
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function getElementName(peak) {
  return peak.match ? peak.match.symbol : "яяя";
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[";\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
