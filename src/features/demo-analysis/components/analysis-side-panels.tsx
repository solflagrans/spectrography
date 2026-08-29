"use client";

import { CircleAlert, LoaderCircle, RotateCcw } from "lucide-react";

import type { DemoHypothesisStatus } from "@/application/demo-analysis/create-demo-analysis";
import { useDemoAnalysis } from "@/features/demo-analysis/model/demo-analysis-context";

import styles from "./analysis-page.module.css";

const statusLabels: Record<DemoHypothesisStatus, string> = {
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
  } = useDemoAnalysis();

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
    parameters,
    calculationStatus,
    parameterError,
    resetPeakSearchParameters,
    updatePeakSearchParameters,
  } = useDemoAnalysis();

  return (
    <div className={styles.sidePanelContent}>
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
  );
}

export function IdentificationLinesPanel() {
  const { analysis } = useDemoAnalysis();
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
          <p>Справочная библиотека · {analysis.libraryVersion}</p>
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
                <tr key={`${line.peakId}-${line.referenceWavelength}`}>
                  <td>{line.ion}<br />{line.referenceWavelength.toFixed(2)}</td>
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
  status: ReturnType<typeof useDemoAnalysis>["calculationStatus"];
  error: string | null;
}>) {
  if (error) {
    return <div className={styles.errorNotice} role="alert"><CircleAlert size={16} />{error}</div>;
  }
  if (status === "calculating") {
    return (
      <div className={styles.calculationNotice} role="status" aria-live="polite">
        <LoaderCircle className={styles.spinner} size={16} aria-hidden="true" />
        Пересчитываем анализ…
      </div>
    );
  }
  return null;
}

function SideStatus({ status }: Readonly<{ status: DemoHypothesisStatus }>) {
  const tone = status === "confirmed" ? "success" : status === "possible" ? "info" : "warning";
  return <span className={`${styles.tag} ${styles[`tag_${tone}`]}`}>{statusLabels[status]}</span>;
}

function formatSigned(value: number): string {
  return value === 0 ? "0.000" : `+${value.toFixed(3)}`;
}
