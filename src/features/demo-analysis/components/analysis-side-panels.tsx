"use client";

import { ArrowRight, CircleAlert, LoaderCircle, RotateCcw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

import type { SpectralLineCandidate } from "@/domain/spectrum";
import { useAnalysisWorkspace } from "@/features/demo-analysis/model/analysis-workspace-context";
import {
  diagnosticReasonLabels,
  getIdentificationEntries,
  type IdentificationSort,
} from "@/features/demo-analysis/model/identification-ui";

import styles from "./analysis-page.module.css";

export function ProcessingSettingsPanel() {
  const {
    parameters,
    calculationStatus,
    parameterError,
    resetProcessingParameters,
    updateProcessingParameters,
  } = useAnalysisWorkspace();

  return (
    <div className={styles.sidePanelContent}>
      <SidePanelHeader title="Настройки обработки" onReset={resetProcessingParameters} />
      <section className={styles.sideParameterGroup}>
        <h3>Базовая линия и шум</h3>
        <NumberParameter
          id="baseline-smoothness"
          label="Гладкость AsLS"
          unit="λ"
          value={parameters.processing.baselineSmoothness}
          min={100}
          max={10_000_000}
          step={1000}
          onChange={(value) => updateProcessingParameters({ baselineSmoothness: value })}
        />
        <NumberParameter
          id="noise-window"
          label="Окно локального MAD"
          unit="нм"
          value={parameters.processing.noiseWindowNm}
          min={0.05}
          max={50}
          step={0.1}
          onChange={(value) => updateProcessingParameters({ noiseWindowNm: value })}
        />
      </section>
      <section className={styles.sideParameterGroup}>
        <h3>Сглаживание</h3>
        <div className={styles.rangeHeading}>
          <label htmlFor="smoothing-window">Окно Савицкого—Голея</label>
          <output htmlFor="smoothing-window">{parameters.processing.smoothingWindow} пт</output>
        </div>
        <input
          id="smoothing-window"
          className={styles.rangeInput}
          type="range"
          min="1"
          max="51"
          step="2"
          value={parameters.processing.smoothingWindow}
          onChange={(event) => updateProcessingParameters({ smoothingWindow: Number(event.target.value) })}
        />
        <p>Уменьшает высокочастотный шум без уширения основных пиков.</p>
      </section>
      <section className={styles.sideParameterGroup}>
        <h3>Нормализация</h3>
        <label className={styles.selectField} htmlFor="normalization-method">
          <span>Метод нормирования</span>
          <select
            id="normalization-method"
            value={parameters.processing.normalization}
            onChange={(event) => updateProcessingParameters({
              normalization: event.target.value === "none" ? "none" : "maximum",
            })}
          >
            <option value="maximum">По максимальному пику (0…1)</option>
            <option value="none">Без нормализации</option>
          </select>
        </label>
      </section>
      <CalculationFeedback status={calculationStatus} error={parameterError} />
    </div>
  );
}

export function PeakSettingsPanel() {
  const {
    analysis,
    parameters,
    calculationStatus,
    parameterError,
    peakPanelSection,
    resetPeakSearchParameters,
    selectedPeakId,
    setPeakPanelSection,
    updatePeakSearchParameters,
  } = useAnalysisWorkspace();
  const selectedPeak = analysis?.peaks.find((peak) => peak.id === selectedPeakId) ?? null;

  return (
    <div className={styles.sidePanelContent}>
      <div className={styles.sidePanelTabs} role="tablist" aria-label="Разделы панели пиков">
        <button
          type="button"
          role="tab"
          aria-selected={peakPanelSection === "parameters"}
          aria-controls="peak-parameters-panel"
          id="peak-parameters-tab"
          onClick={() => setPeakPanelSection("parameters")}
        >
          Параметры
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={peakPanelSection === "selected"}
          aria-controls="selected-peak-panel"
          id="selected-peak-tab"
          onClick={() => setPeakPanelSection("selected")}
        >
          Выбранный пик
        </button>
      </div>

      {peakPanelSection === "parameters" ? (
        <div role="tabpanel" id="peak-parameters-panel" aria-labelledby="peak-parameters-tab">
          <SidePanelHeader title="Параметры пиков" onReset={resetPeakSearchParameters} />
          <section className={styles.sideParameterGroup}>
            <h3>Поиск пиков</h3>
            <div className={styles.rangeHeading}>
              <label htmlFor="detection-threshold">Минимальный SNR</label>
              <output htmlFor="detection-threshold">{parameters.peakSearch.minimumSnr.toFixed(1)}</output>
            </div>
            <input
              id="detection-threshold"
              className={styles.rangeInput}
              type="range"
              min="0"
              max="30"
              step="0.5"
              value={parameters.peakSearch.minimumSnr}
              onChange={(event) => updatePeakSearchParameters({ minimumSnr: Number(event.target.value) })}
            />
            <p>Пик должен быть выше локального уровня шума в указанное число раз.</p>
            <NumberParameter
              id="minimum-width"
              label="Минимальная ширина"
              unit="нм"
              value={parameters.peakSearch.minimumWidth}
              min={0}
              max={50}
              step={0.01}
              onChange={(value) => updatePeakSearchParameters({ minimumWidth: value })}
            />
            <NumberParameter
              id="maximum-width"
              label="Максимальная ширина"
              unit="нм"
              value={parameters.peakSearch.maximumWidth}
              min={0.01}
              max={100}
              step={0.1}
              onChange={(value) => updatePeakSearchParameters({ maximumWidth: value })}
            />
            <NumberParameter
              id="minimum-prominence"
              label="Минимальная выраженность"
              unit="отн. ед."
              value={parameters.peakSearch.prominence}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => updatePeakSearchParameters({ prominence: value })}
            />
            <NumberParameter
              id="minimum-distance"
              label="Минимальное расстояние"
              unit="нм"
              value={parameters.peakSearch.minimumDistance}
              min={0.01}
              max={50}
              step={0.1}
              onChange={(value) => updatePeakSearchParameters({ minimumDistance: value })}
            />
          </section>
          <section className={styles.sideParameterGroup}>
            <h3>Сопоставление линий</h3>
            <NumberParameter
              id="matching-tolerance"
              label="Допуск сопоставления"
              unit="нм"
              value={parameters.peakSearch.tolerance}
              min={0.01}
              max={5}
              step={0.01}
              onChange={(value) => updatePeakSearchParameters({ tolerance: value })}
            />
          </section>
          <CalculationFeedback status={calculationStatus} error={parameterError} />
        </div>
      ) : (
        <section
          className={styles.selectedPeakPanel}
          role="tabpanel"
          id="selected-peak-panel"
          aria-labelledby="selected-peak-tab"
        >
          <SelectedPeakContent
            analysis={analysis}
            selectedPeak={selectedPeak}
          />
        </section>
      )}
    </div>
  );
}

function SelectedPeakContent({
  analysis,
  selectedPeak,
}: Readonly<{
  analysis: ReturnType<typeof useAnalysisWorkspace>["analysis"];
  selectedPeak: NonNullable<ReturnType<typeof useAnalysisWorkspace>["analysis"]>["peaks"][number] | null;
}>) {
  const router = useRouter();
  const { selectHypothesisForElement } = useAnalysisWorkspace();
  if (!analysis?.peaks.length) {
    return <PanelEmptyState>При текущих параметрах пики не найдены.</PanelEmptyState>;
  }
  if (!selectedPeak) {
    return <PanelEmptyState>Выберите пик на графике или в таблице, чтобы увидеть его параметры и кандидатов.</PanelEmptyState>;
  }

  const rawIntensity = selectedPeak.rawIntensity;

  return (
    <>
      <h2 className={styles.sidePanelTitle}>Пик {selectedPeak.wavelength.toFixed(2)} нм</h2>
      <dl className={styles.selectedPeakDetails}>
        <PeakDetail label="Длина волны" value={`${selectedPeak.wavelength.toFixed(3)} нм`} />
        <PeakDetail label="Исходная интенсивность" value={formatValue(rawIntensity, 4)} />
        <PeakDetail label="Подготовленная интенсивность" value={formatValue(selectedPeak.intensity, 4)} />
        <PeakDetail label="Выраженность" value={formatValue(selectedPeak.prominence, 4)} />
        <PeakDetail label="SNR" value={Number.isFinite(selectedPeak.snr) ? formatValue(selectedPeak.snr, 2) : "∞"} />
        <PeakDetail label="Ширина" value={`${formatValue(selectedPeak.widthNm, 3)} нм`} />
        <PeakDetail label="Порог в этой точке" value={formatValue(analysis.thresholdDataset.intensities[selectedPeak.index], 4)} />
      </dl>

      <section className={styles.candidateSection} aria-labelledby="candidate-lines-title">
        <h3 id="candidate-lines-title">Кандидаты в пределах допуска</h3>
        {selectedPeak.candidates.length ? (
          <ol className={styles.candidateList}>
            {selectedPeak.candidates.map((candidate, index) => (
              <li key={candidate.lineId}>
                <div className={styles.candidateHeading}>
                  <strong>{candidate.elementName} ({candidate.elementSymbol})</strong>
                  <span className={index === 0 ? styles.suggestedCandidate : styles.alternativeCandidate}>
                    {index === 0 ? "Предложено" : "Альтернатива"}
                  </span>
                </div>
                <div className={styles.candidateValues}>
                  <span>{formatCandidateLine(candidate)} нм</span>
                  <code>{formatSigned(candidate.delta)} нм</code>
                </div>
                {hasHypothesisForElement(analysis, candidate.elementSymbol) ? (
                  <button
                    className={styles.candidateLink}
                    type="button"
                    onClick={() => {
                      if (selectHypothesisForElement(candidate.elementSymbol)) router.push("/identification");
                    }}
                  >
                    Открыть гипотезу
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                ) : (
                  <span className={styles.candidateUnavailable}>Доступной гипотезы нет</span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <PanelEmptyState>
            В пределах допуска ±{analysis.parameters.peakSearch.tolerance.toFixed(2)} нм подходящих линий нет.
          </PanelEmptyState>
        )}
      </section>
    </>
  );
}

function PeakDetail({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function PanelEmptyState({ children }: Readonly<{ children: ReactNode }>) {
  return <p className={styles.sidePanelEmpty}>{children}</p>;
}

export function IdentificationLinesPanel() {
  const {
    analysis,
    identificationTab,
    selectedHypothesisId,
    selectHypothesis,
    setIdentificationTab,
  } = useAnalysisWorkspace();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<IdentificationSort>("ranking");

  if (!analysis) {
    return (
      <div className={styles.sidePanelContent}>
        <h2 className={styles.sidePanelTitle}>Гипотезы</h2>
        <p className={styles.sidePanelEmpty}>Сначала откройте спектр.</p>
      </div>
    );
  }
  const entries = getIdentificationEntries(analysis, identificationTab, query, sort);

  return (
    <div className={`${styles.sidePanelContent} ${styles.identificationMaster}`}>
      <h2 className={styles.sidePanelTitle}>Гипотезы элементов</h2>
      <div className={styles.sidePanelTabs} role="tablist" aria-label="Списки идентификации">
        <button id="identification-hypotheses-tab" type="button" role="tab" aria-selected={identificationTab === "hypotheses"} aria-controls="identification-list-panel" onClick={() => setIdentificationTab("hypotheses")}>Гипотезы · {analysis.hypotheses.length}</button>
        <button id="identification-diagnostics-tab" type="button" role="tab" aria-selected={identificationTab === "diagnostics"} aria-controls="identification-list-panel" onClick={() => setIdentificationTab("diagnostics")}>Диагностика · {analysis.rejectedHypotheses.length}</button>
      </div>
      <label className={styles.hypothesisSearch} htmlFor="hypothesis-search">
        <Search size={14} aria-hidden="true" />
        <input id="hypothesis-search" type="search" aria-label="Поиск гипотезы по элементу или символу" placeholder="Элемент или символ" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <label className={styles.hypothesisSort} htmlFor="hypothesis-sort">
        <span>Сортировка</span>
        <select id="hypothesis-sort" value={sort} onChange={(event) => setSort(event.target.value as IdentificationSort)}>
          <option value="ranking">Автоматическое ранжирование</option>
          <option value="characteristic">Характерные линии</option>
          <option value="independent">Независимые совпадения</option>
          <option value="deviation">Среднее отклонение</option>
          <option value="name">Название</option>
        </select>
      </label>
      <div id="identification-list-panel" role="tabpanel" aria-labelledby={identificationTab === "hypotheses" ? "identification-hypotheses-tab" : "identification-diagnostics-tab"}>
        {entries.length ? (
          <div className={styles.hypothesisMasterList} role="listbox" aria-label={identificationTab === "hypotheses" ? "Основные гипотезы" : "Диагностические совпадения"}>
            {entries.map((entry) => (
              <button key={entry.id} type="button" role="option" aria-selected={selectedHypothesisId === entry.id} className={styles.hypothesisMasterItem} onClick={() => selectHypothesis(entry.id, identificationTab)}>
                <span className={styles.hypothesisMasterHeading}>
                  <strong>{entry.hypothesis.symbol}</strong>
                  <span>{entry.hypothesis.name}</span>
                  {identificationTab === "hypotheses" ? <code>#{entry.rank}</code> : null}
                </span>
                <span className={styles.hypothesisMasterMetrics}>
                  <span>Характерные {entry.hypothesis.foundCharacteristicLineCount}/{entry.hypothesis.availableCharacteristicLineCount}</span>
                  <span>Линии {entry.hypothesis.independentMatchedLineCount}</span>
                  <span>Δ {entry.hypothesis.meanAbsoluteDelta.toFixed(3)} нм</span>
                </span>
                {entry.rejectionReasons.length ? <span className={styles.diagnosticReasonCompact}>{diagnosticReasonLabels[entry.rejectionReasons[0]]}</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <PanelEmptyState>
            {query
              ? "По вашему запросу элементы не найдены."
              : identificationTab === "hypotheses"
                ? analysis.rejectedHypotheses.length
                  ? "Основных гипотез нет. Перейдите во вкладку «Диагностика», чтобы изучить слабые совпадения."
                  : "Основные гипотезы не сформированы."
                : "Диагностических совпадений нет."}
          </PanelEmptyState>
        )}
      </div>
    </div>
  );
}

function hasHypothesisForElement(
  analysis: NonNullable<ReturnType<typeof useAnalysisWorkspace>["analysis"]>,
  symbol: string,
): boolean {
  return analysis.hypotheses.some((hypothesis) => hypothesis.symbol === symbol)
    || analysis.rejectedHypotheses.some((item) => item.hypothesis.symbol === symbol);
}

function SidePanelHeader({ title, onReset }: Readonly<{ title: string; onReset: () => void }>) {
  return (
    <header className={styles.sidePanelHeader}>
      <h2>{title}</h2>
      <button
        className={styles.iconButton}
        type="button"
        onClick={onReset}
        aria-label={`Сбросить: ${title.toLowerCase()}`}
        title="Сбросить к исходным значениям"
      >
        <RotateCcw size={15} aria-hidden="true" />
      </button>
    </header>
  );
}

function NumberParameter({
  id,
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}>) {
  return (
    <label className={styles.numberField} htmlFor={id}>
      <span>{label}</span>
      <span className={styles.numberInputWrap}>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span>{unit}</span>
      </span>
    </label>
  );
}

function CalculationFeedback({
  status,
  error,
}: Readonly<{
  status: ReturnType<typeof useAnalysisWorkspace>["calculationStatus"];
  error: string | null;
}>) {
  if (error) {
    return (
      <div className={styles.errorNotice} role="alert">
        <CircleAlert size={16} aria-hidden="true" />
        <div className={styles.noticeContent}>
          <strong>Не удалось обновить анализ</strong>
          <span>{error}</span>
          <small>Последний корректный результат сохранён.</small>
        </div>
      </div>
    );
  }
  if (status === "calculating") {
    return (
      <div className={styles.calculationNotice} role="status" aria-live="polite">
        <LoaderCircle className={styles.spinner} size={16} aria-hidden="true" />
        Обновляем графики и результаты…
      </div>
    );
  }
  return null;
}

function formatSigned(value: number): string {
  if (value === 0) return "0.000";
  return `${value > 0 ? "+" : ""}${value.toFixed(3)}`;
}

function formatValue(value: number | undefined, precision: number): string {
  return value === undefined ? "—" : value.toFixed(precision);
}

function formatCandidateLine(candidate: SpectralLineCandidate): string {
  const label = candidate.ionizationLabel
    ? `${candidate.elementSymbol} ${candidate.ionizationLabel}`
    : candidate.elementSymbol;
  return `${label} · ${candidate.line.toFixed(3)}`;
}
