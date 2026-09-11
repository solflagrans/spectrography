"use client";

import {
  CircleAlert,
  Database,
  LoaderCircle,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useRef, useState } from "react";
import { Fragment } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";

import type { WorkingAnalysis } from "@/application/analysis/working-analysis";
import type { MolecularHypothesis, MolecularHypothesisReason } from "@/domain/molecular-spectrum";
import { builtinMolecularSystemSummaries } from "@/domain/molecular-spectrum/builtin-library-summary";
import {
  BUILTIN_LIBRARY_LABEL,
  builtinSpectralLibraryElements,
  builtinSpectralLibraryManifest,
} from "@/domain/spectral-library/builtin-library-summary";
import type {
  AnalysisEvidenceLine,
  AnalyzedPeak,
  ElementInterpretation,
  NewAnalysisSpectrumType,
  SpectralLineCandidate,
} from "@/domain/spectrum";
import {
  useAnalysisWorkspace,
  useAnalysisWorkspaceCore,
  useAnalysisWorkspaceUi,
} from "@/features/demo-analysis/model/analysis-workspace-context";
import { InfoTooltip } from "@/features/workspace/components/info-tooltip";
import { formatCount, formatDecimal, formatSignedDecimal } from "@/features/workspace/model/display-format";
import {
  diagnosticReasonLabels,
  findIdentificationEntry,
} from "@/features/demo-analysis/model/identification-ui";

import styles from "./analysis-page.module.css";
import { SpectrumChart } from "./lazy-spectrum-chart";

const SPECTRUM_TYPE_OPTIONS = [
  { value: "plasma-emission", label: "Эмиссия плазмы/разряда" },
] as const satisfies readonly { value: NewAnalysisSpectrumType; label: string }[];

export function DataAnalysisPage() {
  const { analysis, selectedSpectrumType, updateSpectrumType } = useAnalysisWorkspaceCore();

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
    ["Средняя интенсивность", formatDecimal(analysis.rawStats.mean, 2)],
  ];
  if (analysis.instrumentMetadata) {
    datasetDetails.push(
      ["Серийный номер", analysis.instrumentMetadata.serialNumber || "Не указан"],
      ["Время интеграции", `${formatNumber(analysis.instrumentMetadata.integrationTimeMs)} мс`],
      ["Усреднений", String(analysis.instrumentMetadata.averages)],
    );
  }
  const channelSignalToNoise = analysis.channels.map((channel) => channel.suitability.metrics.usefulDynamicRangeSnr);
  const channelResolution = analysis.channels.map((channel) => channel.spectralResolutionNm);
  const channelScaleUncertainty = analysis.channels.map((channel) => channel.wavelengthCalibration.uncertaintyNm);
  const blockingIssues = analysis.channels.flatMap((channel) => channel.suitability.issues).filter((issue) => issue.severity === "critical");

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
        <Metric label="Интенсивность" value={`${formatDecimal(analysis.rawStats.minimum, 2)}–${formatDecimal(analysis.rawStats.maximum, 2)}`} />
        <Metric label="Средний шаг" value={`~${formatDecimal(analysis.wavelengthStep, 3)} нм`} />
      </MetricGrid>

      <div className={styles.dataSummaryGrid}>
        <Card title="Измерение"><DefinitionList items={datasetDetails} /></Card>
        <Card title="Тип спектра">
          <label className={styles.spectrumTypeField} htmlFor="spectrum-type">
            <select id="spectrum-type" aria-label="Тип спектра" value={selectedSpectrumType} onChange={(event) => updateSpectrumType(event.target.value as NewAnalysisSpectrumType)}>
              {SPECTRUM_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </Card>
        <div id="measurement-quality">
        <Card title="Параметры измерения" accessory={blockingIssues.length ? <Tag tone="danger">Анализ недоступен</Tag> : undefined}>
          <dl className={styles.randomAgreementGrid}>
            <div><dt>Сигнал / шум</dt><dd>{formatMetricRange(channelSignalToNoise, 1)}</dd></div>
            <div><dt>Разрешение</dt><dd>{formatMetricRange(channelResolution, 3)} нм</dd></div>
            <div><dt>Найдено пиков</dt><dd>{analysis.peaks.length}</dd></div>
            <div><dt>Неопределённость шкалы</dt><dd>{formatMetricRange(channelScaleUncertainty, 3)} нм</dd></div>
          </dl>
          <details className={styles.technicalDisclosure}>
            <summary>По каналам</summary>
            {analysis.channels.map((channel) => (
              <div key={channel.id} className={styles.traceCard}>
                {analysis.channels.length > 1 ? <h3>{channel.name}</h3> : null}
                <dl className={styles.randomAgreementGrid}>
                  <div><dt>Полезный диапазон / шум</dt><dd>{Number.isFinite(channel.suitability.metrics.usefulDynamicRangeSnr) ? formatDecimal(channel.suitability.metrics.usefulDynamicRangeSnr, 1) : "∞"}</dd></div>
                  <div><dt>Элементов разрешения</dt><dd>{formatDecimal(channel.suitability.metrics.resolutionElements, 1)}</dd></div>
                  <div><dt>Дрейф базовой линии</dt><dd>{formatDecimal(channel.suitability.metrics.baselineDriftRatio, 3)}</dd></div>
                  <div><dt>Одиночных выбросов</dt><dd>{channel.suitability.metrics.isolatedOutlierCount}</dd></div>
                  <div><dt>Разрешение</dt><dd>{formatDecimal(channel.spectralResolutionNm, 3)} нм</dd></div>
                  <div><dt>Неопределённость шкалы</dt><dd>{formatDecimal(channel.wavelengthCalibration.uncertaintyNm, 3)} нм</dd></div>
                </dl>
                <p className={styles.detailNote}>Коррекция шкалы: {channel.wavelengthCalibration.status === "applied" ? `${formatSignedDelta(channel.wavelengthCalibration.shiftNm)} нм` : "не применена"}; причина: {formatCalibrationReason(channel.wavelengthCalibration.reason)}.</p>
                {channel.suitability.issues.length ? (
                  <div className={styles.measurementDiagnostics}>
                    <strong>Диагностика</strong>
                    <ul>{channel.suitability.issues.map((issue) => (
                      <li key={issue.code} data-severity={issue.severity}>{issue.explanation}</li>
                    ))}</ul>
                  </div>
                ) : null}
              </div>
            ))}
          </details>
        </Card>
        </div>
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
  } = useAnalysisWorkspaceCore();
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
          Открыть образец NASA PDS
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
  const { analysis, selectedIdentificationChannelId, selectIdentificationChannel } = useAnalysisWorkspace();
  if (!analysis) return <AnalysisUnavailable section="Обработка" />;
  const channel = analysis.channels.find((item) => item.id === selectedIdentificationChannelId)
    ?? analysis.channels[0];
  if (!channel) return <AnalysisUnavailable section="Обработка" />;
  return (
    <AnalysisPage title="Обработка">
      <Card
        title={analysis.channels.length === 1 ? "Подготовленный спектр" : `Подготовленный спектр: ${channel.name}`}
        accessory={analysis.channels.length > 1 ? (
          <ChannelPicker
            id="processing-channel"
            label="Канал обработки"
            channels={analysis.channels}
            value={channel.id}
            onChange={selectIdentificationChannel}
          />
        ) : undefined}
      >
        <SpectrumChart
          fill
          rawDataset={channel.rawDataset}
          baselineDataset={channel.baselineDataset}
          preparedDataset={channel.preparedDataset}
          peaks={channel.peaks}
          thresholdDataset={channel.thresholdDataset}
          sourceKey={`${analysis.id}:${channel.id}`}
          defaultVisibleLayers={["raw", "baseline", "prepared", "threshold"]}
          label={`Исходный и подготовленный спектры ${analysis.source.fileName}`}
        />
      </Card>
    </AnalysisPage>
  );
}

export function PeaksAnalysisPage() {
  const {
    analysis,
    selectedIdentificationChannelId,
    selectedPeakId,
    selectIdentificationChannel,
    selectPeak,
  } = useAnalysisWorkspace();
  if (!analysis) return <AnalysisUnavailable section="Анализ" />;
  const channel = analysis.channels.find((item) => item.id === selectedIdentificationChannelId)
    ?? analysis.channels[0];
  if (!channel) return <AnalysisUnavailable section="Анализ" />;

  return (
    <AnalysisPage
      title="Анализ"
    >
      <Card
        title="Пики"
        accessory={analysis.channels.length > 1 ? (
          <ChannelPicker
            id="peaks-channel"
            label="Канал пиков"
            channels={analysis.channels}
            value={channel.id}
            onChange={selectIdentificationChannel}
          />
        ) : <Tag tone="neutral">{formatCount(channel.peaks.length, "пик", "пика", "пиков")}</Tag>}
      >
        <SpectrumChart
          rawDataset={channel.rawDataset}
          preparedDataset={channel.preparedDataset}
          peaks={channel.peaks}
          selectedPeakId={selectedPeakId}
          onPeakSelect={selectPeak}
          thresholdDataset={channel.thresholdDataset}
          sourceKey={`${analysis.id}:${channel.id}`}
          defaultVisibleLayers={["prepared", "threshold", "peaks"]}
          label="Подготовленный спектр с отмеченными пиками"
        />
      </Card>
      <Card title="Найденные пики" accessory={<Tag tone="success">{channel.peaks.length}</Tag>}>
        <PeakTable
          peaks={channel.peaks}
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
            ? "Устойчивые пики не найдены."
            : analysis.peaks.every((peak) => peak.candidates.length === 0)
              ? "Для найденных пиков нет подходящих справочных линий."
              : analysis.rejectedHypotheses.length
            ? "Элементы не определены. Другие совпадения доступны в подробностях."
            : "Элементы не определены."}
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
        <div className={styles.selectionNotice} role="status">Выбранный результат больше недоступен после пересчёта. Открыт первый доступный.</div>
      ) : null}

      <section className={styles.hypothesisOverview} aria-labelledby="selected-hypothesis-title">
        <div className={styles.hypothesisOverviewHeading}>
          <div>
            <h2 id="selected-hypothesis-title">{hypothesis.name} ({hypothesis.symbol})</h2>
            <p>{formatElementSupportSummary(hypothesis)}</p>
          </div>
        </div>
        <div className={styles.reliableEvidenceSummary}>
          <strong>Ключевые признаки</strong>
          {reliableEvidence.length ? (
            <ul>{reliableEvidence.slice(0, 5).map((line) => (
              <li key={line.groupId}>
                <code>{formatGroupWavelength(line)}</code>
                <span>{line.elementSymbol} {line.ionizationLabel} · {line.isKeyCharacteristic ? "ключевая группа" : "подтверждённая группа"}</span>
              </li>
            ))}</ul>
          ) : <span>Подтверждённых характерных групп нет.</span>}
        </div>
        {selectedEntry.rejectionReasons.length ? (
          <div className={styles.diagnosticReasons} aria-label="Причины диагностического результата">
            <strong>Не входит в состав</strong>
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
          referenceLines={channelEvidence.map((line) => ({ label: `${formatEvidenceLabel(line)} ${formatDecimal(line.referenceWavelength, 2)}`, wavelength: line.referenceWavelength }))}
          sourceKey={`${analysis.id}:${channel.id}`}
          defaultVisibleLayers={["prepared", "peaks", "referenceLines"]}
          label={`Спектр канала ${channel.name} и линии элемента ${hypothesis.name}`}
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
          <Metric label="Среднее отклонение" value={`${formatDecimal(hypothesis.meanAbsoluteDelta, 3)} нм`} />
        </div>
        </section>
        <section className={styles.evidenceSection} aria-labelledby="diagnostic-metrics-title">
        <h3 id="diagnostic-metrics-title">Диагностические показатели</h3>
        <div className={styles.identificationDetailGrid}>
        <Card title="Основания ранжирования">
          <ul className={styles.reasonList}>{hypothesis.rankingReasons.map((reason) => <li key={reason.code}><span>{reason.description}</span><code>{formatReasonValue(reason.code, reason.value)}</code></li>)}</ul>
        </Card>
        <Card title={<span className={styles.titleWithTooltip}>Контроль случайных совпадений <InfoTooltip label="Контроль случайных совпадений" content="Сравнение со смещёнными контрольными линиями. Показатель служит для ранжирования и не является вероятностью присутствия элемента." /></span>}>
          <dl className={styles.randomAgreementGrid}>
            <div><dt>Наблюдалось</dt><dd>{hypothesis.randomAgreement.observedAgreements}</dd></div>
            <div><dt>Ожидание для элемента</dt><dd>{formatDecimal(hypothesis.randomAgreement.expectedAgreements, 2)}</dd></div>
            <div><dt>После перебора элементов</dt><dd>{formatDecimal(hypothesis.randomAgreement.adjustedExpectedAgreements, 2)}</dd></div>
            <div><dt>Проверено элементов</dt><dd>{hypothesis.randomAgreement.testedElementCount}</dd></div>
            <div><dt>Требуется групп</dt><dd>{hypothesis.randomAgreement.requiredAgreements}</dd></div>
            <div><dt>Смещённых контролей</dt><dd>{hypothesis.randomAgreement.testedOffsets}</dd></div>
            <div><dt>95-й процентиль контролей</dt><dd>{hypothesis.randomAgreement.control95PercentileAgreements}</dd></div>
            <div><dt>Согласованное созвездие</dt><dd>{hypothesis.randomAgreement.coherentConstellationOverride ? "Да" : "Нет"}</dd></div>
          </dl>
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
                    <ul>{group.missingCharacteristicGroups.map((item) => <li key={item.id}>{formatDecimal(item.representativeWavelength, 3)} нм</li>)}</ul>
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
          <InlineEmptyState>Для этого элемента в покрываемом диапазоне нет характерных групп.</InlineEmptyState>
        ) : hypothesis.ionizationGroups.some((group) => group.missingCharacteristicGroups.length) ? (
          <div className={styles.missingLineList}>
            {hypothesis.ionizationGroups.flatMap((group) => group.missingCharacteristicGroups).map((item) => (
              <div key={item.id}><code>{formatDecimal(item.representativeWavelength, 3)} нм</code><span>{hypothesis.symbol} {item.ionizationLabel}</span><span>{formatCount(item.lines.length, "линия", "линии", "линий")} в группе</span></div>
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
  const analysisView = useAnalysisWorkspaceUi((state) => state.analysisView);
  return analysisView === "composition" ? <IdentificationAnalysisPage /> : <PeaksAnalysisPage />;
}

function AnalysisConclusion({ analysis }: Readonly<{ analysis: WorkingAnalysis }>) {
  const { selectedHypothesisId, selectHypothesis } = useAnalysisWorkspace();
  const reliableItems = [
    ...analysis.hypotheses.map((hypothesis) => ({
      id: hypothesis.id,
      symbol: hypothesis.symbol,
      name: hypothesis.name,
      support: formatElementSupportSummary(hypothesis),
    })),
    ...analysis.molecularHypotheses.map((hypothesis) => ({
      id: hypothesis.id,
      symbol: hypothesis.formula,
      name: hypothesis.displayName,
      support: formatMolecularSupportSummary(hypothesis),
    })),
  ];
  const primary = reliableItems[0];
  const additional = reliableItems.slice(1);
  return (
    <section className={styles.analysisConclusion} aria-labelledby="analysis-conclusion-title">
      <div className={styles.analysisConclusionCopy}>
        <h2 id="analysis-conclusion-title">Состав</h2>
        <p>{primary ? <><strong>Обнаружено: {primary.name} ({primary.symbol}).</strong> {primary.support}{additional.length ? <> Также: {additional.map((item) => `${item.name.toLocaleLowerCase("ru-RU")} (${item.symbol})`).join(", ")}.</> : null}</> : "Элементы не определены."}</p>
        {reliableItems.length ? (
          <label className={styles.mobileHypothesisSelect}>
            <span>Выбрать результат</span>
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
          <div>
            <h2 id="selected-molecule-title">{hypothesis.displayName} ({hypothesis.formula})</h2>
            <p>{hypothesis.explanation}</p>
          </div>
        </div>
        <div className={styles.reliableEvidenceSummary}>
          <strong>Главные признаки</strong>
          <ul>{observations.map((observation) => (
            <li key={`${observation.channelId}-${observation.regionId}`}>
              <code>{formatDecimal(observation.observedRange.minimum, 1)}–{formatDecimal(observation.observedRange.maximum, 1)} нм</code>
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
          label={`Спектр канала ${channel.name} и области системы ${hypothesis.formula}`}
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
    return <InlineEmptyState>У этого элемента нет согласованных линий.</InlineEmptyState>;
  }

  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.table} ${styles.evidenceTable}`}>
        <colgroup>
          <col className={styles.evidenceGroupColumn} />
          <col className={styles.evidencePeakColumn} />
          <col className={styles.evidenceDeltaColumn} />
          <col className={styles.evidenceSnrColumn} />
          <col className={styles.evidenceQualityColumn} />
        </colgroup>
        <thead>
          <tr>
            <th>Группа и справочная длина</th>
            <th>Пик</th>
            <th>Отклонение</th>
            <th>SNR</th>
            <th><span className={styles.titleWithTooltip}>Качество <InfoTooltip label="Качество совпадения" content="Эвристическая оценка для ранжирования совпадений; не является вероятностью." /></span></th>
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
                  data-evidence-row={line.groupId}
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
                  <td data-label="Группа и справочная длина"><div className={styles.evidenceGroupCell}><strong>{formatEvidenceLabel(line)}</strong><code>{formatGroupWavelength(line)}</code>{line.memberLineIds.length > 1 ? <small>{formatCount(line.memberLineIds.length, "линия", "линии", "линий")}</small> : null}</div></td>
                  <td data-label="Пик"><div className={styles.valueStack}>{line.observations.map((observation) => <code key={`${observation.channelId}-${observation.peakId}`}>{formatDecimal(observation.peakWavelength, 3)} нм</code>)}</div></td>
                  <td data-label="Отклонение"><div className={styles.valueStack}>{line.observations.map((observation) => <code key={`${observation.channelId}-${observation.peakId}`}>{formatSignedDelta(observation.delta)} нм</code>)}</div></td>
                  <td data-label="SNR"><div className={styles.valueStack}>{line.observations.map((observation) => <code key={`${observation.channelId}-${observation.peakId}`}>{Number.isFinite(observation.snr) ? formatDecimal(observation.snr, 2) : "∞"}</code>)}</div></td>
                  <td data-label="Качество"><span className={styles.qualityCell}><span>{formatEvidenceQuality(line.strength)}</span><code>{formatDecimal(line.quality, 2)}</code></span></td>
                </tr>
                <tr className={styles.evidenceDetailRow}>
                  <td colSpan={5}>
                    <details>
                      <summary>Подробнее · {formatCount(alternatives.length, "альтернатива", "альтернативы", "альтернатив")}</summary>
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

export function LibraryAnalysisPage() {
  const elements = builtinSpectralLibraryElements;

  return (
    <AnalysisPage title="Библиотека" showAnalysisModes={false} summary={`${formatCount(builtinSpectralLibraryManifest.lineCount, "атомная линия", "атомные линии", "атомных линий")} · ${formatCount(elements.length, "элемент", "элемента", "элементов")} · ${formatCount(builtinMolecularSystemSummaries.length, "молекулярная система", "молекулярные системы", "молекулярных систем")}`}>
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
        <Card title="Молекулярные системы" accessory={<Tag tone="neutral">{builtinMolecularSystemSummaries.length}</Tag>}>
          <div className={styles.librarySystemList}>
            {builtinMolecularSystemSummaries.map((system) => (
              <article key={system.id}>
                <strong>{system.displayName} ({system.formula})</strong>
                <span>{system.transition}</span>
                <small>{formatDecimal(system.wavelengthRange.minimum, 1)}–{formatDecimal(system.wavelengthRange.maximum, 1)} нм · {formatCount(system.characteristicRegionCount, "характерный участок", "характерных участка", "характерных участков")}</small>
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
    <Card title={<span className={styles.titleWithTooltip}>{hypothesis.formula} · {hypothesis.systemName} <InfoTooltip label="Оценка формы молекулярной полосы" content="Сопоставление формы характерных участков спектра." /></span>} accessory={<Tag tone={hypothesis.accepted ? "success" : "neutral"}>{hypothesis.accepted ? "Обнаружено" : "Не обнаружено"}</Tag>}>
      <p className={styles.detailNote}>{hypothesis.transition}</p>
      <dl className={styles.randomAgreementGrid}>
        <div><dt>Общее смещение</dt><dd>{formatSignedDelta(hypothesis.commonShiftNm)} нм</dd></div>
        <div><dt>Подтверждено участков</dt><dd>{hypothesis.supportedRegionIds.length}</dd></div>
        <div><dt>Не найдено участков</dt><dd>{hypothesis.missingExpectedRegionIds.length}</dd></div>
        <div><dt>Случайных смещений</dt><dd>{hypothesis.randomAgreement.testedOffsets}</dd></div>
      </dl>
      <div className={styles.molecularRegionTable}>
        {hypothesis.observations.map((observation) => (
          <div key={`${observation.channelId}-${observation.regionId}`}>
            <strong>{formatDecimal(observation.observedRange.minimum, 1)}–{formatDecimal(observation.observedRange.maximum, 1)} нм</strong>
            <span>{observation.supported ? "Подтверждает систему" : "Слабое или неоднозначное совпадение"}</span>
            <small>форма {formatDecimal(observation.shapeCorrelation, 2)} · SNR {Number.isFinite(observation.contrastSnr) ? formatDecimal(observation.contrastSnr, 1) : "∞"} · контраст {formatDecimal(observation.relativeContrast * 100, 1)}%</small>
            {observation.overlappingAtomicPeakIds.length ? <small>Перекрывается с {formatCount(observation.overlappingAtomicPeakIds.length, "атомным сигналом", "атомными сигналами", "атомными сигналами")}</small> : null}
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

function formatElementSupportSummary(hypothesis: ElementInterpretation): string {
  const groups = formatCount(
    hypothesis.reliableCharacteristicGroupCount,
    "характерная группа",
    "характерные группы",
    "характерных групп",
  );
  if (!hypothesis.strongCharacteristicGroupCount) return `${groups}.`;
  return `${groups}, включая ${formatCount(hypothesis.strongCharacteristicGroupCount, "сильную группу", "сильные группы", "сильных групп")}.`;
}

function formatMolecularSupportSummary(hypothesis: MolecularHypothesis): string {
  return `${formatCount(hypothesis.supportedRegionIds.length, "подтверждённая область", "подтверждённые области", "подтверждённых областей")}.`;
}

function formatEvidenceQuality(strength: AnalysisEvidenceLine["strength"]): string {
  return strength === "strong" ? "Высокая" : strength === "moderate" ? "Средняя" : "Низкая";
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

function formatMetricRange(values: readonly number[], maximumFractionDigits: number): string {
  const finiteValues = values.filter(Number.isFinite);
  if (!finiteValues.length) return "∞";
  const minimum = Math.min(...finiteValues);
  const maximum = Math.max(...finiteValues);
  if (values.some((value) => value === Number.POSITIVE_INFINITY)) {
    return `${formatDecimal(minimum, maximumFractionDigits)}–∞`;
  }
  return minimum === maximum
    ? formatDecimal(minimum, maximumFractionDigits)
    : `${formatDecimal(minimum, maximumFractionDigits)}–${formatDecimal(maximum, maximumFractionDigits)}`;
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
            <strong>Обновляем анализ…</strong>
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
      <p>Сначала откройте свой файл или образец NASA PDS в разделе «Данные».</p>
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
}: Readonly<{ title: ReactNode; accessory?: ReactNode; children: ReactNode }>) {
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
  const table = useTable({
    data: peaks,
    columns: peakTableColumns,
    features: peakTableFeatures,
    getRowId: (peak) => peak.id,
    enableSortingRemoval: false,
  });

  if (!peaks.length) {
    return <InlineEmptyState>При текущих параметрах пики не обнаружены.</InlineEmptyState>;
  }

  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  aria-sort={header.column.getIsSorted() === "asc"
                    ? "ascending"
                    : header.column.getIsSorted() === "desc"
                      ? "descending"
                      : undefined}
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <button
                      type="button"
                      className={styles.sortableHeader}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <table.FlexRender header={header} />
                      <span aria-hidden="true">{header.column.getIsSorted() === "asc" ? "↑" : header.column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
                    </button>
                  ) : <table.FlexRender header={header} />}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const peak = row.original;
            return (
            <tr
              key={row.id}
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
              {row.getAllCells().map((cell) => (
                <td key={cell.id}><table.FlexRender cell={cell} /></td>
              ))}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const peakTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const peakColumnHelper = createColumnHelper<typeof peakTableFeatures, AnalyzedPeak>();
const peakTableColumns = peakColumnHelper.columns([
  peakColumnHelper.display({ id: "number", header: "№", cell: ({ row }) => row.index + 1 }),
  peakColumnHelper.accessor("wavelength", { header: "Длина волны", cell: ({ row }) => <code>{formatDecimal(row.original.wavelength, 2)} нм</code> }),
  peakColumnHelper.accessor("intensity", { header: "Интенсивность", cell: ({ row }) => <code>{formatDecimal(row.original.intensity, 3)}</code> }),
  peakColumnHelper.display({
    id: "nearest-line",
    header: () => (
      <span className={styles.tableHeaderWithInfo}>
        Ближайшая линия
        <InfoTooltip label="Ближайшая линия" content="Геометрически ближайшая справочная линия, а не итоговое назначение." />
      </span>
    ),
    cell: ({ row }) => row.original.match
      ? `${formatCandidateLabel(row.original.match)} · ${formatDecimal(row.original.match.line, 2)} нм`
      : "Не найдено",
  }),
  peakColumnHelper.display({ id: "delta", header: "Отклонение", cell: ({ row }) => <code>{row.original.match ? `${formatSignedDelta(row.original.match.delta)} нм` : "—"}</code> }),
  peakColumnHelper.accessor("snr", { header: "SNR", cell: ({ row }) => <code>{Number.isFinite(row.original.snr) ? formatDecimal(row.original.snr, 2) : "∞"}</code> }),
]);

function Tag({
  tone,
  children,
}: Readonly<{ tone: "neutral" | "success" | "warning" | "danger" | "info"; children: ReactNode }>) {
  return <span className={`${styles.tag} ${styles[`tag_${tone}`]}`}>{children}</span>;
}

function ChannelPicker({
  id,
  label,
  channels,
  value,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  channels: WorkingAnalysis["channels"];
  value: string;
  onChange: (channelId: string) => void;
}>) {
  return (
    <label className={styles.channelPicker} htmlFor={id}>
      <span>Канал</span>
      <select id={id} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
      </select>
    </label>
  );
}

function formatSignedDelta(delta: number): string {
  return formatSignedDecimal(delta, 3);
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
    ? `${formatDecimal(line.referenceWavelength, 3)} нм`
    : `${formatDecimal(minimum, 3)}–${formatDecimal(maximum, 3)} нм`;
}

function toRoman(stage: number): string {
  const numerals: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" };
  return numerals[stage] ?? String(stage);
}

function formatReasonValue(code: string, value: number): string {
  if (code === "wavelength-agreement") return `${formatDecimal(value, 3)} нм`;
  return Number.isInteger(value) ? String(value) : formatDecimal(value, 2);
}

function formatWavelengthOrigin(origin: "observed" | "ritz"): string {
  return origin === "observed" ? "наблюдаемая" : "Ritz";
}

function formatWavelengthMedium(medium: "air" | "vacuum"): string {
  return medium === "air" ? "воздух" : "вакуум";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : formatDecimal(value, 2);
}
