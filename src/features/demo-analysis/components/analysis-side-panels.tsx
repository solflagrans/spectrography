"use client";

import { CircleAlert, LoaderCircle, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import type { AnalysisHypothesisStatus } from "@/application/analysis/create-working-analysis";
import type { AnalysisEvidenceLine, SpectralLineCandidate } from "@/domain/spectrum";
import { useAnalysisWorkspace } from "@/features/demo-analysis/model/analysis-workspace-context";

import styles from "./analysis-page.module.css";

const statusLabels: Record<AnalysisHypothesisStatus, string> = {
  confirmed: "Подтверждён",
  possible: "Возможен",
  review: "Требует проверки",
};

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
              <label htmlFor="detection-threshold">Порог обнаружения</label>
              <output htmlFor="detection-threshold">{parameters.peakSearch.threshold.toFixed(2)}</output>
            </div>
            <input
              id="detection-threshold"
              className={styles.rangeInput}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={parameters.peakSearch.threshold}
              onChange={(event) => updatePeakSearchParameters({ threshold: Number(event.target.value) })}
            />
            <p>Минимальная относительная высота сигнала в подготовленном спектре.</p>
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
  if (!analysis?.peaks.length) {
    return <PanelEmptyState>При текущих параметрах пики не найдены.</PanelEmptyState>;
  }
  if (!selectedPeak) {
    return <PanelEmptyState>Выберите пик на графике или в таблице, чтобы увидеть его параметры и кандидатов.</PanelEmptyState>;
  }

  const rawIntensity = analysis.rawDataset.intensities[selectedPeak.sourceIndex];

  return (
    <>
      <h2 className={styles.sidePanelTitle}>Пик {selectedPeak.wavelength.toFixed(2)} нм</h2>
      <dl className={styles.selectedPeakDetails}>
        <PeakDetail label="Длина волны" value={`${selectedPeak.wavelength.toFixed(3)} нм`} />
        <PeakDetail label="Исходная интенсивность" value={formatValue(rawIntensity, 4)} />
        <PeakDetail label="Подготовленная интенсивность" value={formatValue(selectedPeak.intensity, 4)} />
        <PeakDetail label="Выраженность" value={formatValue(selectedPeak.prominence, 4)} />
        <PeakDetail label="Порог в этой точке" value={formatValue(analysis.threshold, 4)} />
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
  const { analysis } = useAnalysisWorkspace();
  const leading = analysis?.hypotheses[0];

  if (!analysis || !leading) {
    return (
      <div className={styles.sidePanelContent}>
        <h2 className={styles.sidePanelTitle}>Найденные линии</h2>
        <p className={styles.sidePanelEmpty}>При текущих параметрах совпадающих линий нет.</p>
      </div>
    );
  }

  return (
    <div className={styles.sidePanelContent}>
      <header className={styles.linesPanelHeader}>
        <div>
          <h2>{leading.name} ({leading.symbol})</h2>
          <p>Справочная библиотека · {analysis.libraryLabel}</p>
        </div>
        <SideStatus status={leading.status} />
      </header>
      <section className={styles.linesSection} aria-labelledby="found-lines-title">
        <h3 id="found-lines-title">Найденные линии ({leading.evidence.length})</h3>
        <div className={styles.compactTableScroll}>
          <table className={styles.compactTable}>
            <thead>
              <tr>
                <th>Линия</th>
                <th>Наблюдено</th>
                <th>Откл.</th>
              </tr>
            </thead>
            <tbody>
              {leading.evidence.map((line) => (
                <tr key={`${line.peakId}-${line.lineId}`}>
                  <td>{formatEvidenceLabel(line)}<br />{line.referenceWavelength.toFixed(2)}</td>
                  <td>{line.observedWavelength.toFixed(2)}</td>
                  <td className={styles.compactDelta}>{formatSigned(line.delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
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

function SideStatus({ status }: Readonly<{ status: AnalysisHypothesisStatus }>) {
  const tone = status === "confirmed" ? "success" : status === "possible" ? "info" : "warning";
  return <span className={`${styles.tag} ${styles[`tag_${tone}`]}`}>{statusLabels[status]}</span>;
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

function formatEvidenceLabel(line: AnalysisEvidenceLine): string {
  return line.ionizationLabel
    ? `${line.elementSymbol} ${line.ionizationLabel}`
    : line.elementSymbol;
}
