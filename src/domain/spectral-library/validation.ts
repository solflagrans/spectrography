import type { SpectralLibraryManifest } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export function validateSpectralLibraryManifest(manifest: SpectralLibraryManifest): void {
  if (manifest.schemaVersion !== 1) throw new Error("Неподдерживаемая версия схемы библиотеки.");
  if (!manifest.name.trim() || !manifest.version.trim()) throw new Error("Не указано имя или версия библиотеки.");
  if (manifest.source !== "NIST Atomic Spectra Database") throw new Error("Неизвестный источник библиотеки.");
  if (!manifest.nistAsdVersion.trim()) throw new Error("Не указана версия NIST ASD.");
  if (!manifest.doi.trim()) throw new Error("Не указан DOI источника.");
  if (!ISO_DATE.test(manifest.retrievedAt)) throw new Error("Дата получения данных должна иметь формат YYYY-MM-DD.");
  if (!manifest.attribution.trim()) throw new Error("Не указана атрибуция источника.");
  if (!manifest.query.elements.length || !manifest.query.ionizationStages.length) {
    throw new Error("Параметры выборки библиотеки неполны.");
  }
  const range = manifest.query.wavelengthRangeNm;
  if (!Number.isFinite(range.minimum) || !Number.isFinite(range.maximum) || range.minimum >= range.maximum) {
    throw new Error("Диапазон длин волн библиотеки некорректен.");
  }
  if (!Number.isSafeInteger(manifest.lineCount) || manifest.lineCount < 1) {
    throw new Error("Число линий библиотеки некорректно.");
  }
  if (manifest.checksum.algorithm !== "sha256" || !SHA256.test(manifest.checksum.value)) {
    throw new Error("Контрольная сумма библиотеки некорректна.");
  }
}
