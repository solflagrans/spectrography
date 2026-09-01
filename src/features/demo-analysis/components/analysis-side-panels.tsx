"use client";

import { ArrowRight, CircleAlert, LoaderCircle, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { useAnalysisWorkspace } from "@/features/demo-analysis/model/analysis-workspace-context";
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
      <section className={styles.sideParameterGroup}>
        <h3>Шкала длин волн</h3>
        <label className={styles.selectField} htmlFor="automatic-wavelength-calibration">
          <span>Автоматическая коррекция</span>
          <input
            id="automatic-wavelength-calibration"
            type="checkbox"
            checked={parameters.wavelengthCalibration.allowAutomaticCorrection}
            onChange={(event) => updateWavelengthCalibrationParameters({ allowAutomaticCorrection: event.target.checked })}
          />
        </label>
        <p>Применяется только после проверки на независимых опорных признаках; исходный спектр не меняется.</p>
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
            <p>Допуск рассчитывается отдельно для каждого пика и линии по разрешению, сетке, SNR и неопределённости калибровки.</p>
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

  return (
    <>
      <h2 className={styles.sidePanelTitle}>Пик {selectedPeak.wavelength.toFixed(2)} нм</h2>
      <dl className={styles.selectedPeakDetails}>
        <PeakDetail label="Длина волны" value={`${selectedPeak.wavelength.toFixed(3)} нм`} />
        <PeakDetail label="Исходная точка сетки" value={`${selectedPeak.sampledWavelength.toFixed(3)} нм`} />
        <PeakDetail label="Уточнение максимума" value={selectedPeak.positionRefined ? `${selectedPeak.refinementOffsetNm >= 0 ? "+" : ""}${selectedPeak.refinementOffsetNm.toFixed(4)} нм` : "Не применялось"} />
        <PeakDetail label="Неопределённость положения" value={`≥ ${selectedPeak.positionUncertaintyNm.toFixed(4)} нм`} />
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
          <PeakCandidateBrowser key={selectedPeak.id} analysis={analysis} selectedPeak={selectedPeak} />
        ) : (
          <PanelEmptyState>
            В пределах рассчитанных для этого пика адаптивных допусков подходящих линий нет.
          </PanelEmptyState>
        )}
      </section>
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
      <p className={styles.candidateExplanation}>
        Ближайшая линия определяется только по длине волны в пределах адаптивного допуска и не является итоговой идентификацией пика.
      </p>

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
              <h4 id={`candidate-nearest-${selectedPeak.id}`}>Ближайший кандидат</h4>
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
          <output className={styles.candidateCount} aria-live="polite">
            Найдено справочных записей: {shownRecordCount} · карточек: {filteredGroups.length}
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
        {expanded ? "Свернуть" : `Показать все кандидаты · ${view.candidateCount}`}
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
  const acceptedRole = group.acceptedAssignment?.role === "main"
    ? "Основная гипотеза"
    : "Принятая альтернативная гипотеза";
  const relationLabel = group.acceptedAssignment
    ? `Участвует в гипотезе · ${acceptedRole}`
    : group.hypothesis?.role === "diagnostic"
      ? "Альтернатива · диагностическая гипотеза элемента"
      : group.hypothesis
        ? "Альтернатива · элемент принятой гипотезы"
        : "Альтернатива";

  return (
    <li data-candidate-group={group.id} data-candidate-record-count={group.candidates.length}>
      <div className={styles.candidateHeading}>
        <strong>{candidate.elementName} ({candidate.elementSymbol})</strong>
        {group.candidates.length > 1 ? (
          <span className={styles.candidateRecordCount}>{group.candidates.length} записи</span>
        ) : null}
      </div>
      <div className={styles.candidateStatuses}>
        {group.isNearest ? <span className={styles.nearestCandidate}>Ближайшая по длине волны</span> : null}
        <span className={group.acceptedAssignment ? styles.assignedCandidate : styles.alternativeCandidate}>
          {relationLabel}
        </span>
      </div>
      <div className={styles.candidateValues}>
        <span>{formatCandidateGroupLine(group)} нм</span>
        <code>Δ {formatSigned(candidate.delta)} нм</code>
      </div>
      <small>Степень ионизации {candidate.ionizationLabel || candidate.ionizationStage} · адаптивный допуск ±{candidate.adaptiveToleranceNm.toFixed(3)} нм</small>
      <details className={styles.candidateTechnicalDetails}>
        <summary>Технические подробности</summary>
        <dl>
          <PeakDetail label="Происхождение длины" value={candidate.wavelengthType === "observed" ? "Observed" : "Ritz"} />
          <PeakDetail label="Среда" value={candidate.wavelengthMedium === "air" ? "Воздух" : "Вакуум"} />
          <PeakDetail label="Нормированное отклонение" value={candidate.normalizedDelta.toFixed(4)} />
          <PeakDetail label="Объединённая неопределённость" value={`${candidate.combinedUncertaintyNm.toFixed(4)} нм`} />
          <PeakDetail label="Шаг сетки" value={`${candidate.uncertainty.gridSamplingNm.toFixed(4)} нм`} />
          <PeakDetail label="Разрешение" value={`${candidate.uncertainty.spectralResolutionNm.toFixed(4)} нм`} />
          <PeakDetail label="Ширина пика" value={`${candidate.uncertainty.peakWidthNm.toFixed(4)} нм`} />
          <PeakDetail label="Положение пика" value={`${candidate.uncertainty.peakPositionNm.toFixed(4)} нм`} />
          <PeakDetail label="Справочная линия" value={`${candidate.uncertainty.referenceLineNm.toFixed(4)} нм`} />
          <PeakDetail label="Калибровка" value={`${candidate.uncertainty.calibrationNm.toFixed(4)} нм`} />
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
      {group.hypothesis ? (
        <button className={styles.candidateLink} type="button" onClick={() => onOpenHypothesis(group)}>
          Открыть гипотезу
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      ) : null}
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
      <h2 className={styles.sidePanelTitle}>Обнаруженный состав</h2>
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
                <code>полоса</code>
              </span>
              <span className={styles.hypothesisMasterMetrics}>
                <span>Поддержано участков {hypothesis.supportedRegionIds.length}</span>
                <span>Общее смещение {formatSigned(hypothesis.commonShiftNm)} нм</span>
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
                <code>{entry.hypothesis.reliability === "tentative" ? "осторожно" : `#${entry.rank}`}</code>
              </span>
              <span className={styles.hypothesisMasterMetrics}>
                <span>Сильные группы {entry.hypothesis.strongCharacteristicGroupCount}</span>
                <span>Качественные {entry.hypothesis.reliableCharacteristicGroupCount}</span>
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
        <summary>Слабые и неоднозначные совпадения · {analysis.rejectedHypotheses.length}</summary>
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

function formatCandidateGroupLine(group: CandidateDisplayGroup): string {
  const candidate = group.representative;
  const label = candidate.ionizationLabel
    ? `${candidate.elementSymbol} ${candidate.ionizationLabel}`
    : candidate.elementSymbol;
  const wavelengths = group.candidates.map((item) => item.line);
  const minimum = Math.min(...wavelengths);
  const maximum = Math.max(...wavelengths);
  const wavelength = maximum - minimum < 0.0005
    ? candidate.line.toFixed(3)
    : `${minimum.toFixed(3)}–${maximum.toFixed(3)}`;
  return `${label} · ${wavelength}`;
}
