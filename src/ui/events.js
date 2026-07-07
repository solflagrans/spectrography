import { runAnalysis } from "../core/analysis.js";
import { validateDataset } from "../core/validation.js";
import { presets } from "../data/presets.js";
import { parseJsonPayload, parseManualColumns } from "../io/parseDataset.js";
import { createReport, downloadJson } from "../io/report.js";
import { setAnalysisState, setDatasetState, setSortState } from "../state/store.js";
import { drawChart, updateHover } from "./chartRenderer.js";
import { readAnalysisOptions } from "./dom.js";
import { showError } from "./errors.js";
import { syncInputs, syncManualScroll, updateManualRowNumbers } from "./manualInputs.js";
import { updateMeta } from "./meta.js";
import { readDatabaseEditor, renderDatabaseEditor, syncDatabaseInput } from "./renderDatabase.js";
import { renderPeakTable } from "./renderPeaks.js";
import { renderResults } from "./renderResults.js";

export function bindEvents(elements, state) {
  const analyze = () => analyzeDataset(elements, state);
  const setDataset = (wavelengths, intensities, shouldAnalyze = true) => {
    setDatasetState(wavelengths, intensities);
    syncInputs(elements, state);
    updateMeta(elements, state);
    if (shouldAnalyze) analyze();
    drawChart(elements, state);
  };

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".segment").forEach((item) => item.classList.remove("is-active"));
      document.querySelectorAll(".source-view").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      document.querySelector(`[data-view="${button.dataset.source}"]`).classList.add("is-active");
    });
  });

  document.querySelectorAll(".app-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".app-tab").forEach((item) => item.classList.remove("is-active"));
      document.querySelectorAll(".app-view").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      document.querySelector(`[data-app-panel="${button.dataset.appView}"]`).classList.add("is-active");
      requestAnimationFrame(() => drawChart(elements, state));
    });
  });

  document.querySelector("#loadPreset").addEventListener("click", () => {
    const preset = presets[elements.presetSelect.value];
    setDataset(preset.wavelengths, preset.intensities);
  });

  document.querySelector("#resetButton").addEventListener("click", () => {
    elements.presetSelect.value = "solar";
    elements.sigmaInput.value = "1";
    elements.prominenceInput.value = "0.06";
    elements.distanceInput.value = "8";
    elements.toleranceInput.value = "0.35";
    elements.smoothingInput.value = "1";
    elements.peakSearch.value = "";
    elements.peakMatchFilter.value = "all";
    elements.peakMinInput.value = "";
    elements.peakMaxInput.value = "";
    elements.matchedOnlyInput.checked = false;
    const preset = presets.solar;
    setDataset(preset.wavelengths, preset.intensities);
  });

  document.querySelector("#importJson").addEventListener("click", () => {
    try {
      const payload = parseJsonPayload(elements.jsonInput.value);
      validateDataset(payload.wavelengths, payload.intensities);
      setDataset(payload.wavelengths, payload.intensities);
    } catch (error) {
      showError(elements, error.message);
    }
  });

  document.querySelector("#loadJsonFile").addEventListener("click", () => {
    elements.jsonFileInput.click();
  });

  elements.jsonFileInput.addEventListener("change", async () => {
    const file = elements.jsonFileInput.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      elements.jsonInput.value = text;
      const payload = parseJsonPayload(text);
      validateDataset(payload.wavelengths, payload.intensities);
      setDataset(payload.wavelengths, payload.intensities);
    } catch (error) {
      showError(elements, error.message);
    } finally {
      elements.jsonFileInput.value = "";
    }
  });

  document.querySelector("#applyArrays").addEventListener("click", () => {
    try {
      const { wavelengths, intensities } = parseManualColumns(
        elements.wavelengthInput.value,
        elements.intensityInput.value,
      );
      validateDataset(wavelengths, intensities);
      setDataset(wavelengths, intensities);
    } catch (error) {
      showError(elements, error.message);
    }
  });

  document.querySelector("#applyDatabase").addEventListener("click", () => {
    try {
      state.database = readDatabaseEditor(elements);
      syncDatabaseInput(elements, state);
      renderDatabaseEditor(elements, state.database);
      analyze();
    } catch (error) {
      showError(elements, error.message);
    }
  });

  document.querySelector("#addDatabaseRow").addEventListener("click", () => {
    try {
      state.database = readDatabaseEditor(elements);
    } catch {
      state.database = structuredClone(state.database);
    }
    state.database.push({ symbol: "", name: "", lines: [] });
    renderDatabaseEditor(elements, state.database);
  });

  elements.databaseEditor.addEventListener("click", (event) => {
    const button = event.target.closest(".delete-row");
    if (!button) return;
    try {
      state.database = readDatabaseEditor(elements);
    } catch {
      state.database = structuredClone(state.database);
    }
    state.database.splice(Number(button.dataset.index), 1);
    renderDatabaseEditor(elements, state.database);
  });

  document.querySelector("#analyzeButton").addEventListener("click", analyze);
  document.querySelector("#downloadResults").addEventListener("click", () => {
    downloadJson("spectral-analysis-report.json", createReport(state));
  });

  [elements.wavelengthInput, elements.intensityInput].forEach((element) => {
    element.addEventListener("input", () => updateManualRowNumbers(elements));
    element.addEventListener("scroll", () => syncManualScroll(elements, element));
  });

  [
    elements.peakSearch,
    elements.peakMatchFilter,
    elements.peakMinInput,
    elements.peakMaxInput,
    elements.matchedOnlyInput,
  ].forEach((element) => {
    element.addEventListener("input", () => renderPeakTable(elements, state));
    element.addEventListener("change", () => renderPeakTable(elements, state));
  });

  document.querySelectorAll("th[data-sort]").forEach((header) => {
    header.addEventListener("click", () => {
      setSortState(header.dataset.sort);
      renderPeakTable(elements, state);
    });
  });

  ["sigmaInput", "prominenceInput", "distanceInput", "toleranceInput", "smoothingInput"].forEach((key) => {
    elements[key].addEventListener("change", analyze);
  });

  elements.canvas.addEventListener("mousemove", updateHover(elements, state));
  elements.canvas.addEventListener("mouseleave", () => {
    state.hoverPeak = null;
    elements.tooltip.hidden = true;
    drawChart(elements, state);
  });

  window.addEventListener("resize", () => drawChart(elements, state));

  return { setDataset, analyze };
}

function analyzeDataset(elements, state) {
  try {
    const options = readAnalysisOptions(elements);
    const result = runAnalysis({
      wavelengths: state.wavelengths,
      intensities: state.intensities,
      database: state.database,
      options,
    });
    setAnalysisState(result);
    renderResults(elements, state, result.detected, options);
    drawChart(elements, state);
  } catch (error) {
    showError(elements, error.message);
  }
}
