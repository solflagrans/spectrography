"use client";

import {
  ArrowRight,
  Check,
  CircleAlert,
  Database,
  FlaskConical,
  Link2,
  LoaderCircle,
  Ruler,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";

import type {
  AnalysisHypothesisStatus,
  WorkingAnalysis,
} from "@/application/analysis/create-working-analysis";
import type { MatchedPeak } from "@/domain/spectrum";
import { useAnalysisWorkspace } from "@/features/demo-analysis/model/analysis-workspace-context";

import styles from "./analysis-page.module.css";
import { SpectrumChart } from "./spectrum-chart";

const statusLabels: Record<AnalysisHypothesisStatus, string> = {
  confirmed: "Подтверждён",
  possible: "Возможен",
  review: "Требует проверки",
};

export function DataAnalysisPage() {
  const { analysis } = useAnalysisWorkspace();

  if (!analysis) {
    return (
      <section className={styles.welcome} aria-labelledby="data-empty-title">
        <div className={styles.welcomeIcon} aria-hidden="true">
          <Database size={27} strokeWidth={1.65} />
        </div>
        <h1 id="data-empty-title">Данные спектра ещё не открыты</h1>
        <p>
          Выберите JSON-, XLSX- или RAW8-файл либо откройте встроенный пример, чтобы запустить
          интерактивный анализ.
        </p>
        <SpectrumImportControls />
        <span className={styles.transientNote}>Состояние сбросится после перезагрузки страницы</span>
      </section>
    );
  }

  const datasetDetails: Array<readonly [string, string]> = [
    ["Файл", analysis.source.fileName],
    ["Источник", analysis.source.kind],
    ["Формат", analysis.source.format],
    ["Единицы", analysis.source.units],
  ];
  if (analysis.instrumentMetadata) {
    datasetDetails.push(
      ["Серийный номер", analysis.instrumentMetadata.serialNumber || "Не указан"],
      ["Время интеграции", `${formatNumber(analysis.instrumentMetadata.integrationTimeMs)} мс`],
      ["Усреднений", String(analysis.instrumentMetadata.averages)],
    );
  }

  return (
    <AnalysisPage title="Данные">
      <SpectrumImportControls compact />
      <Card
        title="Обзор исходного спектра"
        accessory={<Tag tone="neutral">Сырой сигнал</Tag>}
      >
        <SpectrumChart dataset={analysis.rawDataset} label={`Исходный спектр ${analysis.source.fileName}`} />
      </Card>

      <MetricGrid>
        <Metric label="Диапазон" value={`${formatNumber(analysis.wavelengthRange.minimum)}–${formatNumber(analysis.wavelengthRange.maximum)} нм`} />
        <Metric label="Точек" value={String(analysis.rawDataset.wavelengths.length)} />
        <Metric label="Минимум" value={analysis.rawStats.minimum.toFixed(2)} />
        <Metric label="Максимум" value={analysis.rawStats.maximum.toFixed(2)} />
        <Metric label="Среднее" value={analysis.rawStats.mean.toFixed(2)} />
        <Metric label="Шаг" value={`~${analysis.wavelengthStep} нм`} />
      </MetricGrid>

      <div className={styles.twoColumns}>
        <Card title="Сведения о наборе">
          <DefinitionList items={datasetDetails} />
        </Card>
        <Card title="Проверка целостности">
          <div className={styles.checkList}>
            <CheckRow>Массивы длин волн и интенсивностей согласованы</CheckRow>
            <CheckRow>Значения конечны, длины волн не дублируются</CheckRow>
            <CheckRow>Исходный набор сохранён отдельно от подготовленного</CheckRow>
            {analysis.auxiliaryData ? (
              <CheckRow>Массивы dark и reference сохранены без применения к сигналу</CheckRow>
            ) : null}
          </div>
        </Card>
      </div>
    </AnalysisPage>
  );
}

function SpectrumImportControls({ compact = false }: Readonly<{ compact?: boolean }>) {
  const {
    importError,
    importSpectrumFile,
    importStatus,
    openDemoAnalysis,
  } = useAnalysisWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isReading = importStatus === "reading";

  const acceptFile = (file: File | undefined) => {
    if (!file || isReading) return;
    void importSpectrumFile(file);
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  };

  return (
    <section className={`${styles.importPanel} ${compact ? styles.importPanelCompact : ""}`} aria-label="Импорт спектра">
      <div
        className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ""}`}
        role="group"
        aria-label="Область загрузки файла"
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
        }}
        onDrop={handleDrop}
        aria-busy={isReading}
      >
        <span className={styles.dropZoneIcon} aria-hidden="true">
          {isReading ? <LoaderCircle className={styles.spinner} size={20} /> : <Upload size={20} />}
        </span>
        <div className={styles.dropZoneCopy}>
          <strong>{isReading ? "Читаем и проверяем файл…" : "Перетащите спектр сюда"}</strong>
          <span>JSON, XLSX или RAW8 · до 10 000 точек</span>
        </div>
        <input
          ref={inputRef}
          className={styles.fileInput}
          type="file"
          accept=".json,.xlsx,.raw8,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleInput}
          aria-label="Файл спектра"
          disabled={isReading}
        />
        <button
          className={styles.fileButton}
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isReading}
        >
          Выбрать файл
        </button>
      </div>
      <div className={styles.demoImportAction}>
        <button type="button" onClick={openDemoAnalysis} disabled={isReading}>
          <Sparkles size={15} aria-hidden="true" />
          Открыть демонстрационный спектр
        </button>
      </div>
      {importError ? (
        <div className={styles.importError} role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <span>{importError}</span>
        </div>
      ) : null}
    </section>
  );
}

export function ProcessingAnalysisPage() {
  const analysis = useRequiredAnalysis();
  if (!analysis) return <AnalysisUnavailable section="Обработка" />;
  const sortingOperation = analysis.transformations.find((operation) => operation.id === "sorting");

  return (
    <AnalysisPage title="Обработка">
      <Card title="Подготовленный спектр" accessory={<Tag tone="neutral">Предпросмотр</Tag>}>
        <SpectrumChart
          fill
          dataset={analysis.preparedDataset}
          label={`Подготовленный спектр ${analysis.source.fileName}`}
        />
        {sortingOperation ? (
          <p className={styles.preparationNotice}>
            <Check size={14} aria-hidden="true" />
            {sortingOperation.description}
          </p>
        ) : null}
      </Card>
    </AnalysisPage>
  );
}

export function PeaksAnalysisPage() {
  const analysis = useRequiredAnalysis();
  if (!analysis) return <AnalysisUnavailable section="Пики" />;

  return (
    <AnalysisPage
      title="Пики"
    >
      <Card
        title="Спектральная кривая и найденные пики"
        accessory={<Tag tone="neutral">Порог {analysis.threshold.toFixed(2)}</Tag>}
      >
        <SpectrumChart
          dataset={analysis.preparedDataset}
          peaks={analysis.peaks}
          threshold={analysis.threshold}
          label="Подготовленный спектр с отмеченными пиками"
        />
      </Card>
      <Card title="Найденные пики" accessory={<Tag tone="success">{analysis.peaks.length}</Tag>}>
        <PeakTable peaks={analysis.peaks} />
      </Card>
    </AnalysisPage>
  );
}

export function IdentificationAnalysisPage() {
  const analysis = useRequiredAnalysis();
  if (!analysis) return <AnalysisUnavailable section="Идентификация" />;
  const leading = analysis.hypotheses[0];

  return (
    <AnalysisPage title="Идентификация">
      {leading ? (
        <Card
          title={`Линии гипотезы: ${leading.name} (${leading.symbol})`}
          accessory={<StatusTag status={leading.status} />}
        >
          <SpectrumChart
            compact
            dataset={analysis.preparedDataset}
            peaks={analysis.peaks.filter((peak) => peak.match?.elementSymbol === leading.symbol)}
            referenceLines={leading.evidence.map((line) => ({
              label: `${line.ion} ${line.referenceWavelength.toFixed(2)}`,
              wavelength: line.referenceWavelength,
            }))}
            label={`Спектр и справочные линии ${leading.name}`}
          />
        </Card>
      ) : null}

      <Card title="Гипотезы совпадений">
        {analysis.hypotheses.length ? (
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.hypothesisTable}`}>
              <thead>
                <tr>
                  <th>Элемент</th>
                  <th>Статус оценки</th>
                  <th>Найдено линий</th>
                  <th>Ранжирование</th>
                  <th>Пояснение</th>
                </tr>
              </thead>
              <tbody>
                {analysis.hypotheses.map((hypothesis) => (
                  <tr key={hypothesis.symbol}>
                    <td><strong>{hypothesis.symbol}</strong> · {hypothesis.name}</td>
                    <td><StatusTag status={hypothesis.status} /></td>
                    <td><code>{hypothesis.evidence.length}</code></td>
                    <td><code>{hypothesis.heuristicScore.toFixed(2)}</code></td>
                    <td className={styles.hypothesisExplanation}>{hypothesis.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <InlineEmptyState>При текущих параметрах совпадений со справочными линиями нет.</InlineEmptyState>
        )}
      </Card>
    </AnalysisPage>
  );
}

export function ResultAnalysisPage() {
  const analysis = useRequiredAnalysis();
  if (!analysis) return <AnalysisUnavailable section="Результат" />;

  return (
    <AnalysisPage title="Результат">
      <section className={styles.conclusion}>
        <div className={styles.conclusionIcon} aria-hidden="true">
          <FlaskConical size={22} />
        </div>
        <div>
          <span className={styles.eyebrow}>Сводное заключение</span>
          <h2>{analysis.title}</h2>
          <p>{analysis.conclusion}</p>
        </div>
      </section>

      <div className={styles.twoColumns}>
        <MetricCard label="Источник данных" value={`${analysis.source.kind} · ${analysis.rawDataset.wavelengths.length} точки`} />
        <MetricCard label="Справочная библиотека" value={`Встроенная · ${analysis.libraryVersion}`} />
      </div>

      <Card title="Прослеживаемость вывода">
        <div className={styles.traceList}>
          {analysis.hypotheses.map((hypothesis) => (
            <article className={styles.traceCard} key={hypothesis.symbol}>
              <header>
                <div>
                  <h3>{hypothesis.name} ({hypothesis.symbol})</h3>
                  <p>{hypothesis.explanation}</p>
                </div>
                <StatusTag status={hypothesis.status} />
              </header>
              <div className={styles.evidenceList}>
                {hypothesis.evidence.map((line) => (
                  <div className={styles.evidenceRow} key={`${line.peakId}-${line.referenceWavelength}`}>
                    <Link2 size={14} aria-hidden="true" />
                    <span>Пик {line.peakWavelength.toFixed(2)} нм</span>
                    <ArrowRight size={13} aria-hidden="true" />
                    <span>{line.ion} {line.referenceWavelength.toFixed(2)} нм</span>
                    <span className={styles.deviationValue}>
                      <Ruler size={13} aria-hidden="true" />
                      {formatDelta(line.delta)} нм
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
          {analysis.unmatchedPeaks.length ? (
            <article className={styles.traceCard}>
              <header>
                <div>
                  <h3>Пики без совпадения</h3>
                  <p>Сохранены как полноценный неопределённый результат.</p>
                </div>
                <Tag tone="danger">{analysis.unmatchedPeaks.length}</Tag>
              </header>
              <div className={styles.evidenceList}>
                {analysis.unmatchedPeaks.map((peak) => (
                  <div className={styles.evidenceRow} key={peak.id}>
                    <CircleAlert size={14} aria-hidden="true" />
                    <span>Пик {peak.wavelength.toFixed(2)} нм</span>
                    <span className={styles.muted}>Нет линии в пределах допуска</span>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      </Card>
    </AnalysisPage>
  );
}

function AnalysisPage({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  const { calculationStatus, parameterError } = useAnalysisWorkspace();
  const accessory = calculationStatus === "calculating"
    ? <Tag tone="info">Пересчёт…</Tag>
    : parameterError
      ? <Tag tone="danger">Проверьте параметры</Tag>
      : <Tag tone="neutral">Интерактивный анализ</Tag>;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{title}</h1>
        </div>
        {accessory}
      </header>
      {children}
    </div>
  );
}

function InlineEmptyState({ children }: Readonly<{ children: ReactNode }>) {
  return <p className={styles.inlineEmpty}>{children}</p>;
}

function AnalysisUnavailable({ section }: Readonly<{ section: string }>) {
  return (
    <section className={styles.unavailable}>
      <Database size={28} aria-hidden="true" />
      <h1>{section}</h1>
      <p>Сначала откройте встроенный пример в разделе «Данные».</p>
      <Link className={styles.secondaryButton} href="/data">
        Перейти к данным
      </Link>
    </section>
  );
}

function Card({
  title,
  accessory,
  children,
}: Readonly<{ title: string; accessory?: ReactNode; children: ReactNode }>) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <h2>{title}</h2>
        {accessory}
      </header>
      {children}
    </section>
  );
}

function MetricGrid({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={styles.metricGrid}>{children}</div>;
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className={styles.metricCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DefinitionList({ items }: Readonly<{ items: readonly (readonly [string, string])[] }>) {
  return (
    <dl className={styles.definitionList}>
      {items.map(([term, description]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{description}</dd>
        </div>
      ))}
    </dl>
  );
}

function CheckRow({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div>
      <span aria-hidden="true"><Check size={13} /></span>
      <p>{children}</p>
    </div>
  );
}

function PeakTable({ peaks }: Readonly<{ peaks: readonly (MatchedPeak & { readonly id: string })[] }>) {
  if (!peaks.length) {
    return <InlineEmptyState>При текущих параметрах пики не обнаружены.</InlineEmptyState>;
  }

  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>№</th>
            <th>Длина волны</th>
            <th>Интенсивность</th>
            <th>Справочная линия</th>
            <th>Отклонение</th>
          </tr>
        </thead>
        <tbody>
          {peaks.map((peak, index) => (
            <tr key={peak.id}>
              <td>{index + 1}</td>
              <td><code>{peak.wavelength.toFixed(2)} нм</code></td>
              <td><code>{peak.intensity.toFixed(3)}</code></td>
              <td>{peak.match ? `${peak.match.elementSymbol} I · ${peak.match.line.toFixed(2)} нм` : "Не найдено"}</td>
              <td><code>{peak.match ? `${formatDelta(peak.match.delta)} нм` : "—"}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusTag({ status }: Readonly<{ status: AnalysisHypothesisStatus }>) {
  const tone = status === "confirmed" ? "success" : status === "possible" ? "info" : "warning";
  return <Tag tone={tone}>{statusLabels[status]}</Tag>;
}

function Tag({
  tone,
  children,
}: Readonly<{ tone: "neutral" | "success" | "warning" | "danger" | "info"; children: ReactNode }>) {
  return <span className={`${styles.tag} ${styles[`tag_${tone}`]}`}>{children}</span>;
}

function useRequiredAnalysis(): WorkingAnalysis | null {
  return useAnalysisWorkspace().analysis;
}

function formatDelta(delta: number): string {
  return delta === 0 ? "0.000" : `+${delta.toFixed(3)}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
