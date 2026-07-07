import { round } from "../core/math.js";
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

function updateSortHeaders(state) {
  document.querySelectorAll("th[data-sort]").forEach((header) => {
    const active = header.dataset.sort === state.sort.key;
    header.setAttribute("aria-sort", active ? (state.sort.direction === "asc" ? "ascending" : "descending") : "none");
    header.dataset.direction = active ? state.sort.direction : "";
  });
}
