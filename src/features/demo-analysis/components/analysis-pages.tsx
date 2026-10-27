"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/ui/select";

import { describeCompositionSettings, resolveCompositionSettings } from "@/domain/spectrum/composition-settings";

import {
  ChevronDown,
  ChevronRight,
  Download,
  CircleAlert,
  Info,
  Database,
  LoaderCircle,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";
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
} from "@/domain/spectrum";
import {
  useAnalysisWorkspace,
  useAnalysisWorkspaceCore,
  useAnalysisWorkspaceUi,
  usePeakInspectorUi,
} from "@/features/demo-analysis/model/analysis-workspace-context";
import { InfoTooltip } from "@/features/workspace/components/info-tooltip";
import { formatCount, formatDecimal, formatSignedDecimal } from "@/features/workspace/model/display-format";
import {
  diagnosticReasonLabels,
  findIdentificationEntry,
} from "@/features/demo-analysis/model/identification-ui";

import styles from "./analysis-page.module.css";
import menuStyles from "@/components/ui/menu-surface.module.css";
import { createAnalysisExport, createPeaksCsv, createSpectrumCsv } from "@/application/export-analysis/export-analysis";
import { SpectrumChart } from "./lazy-spectrum-chart";
import { ReferenceRecordDialog } from "./reference-record-dialog";
import { useProcessingSection } from "../model/processing-section";
import type { SpectrumChartLayer } from "./spectrum-chart-option";

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


  return (
    <AnalysisPage title="Данные" action={<SpectrumImportControls compact />}>
      <Card className={styles.chartCard} title="Исходный спектр" description={<span className={styles.dataChartSummary}>
        <span><span>Диапазон</span><strong>{formatNumber(analysis.wavelengthRange.minimum)}–{formatNumber(analysis.wavelengthRange.maximum)} нм</strong></span><span><strong>{formatCount(analysis.rawDataset.wavelengths.length, "точка", "точки", "точек")}</strong></span><span><span>Средний шаг</span><strong>≈{formatDecimal(analysis.wavelengthStep, 3)} нм</strong> <InfoTooltip label="Средний шаг" content="Среднее расстояние между соседними точками. При неравномерной сетке шаг отдельных участков может отличаться." /></span>
      </span>}>
        <SpectrumChart
          rawIntensityUnit={analysis.source.units === "нм / отсчёты прибора" ? "отсчёты прибора" : "отн. ед."}
          rawDataset={analysis.rawDataset}
          sourceKey={analysis.id}
          defaultVisibleLayers={["raw"]}
          showLayerControls={false}
          label={`Спектр ${analysis.source.fileName}`}
        />
      </Card>

      <Card className={styles.measurementCard} title="Измерение" description={<span className={styles.measurementFile}><span>{analysis.source.fileName}</span><Tag tone="neutral">{analysis.source.format}</Tag></span>} accessory={<ImportDetails analysis={analysis} />}>
        <div className={styles.measurementFields}>
          {analysis.source.kind ? <div><span>Источник</span><span>{analysis.source.kind}</span></div> : null}
          <div><span>Единицы</span><span>{analysis.source.units}</span></div>
          <label htmlFor="spectrum-type"><span>Тип спектра</span><Select id="spectrum-type" aria-label="Тип спектра" value={selectedSpectrumType} onValueChange={(value) => updateSpectrumType(value as NewAnalysisSpectrumType)}>
            {SPECTRUM_TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </Select></label>
        </div>
      </Card>
      <div id="measurement-quality"><Card title="Каналы и характеристики">
        {analysis.channels.some((channel) => channel.suitability.issues.some((issue) => issue.severity === "critical")) ? <ul className={styles.dataWarnings}>{analysis.channels.flatMap((channel) => channel.suitability.issues.filter((issue) => issue.severity === "critical").map((issue) => <li key={`${channel.id}:${issue.code}`} data-severity="critical">{dataChannelLabel(channel)}: {issue.explanation}</li>))}</ul> : null}
        <div className={styles.tableScroll}><table className={`${styles.table} ${styles.dataChannelTable}`}>
          <colgroup><col style={{ width: 180 }} /><col style={{ width: 170 }} /><col style={{ width: 180 }} /><col style={{ width: 280 }} /><col /></colgroup>
          <thead><tr><th>Канал / участок</th><th>Диапазон, нм</th><th><span className={styles.dataNumericHeading}>Разрешение, нм <InfoTooltip label="Разрешение канала" content="Расчётная оценка ширины FWHM по пикам канала." /></span></th><th><span className={styles.dataNumericHeading}>Неопределённость шкалы, нм <InfoTooltip label="Неопределённость шкалы" content="Оценка неопределённости шкалы длины волны, используемая при сопоставлении линий." /></span></th><th><span className={styles.visuallyHidden}>Подробности</span></th></tr></thead>
          <tbody>{analysis.channels.map((channel) => <tr key={channel.id}>
            <td>{dataChannelLabel(channel)}{!channel.usable ? <span className={styles.excludedChannel}>Исключён из анализа</span> : null}</td><td>{formatDecimal(channel.wavelengthRange.minimum, 2)}–{formatDecimal(channel.wavelengthRange.maximum, 2)}</td>
            <td>{Number.isFinite(channel.spectralResolutionNm) ? formatDecimal(channel.spectralResolutionNm, 3) : "Не определено"}</td>
            <td>{Number.isFinite(channel.wavelengthCalibration.uncertaintyNm) ? formatDecimal(channel.wavelengthCalibration.uncertaintyNm, 3) : "Не определена"}</td>
            <td><ChannelDataDetails channel={channel} /></td>
          </tr>)}</tbody>
        </table></div>
      </Card></div>
    </AnalysisPage>
  );
}

function dataChannelLabel(channel: WorkingAnalysis["channels"][number]): string {
  const segment = channel.id.match(/-segment-(\d+)$/);
  return segment ? `${channel.name.split(" · ")[0]} · участок ${segment[1]}` : channel.name;
}

function ChannelDataDetails({ channel }: Readonly<{ channel: WorkingAnalysis["channels"][number] }>) {
  const label = dataChannelLabel(channel);
  return <Dialog.Root><Dialog.Trigger asChild><Button variant="ghost" size="compact" aria-label={`Подробности: ${label}`}>Подробнее…</Button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className={`${styles.dialogOverlay} ${styles.referenceOverlay}`} /><Dialog.Content className={`${styles.referenceDialog} ${styles.importDialog}`} aria-describedby={undefined}>
      <div className={styles.referenceDialogHeader}><Dialog.Title>{label}</Dialog.Title><Dialog.Close asChild><Button size="icon" aria-label="Закрыть характеристики участка"><X size={18} /></Button></Dialog.Close></div>
      <div className={styles.channelDialogBody}>
        <div className={styles.channelDialogSummary}><span>{formatDecimal(channel.wavelengthRange.minimum, 2)}–{formatDecimal(channel.wavelengthRange.maximum, 2)} нм</span><span data-usable={channel.usable}>{channel.usable ? "Используется в анализе" : "Исключён из анализа"}</span></div>
        <section className={styles.channelDialogSection}><h3>Показатели сигнала</h3><DefinitionList items={[
          ["Полезный диапазон / шум", formatMeasuredValue(channel.suitability.metrics.usefulDynamicRangeSnr)],
          ["Элементов разрешения", formatDecimal(channel.suitability.metrics.resolutionElements, 1)],
          ["Дрейф базовой линии", formatDecimal(channel.suitability.metrics.baselineDriftRatio, 3)],
          ["Одиночных выбросов", String(channel.suitability.metrics.isolatedOutlierCount)],
        ]} /></section>
        <section className={styles.channelDialogSection}><h3>Коррекция шкалы длины волны</h3><p className={styles.channelCalibrationExplanation}><strong>{channel.wavelengthCalibration.status === "applied" ? `Применено смещение ${formatSignedDelta(channel.wavelengthCalibration.shiftNm)} нм` : "Не применена"}</strong>: {formatCalibrationReason(channel.wavelengthCalibration.reason)}.</p></section>
        {channel.suitability.issues.length ? <section className={styles.channelDialogSection}><h3>Диагностика</h3><ul className={styles.channelDiagnostics}>{channel.suitability.issues.map((issue) => <li key={issue.code} data-severity={issue.severity}>
          {issue.severity === "diagnostic" ? <Info size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
          <div><div className={styles.channelDiagnosticHeading}><strong>{({ "insufficient-range": "Покрытие диапазона", "low-dynamic-range": "Динамический диапазон", "baseline-drift": "Базовая линия", "isolated-outliers": "Одиночные выбросы", "possible-signal-limit": "Предельные значения сигнала", "insufficient-features": "Спектральные признаки", "uncertain-resolution": "Оценка разрешения", "uncertain-calibration": "Неопределённость шкалы" } as const)[issue.code]}</strong><span>{issue.severity === "diagnostic" ? "Справочно" : issue.severity === "critical" ? "Критично" : "Предупреждение"}</span></div><p>{issue.explanation}</p></div>
        </li>)}</ul></section> : null}
      </div>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}

function ImportDetails({ analysis }: Readonly<{ analysis: WorkingAnalysis }>) {
  const metadata = analysis.instrumentMetadata;
  return <Dialog.Root><Dialog.Trigger asChild><Button variant="ghost" size="compact" aria-label="Подробности импорта">Подробнее…</Button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className={`${styles.dialogOverlay} ${styles.referenceOverlay}`} /><Dialog.Content className={`${styles.referenceDialog} ${styles.importDialog}`} aria-describedby={undefined}>
      <div className={styles.referenceDialogHeader}><Dialog.Title>Подробности импорта</Dialog.Title><Dialog.Close asChild><Button size="icon" aria-label="Закрыть подробности импорта"><X size={18} /></Button></Dialog.Close></div>
      <DefinitionList items={[
        ["Файл", analysis.source.fileName], ["Формат", analysis.source.format], ["Источник", analysis.source.kind],
        ["Минимальная интенсивность", formatMeasuredValue(analysis.rawStats.minimum)], ["Максимальная интенсивность", formatMeasuredValue(analysis.rawStats.maximum)], ["Средняя интенсивность", formatMeasuredValue(analysis.rawStats.mean)],
        ...(metadata ? [["Серийный номер", metadata.serialNumber || "Не указан"], ["Время интеграции", `${formatNumber(metadata.integrationTimeMs)} мс`], ["Усреднений", String(metadata.averages)], ["Пиксели", `${metadata.startPixel}–${metadata.stopPixel}`]] as const : []),
        ...(analysis.auxiliaryData ? [["Массив dark", `${analysis.auxiliaryData.dark.length} значений`], ["Массив reference", `${analysis.auxiliaryData.reference.length} значений`]] as const : []),
      ]} />
      {analysis.auxiliaryData ? <p className={styles.detailNote}>Dark и reference сохранены как исходные вспомогательные данные и автоматически не применяются.</p> : null}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
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
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={isReading}>
          {isReading ? "Читаем файл…" : "Заменить файл"}
        </Button>
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
        <Button variant="primary"
          className={styles.fileButton}
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isReading}
        >
          {analysis ? "Заменить файл" : "Выбрать файл"}
        </Button>
      </div>
      {!analysis ? <div className={styles.demoImportAction}>
        <Button type="button" onClick={openDemoAnalysis} disabled={isReading}>
          <Sparkles size={15} aria-hidden="true" />
          Открыть образец NASA PDS
        </Button>
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
  const { analysis, selectedIdentificationChannelId, selectIdentificationChannel, selectedHypothesisId, selectHypothesis, selectedPeakId, selectPeak } = useAnalysisWorkspace();
  const section = useProcessingSection();
  if (!analysis) return <AnalysisUnavailable section="Обработка" />;
  const channel = analysis.channels.find((item) => item.id === selectedIdentificationChannelId)
    ?? analysis.channels[0];
  if (!channel) return <AnalysisUnavailable section="Обработка" />;
  const compositionView = section === "composition-settings";
  const molecule = analysis.molecularHypotheses.find((item) => item.id === selectedHypothesisId);
  const atomic = findIdentificationEntry(analysis, selectedHypothesisId)?.hypothesis;
  const evidence = atomic?.evidence.filter((line) => line.isCharacteristic && line.strength !== "weak" && line.observations.some((item) => item.channelId === channel.id)) ?? [];
  const supportingIds = new Set(evidence.flatMap((line) => line.observations.filter((item) => item.channelId === channel.id).map((item) => item.peakId)));
  const regions = molecule?.observations.filter((item) => item.channelId === channel.id && item.supported).map((item) => ({ label: item.regionId, minimum: item.observedRange.minimum, maximum: item.observedRange.maximum })) ?? [];
  const defaults: readonly SpectrumChartLayer[] = section === "peak-settings" ? ["prepared", "threshold", "peaks"] : compositionView ? ["prepared", "peaks", "referenceLines", "regions"] : ["raw", "baseline", "prepared"];
  const peaks = compositionView ? channel.peaks.filter((peak) => supportingIds.has(peak.id) || regions.some((region) => peak.wavelength >= region.minimum && peak.wavelength <= region.maximum)) : channel.peaks;
  const hypotheses = [...analysis.hypotheses.map((item) => ({ id: item.id, label: `${item.name} (${item.symbol})` })), ...analysis.molecularHypotheses.map((item) => ({ id: item.id, label: item.formula }))];
  return (
    <AnalysisPage title="Обработка">
      <Card
        className={styles.chartCard}
        title={section === "peak-settings" ? "Поиск пиков" : compositionView ? "Подтверждения состава" : "Подготовка спектра"}
        accessory={<div className={styles.processingChartSelectors}>
          {analysis.channels.length > 1 ? <ChannelPicker id="processing-channel" label="Канал обработки" channels={analysis.channels} value={channel.id} onChange={selectIdentificationChannel} /> : null}
          {compositionView && hypotheses.length ? <label className={styles.channelPicker}>Гипотеза<Select aria-label="Гипотеза на графике" value={hypotheses.some((item) => item.id === selectedHypothesisId) ? selectedHypothesisId! : ""} onValueChange={(value) => selectHypothesis(value, "hypotheses")}>{hypotheses.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</Select></label> : null}
        </div>}
      >
        <SpectrumChart
          rawIntensityUnit={analysis.source.units === "нм / отсчёты прибора" ? "отсчёты прибора" : "отн. ед."}
          fill
          rawDataset={channel.rawDataset}
          baselineDataset={channel.baselineDataset}
          preparedDataset={channel.preparedDataset}
          peaks={peaks}
          selectedPeakId={selectedPeakId}
          onPeakSelect={selectPeak}
          referenceLines={compositionView && evidence.length ? evidence.map((line) => ({ label: `${formatEvidenceLabel(line)} ${formatDecimal(line.referenceWavelength, 2)}`, wavelength: line.referenceWavelength })) : undefined}
          highlightedRegions={compositionView && regions.length ? regions : undefined}
          layerViewKey={section}
          thresholdDataset={channel.thresholdDataset}
          sourceKey={`${analysis.id}:${channel.id}`}
          defaultVisibleLayers={defaults}
          label={`Исходный и подготовленный спектры ${analysis.source.fileName}`}
        />
        {compositionView && !atomic && !molecule ? <p className={styles.settingHint}>Принятых гипотез нет. Спектр доступен для исследования.</p> : null}
      </Card>
    </AnalysisPage>
  );
}

export function PeaksAnalysisPage() {
  const [preview, setPreview] = useState<{ source: string; peakId: string } | null>(null);
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
      peakLayout
    >
      <Card
        className={styles.chartCard}
        title="Подготовленный спектр"
        accessory={analysis.channels.length > 1 ? (
          <ChannelPicker
            id="peaks-channel"
            label="Канал пиков"
            channels={analysis.channels}
            value={channel.id}
            onChange={(channelId) => { setPreview(null); selectIdentificationChannel(channelId); }}
          />
        ) : <Tag tone="neutral">{formatCount(channel.peaks.length, "пик", "пика", "пиков")}</Tag>}
      >
        <SpectrumChart
          rawIntensityUnit={analysis.source.units === "нм / отсчёты прибора" ? "отсчёты прибора" : "отн. ед."}
          rawDataset={channel.rawDataset}
          baselineDataset={channel.baselineDataset}
          preparedDataset={channel.preparedDataset}
          peaks={channel.peaks}
          selectedPeakId={selectedPeakId}
          hoveredPeakId={preview?.source === `${analysis.id}:${channel.id}` ? preview.peakId : null}
          onPeakSelect={selectPeak}
          thresholdDataset={channel.thresholdDataset}
          sourceKey={`${analysis.id}:${channel.id}`}
          defaultVisibleLayers={["prepared", "peaks"]}
          compact
          label="Подготовленный спектр с отмеченными пиками"
        />
      </Card>
      <Card title={`Пики · ${channel.peaks.length}`} accessory={<AnalysisExportMenu analysis={analysis} channelId={channel.id} />} description={<>Интенсивность · {channel.parameters.processing.normalization === "maximum" ? "доля максимума (0–1)" : analysis.source.units.split(" / ")[1]}</>}>
        <PeakTable
          onPeakPreview={(peakId) => setPreview(peakId ? { source: `${analysis.id}:${channel.id}`, peakId } : null)}
          peaks={channel.peaks}
          selectedPeakId={selectedPeakId}
          onPeakSelect={selectPeak}
        />
      </Card>
      <CompactInterpretation analysis={analysis} />

    </AnalysisPage>
  );
}

export function IdentificationAnalysisPage() {
  const { setTab: setInspectorTab } = usePeakInspectorUi();
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
        <MolecularChecks analysis={analysis} standalone />
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
        <MolecularChecks analysis={analysis} standalone />
      </AnalysisPage>
    );
  }
  const hypothesis = selectedEntry.hypothesis;
  const channel = analysis.channels.find((item) => item.id === selectedIdentificationChannelId)
    ?? analysis.channels[0];
  if (!channel || !channel.usable) {
    return <AnalysisPage title="Анализ"><AnalysisConclusion analysis={analysis} /><InlineEmptyState>Выбранный канал недоступен или его качества недостаточно для интерпретации.</InlineEmptyState><MolecularChecks analysis={analysis} standalone /></AnalysisPage>;
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

      <section className={styles.resultOverview} aria-labelledby="selected-hypothesis-title">
        <div className={styles.resultOverviewTitle}>
          <h2 id="selected-hypothesis-title">{hypothesis.name} <span>· {hypothesis.symbol}</span></h2>
          <Tag tone={selectedEntry.rejectionReasons.length ? "neutral" : "success"}>{selectedEntry.rejectionReasons.length ? "Не подтверждён" : "Обнаружено"}</Tag>
        </div>
        <p>{formatElementSupportSummary(hypothesis)}{hypothesis.admission === "sensitive" ? " Чувствительный отбор." : ""}</p>
        {selectedEntry.rejectionReasons.length ? <div className={styles.resultRejection} aria-label="Причины диагностического результата">
          <p>{diagnosticReasonLabels[selectedEntry.rejectionReasons[0]]}</p>
          {selectedEntry.rejectionReasons.length > 1 ? <details><summary>Другие причины · {selectedEntry.rejectionReasons.length - 1}</summary><ul>{selectedEntry.rejectionReasons.slice(1).map((reason) => <li key={reason}>{diagnosticReasonLabels[reason]}</li>)}</ul></details> : null}
        </div> : null}
      </section>

      <Card
        title="Спектр"
        accessory={analysis.channels.length > 1 ? (
          <label className={styles.channelPicker} htmlFor="identification-channel">
            <span>Канал</span>
            <Select id="identification-channel" value={channel.id} onValueChange={(value) => selectIdentificationChannel(value)}>
              {analysis.channels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </Select>
          </label>
        ) : undefined}
      >
        <SpectrumChart
          rawIntensityUnit={analysis.source.units === "нм / отсчёты прибора" ? "отсчёты прибора" : "отн. ед."}
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
        {!channelEvidence.length && reliableEvidence.length ? <p className={styles.detailNote}>В выбранном канале нет характерных совпадений. Доказательства ниже относятся к другим каналам.</p> : null}
      </Card>

      <Card className={styles.evidenceCard} title="Доказательства" accessory={analysis.channels.length > 1 ? <span className={styles.evidenceScope}>Все каналы</span> : undefined}>
        <EvidenceTable key={`${analysis.id}:${hypothesis.id}`}
          analysis={analysis}
          hypothesis={hypothesis}
          onObservationOpen={(peakId, channelId) => {
            selectIdentificationChannel(channelId);
            selectPeak(peakId);
          }}
          onPeakOpen={(peakId) => {
            setInspectorTab("matches");
            selectPeak(peakId);
            setAnalysisView("peaks");
          }}
        />
      </Card>

      <details className={styles.interpretationDisclosure}>
        <summary><span className={styles.titleWithTooltip}>Ненайденные признаки · {hypothesis.ionizationGroups.reduce((count, group) => count + group.missingCharacteristicGroups.length, 0)} <InfoTooltip label="Ненайденные признаки" content="Отсутствие пика само по себе не доказывает отсутствие элемента." /></span></summary>
        {hypothesis.availableCharacteristicGroupCount === 0 ? <InlineEmptyState>В покрываемом диапазоне нет характерных групп для проверки.</InlineEmptyState> :
          hypothesis.ionizationGroups.some((group) => group.missingCharacteristicGroups.length) ? <div className={styles.missingEvidenceSections}>{hypothesis.ionizationGroups.filter((group) => group.missingCharacteristicGroups.length).map((group) => <section key={group.ionizationStage}>
            <h3>{hypothesis.symbol} {group.ionizationLabel}</h3>
            <ul className={styles.missingEvidenceList}>{group.missingCharacteristicGroups.map((item) => <li key={item.id}><code>{formatDecimal(item.representativeWavelength, 3)} нм</code><span>{formatCount(item.lines.length, "линия", "линии", "линий")} в группе</span></li>)}</ul>
          </section>)}</div> : <InlineEmptyState>Все доступные характерные группы имеют сопоставленное наблюдение.</InlineEmptyState>}
      </details>
      <details className={`${styles.interpretationDisclosure} ${styles.resultChecks}`}>
        <summary>Проверка результата</summary>
        <dl>
          <div><dt>Контроль случайных совпадений</dt><dd data-passed={hypothesis.randomAgreement.distinguishableFromRandom}>{hypothesis.randomAgreement.distinguishableFromRandom ? "Пройден" : "Не пройден"}</dd></div>
          <div><dt>Согласованность шкалы длины волны</dt><dd data-passed={hypothesis.wavelengthCoherence.coherent}>{hypothesis.wavelengthCoherence.coherent ? "Подтверждена" : "Не подтверждена"}</dd></div>
        </dl>
      </details>
      <details className={styles.interpretationDisclosure}>
        <summary>Подробности расчёта</summary>
        <section className={styles.calculationSection}>
          <h3>Сопоставление линий</h3>
          <DefinitionList items={[
            ["Степени ионизации", hypothesis.ionizationStages.map(toRoman).join(", ") || "—"],
            ["Качественные характерные группы / доступные", `${hypothesis.reliableCharacteristicGroupCount} / ${hypothesis.availableCharacteristicGroupCount}`],
            ["Все сопоставленные группы", String(hypothesis.independentMatchedGroupCount)],
            ["Слабые или нехарактерные группы", String(hypothesis.weakEvidenceGroupCount)],
            ["Среднее абсолютное отклонение", `${formatDecimal(hypothesis.meanAbsoluteDelta, 3)} нм`],
            ["Ключевые группы с качественным наблюдением", String(hypothesis.rankingReasons.find((reason) => reason.code === "key-groups")?.value ?? 0)],
          ]} />
        </section>
        <section className={styles.calculationSection}>
          <h3 className={styles.titleWithTooltip}>Контроль случайных совпадений <InfoTooltip label="Контроль случайных совпадений" content="Сравнение со смещёнными контрольными линиями. Показатели не являются вероятностью присутствия элемента." /></h3>
          <DefinitionList items={[
            ["Наблюдалось характерных совпадений", String(hypothesis.randomAgreement.observedAgreements)],
            ["Ожидание для элемента", formatDecimal(hypothesis.randomAgreement.expectedAgreements, 2)],
            ["После перебора элементов", formatDecimal(hypothesis.randomAgreement.adjustedExpectedAgreements, 2)],
            ["Проверено элементов", String(hypothesis.randomAgreement.testedElementCount)],
            ["Требуется групп", String(hypothesis.randomAgreement.requiredAgreements)],
            ["Смещённых контролей", String(hypothesis.randomAgreement.testedOffsets)],
            ["95-й процентиль контролей", String(hypothesis.randomAgreement.control95PercentileAgreements)],
            ["Применён критерий точного многолинейного совпадения", hypothesis.randomAgreement.coherentConstellationOverride ? "Да" : "Нет"],
          ]} />
        </section>
      </details>
      <MolecularChecks analysis={analysis} standalone />
    </AnalysisPage>
  );
}

export function AnalysisAnalysisPage() {
  const analysisView = useAnalysisWorkspaceUi((state) => state.analysisView);
  return analysisView === "composition" ? <IdentificationAnalysisPage /> : <PeaksAnalysisPage />;
}

function AnalysisConclusion({ analysis }: Readonly<{ analysis: WorkingAnalysis }>) {
  const { selectedHypothesisId, selectHypothesis, setAnalysisView } = useAnalysisWorkspace();
  const reliableItems = [
    ...analysis.hypotheses.map((item) => ({ id: item.id, symbol: item.symbol, name: item.name, tab: "hypotheses" as const })),
    ...analysis.molecularHypotheses.map((item) => ({ id: item.id, symbol: item.formula, name: item.displayName, tab: "hypotheses" as const })),
  ];
  const choices = [...reliableItems, ...analysis.rejectedHypotheses.map(({ hypothesis }) => ({ id: hypothesis.id, symbol: hypothesis.symbol, name: hypothesis.name, tab: "diagnostics" as const }))];
  return <section className={styles.compositionStrip} aria-labelledby="analysis-conclusion-title">
    <p id="analysis-conclusion-title"><strong>{reliableItems.length ? `Обнаружено: ${reliableItems.map((item) => `${item.name} (${item.symbol})`).join(", ")}` : "Элементы не определены."}</strong><span>{describeCompositionSettings(analysis.parameters.composition)}</span></p>
    {resolveCompositionSettings(analysis.parameters.composition).elementMode !== "all" ? <p className={styles.detailNote}>Результат относится только к проверяемым элементам.</p> : null}
    {choices.length ? <label className={styles.mobileResultSelect}><span>Выбрать результат</span><Select value={choices.some((item) => item.id === selectedHypothesisId) ? selectedHypothesisId! : ""} onValueChange={(value) => { const choice = choices.find((item) => item.id === value); if (choice) selectHypothesis(value, choice.tab); setAnalysisView("composition"); }}>
      {choices.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} ({item.symbol}){item.tab === "diagnostics" ? " · не подтверждён" : ""}</SelectItem>)}
    </Select></label> : null}
  </section>;
}

function MolecularChecks({ analysis, standalone = false }: Readonly<{ analysis: WorkingAnalysis; standalone?: boolean }>) {
  if (!analysis.rejectedMolecularHypotheses.length) return null;
  const checks = <section className={`${styles.evidenceSection} ${styles.spectrumChecks}`} aria-label="Проверка молекулярных систем">
    <h3 className={styles.titleWithTooltip}>Проверка молекулярных систем <InfoTooltip label="Проверка молекулярных систем" content="Проверка относится ко всему спектру и не зависит от выбранного элемента." /></h3>
    {analysis.rejectedMolecularHypotheses.map((item) => <details key={item.id} className={styles.molecularCheck}>
      <summary>{item.formula} · {item.systemName}</summary>
      <p>{item.explanation}</p>
      <ul>{item.reasons.map((reason) => <li key={reason}>{formatMolecularReason(reason)}</li>)}</ul>
    </details>)}
  </section>;
  return standalone ? <details className={styles.interpretationDisclosure}><summary>Проверки всего спектра</summary>{checks}</details> : checks;
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
      <section className={styles.resultOverview} aria-labelledby="selected-molecule-title">
        <div className={styles.resultOverviewTitle}><h2 id="selected-molecule-title">{hypothesis.displayName} <span>· {hypothesis.formula}</span></h2><Tag tone="success">Обнаружено</Tag></div>
        <p>{formatMolecularSupportSummary(hypothesis)}{hypothesis.admission === "sensitive" ? " Чувствительный отбор." : ""}</p>
      </section>
      <Card
        title="Спектр"
        accessory={analysis.channels.length > 1 ? (
          <label className={styles.channelPicker} htmlFor="molecular-channel">
            <span>Канал</span>
            <Select id="molecular-channel" value={channel.id} onValueChange={(value) => selectIdentificationChannel(value)}>
              {analysis.channels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </Select>
          </label>
        ) : undefined}
      >
        <SpectrumChart
          rawIntensityUnit={analysis.source.units === "нм / отсчёты прибора" ? "отсчёты прибора" : "отн. ед."}
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
      <Card className={styles.evidenceCard} title="Доказательства">
        <div className={styles.tableScroll}><table className={`${styles.table} ${styles.molecularEvidenceTable}`}>
          <thead><tr><th>Характерный участок · нм</th><th>Канал</th><th>Совпадение формы</th></tr></thead>
          <tbody>{hypothesis.observations.map((item) => <tr key={`${item.channelId}-${item.regionId}`}><td><code>{formatDecimal(item.observedRange.minimum, 1)}–{formatDecimal(item.observedRange.maximum, 1)}</code></td><td>{analysis.channels.find((entry) => entry.id === item.channelId)?.name ?? item.channelId}</td><td>{item.supported ? "Подтверждено" : "Не подтверждено"}</td></tr>)}</tbody>
        </table></div>
      </Card>
      <details className={`${styles.interpretationDisclosure} ${styles.resultChecks}`}><summary>Проверка результата</summary><dl><div><dt>Контроль случайных совпадений формы</dt><dd data-passed={hypothesis.randomAgreement.distinguishableFromRandom}>{hypothesis.randomAgreement.distinguishableFromRandom ? "Пройден" : "Не пройден"}</dd></div></dl></details>
      <details className={styles.interpretationDisclosure}>
        <summary>Подробности молекулярного сопоставления</summary>
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
  const [recordLine, setRecordLine] = useState<AnalysisEvidenceLine | null>(null);
  const recordTrigger = useRef<HTMLButtonElement | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const characteristic = hypothesis.evidence.filter((line) => line.isCharacteristic && line.strength !== "weak");
  const rows = [...(showAll ? hypothesis.evidence : characteristic)].sort((left, right) => Number(right.isKeyCharacteristic) - Number(left.isKeyCharacteristic) || Number(right.isCharacteristic) - Number(left.isCharacteristic) || right.quality - left.quality);
  return <>
    <div className={styles.evidenceToolbar} role="group" aria-label="Показать доказательства">
      <Button size="compact" variant="ghost" aria-pressed={!showAll} onClick={() => setShowAll(false)}>Характерные · {characteristic.length}</Button>
      <Button size="compact" variant="ghost" aria-pressed={showAll} onClick={() => setShowAll(true)}>Все совпадения · {hypothesis.evidence.length}</Button>
    </div>
    {!rows.length ? <InlineEmptyState>{showAll ? "Сопоставленных групп нет." : "Качественных характерных совпадений нет. Остальные доступны в полном списке."}</InlineEmptyState> :
    <div className={`${styles.tableScroll} ${styles.evidenceTableScroll}`}>
      <table className={`${styles.table} ${styles.evidenceTable}`}>
        <colgroup><col className={styles.evidenceGroupColumn} /><col className={styles.evidencePeakColumn} /><col className={styles.evidenceDeltaColumn} /><col className={styles.evidenceSnrColumn} /><col className={styles.evidenceQualityColumn} /></colgroup>
        <thead><tr><th>Группа · нм</th><th>Пик · нм</th><th>Отклонение · нм</th><th>SNR</th><th><span className={styles.titleWithTooltip}>Качество <InfoTooltip label="Качество совпадения" content="Оценка отдельного совпадения для ранжирования; не вероятность присутствия элемента." /></span></th></tr></thead>
        <tbody>{rows.map((line) => {
          const alternatives = [...new Set(line.observations.flatMap((observation) => hypothesis.alternativeExplanations.find((item) => item.peakId === observation.peakId && item.channelId === observation.channelId)?.elementSymbols ?? []))].filter((symbol) => symbol !== hypothesis.symbol);
          const first = line.observations[0];
          const expanded = expandedGroupId === line.groupId;
          const openPeak = () => { if (first) { onObservationOpen(first.peakId, first.channelId); onPeakOpen(first.peakId); } };
          return <Fragment key={line.groupId}>
            <tr className={styles.selectableRow} data-evidence-row={line.groupId} tabIndex={first ? 0 : undefined} onClick={openPeak} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openPeak(); } }}>
              <td data-label="Группа · нм"><div className={styles.evidenceIdentity}>
                <Button variant="ghost" size="hint" aria-label={`Подробности группы ${formatGroupWavelength(line)}`} aria-expanded={expanded} aria-controls={`evidence-${line.groupId}`} onClick={(event) => { event.stopPropagation(); setExpandedGroupId(expanded ? null : line.groupId); }}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</Button>
                <div><strong>{formatEvidenceLabel(line)}{line.isKeyCharacteristic ? <span className={styles.evidenceKey}>Ключевая</span> : null}</strong><code>{formatGroupWavelength(line)}</code></div>
              </div></td>
              <td data-label="Пик · нм"><div className={styles.valueStack}>{line.observations.map((observation) => <code key={`${observation.channelId}-${observation.peakId}`}>{formatDecimal(observation.peakWavelength, 3)}</code>)}</div></td>
              <td data-label="Отклонение · нм"><div className={styles.valueStack}>{line.observations.map((observation) => <code key={`${observation.channelId}-${observation.peakId}`}>{formatSignedDelta(observation.delta)}</code>)}</div></td>
              <td data-label="SNR"><div className={styles.valueStack}>{line.observations.map((observation) => <code key={`${observation.channelId}-${observation.peakId}`}>{Number.isFinite(observation.snr) ? formatDecimal(observation.snr, 2) : "∞"}</code>)}</div></td>
              <td data-label="Качество"><span className={styles.qualityCell}><span>{formatEvidenceQuality(line.strength)}</span></span></td>
            </tr>
            {expanded ? <tr className={styles.evidenceExpandedRow} id={`evidence-${line.groupId}`}><td colSpan={5}>
              <div className={styles.evidenceDetails}><dl className={styles.evidenceDetailsMetrics}>
                <div><dt>Индекс совпадения <InfoTooltip label="Числовой индекс совпадения" content="Эвристический индекс качества отдельного совпадения для ранжирования. Не является вероятностью присутствия элемента." /></dt><dd>{formatDecimal(line.quality, 2)}</dd></div>
                <div><dt>Тип длины</dt><dd>{formatWavelengthOrigin(line.wavelengthType)}</dd></div>
                <div><dt>Среда</dt><dd>{formatWavelengthMedium(line.wavelengthMedium)}</dd></div>
                <div><dt>Каналы наблюдений</dt><dd>{line.observations.map((observation) => analysis.channels.find((item) => item.id === observation.channelId)?.name ?? observation.channelId).join(", ")}</dd></div>
                <div><dt>Альтернативные элементы</dt><dd>{alternatives.length ? alternatives.join(", ") : "Нет"}</dd></div>
                <div><dt>Линий в группе</dt><dd>{line.memberLineIds.length}</dd></div>
              </dl>
              <div className={styles.evidenceDetailsActions}><Button size="compact" onClick={(event) => { recordTrigger.current = event.currentTarget; setRecordLine(line); }}>Справочные линии · {line.memberLineIds.length}</Button></div></div>
            </td></tr> : null}
          </Fragment>;
        })}</tbody>
      </table>
    </div>}
    <ReferenceRecordDialog lineIds={recordLine?.memberLineIds} title={recordLine ? `Справочные линии · ${formatEvidenceLabel(recordLine)} · ${formatGroupWavelength(recordLine)}` : undefined} onClose={() => setRecordLine(null)} restoreFocus={() => recordTrigger.current?.focus()} />
  </>;
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
    "single-region": "недостаточно подтверждённых участков для выбранного режима",
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

function AnalysisPage({
  title,
  children,
  showAnalysisModes = title === "Анализ",
  action,
  summary,
  peakLayout = false,
}: Readonly<{ peakLayout?: boolean; title: string; children: ReactNode; showAnalysisModes?: boolean; action?: ReactNode; summary?: string }>) {
  const { analysisView, calculationStatus, parameterError, setAnalysisView } = useAnalysisWorkspace();
  const status = calculationStatus === "calculating"
    ? <Tag tone="info">Обновляем анализ…</Tag>
    : parameterError
      ? <Tag tone="danger">Изменения не применены</Tag>
      : null;

  return (
    <div className={`${styles.page} ${title === "Данные" ? styles.dataPage : ""} ${peakLayout ? styles.peakPage : ""} ${showAnalysisModes && analysisView === "composition" ? styles.compositionPage : ""}`} aria-busy={calculationStatus === "calculating"}>
      <div className={showAnalysisModes ? styles.analysisPageNavigation : styles.pageIntroduction}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{title}</h1>
          {summary ? <p className={styles.pageSummary}>{summary}</p> : null}
        </div>
        <div className={styles.pageActions}>{status}{action}</div>
      </header>
      {showAnalysisModes ? (
        <div className={styles.analysisModeTabs} role="tablist" aria-label="Режим анализа">
          <Button variant="ghost" type="button" role="tab" aria-selected={analysisView === "peaks"} onClick={() => setAnalysisView("peaks")}>Спектр и пики</Button>
          <Button variant="ghost" type="button" role="tab" aria-selected={analysisView === "composition"} onClick={() => setAnalysisView("composition")}>Интерпретация</Button>
        </div>
      ) : null}
      </div>
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
      <Button asChild className={styles.unavailableAction}><Link href="/data">
        Перейти к данным
      </Link></Button>
    </section>
  );
}

function Card({
  className,
  title,
  accessory,
  description,
  children,
}: Readonly<{ className?: string; title: ReactNode; accessory?: ReactNode; description?: ReactNode; children: ReactNode }>) {
  return (
    <section className={[styles.card, className].filter(Boolean).join(" ")}>
      <header className={styles.cardHeader}>
        <div className={styles.cardHeading}><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
        {accessory}
      </header>
      {children}
    </section>
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
  onPeakPreview,
}: Readonly<{
  peaks: readonly AnalyzedPeak[];
  selectedPeakId: string | null;
  onPeakSelect: (peakId: string) => void;
  onPeakPreview: (peakId: string | null) => void;
}>) {
  const table = useTable({
    data: peaks,
    columns: peakTableColumns,
    features: peakTableFeatures,
    getRowId: (peak) => peak.id,
    enableSortingRemoval: false,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const orderedIds = table.getRowModel().rows.map((row) => row.id).join("|");
  useEffect(() => {
    const container = containerRef.current;
    const row = container?.querySelector<HTMLElement>('tr[aria-selected="true"]');
    if (!container || !row) return;
    const bounds = container.getBoundingClientRect();
    const rowBounds = row.getBoundingClientRect();
    const headerHeight = container.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    if (rowBounds.top < bounds.top + headerHeight) container.scrollTop += rowBounds.top - bounds.top - headerHeight;
    else if (rowBounds.bottom > bounds.bottom) container.scrollTop += rowBounds.bottom - bounds.bottom;
  }, [orderedIds, selectedPeakId]);

  if (!peaks.length) {
    return <InlineEmptyState>При текущих параметрах пики не обнаружены.</InlineEmptyState>;
  }

  return (
    <div ref={containerRef} className={`${styles.tableScroll} ${styles.peakTableScroll}`}>
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
                    <Button size="compact" variant="ghost"
                      type="button"
                      className={styles.sortableHeader}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <table.FlexRender header={header} />
                      <span aria-hidden="true">{header.column.getIsSorted() === "asc" ? "↑" : header.column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
                    </Button>
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
              onMouseEnter={() => onPeakPreview(peak.id)}
              onMouseLeave={() => onPeakPreview(null)}
              onFocus={() => onPeakPreview(peak.id)}
              onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onPeakPreview(null); }}
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
  peakColumnHelper.accessor("wavelength", { header: "Длина волны", cell: ({ row }) => <code>{formatDecimal(row.original.wavelength, 3)} нм</code> }),
  peakColumnHelper.accessor("intensity", { header: "Интенсивность", cell: ({ row }) => <code>{formatDecimal(row.original.intensity, 3)}</code> }),
  peakColumnHelper.accessor("widthNm", { header: "Ширина, нм", cell: ({ row }) => <code>{formatDecimal(row.original.widthNm, 3)}</code> }),
  peakColumnHelper.display({ id: "assignment", header: "Назначение", cell: ({ row }) => <PeakAssignment peakId={row.original.id} /> }),
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
      <Select id={id} aria-label={label} value={value} onValueChange={(value) => onChange(value)}>
        {channels.map((channel) => <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>)}
      </Select>
    </label>
  );
}

function formatSignedDelta(delta: number): string {
  return formatSignedDecimal(delta, 3);
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

function formatWavelengthOrigin(origin: "observed" | "ritz"): string {
  return origin === "observed" ? "наблюдаемая" : "Ritz";
}

function formatWavelengthMedium(medium: "air" | "vacuum"): string {
  return medium === "air" ? "воздух" : "вакуум";
}

function formatMeasuredValue(value: number): string {
  return Number.isFinite(value) ? formatDecimal(value, 2) : value === Infinity ? "∞" : "Не определено";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : formatDecimal(value, 2);
}

function PeakAssignment({ peakId }: Readonly<{ peakId: string }>) {
  const { analysis, selectPeak } = useAnalysisWorkspace();
  const { setTab } = usePeakInspectorUi();
  const assigned = analysis?.hypotheses.filter((hypothesis) => hypothesis.evidence.some((group) => group.observations.some((item) => item.peakId === peakId)));
  return assigned?.length ? <Button variant="text" size="compact" className={styles.assignmentLink} aria-label={`Соответствия пика: ${assigned.map((item) => item.symbol).join(", ")}`} onClick={(event) => { event.stopPropagation(); setTab("matches"); selectPeak(peakId); }}>{assigned.map((item) => item.symbol).join(", ")}</Button> : "—";
}

function CompactInterpretation({ analysis }: Readonly<{ analysis: WorkingAnalysis }>) {
  const { setAnalysisView } = useAnalysisWorkspace();
  const labels = [...analysis.hypotheses.map((item) => item.symbol), ...analysis.molecularHypotheses.map((item) => item.formula)];
  return <section className={styles.compactInterpretation} aria-label="Краткая интерпретация"><div className={styles.compactInterpretationCopy}><strong>Интерпретация</strong> · {labels.length ? labels.join(", ") : "Принятых гипотез нет"}{resolveCompositionSettings(analysis.parameters.composition).elementMode !== "all" || resolveCompositionSettings(analysis.parameters.composition).mode !== "standard" ? <small className={styles.settingHint}>{describeCompositionSettings(analysis.parameters.composition)}</small> : null}</div><Button variant="text" size="compact" onClick={() => setAnalysisView("composition")}>Доказательства</Button></section>;
}

function AnalysisExportMenu({ analysis, channelId }: Readonly<{ analysis: WorkingAnalysis; channelId: string }>) {
  const channel = analysis.channels.find((item) => item.id === channelId)!;
  const download = (kind: "peaks" | "spectrum" | "analysis") => {
    const content = kind === "peaks" ? createPeaksCsv(channel) : kind === "spectrum" ? createSpectrumCsv(channel) : createAnalysisExport(analysis);
    const url = URL.createObjectURL(new Blob([content], { type: kind === "analysis" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${analysis.source.fileName}-${channelId}-${kind}.${kind === "analysis" ? "json" : "csv"}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild><Button aria-label="Экспорт результатов">
      <Download size={16} aria-hidden="true" /><span>Экспорт</span><ChevronDown size={14} aria-hidden="true" />
    </Button></DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className={menuStyles.content} align="end" sideOffset={6} collisionPadding={12}>
        <DropdownMenu.Item className={menuStyles.item} onSelect={() => download("peaks")}><span>Таблица пиков</span><span className={menuStyles.metadata}>CSV</span></DropdownMenu.Item>
        <DropdownMenu.Item className={menuStyles.item} onSelect={() => download("spectrum")}><span>Подготовленный спектр</span><span className={menuStyles.metadata}>CSV</span></DropdownMenu.Item>
        <DropdownMenu.Separator className={menuStyles.separator} />
        <DropdownMenu.Item className={menuStyles.item} onSelect={() => download("analysis")}><span>Все результаты и параметры</span><span className={menuStyles.metadata}>JSON</span></DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
