"use client";

import { formatCalibrationReason } from "../model/calibration-ui";
import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/ui/select";

import { COMPOSITION_MODE_LABELS, DEFAULT_COMPOSITION_SETTINGS, resolveCompositionSettings, type CompositionSettings } from "@/domain/spectrum/composition-settings";
import { builtinSpectralLibraryElements } from "@/domain/spectral-library/builtin-library-summary";

import { ChevronLeft, ChevronRight, CircleAlert, Crosshair, SlidersHorizontal, ScanLine, LoaderCircle, RotateCcw, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  useAnalysisWorkspace,
  useAnalysisWorkspaceCore,
  usePeakInspectorUi,
} from "@/features/demo-analysis/model/analysis-workspace-context";
import { DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS } from "@/domain/spectrum";
import { InfoTooltip } from "@/features/workspace/components/info-tooltip";
import { formatCount, formatDecimal, formatSignedDecimal } from "@/features/workspace/model/display-format";
import {
  diagnosticReasonLabels,
  getIdentificationEntries,
  type IdentificationSort,
} from "@/features/demo-analysis/model/identification-ui";
import {
  createPeakCandidateView,
  filterCandidateGroups,
  type CandidateDisplayGroup,
  type CandidateRelationFilter,
} from "@/features/demo-analysis/model/peak-candidates-ui";

import { useProcessingSection } from "../model/processing-section";
import styles from "./analysis-page.module.css";
import { ReferenceRecordDialog } from "./reference-record-dialog";
import { SettingsDisclosure } from "./settings-disclosure";
import { ResultChoice } from "./result-choice";

const processingSections = [
  { id: "preparation-settings", label: "Подготовка", icon: SlidersHorizontal },
  { id: "peak-settings", label: "Поиск пиков", icon: ScanLine },
  { id: "composition-settings", label: "Состав", icon: Search },
] as const;

function CalibrationStatus({ channel }: Readonly<{ channel: NonNullable<ReturnType<typeof useAnalysisWorkspaceCore>["analysis"]>["channels"][number] }>) {
  const calibration = channel.wavelengthCalibration;
  const applied = calibration.status === "applied";
  return <div className={styles.calibrationStatus}>
    <span>Смещение шкалы</span>
    <strong>{applied ? `${formatSignedDecimal(calibration.shiftNm, 3)} нм` : "Не применено"}</strong>
    <InfoTooltip label="Коррекция шкалы длины волны" content={`${applied ? "Общее смещение длин волн применено" : "Общее смещение длин волн не применено"}: ${formatCalibrationReason(calibration.reason)}. Исходные измерения не изменяются.`} />
  </div>;
}

export function ProcessingSettingsPanel() {
  const section = useProcessingSection();
  const selectSection = (index: number) => {
    const next = processingSections[index];
    window.history.pushState(null, "", `#${next.id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    document.getElementById(`${next.id}-tab`)?.focus();
  };
  return (
    <div className={styles.processingSettings}>
      <div className={styles.settingsNavigation}>
        <div className={styles.settingsTabs} role="tablist" aria-label="Разделы настроек">
          {processingSections.map(({ id, label, icon: Icon }, index) => (
            <Button variant="ghost"
              key={id}
              id={`${id}-tab`}
              type="button"
              role="tab"
              aria-selected={section === id}
              aria-controls={`${id}-panel`}
              tabIndex={section === id ? 0 : -1}
              onClick={() => selectSection(index)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                selectSection(event.key === "Home" ? 0 : event.key === "End" ? processingSections.length - 1 : (index + (event.key === "ArrowLeft" ? -1 : 1) + processingSections.length) % processingSections.length);
              }}
            >
              <Icon size={16} aria-hidden="true" />{label}
            </Button>
          ))}
        </div>
      </div>
      {processingSections.map(({ id }) => (
        <section key={id} id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab`} hidden={section !== id}>
          {section === id ? id === "peak-settings" ? <PeakSearchSettingsPanel /> : id === "composition-settings" ? <CompositionSettingsPanel /> : <PreparationSettingsPanel /> : null}
        </section>
      ))}
    </div>
  );
}

export function CompositionSettingsPanel() {
  const { parameters, updateCompositionSettings, calculationStatus, parameterError } = useAnalysisWorkspace();
  const settings = resolveCompositionSettings(parameters.composition);
  const [query, setQuery] = useState("");
  const elements = builtinSpectralLibraryElements.filter((item) => `${item.symbol} ${item.name}`.toLocaleLowerCase("ru-RU").includes(query.toLocaleLowerCase("ru-RU")));
  const custom = (patch: Partial<CompositionSettings>) => updateCompositionSettings({ ...patch, mode: "custom" });
  return (
    <div className={styles.sidePanelContent}>
      <SidePanelHeader title="Определение состава" onReset={() => updateCompositionSettings(DEFAULT_COMPOSITION_SETTINGS)} resetDisabled={JSON.stringify(settings) === JSON.stringify(DEFAULT_COMPOSITION_SETTINGS)} />
      <ParameterSection title="Проверяемые элементы">
        <SelectParameter id="element-mode" label="Область поиска" value={settings.elementMode} onChange={(value) => updateCompositionSettings({ elementMode: value as CompositionSettings["elementMode"] })} options={[{ value: "all", label: "Все элементы библиотеки" }, { value: "exclude", label: "Исключить выбранные" }, { value: "only", label: "Только выбранные" }]} />
        {settings.elementMode !== "all" ? <>
          <label className={styles.compositionSearch}>Найти элемент<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или символ" /></label>
          <p className={styles.sidePanelEmpty}>Выбрано: {settings.elements.length}. Доступны элементы встроенной библиотеки. Азот включает N, N₂ и N₂⁺.</p>
          <div className={styles.elementChoices}>
            {elements.map((element) => <label key={element.symbol}>
              <input type="checkbox" checked={settings.elements.includes(element.symbol)} onChange={(event) => updateCompositionSettings({ elements: event.target.checked ? [...settings.elements, element.symbol].sort() : settings.elements.filter((item) => item !== element.symbol) })} />
              <strong>{element.symbol}</strong><span>{element.name}</span>
            </label>)}
          </div>
          {!elements.length ? <p>Элемент не найден в библиотеке.</p> : null}
          {settings.elementMode === "only" && !settings.elements.length ? <p role="status">Выберите хотя бы один элемент. Пока определение состава отключено.</p> : null}
        </> : null}
      </ParameterSection>
      <ParameterSection>
        <SelectParameter id="composition-mode" label="Режим отбора" value={settings.mode} onChange={(value) => updateCompositionSettings({ mode: value as CompositionSettings["mode"] })} options={Object.entries(COMPOSITION_MODE_LABELS).map(([value, label]) => ({ value, label }))} />
        <p className={styles.sidePanelEmpty}>{settings.mode === "sensitive" ? "Допускает менее выраженные подтверждения в составе. Такие результаты отмечены; остальные совпадения доступны для исследования." : settings.mode === "strict" ? "Требует больше независимых подтверждений и более высокого качества совпадений." : settings.mode === "custom" ? "Применены заданные вручную требования к подтверждениям." : "Атомные линии — от 3 независимых групп; молекулярные полосы — от 2 областей."}</p>
        <SettingsDisclosure title="Требования к подтверждениям" value={COMPOSITION_MODE_LABELS[settings.mode]} status={calculationStatus} error={parameterError}>
          <div className={styles.parameterStack}>
            <NumberParameter id="composition-groups" label="Минимум атомных групп" help="Независимые группы линий, подтверждающие элемент. Несколько неразрешимых линий одного пика считаются одной группой. Увеличьте значение для более строгого отбора." unit="" value={settings.minimumGroups} min={3} max={10} step={1} onChange={(minimumGroups) => custom({ minimumGroups })} />
            <RangeParameter id="composition-quality" label="Качество атомного подтверждения" help="Учитывает заметность сигнала, точность совпадения и неоднозначность. Большее значение исключает слабые подтверждения. Это индекс отбора, а не вероятность." value={settings.minimumQuality} min={0.4} max={0.75} step={0.01} output={formatDecimal(settings.minimumQuality, 2)} onChange={(minimumQuality) => custom({ minimumQuality })} />
            <NumberParameter id="composition-strong" label="Минимум сильных групп" help="Сколько подтверждений должны быть особенно выраженными и однозначными. Ключевой признак и проверка случайных совпадений обязательны при любом значении." unit="" value={settings.minimumStrongGroups} min={0} max={5} step={1} onChange={(minimumStrongGroups) => custom({ minimumStrongGroups })} />
            <NumberParameter id="composition-regions" label="Минимум областей полос" help="Для N₂ и N₂⁺ проверяется форма нескольких участков спектра. Атомные группы и молекулярные области не суммируются." unit="" value={settings.minimumMolecularRegions} min={2} max={5} step={1} onChange={(minimumMolecularRegions) => custom({ minimumMolecularRegions })} />
            <RangeParameter id="composition-molecular-quality" label="Качество формы полос" help="Насколько хорошо наблюдаемая форма должна совпадать с молекулярной полосой. Большее значение делает отбор строже; сравнение со случайными совпадениями остаётся обязательным." value={settings.minimumMolecularQuality} min={0.36} max={0.75} step={0.01} output={formatDecimal(settings.minimumMolecularQuality, 2)} onChange={(minimumMolecularQuality) => custom({ minimumMolecularQuality })} />
          </div>
        </SettingsDisclosure>
      </ParameterSection>
      <CalculationFeedback status={calculationStatus} error={parameterError} />
    </div>
  );
}

function PreparationSettingsPanel() {
  const {
    analysis,
    parameters,
    calculationStatus,
    parameterError,
    resetProcessingParameters,
    updateProcessingParameters,
    updateWavelengthCalibrationParameters,
  } = useAnalysisWorkspaceCore();
  const selectedChannelId = useAnalysisWorkspace().selectedIdentificationChannelId;
  const selectedChannel = analysis?.channels.find((channel) => channel.id === selectedChannelId) ?? analysis?.channels[0];
  const canReset = parameters.processing.analysisRange !== undefined || parameters.processing.baselineSmoothness !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing.baselineSmoothness
    || parameters.processing.noiseWindowNm !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing.noiseWindowNm
    || parameters.processing.smoothingWindow !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing.smoothingWindow
    || parameters.processing.normalization !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing.normalization
    || parameters.wavelengthCalibration.allowAutomaticCorrection !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.wavelengthCalibration.allowAutomaticCorrection;

  return (
    <div className={styles.sidePanelContent} data-parameter-panel="processing">
      <SidePanelHeader title="Подготовка спектра" onReset={resetProcessingParameters} resetDisabled={!canReset} />
      {analysis ? <ParameterSection title="Диапазон анализа">
        <ToggleParameter id="restrict-analysis-range" label="Ограничить диапазон, нм" help="Обработка и интерпретация выполняются только внутри границ. Масштаб графика на диапазон анализа не влияет. Исходное измерение сохраняется целиком." checked={parameters.processing.analysisRange !== undefined} onChange={(checked) => updateProcessingParameters({ analysisRange: checked ? { ...analysis.wavelengthRange } : undefined })} />
        {parameters.processing.analysisRange ? <ValueRangeParameter label="Границы анализа" unit="нм"
          minimum={{ id: "analysis-range-min", value: parameters.processing.analysisRange.minimum, min: 0, max: parameters.processing.analysisRange.maximum, step: 0.001 }}
          maximum={{ id: "analysis-range-max", value: parameters.processing.analysisRange.maximum, min: parameters.processing.analysisRange.minimum, max: 1000000, step: 0.001 }}
          onMinimumChange={(minimum) => updateProcessingParameters({ analysisRange: { ...parameters.processing.analysisRange!, minimum } })}
          onMaximumChange={(maximum) => updateProcessingParameters({ analysisRange: { ...parameters.processing.analysisRange!, maximum } })} /> : null}
      </ParameterSection> : null}
      <ParameterSection>
        <RangeParameter
          id="smoothing-window"
          label="Сглаживание"
          help="Убирает мелкие колебания сигнала. Большое окно сильнее сглаживает спектр, но может скрыть узкие пики или объединить близкие. Значение 1 отключает сглаживание."
          value={parameters.processing.smoothingWindow}
          min={1}
          max={51}
          step={2}
          output={`${selectedChannel ? `≈${formatDecimal((parameters.processing.smoothingWindow - 1) * ((selectedChannel.wavelengthRange.maximum - selectedChannel.wavelengthRange.minimum) / Math.max(1, selectedChannel.preparedDataset.wavelengths.length - 1)), 3)} нм` : ""}`}
          onChange={(value) => updateProcessingParameters({ smoothingWindow: value })}
        />
      </ParameterSection>
      <ParameterSection title="Базовая линия">
        <LogRangeParameter
          id="baseline-smoothness"
          label="Гладкость базовой линии"
          help="Определяет, насколько плавно меняется фон под пиками. Увеличьте значение для более ровного фона; уменьшите, если фон заметно изгибается. Ползунок имеет логарифмическую шкалу."
          value={parameters.processing.baselineSmoothness}
          min={100}
          max={10_000_000}
          onChange={(value) => updateProcessingParameters({ baselineSmoothness: value })}
        />
        <SettingsDisclosure title="Оценка шума" invalid={!(parameters.processing.noiseWindowNm > 0)} value={`окно ${formatSettingValue(parameters.processing.noiseWindowNm)} нм`} status={calculationStatus} error={parameterError}>
        <NumberParameter
          id="noise-window"
          label="Окно"
          help="Размер участка, по которому оцениваются случайные колебания сигнала. Малое окно лучше учитывает местные изменения шума, большое даёт более устойчивую оценку."
          unit="нм"
          value={parameters.processing.noiseWindowNm}
          min={0.05}
          max={50}
          step={0.1}
          onChange={(value) => updateProcessingParameters({ noiseWindowNm: value })}
        />
        </SettingsDisclosure>
      </ParameterSection>
      <ParameterSection>
        <SelectParameter
          id="normalization-method"
          label="Нормализация"
          help="Приводит наибольшую подготовленную интенсивность к 1, чтобы удобнее сравнивать форму спектра. Исходные измерения сохраняются без изменений."
          value={parameters.processing.normalization}
          onChange={(value) => updateProcessingParameters({ normalization: value === "none" ? "none" : "maximum" })}
          options={[{ value: "maximum", label: "К максимуму (0–1)" }, { value: "none", label: "Не нормировать" }]}
        />
      </ParameterSection>
      <ParameterSection title="Шкала длины волны">
        <ToggleParameter
          id="automatic-wavelength-calibration"
          label="Автоматически уточнять шкалу"
          help="Исправляет небольшое общее смещение длин волн, если несколько уверенных совпадений подтверждают поправку и отдельная проверка показывает улучшение. Исходные измерения сохраняются."
          checked={parameters.wavelengthCalibration.allowAutomaticCorrection}
          onChange={(checked) => updateWavelengthCalibrationParameters({ allowAutomaticCorrection: checked })}
        />
        {selectedChannel ? <CalibrationStatus channel={selectedChannel} /> : null}
        {analysis && analysis.channels.length > 1 ? <SettingsDisclosure title="Другие участки и каналы" value={String(analysis.channels.length - 1)} readOnly>
          <div className={styles.calibrationChannelList}>{analysis.channels.filter((channel) => channel.id !== selectedChannel?.id).map((channel) => <div className={styles.calibrationChannelItem} key={channel.id}>
            <span>{channel.id.match(/-segment-(\d+)$/) ? `Участок ${channel.id.match(/-segment-(\d+)$/)![1]}` : channel.name}</span>
            <span className={styles.calibrationRange}>{formatDecimal(channel.wavelengthRange.minimum, 2)}–{formatDecimal(channel.wavelengthRange.maximum, 2)} нм</span>
            <CalibrationStatus channel={channel} />
          </div>)}</div>
        </SettingsDisclosure> : null}
      </ParameterSection>
      <CalculationFeedback status={calculationStatus} error={parameterError} />
    </div>
  );
}

export function PeakSearchSettingsPanel() {
  const {
    parameters,
    calculationStatus,
    parameterError,
    resetPeakSearchParameters,
    updatePeakSearchParameters,
  } = useAnalysisWorkspace();
  const canReset = parameters.peakSearch.minimumSnr !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch.minimumSnr
    || parameters.peakSearch.minimumWidth !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch.minimumWidth
    || parameters.peakSearch.maximumWidth !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch.maximumWidth
    || parameters.peakSearch.prominence !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch.prominence
    || parameters.peakSearch.minimumDistance !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch.minimumDistance;

  return (
    <div className={styles.sidePanelContent}>
      <SidePanelHeader title="Параметры пиков" onReset={resetPeakSearchParameters} resetDisabled={!canReset} />
      <ParameterSection>
        <RangeParameter
          id="detection-threshold"
          label="Минимальное отношение сигнал/шум"
          help="Насколько пик должен выделяться на фоне шума. Увеличьте значение, чтобы убрать сомнительные пики; уменьшите, чтобы искать более слабые."
          value={parameters.peakSearch.minimumSnr}
          min={0}
          max={30}
          step={0.5}
          output={formatDecimal(parameters.peakSearch.minimumSnr, 1)}
          onChange={(value) => updatePeakSearchParameters({ minimumSnr: value })}
        />
        <ValueRangeParameter
          label="Ширина на половине выраженности"
          help="Оставляет пики в выбранном диапазоне ширины. Нижняя граница отсеивает слишком узкие всплески, верхняя — широкие подъёмы сигнала. Слишком узкий диапазон может исключить реальные линии."
          minimum={{ id: "minimum-width", value: parameters.peakSearch.minimumWidth, min: 0, max: 50, step: 0.01 }}
          maximum={{ id: "maximum-width", value: parameters.peakSearch.maximumWidth, min: 0.01, max: 100, step: 0.1 }}
          unit="нм"
          onMinimumChange={(value) => updatePeakSearchParameters({ minimumWidth: value })}
          onMaximumChange={(value) => updatePeakSearchParameters({ maximumWidth: value })}
        />
        <SettingsDisclosure title="Выраженность и расстояние" invalid={parameters.peakSearch.prominence < 0 || !(parameters.peakSearch.minimumDistance > 0)} value={`${formatSettingValue(parameters.peakSearch.prominence)} ${parameters.processing.normalization === "maximum" ? "доли макс." : "ед. сигнала"} · ${formatSettingValue(parameters.peakSearch.minimumDistance)} нм`} status={calculationStatus} error={parameterError}>
        <NumberParameter
          id="minimum-prominence"
          label="Минимальная выраженность"
          help="Насколько вершина должна возвышаться над соседними впадинами. Увеличьте значение, чтобы отсеять небольшие колебания; уменьшите, чтобы сохранить менее выраженные пики."
          unit={parameters.processing.normalization === "maximum" ? "доля максимума" : "ед. сигнала"}
          value={parameters.peakSearch.prominence}
          min={0}
          max={Number.MAX_VALUE}
          step={0.01}
          onChange={(value) => updatePeakSearchParameters({ prominence: value })}
        />
        <NumberParameter
          id="minimum-distance"
          label="Расстояние между пиками"
          help="Помогает не считать близкие максимумы отдельными пиками. Чем больше значение, тем сильнее отбор близких максимумов; алгоритм ограничивает его с учётом шага измерений."
          unit="нм"
          value={parameters.peakSearch.minimumDistance}
          min={0.01}
          max={50}
          step={0.1}
          onChange={(value) => updatePeakSearchParameters({ minimumDistance: value })}
        />
        </SettingsDisclosure>
      </ParameterSection>
      <CalculationFeedback status={calculationStatus} error={parameterError} />
    </div>
  );
}

export function PeakSettingsPanel() {
  const { analysis, selectedPeakId, calculationStatus } = useAnalysisWorkspace();
  const selectedPeak = analysis?.peaks.find((peak) => peak.id === selectedPeakId) ?? null;
  return (
    <div className={styles.sidePanelContent}>
      <section className={styles.selectedPeakPanel} aria-label="Инспектор пика">
        {calculationStatus === "calculating" ? <PanelEmptyState>Обновляем анализ…</PanelEmptyState> : <SelectedPeakContent analysis={analysis} selectedPeak={selectedPeak} />}
      </section>
    </div>
  );
}

export function AnalysisSidePanel() {
  const { analysisView } = useAnalysisWorkspace();
  return analysisView === "composition" ? <IdentificationLinesPanel /> : <PeakSettingsPanel />;
}

function SelectedPeakContent({ analysis, selectedPeak }: Readonly<{
  analysis: ReturnType<typeof useAnalysisWorkspace>["analysis"];
  selectedPeak: NonNullable<ReturnType<typeof useAnalysisWorkspace>["analysis"]>["peaks"][number] | null;
}>) {
  const { tab, setTab } = usePeakInspectorUi();
  const { selectPeak } = useAnalysisWorkspace();
  if (!analysis?.peaks.length) return <PanelEmptyState>При текущих параметрах пики не найдены.</PanelEmptyState>;
  if (!selectedPeak) return <div className={styles.inspectorWelcome}><Crosshair size={20} aria-hidden="true" /><h2>Выберите пик</h2><p>На графике или в таблице.</p></div>;
  const channel = analysis.channels.find((item) => item.id === selectedPeak.channelId);
  const peaks = channel?.peaks ?? [];
  const index = peaks.findIndex((item) => item.id === selectedPeak.id);
  const rawUnit = analysis.source.units.split(" / ")[1];
  const preparedUnit = channel?.parameters.processing.normalization === "maximum" ? "доля максимума" : rawUnit;
  const tabs = [{ id: "parameters", label: "Параметры" }, { id: "matches", label: "Соответствия" }] as const;
  return <>
    <header className={styles.peakInspectorHeader}>
      <div className={styles.peakInspectorTitle}><div><h2>{formatDecimal(selectedPeak.wavelength, 3)} нм</h2><small>Пик № {index + 1}{analysis.channels.length > 1 ? ` · ${channel?.name ?? ""}` : ""}</small></div>
        <nav aria-label="Соседние пики по длине волны"><Button size="icon"  aria-label="Предыдущий пик" disabled={index <= 0} onClick={() => selectPeak(peaks[index - 1].id)}><ChevronLeft size={16} /></Button><Button size="icon"  aria-label="Следующий пик" disabled={index < 0 || index >= peaks.length - 1} onClick={() => selectPeak(peaks[index + 1].id)}><ChevronRight size={16} /></Button></nav>
      </div>
      <div className={styles.settingsTabs} role="tablist" aria-label="Разделы инспектора">
        {tabs.map((item, tabIndex) => <Button variant="ghost" key={item.id} role="tab" id={`inspector-${item.id}-tab`} aria-selected={tab === item.id} aria-controls={`inspector-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - tabIndex;
          setTab(tabs[next].id);
          document.getElementById(`inspector-${tabs[next].id}-tab`)?.focus();
        }}>{item.label}</Button>)}
      </div>
    </header>
    <div id={`inspector-${tab}`} role="tabpanel" aria-labelledby={`inspector-${tab}-tab`} className={styles.inspectorTabContent}>
      {tab === "parameters" ? <>
        <dl className={styles.inspectorMetrics}>
          <PeakDetail label={`Интенсивность · ${preparedUnit}`} value={formatMeasuredValue(selectedPeak.intensity)} />
          <PeakDetail label="Ширина · нм" value={formatValue(selectedPeak.widthNm, 3)} />
          <PeakDetail label="Сигнал/шум (SNR)" value={Number.isFinite(selectedPeak.snr) ? formatValue(selectedPeak.snr, 2) : "∞"} />
          <PeakDetail label="Неопределённость положения · нм" value={`≥ ${formatDecimal(selectedPeak.positionUncertaintyNm, 4)}`} />
          <PeakDetail label={`Исходная интенсивность · ${rawUnit}`} value={formatMeasuredValue(selectedPeak.rawIntensity)} />
        </dl>
        <p className={styles.settingHint}>Ширина измерена на половине выраженности.</p>
        {channel?.wavelengthCalibration.status === "applied" ? <p className={styles.settingHint}>Применена поправка шкалы: {formatSignedDecimal(channel.wavelengthCalibration.shiftNm, 3)} нм.</p> : null}
        <SettingsDisclosure title="Уточнение координаты" value={selectedPeak.positionRefined ? `${formatSignedDecimal(selectedPeak.refinementOffsetNm, 4)} нм` : "не применялось"} readOnly><dl className={styles.inspectorMetrics}><PeakDetail label="Исходная точка сетки · нм" value={formatDecimal(selectedPeak.sampledWavelength, 3)} /><PeakDetail label="Смещение максимума · нм" value={formatSignedDecimal(selectedPeak.refinementOffsetNm, 4)} /></dl></SettingsDisclosure>
        <SettingsDisclosure title="Обнаружение пика" value={`SNR ${formatValue(selectedPeak.snr, 1)}`} readOnly><dl className={styles.inspectorMetrics}><PeakDetail label="Выраженность" value={formatMeasuredValue(selectedPeak.prominence)} /><PeakDetail label="Локальный порог" value={formatMeasuredValue(channel?.thresholdDataset.intensities[selectedPeak.index])} /></dl></SettingsDisclosure>
      </> : <section aria-label="Линии и назначения">{selectedPeak.candidates.length ? <PeakCandidateBrowser key={selectedPeak.id} analysis={analysis} selectedPeak={selectedPeak} /> : <PanelEmptyState>Подходящих справочных линий нет.</PanelEmptyState>}</section>}
    </div>
  </>;
}

function formatMeasuredValue(value: number | undefined): string {
  return value === undefined ? "—" : Math.abs(value) >= 1_000_000 ? value.toExponential(3) : formatValue(value, 4);
}

function PeakCandidateBrowser({
  analysis,
  selectedPeak,
}: Readonly<{
  analysis: NonNullable<ReturnType<typeof useAnalysisWorkspace>["analysis"]>;
  selectedPeak: NonNullable<ReturnType<typeof useAnalysisWorkspace>["analysis"]>["peaks"][number];
}>) {
  const { selectHypothesis, setAnalysisView } = useAnalysisWorkspace();
  const [recordGroup, setRecordGroup] = useState<CandidateDisplayGroup | null>(null);
  const recordTrigger = useRef<HTMLButtonElement | null>(null);
  const openRecord = (group: CandidateDisplayGroup, trigger: HTMLButtonElement) => { recordTrigger.current = trigger; setRecordGroup(group); };
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [ionizationStage, setIonizationStage] = useState<number | "all">("all");
  const [relation, setRelation] = useState<CandidateRelationFilter>("all");
  const view = useMemo(
    () => createPeakCandidateView(analysis, selectedPeak),
    [analysis, selectedPeak],
  );
  const filteredGroups = useMemo(
    () => filterCandidateGroups(view.groups, { query, ionizationStage, relation }),
    [view.groups, query, ionizationStage, relation],
  );
  const ionizationStages = useMemo(() => [...new Set(view.groups.map((group) => (
    group.representative.ionizationStage
  )))].sort((left, right) => left - right), [view.groups]);
  const metadata = new Set(view.groups.map((group) => `${group.representative.wavelengthType} · ${group.representative.wavelengthMedium}`));
  const uniformMetadata = metadata.size === 1;
  const shownRecordCount = filteredGroups.reduce((sum, group) => sum + group.candidates.length, 0);

  const openHypothesis = (group: CandidateDisplayGroup) => {
    if (!group.hypothesis) return;
    selectHypothesis(
      group.hypothesis.id,
      group.hypothesis.role === "diagnostic" ? "diagnostics" : "hypotheses",
    );
    setAnalysisView("composition");
  };

  return (
    <>
      <ReferenceRecordDialog group={recordGroup} onClose={() => setRecordGroup(null)} restoreFocus={() => recordTrigger.current?.focus()} />
      {uniformMetadata && view.groups[0] ? <p className={styles.settingHint}>{view.groups[0].representative.wavelengthType === "observed" ? "Наблюдаемые длины" : "Ritz-длины"} · {view.groups[0].representative.wavelengthMedium === "air" ? "воздух" : "вакуум"}</p> : null}
      <Button variant="text" size="compact" className={styles.candidateToggle} type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>Все соответствия · {view.candidateCount}</Button>
      {!expanded ? (
        <div className={styles.compactCandidateView}>
          {view.acceptedAssignments.length ? (
            <section className={styles.candidateGroupSection} aria-labelledby={`candidate-assignments-${selectedPeak.id}`}>
              <h4 id={`candidate-assignments-${selectedPeak.id}`}>Назначения в составе</h4>
              <ol className={styles.candidateList}>
                {view.acceptedAssignments.map((group) => (
                  <CandidateCard key={group.id} group={group} onOpenHypothesis={openHypothesis} commonMetadata={uniformMetadata} onOpenRecord={openRecord} />
                ))}
              </ol>
            </section>
          ) : null}

          {view.nearest ? (
            <section className={styles.candidateGroupSection} aria-labelledby={`candidate-nearest-${selectedPeak.id}`}>
              <h4 id={`candidate-nearest-${selectedPeak.id}`}>Ближайшая линия</h4>
              <ol className={styles.candidateList}>
                <CandidateCard group={view.nearest} onOpenHypothesis={openHypothesis} commonMetadata={uniformMetadata} onOpenRecord={openRecord} />
              </ol>
            </section>
          ) : null}

          {view.compactAlternatives.length ? (
            <section className={styles.candidateGroupSection} aria-labelledby={`candidate-alternatives-${selectedPeak.id}`}>
              <h4 id={`candidate-alternatives-${selectedPeak.id}`}>Альтернативы</h4>
              <ol className={styles.candidateList}>
                {view.compactAlternatives.slice(0, 2).map((group) => (
                  <CandidateCard key={group.id} group={group} onOpenHypothesis={openHypothesis} commonMetadata={uniformMetadata} onOpenRecord={openRecord} />
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      ) : (
        <section className={styles.fullCandidateView} aria-labelledby={`all-candidates-${selectedPeak.id}`}>
          <h4 id={`all-candidates-${selectedPeak.id}`} className={styles.visuallyHidden}>Все соответствия</h4>
          <div className={styles.candidateFilters}>
            <label className={styles.searchField} htmlFor={`candidate-search-${selectedPeak.id}`}>
              <Search size={14} aria-hidden="true" />
              <input
                id={`candidate-search-${selectedPeak.id}`}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Элемент или символ"
                aria-label="Поиск кандидата по названию элемента или символу"
              />
            </label>
            <label className={styles.selectField} htmlFor={`candidate-ionization-${selectedPeak.id}`}>
              <span>Степень ионизации</span>
              <Select
                id={`candidate-ionization-${selectedPeak.id}`}
                value={ionizationStage}
                onValueChange={(value) => setIonizationStage(value === "all" ? "all" : Number(value))}
              >
                <SelectItem value="all">Все степени</SelectItem>
                {ionizationStages.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
              </Select>
            </label>
            <label className={styles.selectField} htmlFor={`candidate-relation-${selectedPeak.id}`}>
              <span>Отношение к составу</span>
              <Select
                id={`candidate-relation-${selectedPeak.id}`}
                value={relation}
                onValueChange={(value) => setRelation(value as CandidateRelationFilter)}
              >
                <SelectItem value="all">Все отношения</SelectItem>
                <SelectItem value="accepted">Участвует в составе</SelectItem>
                <SelectItem value="diagnostic">Другое совпадение</SelectItem>
                <SelectItem value="other">Остальные</SelectItem>
              </Select>
            </label>
          </div>
          <output className={styles.candidateCount} data-candidate-count aria-live="polite">
            {formatCount(shownRecordCount, "запись", "записи", "записей")}
          </output>
          {filteredGroups.length ? (
            <ol className={styles.candidateList}>
              {filteredGroups.map((group) => (
                <CandidateCard key={group.id} group={group} onOpenHypothesis={openHypothesis} commonMetadata={uniformMetadata} onOpenRecord={openRecord} />
              ))}
            </ol>
          ) : (
            <PanelEmptyState>По выбранным условиям кандидаты не найдены.</PanelEmptyState>
          )}
        </section>
      )}


    </>
  );
}

function CandidateCard({ group, onOpenHypothesis, onOpenRecord, commonMetadata = false }: Readonly<{
  group: CandidateDisplayGroup; onOpenHypothesis: (group: CandidateDisplayGroup) => void; onOpenRecord: (group: CandidateDisplayGroup, trigger: HTMLButtonElement) => void; commonMetadata?: boolean;
}>) {
  const candidate = group.representative;
  return <li data-candidate-group={group.id} data-candidate-record-count={group.candidates.length}>
    <details className={styles.candidateRow}>
      <summary><span>{formatCandidateGroupLine(group)} нм{!commonMetadata ? <small className={styles.candidateMedium}>{candidate.wavelengthType === "observed" ? "Observed" : "Ritz"} · {candidate.wavelengthMedium === "air" ? "воздух" : "вакуум"}</small> : null}</span><code>Δ {formatSigned(candidate.delta)} нм</code></summary>
      {group.isNearest && group.acceptedAssignment ? <p className={styles.settingHint}>{group.lineIds.length > 1 ? "Группа содержит ближайшую линию." : "Ближайшая справочная линия."}</p> : null}
      {group.hypothesis ? <Button variant="text" size="compact" className={styles.candidateHypothesisLink} type="button" onClick={() => onOpenHypothesis(group)}>Доказательства: {candidate.elementName} ({candidate.elementSymbol})</Button> : null}
      <dl className={styles.inspectorMetrics}><PeakDetail label="Допуск · нм" value={`± ${formatDecimal(candidate.adaptiveToleranceNm, 3)}`} /></dl>
      {candidate.toleranceCapped ? <p className={styles.settingHint}>Допуск ограничен верхним пределом.</p> : null}
      <SettingsDisclosure title="Расчёт допуска" readOnly><dl className={styles.inspectorMetrics}>
        <PeakDetail label="Нормированное отклонение" value={formatDecimal(candidate.normalizedDelta, 4)} />
        <PeakDetail label="Объединённая неопределённость · нм" value={formatDecimal(candidate.combinedUncertaintyNm, 4)} />
        {Object.entries(candidate.uncertainty).map(([key, value]) => <PeakDetail key={key} label={({gridSamplingNm: "Шаг сетки", spectralResolutionNm: "Разрешение", peakWidthNm: "Ширина пика", peakPositionNm: "Положение пика", referenceLineNm: "Справочная линия", calibrationNm: "Калибровка"} as Record<string, string>)[key] + " · нм"} value={formatDecimal(value, 4)} />)}
      </dl></SettingsDisclosure>
      <Button variant="text" size="compact" className={styles.referenceRecordButton} onClick={(event) => onOpenRecord(group, event.currentTarget)}>Справочная запись{group.lineIds.length > 1 ? ` · ${group.lineIds.length}` : ""}</Button>
    </details>
  </li>;
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
    selectedHypothesisId,
    selectHypothesis,
  } = useAnalysisWorkspace();
  const [query, setQuery] = useState("");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(true);
  const [sort, setSort] = useState<IdentificationSort>("ranking");

  if (!analysis) {
    return (
      <div className={styles.sidePanelContent}>
        <h2 className={styles.sidePanelTitle}>Гипотезы</h2>
        <p className={styles.sidePanelEmpty}>Сначала откройте спектр.</p>
      </div>
    );
  }
  const hypotheses = getIdentificationEntries(analysis, "hypotheses");
  const diagnostics = getIdentificationEntries(analysis, "diagnostics", query, sort);
  const molecules = analysis.molecularHypotheses;

  return (
    <div className={`${styles.sidePanelContent} ${styles.identificationMaster}`}>
      <h2 className={styles.sidePanelTitle}>Состав</h2>
      {molecules.length ? (
        <div className={styles.hypothesisMasterList} role="listbox" aria-label="Обнаруженные молекулы">
          {molecules.map((hypothesis) => (
            <ResultChoice key={hypothesis.id} symbol={hypothesis.formula} name={hypothesis.displayName}
              summary={formatCount(hypothesis.supportedRegionIds.length, "подтверждённый участок", "подтверждённых участка", "подтверждённых участков")}
              sensitive={hypothesis.admission === "sensitive"} selected={selectedHypothesisId === hypothesis.id} onSelect={() => selectHypothesis(hypothesis.id, "hypotheses")} />
          ))}
        </div>
      ) : null}
      {hypotheses.length ? (
        <div className={styles.hypothesisMasterList} role="listbox" aria-label="Состав">
          {hypotheses.map((entry) => (
            <ResultChoice key={entry.id} symbol={entry.hypothesis.symbol} name={entry.hypothesis.name}
              summary={formatCount(entry.hypothesis.reliableCharacteristicGroupCount, "характерная группа", "характерные группы", "характерных групп")}
              sensitive={entry.hypothesis.admission === "sensitive"} selected={selectedHypothesisId === entry.id} onSelect={() => selectHypothesis(entry.id, "hypotheses")} />
          ))}
        </div>
      ) : !molecules.length ? <PanelEmptyState>Подтверждённых результатов нет.</PanelEmptyState> : null}

      <details
        className={styles.identificationDisclosure}
        open={diagnosticsOpen}
        onToggle={(event) => setDiagnosticsOpen(event.currentTarget.open)}
      >
        <summary>Другие совпадения · {analysis.rejectedHypotheses.length}</summary>
        <label className={styles.hypothesisSearch} htmlFor="hypothesis-search">
          <Search size={14} aria-hidden="true" />
          <input id="hypothesis-search" type="search" aria-label="Поиск другого совпадения по элементу или символу" placeholder="Элемент или символ" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className={styles.hypothesisSort} htmlFor="hypothesis-sort">
          <span>Сортировка</span>
          <Select id="hypothesis-sort" value={sort} onValueChange={(value) => setSort(value as IdentificationSort)}>
            <SelectItem value="ranking">Автоматическое ранжирование</SelectItem>
            <SelectItem value="characteristic">Качественные группы</SelectItem>
            <SelectItem value="independent">Независимые группы</SelectItem>
            <SelectItem value="deviation">Среднее отклонение</SelectItem>
            <SelectItem value="name">Название</SelectItem>
          </Select>
        </label>
        {diagnostics.length ? (
          <div className={styles.hypothesisMasterList} role="listbox" aria-label="Диагностические совпадения">
            {diagnostics.map((entry) => (
              <ResultChoice key={entry.id} symbol={entry.hypothesis.symbol} name={entry.hypothesis.name}
                summary={formatCount(entry.hypothesis.reliableCharacteristicGroupCount, "характерная группа", "характерные группы", "характерных групп")}
                reason={entry.rejectionReasons.length ? diagnosticReasonLabels[entry.rejectionReasons[0]] : undefined}
                selected={selectedHypothesisId === entry.id} onSelect={() => selectHypothesis(entry.id, "diagnostics")} />
            ))}
          </div>
        ) : (
          <PanelEmptyState>{query ? "По вашему запросу элементы не найдены." : "Других совпадений нет."}</PanelEmptyState>
        )}
      </details>
    </div>
  );
}

function SidePanelHeader({ title, onReset, resetDisabled = false }: Readonly<{ title: string; onReset: () => void; resetDisabled?: boolean }>) {
  return (
    <header className={styles.sidePanelHeader}>
      <h2>{title}</h2>
      {!resetDisabled ? <Button size="icon"

        type="button"
        onClick={onReset}
        aria-label={`Сбросить: ${title.toLowerCase()}`}
        title="Сбросить к исходным значениям"
        disabled={resetDisabled}
      >
        <RotateCcw size={15} aria-hidden="true" />
      </Button> : null}
    </header>
  );
}

function NumberParameter({
  id,
  label,
  help,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  help?: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}>) {
  return (
    <div className={`${styles.parameterControl} ${styles.numberParameter}`} data-parameter-control>
      <div><ParameterLabel htmlFor={id} label={label} help={help} />{unit.length > 5 ? <small className={styles.settingHint}>{unit}</small> : null}</div>
      <span className={styles.numberInputWrap}>
        <DeferredNumberInput
          id={id}
          min={min}
          max={max}
          step={step}
          value={value}
          onCommit={onChange}
        />
        {unit && unit.length <= 5 ? <span>{unit}</span> : null}
      </span>
    </div>
  );
}

function DeferredNumberInput({
  id,
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: Readonly<{
  id: string;
  label?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
}>) {
  const commit = (input: HTMLInputElement) => {
    const parsed = Number(input.value);
    if (input.value.trim() === "" || !Number.isFinite(parsed)) {
      input.value = String(value);
      return;
    }
    input.value = String(parsed);
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <input
      key={`${id}:${value}`}
      id={id}
      aria-label={label}
      type="number"
      defaultValue={value}
      min={min}
      max={max}
      step={step}
      onBlur={(event) => commit(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.currentTarget.value = String(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function ParameterSection({ title, children }: Readonly<{ title?: string; children: ReactNode }>) {
  return (
    <section className={styles.sideParameterGroup} data-parameter-section>
      {title ? <h3>{title}</h3> : null}
      <div className={styles.parameterStack}>{children}</div>
    </section>
  );
}

function ParameterLabel({ htmlFor, label, help }: Readonly<{ htmlFor: string; label: string; help?: string }>) {
  return (
    <div className={styles.parameterLabelRow}>
      <label htmlFor={htmlFor}>{label}</label>
      {help ? <InfoTooltip label={label} content={help} /> : null}
    </div>
  );
}

function RangeParameter({ id, label, help, value, min, max, step, output, onChange }: Readonly<{
  id: string; label: string; help?: string; value: number; min: number; max: number; step: number; output: string; onChange: (value: number) => void;
}>) {
  return <div className={styles.parameterControl} data-parameter-control>
    <div className={styles.parameterHeading}>
      <ParameterLabel htmlFor={id} label={label} help={help} />
      <span className={styles.compactNumber}><DeferredNumberInput id={`${id}-number`} label={`${label}, точное значение`} min={min} max={max} step={step} value={value} onCommit={onChange} />{id === "smoothing-window" ? <span className={styles.compactUnit}>точек</span> : null}</span>
    </div>
    <DeferredRangeControl key={`${id}:${value}`} id={id} min={min} max={max} step={step} value={value} onCommit={onChange} />
    {id === "smoothing-window" ? <small className={styles.settingHint}>{output}</small> : null}
  </div>;
}

function LogRangeParameter({ id, label, help, value, min, max, onChange }: Readonly<{
  id: string; label: string; help?: string; value: number; min: number; max: number; onChange: (value: number) => void;
}>) {
  return <div className={styles.parameterControl} data-parameter-control>
    <div className={styles.parameterHeading}>
      <ParameterLabel htmlFor={id} label={label} help={help} />
      <span className={styles.compactNumber}><DeferredNumberInput id={`${id}-number`} label={`${label}, точное значение`} min={min} max={max} step={1} value={value} onCommit={onChange} /></span>
    </div>
    <DeferredRangeControl key={`${id}:${value}`} id={id} min={Math.log10(min)} max={Math.log10(max)} step={0.05} value={Math.log10(Math.min(max, Math.max(min, value)))} onCommit={(next) => onChange(Math.round(10 ** next))} />
  </div>;
}

function SelectParameter({ id, label, help, value, options, onChange }: Readonly<{
  id: string;
  label: string;
  help?: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}>) {
  return (
    <div className={styles.parameterControl} data-parameter-control>
      <ParameterLabel htmlFor={id} label={label} help={help} />
      <Select id={id} className={styles.parameterSelect} value={value} onValueChange={(value) => onChange(value)}>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </Select>
    </div>
  );
}

function ToggleParameter({ id, label, help, checked, onChange }: Readonly<{
  id: string;
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}>) {
  return (
    <div className={styles.toggleParameter} data-parameter-control>
      <ParameterLabel htmlFor={id} label={label} help={help} />
      <input id={id} className={styles.switchInput} type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </div>
  );
}

function ValueRangeParameter({ label, help, minimum, maximum, unit, onMinimumChange, onMaximumChange }: Readonly<{
  label: string;
  help?: string;
  minimum: { id: string; value: number; min: number; max: number; step: number };
  maximum: { id: string; value: number; min: number; max: number; step: number };
  unit: string;
  onMinimumChange: (value: number) => void;
  onMaximumChange: (value: number) => void;
}>) {
  return (
    <fieldset className={styles.valueRangeParameter} aria-label={label} data-parameter-control>
      <legend><span className={styles.rangeLegend}>{label}{help ? <InfoTooltip label={label} content={help} /> : null}</span></legend>
      <div className={styles.valueRangeFields}>
        <label htmlFor={minimum.id}>от</label>
        <DeferredNumberInput id={minimum.id} label={`${label}, от`} value={minimum.value} min={minimum.min} max={minimum.max} step={minimum.step} onCommit={onMinimumChange} />
        <span className={styles.valueRangeSeparator} aria-hidden="true">—</span>
        <label htmlFor={maximum.id}>до</label>
        <DeferredNumberInput id={maximum.id} label={`${label}, до`} value={maximum.value} min={maximum.min} max={maximum.max} step={maximum.step} onCommit={onMaximumChange} />
        <span className={styles.valueRangeUnit}>{unit}</span>
      </div>
    </fieldset>
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
  return formatSignedDecimal(value, 3);
}

function formatValue(value: number | undefined, precision: number): string {
  return value === undefined ? "—" : formatDecimal(value, precision);
}

function formatCandidateGroupLine(group: CandidateDisplayGroup): string {
  const candidate = group.representative;
  const label = candidate.ionizationLabel
    ? `${candidate.elementSymbol} ${candidate.ionizationLabel}`
    : candidate.elementSymbol;
  const wavelengths = group.candidates.map((item) => item.line);
  const minimum = Math.min(...wavelengths);
  const maximum = Math.max(...wavelengths);
  const wavelength = maximum - minimum < 0.0005
    ? formatDecimal(candidate.line, 3)
    : `${formatDecimal(minimum, 3)}–${formatDecimal(maximum, 3)}`;
  return `${label} · ${wavelength}`;
}

function DeferredRangeControl({ id, min, max, step, value, onCommit }: Readonly<{ id: string; min: number; max: number; step: number; value: number; onCommit: (value: number) => void }>) {
  const [draft, setDraft] = useState(value);
  const commit = () => { if (draft !== value) onCommit(draft); };
  return <div className={styles.sliderRow}><input id={id} className={styles.rangeInput} type="range" min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(Number(event.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />{draft !== value ? <output htmlFor={id}>{formatDecimal(id === "baseline-smoothness" ? Math.round(10 ** draft) : draft, 2)}</output> : null}</div>;
}

function formatSettingValue(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(value);
}
