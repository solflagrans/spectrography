"use client";

import {
  ArrowRight,
  CircleAlert,
  Database,
  FlaskConical,
  Info,
  Link2,
  LoaderCircle,
  Ruler,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Fragment } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";

import type { WorkingAnalysis } from "@/application/analysis/create-working-analysis";
import { builtinMolecularSystems } from "@/domain/molecular-spectrum";
import type { MolecularHypothesis, MolecularHypothesisReason } from "@/domain/molecular-spectrum";
import {
  BUILTIN_LIBRARY_LABEL,
  builtinSpectralLibrary,
  builtinSpectralLibraryManifest,
} from "@/domain/spectral-library/builtin-library";
import type {
  AnalysisEvidenceLine,
  AnalyzedPeak,
  ElementInterpretation,
  NewAnalysisSpectrumType,
  SpectralLineCandidate,
} from "@/domain/spectrum";
import { useAnalysisWorkspace } from "@/features/demo-analysis/model/analysis-workspace-context";
import {
  diagnosticReasonLabels,
  findIdentificationEntry,
} from "@/features/demo-analysis/model/identification-ui";

import styles from "./analysis-page.module.css";
import { SpectrumChart } from "./spectrum-chart";

const SPECTRUM_TYPE_OPTIONS = [
  { value: "plasma-emission", label: "Эмиссия плазмы/разряда" },
] as const satisfies readonly { value: NewAnalysisSpectrumType; label: string }[];

export function DataAnalysisPage() {
  const { analysis, selectedSpectrumType, updateSpectrumType } = useAnalysisWorkspace();

  if (!analysis) {
    return (
      <section className={styles.welcome} aria-labelledby="data-empty-title">
        <div className={styles.welcomeIcon} aria-hidden="true">
          <Database size={27} strokeWidth={1.65} />
        </div>
        <h1 id="data-empty-title">Открыть спектр</h1>
        <SpectrumImportControls />
      </section>
    );
  }

  const datasetDetails: Array<readonly [string, string]> = [
    ["Файл", analysis.source.fileName],
    ["Источник", analysis.source.kind],
    ["Формат", analysis.source.format],
    ["Единицы", analysis.source.units],
    ["Средняя интенсивность", analysis.rawStats.mean.toFixed(2)],
  ];
  if (analysis.instrumentMetadata) {
    datasetDetails.push(
      ["Серийный номер", analysis.instrumentMetadata.serialNumber || "Не указан"],
      ["Время интеграции", `${formatNumber(analysis.instrumentMetadata.integrationTimeMs)} мс`],
      ["Усреднений", String(analysis.instrumentMetadata.averages)],
    );
  }

  return (
    <AnalysisPage title="Данные" action={<SpectrumImportControls compact />}>
      <Card title="Исходный спектр">
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
        <Metric label="Количество точек" value={String(analysis.rawDataset.wavelengths.length)} />
        <Metric label="Интенсивность" value={`${analysis.rawStats.minimum.toFixed(2)}–${analysis.rawStats.maximum.toFixed(2)}`} />
        <Metric label="Средний шаг" value={`~${analysis.wavelengthStep} нм`} />
      </MetricGrid>

      <div className={styles.dataSummaryGrid}>
        <Card title="Измерение"><DefinitionList items={datasetDetails} /></Card>
        <Card title="Тип спектра">
          <label className={styles.spectrumTypeField} htmlFor="spectrum-type">
            <span>Тип спектра</span>
            <select id="spectrum-type" value={selectedSpectrumType} onChange={(event) => updateSpectrumType(event.target.value as NewAnalysisSpectrumType)}>
              {SPECTRUM_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </Card>
        <Card title="Качество измерения" accessory={<Tag tone={analysis.suitability.status === "sufficient" ? "success" : analysis.suitability.status === "limited" ? "warning" : "danger"}>{formatSuitabilityStatus(analysis.suitability.status)}</Tag>}>
          {analysis.channels.flatMap((channel) => channel.suitability.issues)[0] ? <p className={styles.qualityReason}>{analysis.channels.flatMap((channel) => channel.suitability.issues)[0].explanation}</p> : null}
          <details className={styles.technicalDisclosure}>
            <summary>Показатели качества</summary>
            {analysis.channels.map((channel) => (
              <div key={channel.id} className={styles.traceCard}>
                {analysis.channels.length > 1 ? <h3>{channel.name}</h3> : null}
                <dl className={styles.randomAgreementGrid}>
                  <div><dt>Полезный диапазон / шум</dt><dd>{Number.isFinite(channel.suitability.metrics.usefulDynamicRangeSnr) ? channel.suitability.metrics.usefulDynamicRangeSnr.toFixed(1) : "∞"}</dd></div>
                  <div><dt>Элементов разрешения</dt><dd>{channel.suitability.metrics.resolutionElements.toFixed(1)}</dd></div>
                  <div><dt>Дрейф базовой линии</dt><dd>{channel.suitability.metrics.baselineDriftRatio.toFixed(3)}</dd></div>
                  <div><dt>Одиночных выбросов</dt><dd>{channel.suitability.metrics.isolatedOutlierCount}</dd></div>
                  <div><dt>Разрешение</dt><dd>{channel.spectralResolutionNm.toFixed(3)} нм</dd></div>
                  <div><dt>Неопределённость шкалы</dt><dd>{channel.wavelengthCalibration.uncertaintyNm.toFixed(3)} нм</dd></div>
                </dl>
                <p className={styles.detailNote}>Коррекция шкалы: {channel.wavelengthCalibration.status === "applied" ? `${formatSignedDelta(channel.wavelengthCalibration.shiftNm)} нм` : "не применена"}; причина: {formatCalibrationReason(channel.wavelengthCalibration.reason)}.</p>
              </div>
            ))}
          </details>
        </Card>
      </div>
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

  if (compact) {
    return (
      <section className={styles.compactImport} aria-label="Замена спектра">
        <input ref={inputRef} className={styles.fileInput} type="file" accept=".json,.xlsx,.raw8,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleInput} aria-label="Файл спектра" disabled={isReading} />
        <button className={styles.replaceFileButton} type="button" onClick={() => inputRef.current?.click()} disabled={isReading}>
          {isReading ? "Читаем файл…" : "Заменить файл"}
        </button>
        {importError ? <div className={styles.importError} role="alert"><CircleAlert size={16} aria-hidden="true" /><div className={styles.noticeContent}><strong>Файл не открыт</strong><span>{importError}</span></div></div> : null}
      </section>
    );
  }

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
          <strong>{isReading ? "Читаем и проверяем файл…" : analysis ? "Перетащите новый спектр сюда" : "Перетащите спектр сюда"}</strong>
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
          {analysis ? "Заменить файл" : "Выбрать файл"}
        </button>
      </div>
      {!analysis ? <div className={styles.demoImportAction}>
        <button type="button" onClick={openDemoAnalysis} disabled={isReading}>
          <Sparkles size={15} aria-hidden="true" />
          Открыть демонстрационный спектр
        </button>
      </div> : null}
      {importError ? (
        <div className={styles.importError} role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <div className={styles.noticeContent}>
            <strong>Файл не открыт</strong>
            <span>{importError}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ProcessingAnalysisPage() {
  const analysis = useRequiredAnalysis();
  if (!analysis) return <AnalysisUnavailable section="Обработка" />;
  return (
    <AnalysisPage title="Обработка">
      <Card title="Подготовленный спектр">
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
      </Card>
    </AnalysisPage>
  );
}

export function PeaksAnalysisPage() {
  const { analysis, selectedPeakId, selectPeak } = useAnalysisWorkspace();
  if (!analysis) return <AnalysisUnavailable section="Анализ" />;

  return (
    <AnalysisPage
      title="Анализ"
    >
      <Card
        title="Пики"
        accessory={<Tag tone="neutral">{formatCount(analysis.peaks.length, "пик", "пика", "пиков")}</Tag>}
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
    setAnalysisView,
  } = useAnalysisWorkspace();
  if (!analysis) return <AnalysisUnavailable section="Анализ" />;
  const selectedMolecule = analysis.molecularHypotheses.find((item) => item.id === selectedHypothesisId);
  if (selectedMolecule) {
    return (
      <AnalysisPage title="Анализ">
        <AnalysisConclusion analysis={analysis} />
        <MolecularPrimaryDetail analysis={analysis} hypothesis={selectedMolecule} />
      </AnalysisPage>
    );
  }
  const selectedEntry = findIdentificationEntry(analysis, selectedHypothesisId);
  if (!selectedEntry) {
    return (
      <AnalysisPage title="Анализ">
        <AnalysisConclusion analysis={analysis} />
        <InlineEmptyState>
          {!analysis.peaks.length
            ? "Для атомной идентификации устойчивые пики не найдены."
            : analysis.peaks.every((peak) => peak.candidates.length === 0)
              ? "Для найденных пиков нет кандидатов атомных линий в пределах текущего допуска."
              : analysis.rejectedHypotheses.length
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
    return <AnalysisPage title="Анализ"><AnalysisConclusion analysis={analysis} /><InlineEmptyState>Выбранный канал недоступен или его качества недостаточно для интерпретации.</InlineEmptyState></AnalysisPage>;
  }
  const reliableEvidence = [...hypothesis.evidence]
    .filter((line) => line.isCharacteristic && line.strength !== "weak")
    .sort((left, right) => (right.strength === "strong" ? 1 : 0) - (left.strength === "strong" ? 1 : 0) || right.quality - left.quality);
  const channelEvidence = reliableEvidence.filter((line) => line.observations.some((observation) => observation.channelId === channel.id));
  const supportingPeakIds = new Set(channelEvidence.flatMap((line) => line.observations.filter((observation) => observation.channelId === channel.id).map((observation) => observation.peakId)));
  const supportingPeaks = channel.peaks.filter((peak) => supportingPeakIds.has(peak.id));

  return (
    <AnalysisPage title="Анализ">
      <AnalysisConclusion analysis={analysis} />
      {hypothesisSelectionNotice ? (
        <div className={styles.selectionNotice} role="status">Выбранная гипотеза больше недоступна после пересчёта. Открыта первая доступная.</div>
      ) : null}

      <section className={styles.hypothesisOverview} aria-labelledby="selected-hypothesis-title">
        <div className={styles.hypothesisOverviewHeading}>
          <div>
            <h2 id="selected-hypothesis-title">{hypothesis.name} ({hypothesis.symbol})</h2>
            <p>{hypothesis.explanation}</p>
          </div>
        </div>
        <div className={styles.reliableEvidenceSummary}>
          <strong>Ключевые признаки</strong>
          {reliableEvidence.length ? (
            <ul>{reliableEvidence.slice(0, 5).map((line) => (
              <li key={line.groupId}>
                <code>{formatGroupWavelength(line)}</code>
                <span>{line.elementSymbol} {line.ionizationLabel} · {line.strength === "strong" ? "сильная группа" : "поддерживающая группа"}</span>
              </li>
            ))}</ul>
          ) : <span>Качественных характерных групп недостаточно.</span>}
        </div>
        {selectedEntry.rejectionReasons.length ? (
          <div className={styles.diagnosticReasons} aria-label="Причины диагностического результата">
            <strong>Не вошла в основной список</strong>
            <ul>{selectedEntry.rejectionReasons.map((reason) => <li key={reason}>{diagnosticReasonLabels[reason]}</li>)}</ul>
          </div>
        ) : null}
      </section>

      <Card
        title={analysis.channels.length === 1 ? "Спектр" : `Спектр канала: ${channel.name}`}
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
          sourceKey={`${analysis.id}:${channel.id}`}
          defaultVisibleLayers={["prepared", "peaks", "referenceLines"]}
          label={`Спектр канала ${channel.name} и линии гипотезы ${hypothesis.name}`}
        />
      </Card>

      <details className={styles.technicalDisclosure}>
        <summary>Доказательства и показатели</summary>
        <section className={styles.evidenceSection} aria-labelledby="identification-summary-title">
        <h3 id="identification-summary-title">Сводка</h3>
        <div className={styles.identificationMetrics}>
          <Metric label="Степени ионизации" value={hypothesis.ionizationStages.map(toRoman).join(", ") || "—"} />
          <Metric label="Характерные группы" value={`${hypothesis.foundCharacteristicGroupCount} / ${hypothesis.availableCharacteristicGroupCount}`} />
          <Metric label="Независимые группы" value={String(hypothesis.independentMatchedGroupCount)} />
          <Metric label="Среднее отклонение" value={`${hypothesis.meanAbsoluteDelta.toFixed(3)} нм`} />
        </div>
        </section>
        <section className={styles.evidenceSection} aria-labelledby="diagnostic-metrics-title">
        <h3 id="diagnostic-metrics-title">Диагностические показатели</h3>
        <div className={styles.identificationDetailGrid}>
        <Card title="Основания ранжирования">
          <ul className={styles.reasonList}>{hypothesis.rankingReasons.map((reason) => <li key={reason.code}><span>{reason.description}</span><code>{formatReasonValue(reason.code, reason.value)}</code></li>)}</ul>
        </Card>
        <Card title="Случайное согласование">
          <dl className={styles.randomAgreementGrid}>
            <div><dt>Наблюдалось</dt><dd>{hypothesis.randomAgreement.observedAgreements}</dd></div>
            <div><dt>Ожидание для элемента</dt><dd>{hypothesis.randomAgreement.expectedAgreements.toFixed(2)}</dd></div>
            <div><dt>После перебора элементов</dt><dd>{hypothesis.randomAgreement.adjustedExpectedAgreements.toFixed(2)}</dd></div>
            <div><dt>Проверено элементов</dt><dd>{hypothesis.randomAgreement.testedElementCount}</dd></div>
            <div><dt>Требуется групп</dt><dd>{hypothesis.randomAgreement.requiredAgreements}</dd></div>
          </dl>
          <p className={styles.detailNote}>Это диагностическое сравнение с равномерным случайным согласованием, а не вероятность присутствия элемента.</p>
        </Card>
        </div>
        </section>

      <Card title="Совпавшие группы">
        <div className={styles.ionizationGroups}>
          {hypothesis.ionizationGroups.map((group) => (
            <section key={group.ionizationStage}>
              <h3>{hypothesis.symbol} {group.ionizationLabel}</h3>
              <dl>
                <div><dt>Найдено групп</dt><dd>{group.foundCharacteristicGroupIds.length}</dd></div>
                <div><dt>Доступно групп</dt><dd>{group.availableCharacteristicGroups.length}</dd></div>
                <div><dt>Согласованных групп</dt><dd>{group.evidence.length}</dd></div>
              </dl>
              <div className={styles.ionizationLineSummary}>
                <div>
                  <strong>Найденные характерные линии</strong>
                  {group.evidence.some((line) => line.isCharacteristic) ? (
                    <ul>{group.evidence.filter((line) => line.isCharacteristic).map((line) => <li key={line.groupId}>{formatGroupWavelength(line)}</li>)}</ul>
                  ) : <span>Нет найденных линий</span>}
                </div>
                <div>
                  <strong>Без найденного пика</strong>
                  {group.missingCharacteristicGroups.length ? (
                    <ul>{group.missingCharacteristicGroups.map((item) => <li key={item.id}>{item.representativeWavelength.toFixed(3)} нм</li>)}</ul>
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

      <Card title="Таблица доказательств" accessory={<Tag tone="neutral">{hypothesis.evidence.length}</Tag>}>
        <EvidenceTable
          analysis={analysis}
          hypothesis={hypothesis}
          onObservationOpen={(peakId, channelId) => {
            selectIdentificationChannel(channelId);
            selectPeak(peakId);
          }}
          onPeakOpen={(peakId) => {
            selectPeak(peakId);
            setAnalysisView("peaks");
          }}
        />
      </Card>

      <Card title="Ненайденные характерные линии">
        {hypothesis.availableCharacteristicGroupCount === 0 ? (
          <InlineEmptyState>Для этой гипотезы в покрываемом диапазоне нет данных для оценки характерных групп.</InlineEmptyState>
        ) : hypothesis.ionizationGroups.some((group) => group.missingCharacteristicGroups.length) ? (
          <div className={styles.missingLineList}>
            {hypothesis.ionizationGroups.flatMap((group) => group.missingCharacteristicGroups).map((item) => (
              <div key={item.id}><code>{item.representativeWavelength.toFixed(3)} нм</code><span>{hypothesis.symbol} {item.ionizationLabel}</span><span>{item.lines.length} линий в группе</span></div>
            ))}
          </div>
        ) : <InlineEmptyState>Все доступные характерные линии имеют сопоставленное наблюдение.</InlineEmptyState>}
        <p className={styles.detailNote}>Видимость линии зависит от условий измерения и чувствительности прибора; отсутствие пика само по себе не доказывает отсутствие элемента.</p>
      </Card>
      </details>
    </AnalysisPage>
  );
}

export function AnalysisAnalysisPage() {
  const { analysisView } = useAnalysisWorkspace();
  return analysisView === "composition" ? <IdentificationAnalysisPage /> : <PeaksAnalysisPage />;
}

function AnalysisConclusion({ analysis }: Readonly<{ analysis: WorkingAnalysis }>) {
  const { selectedHypothesisId, selectHypothesis } = useAnalysisWorkspace();
  const reliableItems = [
    ...analysis.hypotheses.map((hypothesis) => ({
      id: hypothesis.id,
      symbol: hypothesis.symbol,
      name: hypothesis.name,
    })),
    ...analysis.molecularHypotheses.map((hypothesis) => ({
      id: hypothesis.id,
      symbol: hypothesis.formula,
      name: hypothesis.displayName,
    })),
  ];
  const primary = reliableItems[0];
  const additional = reliableItems.slice(1);
  const molecularLine = analysis.molecularHypotheses.length
    ? `${analysis.molecularHypotheses.map((item) => item.formula).join(" и ")} обнаружены.`
    : analysis.rejectedMolecularHypotheses.length
      ? `${analysis.rejectedMolecularHypotheses.map((item) => item.formula).join(" и ")} не обнаружены.`
      : null;

  return (
    <section className={styles.analysisConclusion} aria-labelledby="analysis-conclusion-title">
      <div className={styles.analysisConclusionCopy}>
        <h2 id="analysis-conclusion-title">Основные гипотезы</h2>
        <p>{primary ? <><strong>{primary.name} ({primary.symbol})</strong> — основная гипотеза.{additional.length ? <> Дополнительные: {additional.map((item) => `${item.name.toLocaleLowerCase("ru-RU")} (${item.symbol})`).join(", ")}.</> : null}</> : "Надёжных гипотез о составе нет."}</p>
        <p>Качество измерения: {formatSuitabilityShort(analysis.suitability.status)}.</p>
        {molecularLine ? <p>{molecularLine}</p> : null}
        {reliableItems.length ? (
          <label className={styles.mobileHypothesisSelect}>
            <span>Выбрать гипотезу</span>
            <select
              value={reliableItems.some((item) => item.id === selectedHypothesisId) ? selectedHypothesisId ?? primary?.id : primary?.id}
              onChange={(event) => selectHypothesis(event.target.value, "hypotheses")}
            >
              {reliableItems.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.symbol})</option>)}
            </select>
          </label>
        ) : null}
      </div>
    </section>
  );
}

function MolecularPrimaryDetail({
  analysis,
  hypothesis,
}: Readonly<{ analysis: WorkingAnalysis; hypothesis: MolecularHypothesis }>) {
  const { selectedIdentificationChannelId, selectIdentificationChannel, selectedPeakId, selectPeak } = useAnalysisWorkspace();
  const channel = analysis.channels.find((item) => item.id === selectedIdentificationChannelId) ?? analysis.channels[0];
  if (!channel) return <InlineEmptyState>Канал измерения недоступен.</InlineEmptyState>;
  const observations = hypothesis.observations.filter((item) => item.channelId === channel.id && item.supported);
  const relatedPeakIds = new Set(observations.flatMap((item) => item.overlappingAtomicPeakIds));
  const relatedPeaks = channel.peaks.filter((peak) => relatedPeakIds.has(peak.id));

  return (
    <>
      <section className={styles.hypothesisOverview} aria-labelledby="selected-molecule-title">
        <div className={styles.hypothesisOverviewHeading}>
          <span className={styles.rankBadge}>Осторожный вывод</span>
          <div>
            <h2 id="selected-molecule-title">{hypothesis.displayName} ({hypothesis.formula})</h2>
            <p>{hypothesis.explanation}</p>
          </div>
        </div>
        <div className={styles.reliableEvidenceSummary}>
          <strong>Главные признаки</strong>
          <ul>{observations.map((observation) => (
            <li key={`${observation.channelId}-${observation.regionId}`}>
              <code>{observation.observedRange.minimum.toFixed(1)}–{observation.observedRange.maximum.toFixed(1)} нм</code>
              <span>Форма характерного участка согласуется с системой {hypothesis.systemName}</span>
            </li>
          ))}</ul>
        </div>
      </section>
      <Card
        title={`Связанные участки спектра: ${channel.name}`}
        accessory={analysis.channels.length > 1 ? (
          <label className={styles.channelPicker} htmlFor="molecular-channel">
            <span>Канал</span>
            <select id="molecular-channel" value={channel.id} onChange={(event) => selectIdentificationChannel(event.target.value)}>
              {analysis.channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        ) : undefined}
      >
        <SpectrumChart
          compact
          preparedDataset={channel.preparedDataset}
          peaks={relatedPeaks}
          selectedPeakId={selectedPeakId}
          onPeakSelect={selectPeak}
          highlightedRegions={observations.map((item) => ({
            label: item.regionId,
            minimum: item.observedRange.minimum,
            maximum: item.observedRange.maximum,
          }))}
          sourceKey={`${analysis.id}:${channel.id}`}
          defaultVisibleLayers={["prepared", "peaks", "regions"]}
          label={`Спектр канала ${channel.name} и области гипотезы ${hypothesis.formula}`}
        />
      </Card>
      <details className={styles.technicalDisclosure}>
        <summary>Технические подробности молекулярного сопоставления</summary>
        <MolecularHypothesisDetails hypothesis={hypothesis} />
      </details>
    </>
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
            <th>Группа</th>
            <th>Справочная длина</th>
            <th>Пик</th>
            <th>Отклонение</th>
            <th>SNR</th>
            <th>Качество</th>
          </tr>
        </thead>
        <tbody>
          {hypothesis.evidence.map((line) => {
            const alternatives = [...new Set(line.observations.flatMap((observation) => (
              hypothesis.alternativeExplanations.find((item) => item.peakId === observation.peakId && item.channelId === observation.channelId)?.elementSymbols ?? []
            )))].filter((symbol) => symbol !== hypothesis.symbol);
            const firstObservation = line.observations[0];
            return (
              <Fragment key={line.groupId}>
                <tr
                  className={styles.selectableRow}
                  tabIndex={firstObservation ? 0 : undefined}
                  onClick={() => {
                    if (!firstObservation) return;
                    onObservationOpen(firstObservation.peakId, firstObservation.channelId);
                    onPeakOpen(firstObservation.peakId);
                  }}
                  onKeyDown={(event) => {
                    if (firstObservation && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onObservationOpen(firstObservation.peakId, firstObservation.channelId);
                      onPeakOpen(firstObservation.peakId);
                    }
                  }}
                >
                  <td data-label="Группа"><strong>{formatEvidenceLabel(line)}</strong>{line.memberLineIds.length > 1 ? <small>{line.memberLineIds.length} линий</small> : null}</td>
                  <td data-label="Справочная длина"><code>{formatGroupWavelength(line)}</code></td>
                  <td data-label="Пик"><div className={styles.valueStack}>{line.observations.map((observation) => <code key={`${observation.channelId}-${observation.peakId}`}>{observation.peakWavelength.toFixed(3)} нм</code>)}</div></td>
                  <td data-label="Отклонение"><div className={styles.valueStack}>{line.observations.map((observation) => <code key={`${observation.channelId}-${observation.peakId}`}>{formatSignedDelta(observation.delta)} нм</code>)}</div></td>
                  <td data-label="SNR"><div className={styles.valueStack}>{line.observations.map((observation) => <code key={`${observation.channelId}-${observation.peakId}`}>{Number.isFinite(observation.snr) ? observation.snr.toFixed(2) : "∞"}</code>)}</div></td>
                  <td data-label="Качество"><span className={styles.qualityCell}>{line.strength === "strong" ? "Сильная" : line.strength === "moderate" ? "Поддерживающая" : "Слабая"}<code>{line.quality.toFixed(2)}</code></span></td>
                </tr>
                <tr className={styles.evidenceDetailRow}>
                  <td colSpan={6}>
                    <details>
                      <summary>Подробнее · {alternatives.length} {formatCountWord(alternatives.length, "альтернатива", "альтернативы", "альтернатив")}</summary>
                      <dl className={styles.rowDetailsGrid}>
                        <div><dt>Тип длины</dt><dd>{formatWavelengthOrigin(line.wavelengthType)}</dd></div>
                        <div><dt>Среда</dt><dd>{formatWavelengthMedium(line.wavelengthMedium)}</dd></div>
                        {analysis.channels.length > 1 ? <div><dt>Каналы</dt><dd>{line.observations.map((observation) => analysis.channels.find((item) => item.id === observation.channelId)?.name ?? observation.channelId).join(", ")}</dd></div> : null}
                        <div><dt>Альтернативные элементы</dt><dd>{alternatives.length ? alternatives.join(", ") : "Нет"}</dd></div>
                        <div><dt>Состав группы</dt><dd>{line.memberLineIds.join(", ")}</dd></div>
                        <div><dt>Наблюдений</dt><dd>{line.observations.length}</dd></div>
                      </dl>
                    </details>
                  </td>
                </tr>
              </Fragment>
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

      <Card title="Наиболее надёжные спектральные признаки">
        <div className={styles.evidenceList}>
          {analysis.hypotheses.flatMap((hypothesis) => hypothesis.evidence
            .filter((line) => line.isCharacteristic && line.strength !== "weak")
            .map((line) => ({ hypothesis, line })))
            .sort((left, right) => right.line.quality - left.line.quality)
            .slice(0, 6)
            .map(({ hypothesis, line }) => (
              <div className={styles.evidenceRow} key={`${hypothesis.id}-${line.groupId}`}>
                <Link2 size={14} aria-hidden="true" />
                <strong>{hypothesis.symbol}</strong>
                <span>{formatGroupWavelength(line)}</span>
                <span className={styles.muted}>{line.strength === "strong" ? "сильная группа" : "поддерживающая группа"}</span>
              </div>
            ))}
          {analysis.molecularHypotheses.map((hypothesis) => (
            <div className={styles.evidenceRow} key={hypothesis.id}>
              <Link2 size={14} aria-hidden="true" />
              <strong>{hypothesis.formula}</strong>
              <span>{hypothesis.supportedRegionIds.length} подтверждённых участка полосы</span>
              <span className={styles.muted}>{hypothesis.displayName}</span>
            </div>
          ))}
        </div>
      </Card>

      <details className={styles.technicalDisclosure}>
        <summary>Полная прослеживаемость, слабые совпадения и пики без кандидатов</summary>
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
                  <div className={styles.evidenceRow} key={line.groupId}>
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
          {analysis.rejectedHypotheses.length ? (
            <article className={styles.traceCard}>
              <header>
                <div>
                  <h3>Слабые и неоднозначные альтернативы</h3>
                  <p>Не используются в основном заключении и сохранены для проверки.</p>
                </div>
                <Tag tone="warning">{analysis.rejectedHypotheses.length}</Tag>
              </header>
              <div className={styles.evidenceList}>
                {analysis.rejectedHypotheses.map((item) => (
                  <div className={styles.evidenceRow} key={item.hypothesis.id}>
                    <CircleAlert size={14} aria-hidden="true" />
                    <strong>{item.hypothesis.name} ({item.hypothesis.symbol})</strong>
                    <span className={styles.muted}>{item.reasons.map((reason) => diagnosticReasonLabels[reason]).join("; ")}</span>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
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
          {analysis.rejectedMolecularHypotheses.length ? (
            <article className={styles.traceCard}>
              <header><div><h3>Отклонённые молекулярные варианты</h3><p>Сохранены как нормальный отрицательный результат.</p></div></header>
              <div className={styles.evidenceList}>
                {analysis.rejectedMolecularHypotheses.map((hypothesis) => (
                  <div className={styles.evidenceRow} key={hypothesis.id}>
                    <CircleAlert size={14} aria-hidden="true" />
                    <strong>{hypothesis.formula}</strong>
                    <span>{hypothesis.reasons.map(formatMolecularReason).join("; ")}</span>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      </Card>
      </details>
    </AnalysisPage>
  );
}

export function LibraryAnalysisPage() {
  const elements = [...new Map(builtinSpectralLibrary.map((line) => [line.element.symbol, line.element])).values()]
    .sort((left, right) => left.atomicNumber - right.atomicNumber);

  return (
    <AnalysisPage title="Библиотека" showAnalysisModes={false} summary={`${builtinSpectralLibraryManifest.lineCount.toLocaleString("ru-RU")} атомных линий · ${elements.length} ${formatCountWord(elements.length, "элемент", "элемента", "элементов")} · ${builtinMolecularSystems.length} ${formatCountWord(builtinMolecularSystems.length, "молекулярная система", "молекулярные системы", "молекулярных систем")}`}>
      <div className={styles.libraryGrid}>
        <Card title="Атомные линии" accessory={<Tag tone="neutral">{builtinSpectralLibraryManifest.lineCount.toLocaleString("ru-RU")}</Tag>}>
          <DefinitionList items={[
            ["Источник и версия", BUILTIN_LIBRARY_LABEL],
            ["Диапазон", `${builtinSpectralLibraryManifest.query.wavelengthRangeNm.minimum}–${builtinSpectralLibraryManifest.query.wavelengthRangeNm.maximum} нм`],
            ["Степени ионизации", "I–II"],
          ]} />
          <div className={styles.elementChips} aria-label="Элементы в атомной библиотеке">
            {elements.map((element) => <span key={element.symbol}><strong>{element.symbol}</strong>{element.name}</span>)}
          </div>
        </Card>
        <Card title="Молекулярные системы" accessory={<Tag tone="neutral">{builtinMolecularSystems.length}</Tag>}>
          <div className={styles.librarySystemList}>
            {builtinMolecularSystems.map((system) => (
              <article key={system.id}>
                <strong>{system.displayName} ({system.formula})</strong>
                <span>{system.transition}</span>
                <small>{system.wavelengthRange.minimum.toFixed(1)}–{system.wavelengthRange.maximum.toFixed(1)} нм · {system.characteristicRegions.length} характерных участка</small>
              </article>
            ))}
          </div>
        </Card>
      </div>
      <details className={styles.technicalDisclosure}>
        <summary>Источник и версии</summary>
        <DefinitionList items={[
          ["Атомная версия", builtinSpectralLibraryManifest.version],
          ["Получено", builtinSpectralLibraryManifest.retrievedAt],
          ["DOI", builtinSpectralLibraryManifest.doi],
          ["Контрольная сумма", `${builtinSpectralLibraryManifest.checksum.algorithm}: ${builtinSpectralLibraryManifest.checksum.value}`],
        ]} />
      </details>
    </AnalysisPage>
  );
}

function MolecularHypothesisDetails({ hypothesis }: Readonly<{ hypothesis: MolecularHypothesis }>) {
  return (
    <Card title={`${hypothesis.formula} · ${hypothesis.systemName}`} accessory={<Tag tone={hypothesis.accepted ? "success" : "warning"}>{hypothesis.accepted ? "Принята" : "Отклонена"}</Tag>}>
      <p className={styles.detailNote}>{hypothesis.transition}. Числовые показатели ниже являются эвристиками сравнения формы, а не вероятностью, температурой или концентрацией.</p>
      <dl className={styles.randomAgreementGrid}>
        <div><dt>Общее смещение</dt><dd>{formatSignedDelta(hypothesis.commonShiftNm)} нм</dd></div>
        <div><dt>Подтверждено участков</dt><dd>{hypothesis.supportedRegionIds.length}</dd></div>
        <div><dt>Не найдено участков</dt><dd>{hypothesis.missingExpectedRegionIds.length}</dd></div>
        <div><dt>Случайных смещений</dt><dd>{hypothesis.randomAgreement.testedOffsets}</dd></div>
      </dl>
      <div className={styles.molecularRegionTable}>
        {hypothesis.observations.map((observation) => (
          <div key={`${observation.channelId}-${observation.regionId}`}>
            <strong>{observation.observedRange.minimum.toFixed(1)}–{observation.observedRange.maximum.toFixed(1)} нм</strong>
            <span>{observation.supported ? "Подтверждает систему" : "Слабое или неоднозначное совпадение"}</span>
            <small>форма {observation.shapeCorrelation.toFixed(2)} · SNR {Number.isFinite(observation.contrastSnr) ? observation.contrastSnr.toFixed(1) : "∞"} · контраст {(observation.relativeContrast * 100).toFixed(1)}%</small>
            {observation.overlappingAtomicPeakIds.length ? <small>Перекрывается с {observation.overlappingAtomicPeakIds.length} атомным сигналом; повторно не суммируется</small> : null}
          </div>
        ))}
      </div>
      {hypothesis.missingExpectedRegionIds.length ? <p className={styles.detailNote}>Не поддержаны ожидаемые участки: <code>{hypothesis.missingExpectedRegionIds.join(", ")}</code>.</p> : null}
      {hypothesis.reasons.length ? <p className={styles.detailNote}>Причины: {hypothesis.reasons.map(formatMolecularReason).join("; ")}.</p> : null}
      <p className={styles.detailNote}>Источник: {hypothesis.source.name}, {hypothesis.source.datasetVersion}; {hypothesis.source.license}. SHA-256: <code>{hypothesis.source.filteredSourceSha256}</code>.</p>
    </Card>
  );
}

function formatMolecularReason(reason: MolecularHypothesisReason): string {
  const labels: Record<MolecularHypothesisReason, string> = {
    "spectrum-type-not-supported": "тип спектра не разрешает молекулярную интерпретацию",
    "insufficient-covered-regions": "диапазон покрывает меньше двух характерных участков",
    "single-region": "поддержан только один или ни одного участка",
    "weak-profile-agreement": "форма полосы согласуется недостаточно",
    "missing-key-region": "ключевой участок не найден",
    "random-like-profile": "результат не отделяется от случайных смещений",
  };
  return labels[reason];
}

function formatSuitabilityStatus(status: WorkingAnalysis["suitability"]["status"]): string {
  return status === "sufficient"
    ? "Достаточное качество"
    : status === "limited"
      ? "Ограниченное качество"
      : "Недостаточное качество";
}

function formatSuitabilityShort(status: WorkingAnalysis["suitability"]["status"]): string {
  return status === "sufficient" ? "достаточное" : status === "limited" ? "ограниченное" : "недостаточное";
}

function formatCount(value: number, one: string, few: string, many: string): string {
  return `${value} ${formatCountWord(value, one, few, many)}`;
}

function formatCountWord(value: number, one: string, few: string, many: string): string {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function formatCalibrationReason(reason: WorkingAnalysis["channels"][number]["wavelengthCalibration"]["reason"]): string {
  const labels = {
    disabled: "отключена пользователем",
    "insufficient-anchors": "недостаточно однозначных сильных опор",
    "insufficient-span": "опоры недостаточно разнесены по диапазону",
    "shift-too-large": "оценённое смещение превышает физически допустимый предел",
    "validation-not-improved": "независимая проверка не улучшилась",
    "validation-residual-too-large": "остаток на независимых опорах слишком велик",
    applied: "подтверждена независимыми опорами",
  } as const;
  return labels[reason];
}

function AnalysisPage({
  title,
  children,
  showAnalysisModes = title === "Анализ",
  action,
  summary,
}: Readonly<{ title: string; children: ReactNode; showAnalysisModes?: boolean; action?: ReactNode; summary?: string }>) {
  const { analysisView, calculationStatus, parameterError, setAnalysisView } = useAnalysisWorkspace();
  const status = calculationStatus === "calculating"
    ? <Tag tone="info">Обновляем анализ…</Tag>
    : parameterError
      ? <Tag tone="danger">Изменения не применены</Tag>
      : null;

  return (
    <div className={styles.page} aria-busy={calculationStatus === "calculating"}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{title}</h1>
          {summary ? <p className={styles.pageSummary}>{summary}</p> : null}
        </div>
        <div className={styles.pageActions}>{status}{action}</div>
      </header>
      {showAnalysisModes ? (
        <div className={styles.analysisModeTabs} role="tablist" aria-label="Режим анализа">
          <button type="button" role="tab" aria-selected={analysisView === "composition"} onClick={() => setAnalysisView("composition")}>Состав</button>
          <button type="button" role="tab" aria-selected={analysisView === "peaks"} onClick={() => setAnalysisView("peaks")}>Все пики</button>
        </div>
      ) : null}
      <div className={calculationStatus === "calculating" ? styles.analysisUpdating : styles.analysisCurrent}>
        {calculationStatus === "calculating" ? (
          <div className={styles.analysisUpdatingNotice} role="status" aria-live="polite">
            <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
            <div><strong>Обновляем анализ</strong><span>Текущий вывод временно скрыт, пока применяются новые параметры.</span></div>
          </div>
        ) : null}
        {children}
      </div>
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
            <th>
              <span className={styles.tableHeaderWithInfo}>
                Ближайшая линия
                <Info size={14} aria-label="Геометрически ближайшая справочная линия, а не итоговое назначение" />
              </span>
            </th>
            <th>Отклонение</th>
            <th>SNR</th>
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
              <td><code>{Number.isFinite(peak.snr) ? peak.snr.toFixed(2) : "∞"}</code></td>
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

function formatGroupWavelength(line: AnalysisEvidenceLine): string {
  const minimum = Math.min(...line.memberWavelengths);
  const maximum = Math.max(...line.memberWavelengths);
  return maximum - minimum < 0.0005
    ? `${line.referenceWavelength.toFixed(3)} нм`
    : `${minimum.toFixed(3)}–${maximum.toFixed(3)} нм`;
}

function toRoman(stage: number): string {
  const numerals: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" };
  return numerals[stage] ?? String(stage);
}

function formatReasonValue(code: string, value: number): string {
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
