import { round } from "../core/math.js";
import { selectFilteredPeaks } from "../state/selectors.js";
import { readPeakFilters } from "./dom.js";

export function renderPeakTable(elements, state) {
  const filteredPeaks = selectFilteredPeaks(state, readPeakFilters(elements));
  if (!filteredPeaks.length) {
    elements.peakTable.innerHTML = '<tr><td colspan="4">Пики по текущим фильтрам не найдены</td></tr>';
    return;
  }

  elements.peakTable.innerHTML = filteredPeaks
    .map((peak) => {
      const match = peak.match;
      return `
        <tr>
          <td>${round(peak.wavelength, 3)}</td>
          <td>${round(peak.intensity, 3)}</td>
          <td>${match ? `${match.symbol} · ${match.name}` : "нет"}</td>
          <td>${match ? `${round(match.line, 3)} нм · Δ ${round(match.delta, 3)}` : "—"}</td>
        </tr>
      `;
    })
    .join("");
}
