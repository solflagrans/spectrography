"use client";
import { Button } from "@/components/ui/button";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { SpectralLine } from "@/domain/spectral-library/types";
import type { CandidateDisplayGroup } from "../model/peak-candidates-ui";
import styles from "./analysis-page.module.css";

export function ReferenceRecordDialog({ group, lineIds, title, onClose, restoreFocus }: Readonly<{ group?: CandidateDisplayGroup | null; lineIds?: readonly string[]; title?: string; onClose: () => void; restoreFocus: () => void }>) {
  const ids = lineIds ?? group?.lineIds;
  return <Dialog.Root open={Boolean(ids?.length)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className={`${styles.dialogOverlay} ${styles.referenceOverlay}`} /><Dialog.Content className={styles.referenceDialog} aria-describedby={undefined} onCloseAutoFocus={(event) => { event.preventDefault(); restoreFocus(); }}>
      <div className={styles.referenceDialogHeader}><Dialog.Title>{title ?? `Справочные линии · ${group?.representative.elementSymbol} ${group?.representative.ionizationLabel}`}</Dialog.Title><Dialog.Close asChild><Button size="icon" aria-label="Закрыть справочную запись"><X size={18} /></Button></Dialog.Close></div>
      {ids ? <ReferenceRecords lineIds={ids} /> : null}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}

function ReferenceRecords({ lineIds }: Readonly<{ lineIds: readonly string[] }>) {
  const [result, setResult] = useState<{ lines: readonly SpectralLine[]; doi: string } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    import("@/domain/spectral-library/builtin-library").then((library) => {
      if (active) setResult({ lines: library.builtinSpectralLibrary.filter((line) => lineIds.includes(line.id)), doi: library.builtinSpectralLibraryManifest.doi });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [lineIds]);
  if (error) return <p role="alert">Не удалось загрузить справочные записи. Закройте окно и попробуйте снова.</p>;
  if (!result) return <p role="status">Загрузка справочных записей…</p>;
  return <div className={styles.referenceRecords}>
    <a href={`https://doi.org/${result.doi}`} target="_blank" rel="noreferrer">Источник: NIST ASD</a>
    {lineIds.filter((id) => !result.lines.some((line) => line.id === id)).map((id) => <p key={id}>Запись {id} отсутствует в текущей библиотеке.</p>)}
    {result.lines.map((line) => <article key={line.id}><h3>{line.element.name} · {line.ionizationLabel} · {line.preferredWavelength.valueNm} нм</h3>
      <dl><RecordField label="Идентификатор" value={line.id} /><RecordField label="Наблюдаемая длина, нм" value={line.observedWavelength ? `${line.observedWavelength.rawValue}${line.observedWavelength.notation ?? ""} · ${line.observedWavelength.medium === "air" ? "воздух" : "вакуум"}` : undefined} /><RecordField label="Ritz-длина, нм" value={line.ritzWavelength ? `${line.ritzWavelength.rawValue}${line.ritzWavelength.notation ?? ""} · ${line.ritzWavelength.medium === "air" ? "воздух" : "вакуум"}` : undefined} /><RecordField label="Среда" value={line.preferredWavelength.medium === "air" ? "Воздух" : "Вакуум"} /><RecordField label="Предпочтительная длина" value={line.preferredWavelength.origin === "observed" ? "Observed" : "Ritz"} /><RecordField label="Неопределённость наблюдаемой длины · нм" value={line.observedWavelength?.uncertaintyNm} /><RecordField label="Неопределённость Ritz-длины · нм" value={line.ritzWavelength?.uncertaintyNm} /><RecordField label="Интенсивность источника" value={line.relativeIntensity?.rawValue} /><RecordField label="Тип перехода" value={line.transition?.type} /><RecordField label="Вероятность перехода, с⁻¹" value={line.transition?.transitionProbabilityPerSecond} /><RecordField label="Точность вероятности" value={line.transition?.transitionProbabilityAccuracy} /></dl>
      {(["lowerLevel", "upperLevel"] as const).map((key) => { const level = line.transition?.[key]; return level ? <section key={key}><h4>{key === "lowerLevel" ? "Нижний уровень" : "Верхний уровень"}</h4><dl><RecordField label="Энергия, эВ" value={level.energyEv?.rawValue} /><RecordField label="Конфигурация" value={level.configuration} /><RecordField label="Терм" value={level.term} /><RecordField label="J" value={level.totalAngularMomentum} /><RecordField label="Статистический вес" value={level.statisticalWeight} /></dl></section> : null; })}
      <dl><RecordField label="Источник и версия" value={`${line.source.name} · ${line.source.datasetVersion}`} /><RecordField label="Получено" value={line.source.retrievedAt} /><RecordField label="Ссылки для линии" value={line.bibliography?.lineReferences?.join(", ")} /><RecordField label="Ссылки для вероятности" value={line.bibliography?.transitionProbabilityReferences?.join(", ")} /></dl>
    </article>)}
  </div>;
}
function RecordField({ label, value }: Readonly<{ label: string; value?: string | number }>) {
  return value === undefined || value === "" ? null : <div><dt>{label}</dt><dd>{value}</dd></div>;
}
