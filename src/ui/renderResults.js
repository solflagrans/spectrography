import { getConfidence } from "../core/matching.js";
import { round } from "../core/math.js";
import { clearErrorStatus } from "./errors.js";
import { renderAnalysisPeakTable, renderPeakTable } from "./renderPeaks.js";

export function renderResults(elements, state, detected, options) {
  clearErrorStatus(elements);
  const matchedCount = state.peaks.filter((peak) => peak.match).length;
  elements.analysisSummary.textContent = `${state.matches.length} элементов · ${state.peaks.length} значимых пиков · ${matchedCount} совпадений`;
  renderAnalysisConclusion(elements, state, options);

  if (!state.matches.length) {
    elements.elementResults.innerHTML = '<p class="empty-state">Совпадений с базой не найдено. Увеличьте допуск или проверьте массивы.</p>';
  } else {
    elements.elementResults.innerHTML = state.matches
      .map((item) => {
        const confidence = getConfidence(item);
        return `
          <article class="element-card ${confidence.level}">
            <div class="element-card-head">
              <div>
                <strong class="element-title">${item.symbol}</strong>
                <span class="element-name">${item.name}</span>
              </div>
              <span class="confidence ${confidence.level}">${confidence.label}</span>
            </div>
            <div class="element-metrics">
              <span class="score">Оценка ${item.score}</span>
              <span>${item.peaks.length} совпавших линий</span>
            </div>
            <p class="element-lines">${item.peaks
              .map((peak) => `${round(peak.wavelength, 2)} нм`)
              .join(", ")}</p>
          </article>
        `;
      })
      .join("");
  }

  renderAnalysisPeakTable(elements, state);
  renderPeakTable(elements, state);
}

function renderAnalysisConclusion(elements, state, options) {
  if (!state.matches.length) {
    elements.analysisConclusion.innerHTML = "Уверенных совпадений с базой спектральных линий пока нет.";
    return;
  }
  const symbols = state.matches.map((item) => item.symbol).join(", ");
  const confident = state.matches
    .slice(0, 3)
    .map((item) => `${item.symbol} — ${getConfidence(item).label.toLowerCase()}`)
    .join(", ");
  elements.analysisConclusion.innerHTML = `
    <strong>Обнаружены элементы:</strong> ${symbols}.<br>
    <strong>Наиболее уверенные совпадения:</strong> ${confident}.<br>
    <span>Параметры: порог ${Number(options.sigma)}, допуск ${options.tolerance} нм, сглаживание ${Number(options.smoothing)}, расстояние ${Number(options.distance)} точек.</span>
  `;
}
