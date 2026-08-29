"use client";

import {
  ArrowRight,
  Check,
  CircleAlert,
  Database,
  FlaskConical,
  Link2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type {
  DemoAnalysis,
  DemoElementHypothesis,
  DemoHypothesisStatus,
} from "@/application/demo-analysis/create-demo-analysis";
import type { MatchedPeak } from "@/domain/spectrum";
import { useDemoAnalysis } from "@/features/demo-analysis/model/demo-analysis-context";

import styles from "./analysis-page.module.css";
import { SpectrumChart } from "./spectrum-chart";

const statusLabels: Record<DemoHypothesisStatus, string> = {
  confirmed: "Подтверждён",
  possible: "Возможен",
  review: "Требует проверки",
};

export function DataAnalysisPage() {
  const { analysis, openDemoAnalysis } = useDemoAnalysis();

  if (!analysis) {
    return (
      <section className={styles.welcome} aria-labelledby="data-empty-title">
        <div className={styles.welcomeIcon} aria-hidden="true">
          <Database size={27} strokeWidth={1.65} />
        </div>
        <span className={styles.eyebrow}>Первый сценарий</span>
        <h1 id="data-empty-title">Данные спектра ещё не открыты</h1>
        <p>
          Откройте встроенный пример, чтобы просмотреть готовый анализ и пройти весь путь
          от исходного сигнала до заключения.
        </p>
        <button className={styles.primaryButton} type="button" onClick={openDemoAnalysis}>
          <Sparkles size={16} aria-hidden="true" />
          Открыть демонстрационный спектр
        </button>
        <span className={styles.transientNote}>Состояние сбросится после перезагрузки страницы</span>
      </section>
    );
  }

  return (
    <AnalysisPage title="Данные" description="Исходный набор без скрытых преобразований.">
      <Card
        title="Обзор исходного спектра"
        accessory={<Tag tone="neutral">Сырой сигнал</Tag>}
      >
        <SpectrumChart dataset={analysis.rawDataset} label="Исходный спектр образца Fe-12" />
      </Card>

      <MetricGrid>
        <Metric label="Диапазон" value={`${analysis.rawDataset.wavelengths[0]}–${analysis.rawDataset.wavelengths.at(-1)} нм`} />
        <Metric label="Точек" value={String(analysis.rawDataset.wavelengths.length)} />
        <Metric label="Минимум" value={analysis.rawStats.minimum.toFixed(2)} />
        <Metric label="Максимум" value={analysis.rawStats.maximum.toFixed(2)} />
        <Metric label="Среднее" value={analysis.rawStats.mean.toFixed(2)} />
        <Metric label="Шаг" value={`~${analysis.wavelengthStep} нм`} />
      </MetricGrid>

      <div className={styles.twoColumns}>
        <Card title="Сведения о наборе">
          <DefinitionList
            items={[
              ["Название", analysis.title],
              ["Источник", analysis.source.kind],
              ["Формат", analysis.source.format],
              ["Единицы", analysis.source.units],
            ]}
          />
        </Card>
        <Card title="Проверка целостности" accessory={<Tag tone="success">Готово</Tag>}>
          <div className={styles.checkList}>
            <CheckRow>Массивы длин волн и интенсивностей согласованы</CheckRow>
            <CheckRow>Значения конечны и упорядочены по длине волны</CheckRow>
            <CheckRow>Исходный набор сохранён отдельно от подготовленного</CheckRow>
          </div>
        </Card>
      </div>
    </AnalysisPage>
  );
}

export function ProcessingAnalysisPage() {
  const analysis = useRequiredAnalysis();
  if (!analysis) return <AnalysisUnavailable section="Обработка" />;

  return (
    <AnalysisPage title="Обработка" description="Параметры уже применены к демонстрационному примеру.">
      <div className={styles.processingGrid}>
        <Card title="Применённые параметры" accessory={<Tag tone="success">Выполнено</Tag>}>
          <div className={styles.transformationList}>
            {analysis.transformations.map((transformation, index) => (
              <div className={styles.transformation} key={transformation.id}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <div>
                  <h3>{transformation.label}</h3>
                  <strong>{transformation.value}</strong>
                  <p>{transformation.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Параметры поиска пиков">
          <DefinitionList
            items={[
              ["Коэффициент порога", analysis.options.sigma.toFixed(2)],
              ["Мин. выраженность", analysis.options.prominence.toFixed(3)],
              ["Мин. расстояние", `${analysis.options.distance} точек`],
              ["Допуск сопоставления", `±${analysis.options.tolerance.toFixed(2)} нм`],
            ]}
          />
        </Card>
      </div>
      <Card
        title="Подготовленный спектр"
        accessory={<Tag tone="neutral">Нормированная интенсивность</Tag>}
      >
        <SpectrumChart
          dataset={analysis.preparedDataset}
          label="Подготовленный демонстрационный спектр"
        />
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
      description={`${analysis.peaks.length} пиков выше расчётного порога.`}
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
    <AnalysisPage
      title="Идентификация"
      description="Гипотезы ранжированы эвристикой и подтверждаются наблюдаемыми линиями."
    >
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

      <Card title="Гипотезы по элементам">
        <div className={styles.hypothesisList}>
          {analysis.hypotheses.map((hypothesis) => (
            <HypothesisCard key={hypothesis.symbol} hypothesis={hypothesis} />
          ))}
        </div>
        <p className={styles.heuristicNote}>
          Число ранжирования — сравнительная эвристика для этого набора, а не вероятность
          присутствия элемента.
        </p>
      </Card>
    </AnalysisPage>
  );
}

export function ResultAnalysisPage() {
  const analysis = useRequiredAnalysis();
  if (!analysis) return <AnalysisUnavailable section="Результат" />;

  return (
    <AnalysisPage title="Результат" description="Заключение и цепочка подтверждающих данных.">
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
                    <code>Δ {formatDelta(line.delta)} нм</code>
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
  description,
  children,
}: Readonly<{ title: string; description: string; children: ReactNode }>) {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Демонстрационный анализ</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <Tag tone="neutral">Только просмотр</Tag>
      </header>
      {children}
    </div>
  );
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

function HypothesisCard({ hypothesis }: Readonly<{ hypothesis: DemoElementHypothesis }>) {
  return (
    <article className={styles.hypothesisCard}>
      <header>
        <div>
          <h3>{hypothesis.symbol}</h3>
          <span>{hypothesis.name}</span>
        </div>
        <StatusTag status={hypothesis.status} />
      </header>
      <p>{hypothesis.explanation}</p>
      <dl>
        <div>
          <dt>Связанных линий</dt>
          <dd>{hypothesis.evidence.length}</dd>
        </div>
        <div>
          <dt>Эвристика ранжирования</dt>
          <dd>{hypothesis.heuristicScore.toFixed(2)}</dd>
        </div>
      </dl>
      <div className={styles.lineChips}>
        {hypothesis.evidence.map((line) => (
          <code key={`${line.peakId}-${line.referenceWavelength}`}>
            {line.ion} {line.referenceWavelength.toFixed(2)} · Δ {formatDelta(line.delta)}
          </code>
        ))}
      </div>
    </article>
  );
}

function StatusTag({ status }: Readonly<{ status: DemoHypothesisStatus }>) {
  const tone = status === "confirmed" ? "success" : status === "possible" ? "info" : "warning";
  return <Tag tone={tone}>{statusLabels[status]}</Tag>;
}

function Tag({
  tone,
  children,
}: Readonly<{ tone: "neutral" | "success" | "warning" | "danger" | "info"; children: ReactNode }>) {
  return <span className={`${styles.tag} ${styles[`tag_${tone}`]}`}>{children}</span>;
}

function useRequiredAnalysis(): DemoAnalysis | null {
  return useDemoAnalysis().analysis;
}

function formatDelta(delta: number): string {
  return delta === 0 ? "0.000" : `+${delta.toFixed(3)}`;
}
