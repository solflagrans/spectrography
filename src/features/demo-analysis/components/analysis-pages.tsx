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
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";

import type { WorkingAnalysis } from "@/application/analysis/create-working-analysis";
import type {
  AnalysisEvidenceLine,
  AnalyzedPeak,
  ElementInterpretation,
  SpectralLineCandidate,
} from "@/domain/spectrum";
import { useAnalysisWorkspace } from "@/features/demo-analysis/model/analysis-workspace-context";
import {
  diagnosticReasonLabels,
  findIdentificationEntry,
} from "@/features/demo-analysis/model/identification-ui";

import styles from "./analysis-page.module.css";
import { SpectrumChart } from "./spectrum-chart";

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
        <span className={styles.transientNote}>Анализ хранится только до перезагрузки страницы</span>
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
        <SpectrumChart
          rawDataset={analysis.rawDataset}
          sourceKey={analysis.id}
          defaultVisibleLayers={["raw"]}
          showLayerControls={false}
          label={`Спектр ${analysis.source.fileName}`}
        />
      </Card>

      <MetricGrid>
        <Metric label="Диапазон" value={`${formatNumber(analysis.wavelengthRange.minimum)}–${formatNumber(analysis.wavelengthRange.maximum)} нм`} />
        <Metric label="Точек" value={String(analysis.rawDataset.wavelengths.length)} />
        <Metric label="Минимум" value={analysis.rawStats.minimum.toFixed(2)} />
        <Metric label="Максимум" value={analysis.rawStats.maximum.toFixed(2)} />
        <Metric label="Среднее" value={analysis.rawStats.mean.toFixed(2)} />
        <Metric label="Шаг" value={`~${analysis.wavelengthStep} нм`} />
      </MetricGrid>

      <Card title="Сведения о наборе">
        <DefinitionList items={datasetDetails} />
      </Card>
    </AnalysisPage>
  );
}

function SpectrumImportControls({ compact = false }: Readonly<{ compact?: boolean }>) {
  const {
    analysis,
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
          <div className={styles.noticeContent}>
            <strong>Файл не открыт</strong>
            <span>{importError}</span>
            <small>
              {analysis
                ? "Открытый анализ сохранён. Исправьте файл или выберите другой."
                : "Исправьте файл или выберите другой и попробуйте снова."}
            </small>
          </div>
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
          rawDataset={analysis.rawDataset}
          preparedDataset={analysis.preparedDataset}
          peaks={analysis.peaks}
          thresholdDataset={analysis.thresholdDataset}
          sourceKey={analysis.id}
          defaultVisibleLayers={["raw", "prepared"]}
          label={`Исходный и подготовленный спектры ${analysis.source.fileName}`}
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
  const { analysis, selectedPeakId, selectPeak } = useAnalysisWorkspace();
  if (!analysis) return <AnalysisUnavailable section="Пики" />;

  return (
    <AnalysisPage
      title="Пики"
    >
      <Card
        title="Спектральная кривая и найденные пики"
        accessory={<Tag tone="neutral">SNR ≥ {analysis.parameters.peakSearch.minimumSnr.toFixed(1)}</Tag>}
      >
        <SpectrumChart
          rawDataset={analysis.rawDataset}
          preparedDataset={analysis.preparedDataset}
          peaks={analysis.peaks}
          selectedPeakId={selectedPeakId}
          onPeakSelect={selectPeak}
          thresholdDataset={analysis.thresholdDataset}
          sourceKey={analysis.id}
          defaultVisibleLayers={["prepared", "threshold", "peaks"]}
          label="Подготовленный спектр с отмеченными пиками"
        />
      </Card>
      <Card title="Найденные пики" accessory={<Tag tone="success">{analysis.peaks.length}</Tag>}>
        <PeakTable
          peaks={analysis.peaks}
          selectedPeakId={selectedPeakId}
          onPeakSelect={selectPeak}
        />
      </Card>
    </AnalysisPage>
  );
}

export function IdentificationAnalysisPage() {
  const {
    analysis,
    hypothesisSelectionNotice,
    selectedHypothesisId,
    selectedIdentificationChannelId,
    selectedPeakId,
    selectIdentificationChannel,
    selectPeak,
  } = useAnalysisWorkspace();
  const router = useRouter();
  if (!analysis) return <AnalysisUnavailable section="Идентификация" />;
  if (!analysis.peaks.length) {
    return <AnalysisPage title="Идентификация"><InlineEmptyState>При текущих параметрах пики не найдены. Измените параметры поиска в разделе «Пики».</InlineEmptyState></AnalysisPage>;
  }
  if (analysis.peaks.every((peak) => peak.candidates.length === 0)) {
    return <AnalysisPage title="Идентификация"><InlineEmptyState>Для найденных пиков нет кандидатов спектральных линий в пределах текущего допуска.</InlineEmptyState></AnalysisPage>;
  }
  const selectedEntry = findIdentificationEntry(analysis, selectedHypothesisId);
  if (!selectedEntry) {
    return (
      <AnalysisPage title="Идентификация">
        <InlineEmptyState>
          {analysis.rejectedHypotheses.length
            ? "Основные гипотезы отсутствуют, но диагностические совпадения доступны в левой панели."
            : "Основные и диагностические гипотезы не сформированы."}
        </InlineEmptyState>
      </AnalysisPage>
    );
  }
  const hypothesis = selectedEntry.hypothesis;
  const channel = analysis.channels.find((item) => item.id === selectedIdentificationChannelId)
    ?? analysis.channels[0];
  if (!channel || !channel.usable) {
    return <AnalysisPage title="Идентификация"><InlineEmptyState>Выбранный канал недоступен или непригоден для анализа.</InlineEmptyState></AnalysisPage>;
  }
  const channelEvidence = hypothesis.evidence.filter((line) => line.observations.some((observation) => observation.channelId === channel.id));
  const supportingPeakIds = new Set(channelEvidence.flatMap((line) => line.observations.filter((observation) => observation.channelId === channel.id).map((observation) => observation.peakId)));
  const supportingPeaks = channel.peaks.filter((peak) => supportingPeakIds.has(peak.id));
  const missingReferenceLines = hypothesis.missingCharacteristicLines.filter((line) => (
    line.wavelength >= channel.wavelengthRange.minimum && line.wavelength <= channel.wavelengthRange.maximum
  ));

  return (
    <AnalysisPage title="Идентификация">
      {hypothesisSelectionNotice ? (
        <div className={styles.selectionNotice} role="status">Выбранная гипотеза больше недоступна после пересчёта. Открыта первая доступная.</div>
      ) : null}

      <section className={styles.hypothesisOverview} aria-labelledby="selected-hypothesis-title">
        <div className={styles.hypothesisOverviewHeading}>
          <span className={styles.rankBadge}>{selectedEntry.tab === "hypotheses" ? `#${selectedEntry.rank}` : "Диагностика"}</span>
          <div>
            <h2 id="selected-hypothesis-title">{hypothesis.name} ({hypothesis.symbol})</h2>
            <p>{hypothesis.explanation}</p>
          </div>
        </div>
        <div className={styles.identificationMetrics}>
          <Metric label="Степени ионизации" value={hypothesis.ionizationStages.map(toRoman).join(", ") || "—"} />
          <Metric label="Характерные линии" value={`${hypothesis.foundCharacteristicLineCount} / ${hypothesis.availableCharacteristicLineCount}`} />
          <Metric label="Независимые совпадения" value={String(hypothesis.independentMatchedLineCount)} />
          <Metric label="Среднее отклонение" value={`${hypothesis.meanAbsoluteDelta.toFixed(3)} нм`} />
        </div>
        {selectedEntry.rejectionReasons.length ? (
          <div className={styles.diagnosticReasons} aria-label="Причины диагностического результата">
            <strong>Не вошла в основной список</strong>
            <ul>{selectedEntry.rejectionReasons.map((reason) => <li key={reason}>{diagnosticReasonLabels[reason]}</li>)}</ul>
          </div>
        ) : null}
      </section>

      <Card
        title={`Спектр канала: ${channel.name}`}
        accessory={analysis.channels.length > 1 ? (
          <label className={styles.channelPicker} htmlFor="identification-channel">
            <span>Канал</span>
            <select id="identification-channel" value={channel.id} onChange={(event) => selectIdentificationChannel(event.target.value)}>
              {analysis.channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        ) : undefined}
      >
        <SpectrumChart
          compact
          preparedDataset={channel.preparedDataset}
          peaks={supportingPeaks}
          selectedPeakId={selectedPeakId}
          onPeakSelect={selectPeak}
          referenceLines={channelEvidence.map((line) => ({ label: `${formatEvidenceLabel(line)} ${line.referenceWavelength.toFixed(2)}`, wavelength: line.referenceWavelength }))}
          missingReferenceLines={missingReferenceLines.map((line) => ({ label: `${hypothesis.symbol} ${line.ionizationLabel} ${line.wavelength.toFixed(2)}`, wavelength: line.wavelength }))}
          sourceKey={`${analysis.id}:${channel.id}`}
          defaultVisibleLayers={["prepared", "peaks", "referenceLines", "missingReferenceLines"]}
          label={`Спектр канала ${channel.name} и линии гипотезы ${hypothesis.name}`}
        />
      </Card>

      <div className={styles.identificationDetailGrid}>
        <Card title="Основания ранжирования">
          <ul className={styles.reasonList}>{hypothesis.rankingReasons.map((reason) => <li key={reason.code}><span>{reason.description}</span><code>{formatReasonValue(reason.code, reason.value)}</code></li>)}</ul>
        </Card>
        <Card title="Случайное согласование">
          <dl className={styles.randomAgreementGrid}>
            <div><dt>Наблюдалось</dt><dd>{hypothesis.randomAgreement.observedAgreements}</dd></div>
            <div><dt>Эталонное ожидание</dt><dd>{hypothesis.randomAgreement.expectedAgreements.toFixed(2)}</dd></div>
            <div><dt>Пиков в диапазоне</dt><dd>{hypothesis.randomAgreement.peakCount}</dd></div>
            <div><dt>Плотность линий</dt><dd>{hypothesis.randomAgreement.characteristicLineDensityPerNm.toFixed(4)} / нм</dd></div>
          </dl>
          <p className={styles.detailNote}>Это диагностическое сравнение с равномерным случайным согласованием, а не вероятность присутствия элемента.</p>
        </Card>
      </div>

      <Card title="Доказательства по степеням ионизации">
        <div className={styles.ionizationGroups}>
          {hypothesis.ionizationGroups.map((group) => (
            <section key={group.ionizationStage}>
              <h3>{hypothesis.symbol} {group.ionizationLabel}</h3>
              <dl>
                <div><dt>Найдено характерных</dt><dd>{group.foundCharacteristicLineIds.length}</dd></div>
                <div><dt>Доступно характерных</dt><dd>{group.availableCharacteristicLines.length}</dd></div>
                <div><dt>Согласованных линий</dt><dd>{group.evidence.length}</dd></div>
              </dl>
              <div className={styles.ionizationLineSummary}>
                <div>
                  <strong>Найденные характерные линии</strong>
                  {group.evidence.length ? (
                    <ul>{group.evidence.map((line) => <li key={line.lineId}>{line.referenceWavelength.toFixed(3)} нм</li>)}</ul>
                  ) : <span>Нет найденных линий</span>}
                </div>
                <div>
                  <strong>Без найденного пика</strong>
                  {group.missingCharacteristicLines.length ? (
                    <ul>{group.missingCharacteristicLines.map((line) => <li key={line.lineId}>{line.wavelength.toFixed(3)} нм</li>)}</ul>
                  ) : <span>Нет пропущенных линий</span>}
                </div>
              </div>
            </section>
          ))}
        </div>
        <div className={styles.channelObservationList} aria-label="Наблюдения по каналам">
          {hypothesis.observationsByChannel.map((summary) => (
            <button key={summary.channelId} type="button" onClick={() => selectIdentificationChannel(summary.channelId)} aria-pressed={summary.channelId === channel.id}>
              {analysis.channels.find((item) => item.id === summary.channelId)?.name ?? summary.channelId}
              <span>{summary.observationCount} набл.</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Подтверждающие линии" accessory={<Tag tone="neutral">{hypothesis.evidence.length}</Tag>}>
        <EvidenceTable
          analysis={analysis}
          hypothesis={hypothesis}
          onObservationOpen={(peakId, channelId) => {
            selectIdentificationChannel(channelId);
            selectPeak(peakId);
          }}
          onPeakOpen={(peakId) => {
            selectPeak(peakId);
            router.push("/peaks");
          }}
        />
      </Card>

      <Card title="Характерные линии без найденного пика">
        {hypothesis.availableCharacteristicLineCount === 0 ? (
          <InlineEmptyState>Для этой гипотезы в покрываемом диапазоне нет данных для оценки характерных линий.</InlineEmptyState>
        ) : hypothesis.missingCharacteristicLines.length ? (
          <div className={styles.missingLineList}>
            {hypothesis.missingCharacteristicLines.map((line) => (
              <div key={line.lineId}><code>{line.wavelength.toFixed(3)} нм</code><span>{hypothesis.symbol} {line.ionizationLabel}</span><span>Отн. интенсивность {line.relativeIntensity}</span></div>
            ))}
          </div>
        ) : <InlineEmptyState>Все доступные характерные линии имеют сопоставленное наблюдение.</InlineEmptyState>}
        <p className={styles.detailNote}>Видимость линии зависит от условий измерения и чувствительности прибора; отсутствие пика само по себе не доказывает отсутствие элемента.</p>
      </Card>
    </AnalysisPage>
  );
}

function EvidenceTable({
  analysis,
  hypothesis,
  onObservationOpen,
  onPeakOpen,
}: Readonly<{
  analysis: WorkingAnalysis;
  hypothesis: ElementInterpretation;
  onObservationOpen: (peakId: string, channelId: string) => void;
  onPeakOpen: (peakId: string) => void;
}>) {
  if (!hypothesis.evidence.length) {
    return <InlineEmptyState>У этой гипотезы нет согласованных линий.</InlineEmptyState>;
  }

  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.table} ${styles.evidenceTable}`}>
        <thead>
          <tr>
            <th>Линия</th>
            <th>Справочная λ</th>
            <th>Тип и среда</th>
            <th>Наблюдения</th>
            <th>Пик λ</th>
            <th>Отклонение</th>
            <th>SNR</th>
            <th>Альтернативы</th>
            <th><span className={styles.visuallyHidden}>Действия</span></th>
          </tr>
        </thead>
        <tbody>
          {hypothesis.evidence.map((line) => {
            const alternatives = [...new Set(line.observations.flatMap((observation) => (
              hypothesis.alternativeExplanations.find((item) => item.peakId === observation.peakId && item.channelId === observation.channelId)?.elementSymbols ?? []
            )))].filter((symbol) => symbol !== hypothesis.symbol);
            const firstObservation = line.observations[0];
            return (
              <tr key={line.lineId}>
                <td><strong>{formatEvidenceLabel(line)}</strong></td>
                <td><code>{line.referenceWavelength.toFixed(3)} нм</code></td>
                <td>{formatWavelengthOrigin(line.wavelengthType)} · {formatWavelengthMedium(line.wavelengthMedium)}</td>
                <td>
                  <div className={styles.observationStack}>
                    {line.observations.map((observation) => (
                      <button key={`${observation.channelId}-${observation.peakId}`} type="button" onClick={() => onObservationOpen(observation.peakId, observation.channelId)}>
                        {analysis.channels.find((item) => item.id === observation.channelId)?.name ?? observation.channelId}
                      </button>
                    ))}
                  </div>
                </td>
                <td><div className={styles.valueStack}>{line.observations.map((observation) => <code key={`${observation.channelId}-${observation.peakId}`}>{observation.peakWavelength.toFixed(3)} нм</code>)}</div></td>
                <td><div className={styles.valueStack}>{line.observations.map((observation) => <code key={`${observation.channelId}-${observation.peakId}`}>{formatSignedDelta(observation.delta)} нм</code>)}</div></td>
                <td><div className={styles.valueStack}>{line.observations.map((observation) => <code key={`${observation.channelId}-${observation.peakId}`}>{Number.isFinite(observation.snr) ? observation.snr.toFixed(2) : "∞"}</code>)}</div></td>
                <td>{alternatives.length ? alternatives.join(", ") : "—"}</td>
                <td>{firstObservation ? <button className={styles.tableAction} type="button" onClick={() => onPeakOpen(firstObservation.peakId)}>Открыть пик</button> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
        <MetricCard label="Справочная библиотека" value={analysis.libraryLabel} />
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
                <Tag tone="info">Многолинейная гипотеза</Tag>
              </header>
              <div className={styles.evidenceList}>
                {hypothesis.evidence.map((line) => (
                  <div className={styles.evidenceRow} key={`${line.peakId}-${line.lineId}`}>
                    <Link2 size={14} aria-hidden="true" />
                    <span>Пик {line.peakWavelength.toFixed(2)} нм</span>
                    <ArrowRight size={13} aria-hidden="true" />
                    <span>{formatEvidenceLabel(line)} {line.referenceWavelength.toFixed(2)} нм</span>
                    <span className={styles.deviationValue}>
                      <Ruler size={13} aria-hidden="true" />
                      {formatSignedDelta(line.delta)} нм
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
    ? <Tag tone="info">Обновляем анализ…</Tag>
    : parameterError
      ? <Tag tone="danger">Изменения не применены</Tag>
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
      <p>Сначала откройте свой файл или демонстрационный спектр в разделе «Данные».</p>
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

function PeakTable({
  peaks,
  selectedPeakId,
  onPeakSelect,
}: Readonly<{
  peaks: readonly AnalyzedPeak[];
  selectedPeakId: string | null;
  onPeakSelect: (peakId: string) => void;
}>) {
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
            <tr
              key={peak.id}
              data-peak-id={peak.id}
              className={`${styles.selectableRow} ${peak.id === selectedPeakId ? styles.selectableRowSelected : ""}`}
              aria-selected={peak.id === selectedPeakId}
              tabIndex={0}
              onClick={() => onPeakSelect(peak.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onPeakSelect(peak.id);
                }
              }}
            >
              <td>{index + 1}</td>
              <td><code>{peak.wavelength.toFixed(2)} нм</code></td>
              <td><code>{peak.intensity.toFixed(3)}</code></td>
              <td>{peak.match ? `${formatCandidateLabel(peak.match)} · ${peak.match.line.toFixed(2)} нм` : "Не найдено"}</td>
              <td><code>{peak.match ? `${formatSignedDelta(peak.match.delta)} нм` : "—"}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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

function formatSignedDelta(delta: number): string {
  if (delta === 0) return "0.000";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(3)}`;
}

function formatCandidateLabel(candidate: SpectralLineCandidate): string {
  return candidate.ionizationLabel
    ? `${candidate.elementSymbol} ${candidate.ionizationLabel}`
    : candidate.elementSymbol;
}

function formatEvidenceLabel(line: AnalysisEvidenceLine): string {
  return line.ionizationLabel
    ? `${line.elementSymbol} ${line.ionizationLabel}`
    : line.elementSymbol;
}

function toRoman(stage: number): string {
  const numerals: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" };
  return numerals[stage] ?? String(stage);
}

function formatReasonValue(code: string, value: number): string {
  if (code === "characteristic-completeness") return `${Math.round(value * 100)}%`;
  if (code === "wavelength-agreement") return `${value.toFixed(3)} нм`;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatWavelengthOrigin(origin: "observed" | "ritz"): string {
  return origin === "observed" ? "наблюдаемая" : "Ritz";
}

function formatWavelengthMedium(medium: "air" | "vacuum"): string {
  return medium === "air" ? "воздух" : "вакуум";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
