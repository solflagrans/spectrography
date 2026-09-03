"use client";

import { CircleAlert, LoaderCircle, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  useAnalysisWorkspace,
  useAnalysisWorkspaceCore,
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

import styles from "./analysis-page.module.css";

export function ProcessingSettingsPanel() {
  const {
    parameters,
    calculationStatus,
    parameterError,
    resetProcessingParameters,
    updateProcessingParameters,
    updateWavelengthCalibrationParameters,
  } = useAnalysisWorkspaceCore();
  const canReset = parameters.processing.baselineSmoothness !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing.baselineSmoothness
    || parameters.processing.noiseWindowNm !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing.noiseWindowNm
    || parameters.processing.smoothingWindow !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing.smoothingWindow
    || parameters.processing.normalization !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing.normalization
    || parameters.wavelengthCalibration.allowAutomaticCorrection !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.wavelengthCalibration.allowAutomaticCorrection;

  return (
    <div className={styles.sidePanelContent} data-parameter-panel="processing">
      <SidePanelHeader title="Настройки обработки" onReset={resetProcessingParameters} resetDisabled={!canReset} />
      <ParameterSection title="Базовая линия и шум">
        <LogRangeParameter
          id="baseline-smoothness"
          label="Гладкость базовой линии"
          help="Метод AsLS"
          value={parameters.processing.baselineSmoothness}
          min={100}
          max={10_000_000}
          onChange={(value) => updateProcessingParameters({ baselineSmoothness: value })}
        />
        <NumberParameter
          id="noise-window"
          label="Окно оценки шума"
          help="Локальная оценка MAD первых разностей"
          unit="нм"
          value={parameters.processing.noiseWindowNm}
          min={0.05}
          max={50}
          step={0.1}
          onChange={(value) => updateProcessingParameters({ noiseWindowNm: value })}
        />
      </ParameterSection>
      <ParameterSection title="Сглаживание">
        <RangeParameter
          id="smoothing-window"
          label="Окно сглаживания"
          help="Метод Савицкого—Голея"
          value={parameters.processing.smoothingWindow}
          min={1}
          max={51}
          step={2}
          output={`${parameters.processing.smoothingWindow} пт`}
          onChange={(value) => updateProcessingParameters({ smoothingWindow: value })}
        />
      </ParameterSection>
      <ParameterSection title="Нормализация">
        <SelectParameter
          id="normalization-method"
          label="Масштаб интенсивности"
          value={parameters.processing.normalization}
          onChange={(value) => updateProcessingParameters({ normalization: value === "none" ? "none" : "maximum" })}
          options={[{ value: "maximum", label: "К максимуму (0–1)" }, { value: "none", label: "Не нормировать" }]}
        />
      </ParameterSection>
      <ParameterSection title="Шкала длин волн">
        <ToggleParameter
          id="automatic-wavelength-calibration"
          label="Автоматически уточнять шкалу"
          help="Коррекция применяется только после проверки по независимым опорным признакам"
          checked={parameters.wavelengthCalibration.allowAutomaticCorrection}
          onChange={(checked) => updateWavelengthCalibrationParameters({ allowAutomaticCorrection: checked })}
        />
      </ParameterSection>
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
  const canReset = parameters.peakSearch.minimumSnr !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch.minimumSnr
    || parameters.peakSearch.minimumWidth !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch.minimumWidth
    || parameters.peakSearch.maximumWidth !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch.maximumWidth
    || parameters.peakSearch.prominence !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch.prominence
    || parameters.peakSearch.minimumDistance !== DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch.minimumDistance;

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
          <SidePanelHeader title="Параметры пиков" onReset={resetPeakSearchParameters} resetDisabled={!canReset} />
          <ParameterSection title="Поиск пиков">
            <RangeParameter
              id="detection-threshold"
              label="Минимальный SNR"
              help="Минимальное превышение локального уровня шума"
              value={parameters.peakSearch.minimumSnr}
              min={0}
              max={30}
              step={0.5}
              output={formatDecimal(parameters.peakSearch.minimumSnr, 1)}
              onChange={(value) => updatePeakSearchParameters({ minimumSnr: value })}
            />
            <ValueRangeParameter
              label="Ширина пика"
              minimum={{ id: "minimum-width", value: parameters.peakSearch.minimumWidth, min: 0, max: 50, step: 0.01 }}
              maximum={{ id: "maximum-width", value: parameters.peakSearch.maximumWidth, min: 0.01, max: 100, step: 0.1 }}
              unit="нм"
              onMinimumChange={(value) => updatePeakSearchParameters({ minimumWidth: value })}
              onMaximumChange={(value) => updatePeakSearchParameters({ maximumWidth: value })}
            />
            <NumberParameter
              id="minimum-prominence"
              label="Минимальная выраженность"
              help="Минимальное превышение пика над ближайшим фоном"
              unit="отн. ед."
              value={parameters.peakSearch.prominence}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => updatePeakSearchParameters({ prominence: value })}
            />
            <NumberParameter
              id="minimum-distance"
              label="Расстояние между пиками"
              unit="нм"
              value={parameters.peakSearch.minimumDistance}
              min={0.01}
              max={50}
              step={0.1}
              onChange={(value) => updatePeakSearchParameters({ minimumDistance: value })}
            />
          </ParameterSection>
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

export function AnalysisSidePanel() {
  const { analysisView } = useAnalysisWorkspace();
  return analysisView === "composition" ? <IdentificationLinesPanel /> : <PeakSettingsPanel />;
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

  const rawIntensity = selectedPeak.rawIntensity;
  const selectedChannel = analysis.channels.find((channel) => channel.id === selectedPeak.channelId);
  const localThreshold = selectedChannel?.thresholdDataset.intensities[selectedPeak.index];

  return (
    <>
      <h2 className={styles.sidePanelTitle}>Пик {formatDecimal(selectedPeak.wavelength, 2)} нм</h2>
      <dl className={styles.peakSummaryLine} aria-label="Краткие параметры пика">
        <PeakDetail label="Длина" value={`${formatDecimal(selectedPeak.wavelength, 3)} нм`} />
        <PeakDetail label="SNR" value={Number.isFinite(selectedPeak.snr) ? formatValue(selectedPeak.snr, 2) : "∞"} />
        <PeakDetail label="Ширина" value={`${formatValue(selectedPeak.widthNm, 3)} нм`} />
      </dl>

      <section className={styles.candidateSection} aria-labelledby="candidate-lines-title">
        <h3 id="candidate-lines-title">Линии и назначения</h3>
        {selectedPeak.candidates.length ? (
          <PeakCandidateBrowser key={selectedPeak.id} analysis={analysis} selectedPeak={selectedPeak} />
        ) : (
          <PanelEmptyState>
            В пределах рассчитанных для этого пика адаптивных допусков подходящих линий нет.
          </PanelEmptyState>
        )}
      </section>

      <details className={styles.peakTechnicalDisclosure}>
        <summary>Параметры пика</summary>
        <dl className={styles.selectedPeakDetails}>
          <PeakDetail label="Исходная точка сетки" value={`${formatDecimal(selectedPeak.sampledWavelength, 3)} нм`} />
          <PeakDetail label="Уточнение максимума" value={selectedPeak.positionRefined ? `${formatSignedDecimal(selectedPeak.refinementOffsetNm, 4)} нм` : "Не применялось"} />
          <PeakDetail label="Неопределённость положения" value={`≥ ${formatDecimal(selectedPeak.positionUncertaintyNm, 4)} нм`} />
          <PeakDetail label="Исходная интенсивность" value={formatValue(rawIntensity, 4)} />
          <PeakDetail label="Подготовленная интенсивность" value={formatValue(selectedPeak.intensity, 4)} />
          <PeakDetail label="Выраженность" value={formatValue(selectedPeak.prominence, 4)} />
          <PeakDetail label="Порог в этой точке" value={localThreshold === undefined ? "—" : formatValue(localThreshold, 4)} />
        </dl>
      </details>
    </>
  );
}

function PeakCandidateBrowser({
  analysis,
  selectedPeak,
}: Readonly<{
  analysis: NonNullable<ReturnType<typeof useAnalysisWorkspace>["analysis"]>;
  selectedPeak: NonNullable<ReturnType<typeof useAnalysisWorkspace>["analysis"]>["peaks"][number];
}>) {
  const { selectHypothesis, setAnalysisView } = useAnalysisWorkspace();
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
      {!expanded ? (
        <div className={styles.compactCandidateView}>
          {view.acceptedAssignments.length ? (
            <section className={styles.candidateGroupSection} aria-labelledby={`candidate-assignments-${selectedPeak.id}`}>
              <h4 id={`candidate-assignments-${selectedPeak.id}`}>Назначения в гипотезах</h4>
              <ol className={styles.candidateList}>
                {view.acceptedAssignments.map((group) => (
                  <CandidateCard key={group.id} group={group} onOpenHypothesis={openHypothesis} />
                ))}
              </ol>
            </section>
          ) : null}

          {view.nearest ? (
            <section className={styles.candidateGroupSection} aria-labelledby={`candidate-nearest-${selectedPeak.id}`}>
              <h4 id={`candidate-nearest-${selectedPeak.id}`}>Ближайшая линия</h4>
              <ol className={styles.candidateList}>
                <CandidateCard group={view.nearest} onOpenHypothesis={openHypothesis} />
              </ol>
            </section>
          ) : null}

          {view.compactAlternatives.length ? (
            <section className={styles.candidateGroupSection} aria-labelledby={`candidate-alternatives-${selectedPeak.id}`}>
              <h4 id={`candidate-alternatives-${selectedPeak.id}`}>Альтернативы</h4>
              <ol className={styles.candidateList}>
                {view.compactAlternatives.map((group) => (
                  <CandidateCard key={group.id} group={group} onOpenHypothesis={openHypothesis} />
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      ) : (
        <section className={styles.fullCandidateView} aria-labelledby={`all-candidates-${selectedPeak.id}`}>
          <h4 id={`all-candidates-${selectedPeak.id}`}>Все кандидаты</h4>
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
              <select
                id={`candidate-ionization-${selectedPeak.id}`}
                value={ionizationStage}
                onChange={(event) => setIonizationStage(event.target.value === "all" ? "all" : Number(event.target.value))}
              >
                <option value="all">Все степени</option>
                {ionizationStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </label>
            <label className={styles.selectField} htmlFor={`candidate-relation-${selectedPeak.id}`}>
              <span>Отношение к гипотезам</span>
              <select
                id={`candidate-relation-${selectedPeak.id}`}
                value={relation}
                onChange={(event) => setRelation(event.target.value as CandidateRelationFilter)}
              >
                <option value="all">Все отношения</option>
                <option value="accepted">Участвует в принятой гипотезе</option>
                <option value="diagnostic">Диагностическая гипотеза</option>
                <option value="other">Остальные</option>
              </select>
            </label>
          </div>
          <output className={styles.candidateCount} data-candidate-count aria-live="polite">
            {formatCount(shownRecordCount, "запись", "записи", "записей")}
          </output>
          {filteredGroups.length ? (
            <ol className={styles.candidateList}>
              {filteredGroups.map((group) => (
                <CandidateCard key={group.id} group={group} onOpenHypothesis={openHypothesis} />
              ))}
            </ol>
          ) : (
            <PanelEmptyState>По выбранным условиям кандидаты не найдены.</PanelEmptyState>
          )}
        </section>
      )}

      <button
        className={styles.candidateToggle}
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "Свернуть" : `Все кандидаты (${view.candidateCount})`}
      </button>
    </>
  );
}

function CandidateCard({
  group,
  onOpenHypothesis,
}: Readonly<{
  group: CandidateDisplayGroup;
  onOpenHypothesis: (group: CandidateDisplayGroup) => void;
}>) {
  const candidate = group.representative;

  return (
    <li data-candidate-group={group.id} data-candidate-record-count={group.candidates.length}>
      <div className={styles.candidateHeading}>
        {group.hypothesis ? (
          <button className={styles.candidateHypothesisLink} type="button" onClick={() => onOpenHypothesis(group)}>
            {candidate.elementName} ({candidate.elementSymbol})
          </button>
        ) : <strong>{candidate.elementName} ({candidate.elementSymbol})</strong>}
        {group.candidates.length > 1 ? (
          <span className={styles.candidateRecordCount}>{formatCount(group.candidates.length, "запись", "записи", "записей")}</span>
        ) : null}
      </div>
      <div className={styles.candidateValues}>
        <span>{formatCandidateGroupLine(group)} нм</span>
        <code>Δ {formatSigned(candidate.delta)} нм</code>
      </div>
      <details className={styles.candidateTechnicalDetails}>
        <summary>Технические данные</summary>
        <dl>
          <PeakDetail label="Адаптивный допуск" value={`±${formatDecimal(candidate.adaptiveToleranceNm, 3)} нм`} />
          <PeakDetail label="Происхождение длины" value={candidate.wavelengthType === "observed" ? "Observed" : "Ritz"} />
          <PeakDetail label="Среда" value={candidate.wavelengthMedium === "air" ? "Воздух" : "Вакуум"} />
          <PeakDetail label="Нормированное отклонение" value={formatDecimal(candidate.normalizedDelta, 4)} />
          <PeakDetail label="Объединённая неопределённость" value={`${formatDecimal(candidate.combinedUncertaintyNm, 4)} нм`} />
          <PeakDetail label="Шаг сетки" value={`${formatDecimal(candidate.uncertainty.gridSamplingNm, 4)} нм`} />
          <PeakDetail label="Разрешение" value={`${formatDecimal(candidate.uncertainty.spectralResolutionNm, 4)} нм`} />
          <PeakDetail label="Ширина пика" value={`${formatDecimal(candidate.uncertainty.peakWidthNm, 4)} нм`} />
          <PeakDetail label="Положение пика" value={`${formatDecimal(candidate.uncertainty.peakPositionNm, 4)} нм`} />
          <PeakDetail label="Справочная линия" value={`${formatDecimal(candidate.uncertainty.referenceLineNm, 4)} нм`} />
          <PeakDetail label="Калибровка" value={`${formatDecimal(candidate.uncertainty.calibrationNm, 4)} нм`} />
          <PeakDetail label="Достигнут максимум допуска" value={candidate.toleranceCapped ? "Да" : "Нет"} />
        </dl>
        <div className={styles.candidateSourceRecords}>
          <strong>Справочные записи и исходные метаданные</strong>
          <ul>
            {group.sourceRecords.map((record) => (
              <li key={record.id}>
                <code>{record.id}</code>
                {record.sourceName ? <span>{record.sourceName} · {record.datasetVersion}</span> : null}
                {record.rawWavelength ? <span>Исходная длина: {record.rawWavelength}{record.notation ?? ""}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </li>
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
  const hypotheses = getIdentificationEntries(analysis, "hypotheses");
  const diagnostics = getIdentificationEntries(analysis, "diagnostics", query, sort);
  const molecules = analysis.molecularHypotheses;

  return (
    <div className={`${styles.sidePanelContent} ${styles.identificationMaster}`}>
      <h2 className={styles.sidePanelTitle}>Состав</h2>
      {molecules.length ? (
        <div className={styles.hypothesisMasterList} role="listbox" aria-label="Обнаруженные молекулы">
          {molecules.map((hypothesis) => (
            <button
              key={hypothesis.id}
              type="button"
              role="option"
              aria-selected={selectedHypothesisId === hypothesis.id}
              className={styles.hypothesisMasterItem}
              onClick={() => selectHypothesis(hypothesis.id, "hypotheses")}
            >
              <span className={styles.hypothesisMasterHeading}>
                <strong>{hypothesis.formula}</strong>
                <span>{hypothesis.displayName}</span>
              </span>
              <span className={styles.hypothesisMasterMetrics}>
                <span>{formatCount(hypothesis.supportedRegionIds.length, "подтверждённый участок", "подтверждённых участка", "подтверждённых участков")}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {hypotheses.length ? (
        <div className={styles.hypothesisMasterList} role="listbox" aria-label="Основные гипотезы">
          {hypotheses.map((entry) => (
            <button key={entry.id} type="button" role="option" aria-selected={selectedHypothesisId === entry.id} className={styles.hypothesisMasterItem} onClick={() => selectHypothesis(entry.id, "hypotheses")}>
              <span className={styles.hypothesisMasterHeading}>
                <strong>{entry.hypothesis.symbol}</strong>
                <span>{entry.hypothesis.name}</span>
              </span>
              <span className={styles.hypothesisMasterMetrics}>
                <span>{formatCount(entry.hypothesis.reliableCharacteristicGroupCount, "подтверждённая группа", "подтверждённые группы", "подтверждённых групп")}</span>
              </span>
            </button>
          ))}
        </div>
      ) : <PanelEmptyState>Надёжных гипотез нет. Слабые совпадения доступны в подробностях.</PanelEmptyState>}

      <details
        className={styles.identificationDisclosure}
        open={identificationTab === "diagnostics"}
        onToggle={(event) => setIdentificationTab(event.currentTarget.open ? "diagnostics" : "hypotheses")}
      >
        <summary>Другие совпадения · {analysis.rejectedHypotheses.length}</summary>
        <label className={styles.hypothesisSearch} htmlFor="hypothesis-search">
          <Search size={14} aria-hidden="true" />
          <input id="hypothesis-search" type="search" aria-label="Поиск слабого совпадения по элементу или символу" placeholder="Элемент или символ" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className={styles.hypothesisSort} htmlFor="hypothesis-sort">
          <span>Сортировка</span>
          <select id="hypothesis-sort" value={sort} onChange={(event) => setSort(event.target.value as IdentificationSort)}>
            <option value="ranking">Автоматическое ранжирование</option>
            <option value="characteristic">Качественные группы</option>
            <option value="independent">Независимые группы</option>
            <option value="deviation">Среднее отклонение</option>
            <option value="name">Название</option>
          </select>
        </label>
        {diagnostics.length ? (
          <div className={styles.hypothesisMasterList} role="listbox" aria-label="Диагностические совпадения">
            {diagnostics.map((entry) => (
              <button key={entry.id} type="button" role="option" aria-selected={selectedHypothesisId === entry.id} className={styles.hypothesisMasterItem} onClick={() => selectHypothesis(entry.id, "diagnostics")}>
                <span className={styles.hypothesisMasterHeading}>
                  <strong>{entry.hypothesis.symbol}</strong>
                  <span>{entry.hypothesis.name}</span>
                </span>
                <span className={styles.hypothesisMasterMetrics}>
                  <span>Качественные группы {entry.hypothesis.reliableCharacteristicGroupCount}</span>
                  <span>Слабые {entry.hypothesis.weakEvidenceGroupCount}</span>
                </span>
                {entry.rejectionReasons.length ? <span className={styles.diagnosticReasonCompact}>{diagnosticReasonLabels[entry.rejectionReasons[0]]}</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <PanelEmptyState>{query ? "По вашему запросу элементы не найдены." : "Слабых совпадений нет."}</PanelEmptyState>
        )}
      </details>
    </div>
  );
}

function SidePanelHeader({ title, onReset, resetDisabled = false }: Readonly<{ title: string; onReset: () => void; resetDisabled?: boolean }>) {
  return (
    <header className={styles.sidePanelHeader}>
      <h2>{title}</h2>
      <button
        className={styles.iconButton}
        type="button"
        onClick={onReset}
        aria-label={`Сбросить: ${title.toLowerCase()}`}
        title="Сбросить к исходным значениям"
        disabled={resetDisabled}
      >
        <RotateCcw size={15} aria-hidden="true" />
      </button>
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
    <div className={styles.parameterControl} data-parameter-control>
      <ParameterLabel htmlFor={id} label={label} help={help} />
      <span className={styles.numberInputWrap}>
        <DeferredNumberInput
          id={id}
          min={min}
          max={max}
          step={step}
          value={value}
          onCommit={onChange}
        />
        {unit ? <span>{unit}</span> : null}
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
    if (!Number.isFinite(parsed)) {
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

function ParameterSection({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className={styles.sideParameterGroup} data-parameter-section>
      <h3>{title}</h3>
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
  id: string;
  label: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  output: string;
  onChange: (value: number) => void;
}>) {
  return (
    <div className={styles.parameterControl} data-parameter-control>
      <div className={styles.parameterHeading}>
        <ParameterLabel htmlFor={id} label={label} help={help} />
        <output htmlFor={id}>{output}</output>
      </div>
      <input id={id} className={styles.rangeInput} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function LogRangeParameter({ id, label, help, value, min, max, onChange }: Readonly<{
  id: string;
  label: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}>) {
  const minimumExponent = Math.log10(min);
  const maximumExponent = Math.log10(max);
  const exponent = Math.log10(Math.min(max, Math.max(min, value)));
  return (
    <div className={styles.parameterControl} data-parameter-control>
      <div className={styles.parameterHeading}>
        <ParameterLabel htmlFor={id} label={label} help={help} />
        <output htmlFor={id}>{Math.round(value).toLocaleString("ru-RU")}</output>
      </div>
      <input
        id={id}
        className={styles.rangeInput}
        type="range"
        min={minimumExponent}
        max={maximumExponent}
        step={0.05}
        value={exponent}
        onChange={(event) => onChange(Math.round(10 ** Number(event.target.value)))}
      />
    </div>
  );
}

function SelectParameter({ id, label, value, options, onChange }: Readonly<{
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}>) {
  return (
    <div className={styles.parameterControl} data-parameter-control>
      <ParameterLabel htmlFor={id} label={label} />
      <select id={id} className={styles.parameterSelect} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
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

function ValueRangeParameter({ label, minimum, maximum, unit, onMinimumChange, onMaximumChange }: Readonly<{
  label: string;
  minimum: { id: string; value: number; min: number; max: number; step: number };
  maximum: { id: string; value: number; min: number; max: number; step: number };
  unit: string;
  onMinimumChange: (value: number) => void;
  onMaximumChange: (value: number) => void;
}>) {
  return (
    <fieldset className={styles.valueRangeParameter} data-parameter-control>
      <legend>{label}</legend>
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
