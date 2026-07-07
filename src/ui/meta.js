import { round } from "../core/math.js";
import { clearErrorStatus } from "./errors.js";

export function updateMeta(elements, state) {
  const count = state.wavelengths.length;
  if (!count) {
    elements.datasetMeta.textContent = "0 точек";
    elements.pointCountStat.textContent = "0";
    elements.rangeStat.textContent = "—";
    elements.avgStat.textContent = "—";
    clearErrorStatus(elements);
    return;
  }
  const min = Math.min(...state.wavelengths);
  const max = Math.max(...state.wavelengths);
  const avg = state.intensities.reduce((sum, value) => sum + value, 0) / state.intensities.length;
  elements.datasetMeta.textContent = `${count.toLocaleString("ru-RU")} точек · ${round(min, 2)}-${round(max, 2)} нм`;
  elements.pointCountStat.textContent = count.toLocaleString("ru-RU");
  elements.rangeStat.textContent = `${round(min, 1)}–${round(max, 1)} нм`;
  elements.avgStat.textContent = round(avg, 2);
  clearErrorStatus(elements);
}
