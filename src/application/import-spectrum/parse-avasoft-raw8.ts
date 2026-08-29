import { MAX_POINTS, MIN_POINTS, validateDataset } from "@/domain/spectrum";
import type { SpectrumDataset } from "@/domain/spectrum";

const RAW8_SIGNATURE = "AVS84";
const RAW8_HEADER_SIZE = 328;
const DECLARED_LENGTH_TRAILER_OFFSET = 16;

export interface Raw8InstrumentMetadata {
  readonly serialNumber: string;
  readonly integrationTimeMs: number;
  readonly averages: number;
  readonly channelCount: 1;
  readonly startPixel: number;
  readonly stopPixel: number;
}

export interface Raw8AuxiliaryData {
  readonly dark: readonly number[];
  readonly reference: readonly number[];
}

export interface ParsedRaw8Spectrum {
  readonly dataset: SpectrumDataset;
  readonly auxiliaryData: Raw8AuxiliaryData;
  readonly metadata: Raw8InstrumentMetadata;
}

export function parseAvaSoftRaw8(data: ArrayBuffer): ParsedRaw8Spectrum {
  const reader = new BinaryReader(data);
  const signature = reader.readAscii(5, "сигнатура");

  if (signature !== RAW8_SIGNATURE) {
    if (signature.startsWith("AVS8")) {
      throw new Error(`RAW8: версия контейнера «${signature}» пока не поддерживается; ожидается AVS84.`);
    }
    throw new Error("RAW8: неверная сигнатура контейнера; ожидается AVS84.");
  }

  const channelCount = reader.readUint8("количество каналов");
  if (channelCount !== 1) {
    throw new Error(`RAW8: найдено каналов: ${channelCount}. В этой версии поддерживается только один канал.`);
  }

  const declaredLength = reader.readUint32("размер блока канала");
  if (declaredLength === 0) throw new Error("RAW8: в заголовке указан пустой блок канала.");
  if (declaredLength + DECLARED_LENGTH_TRAILER_OFFSET > data.byteLength) {
    throw new Error("RAW8: файл обрезан — объявленный блок канала выходит за границы файла.");
  }

  reader.readUint8("порядковый номер спектра");
  const measurementMode = reader.readUint8("режим измерения");
  if (measurementMode !== 0) {
    throw new Error(`RAW8: режим ${formatMeasurementMode(measurementMode)} пока не поддерживается; требуется Scope RAW8.`);
  }
  reader.readUint8("разрядность");
  reader.readUint8("маркер SD");

  const serialNumber = reader.readAscii(10, "серийный номер").replace(/\0.*$/u, "").trim();
  reader.skip(64, "пользовательское имя прибора");
  reader.readUint8("статус прибора");

  const startPixel = reader.readUint16("StartPixel");
  const stopPixel = reader.readUint16("StopPixel");
  if (stopPixel < startPixel) {
    throw new Error(`RAW8: некорректный диапазон пикселей ${startPixel}–${stopPixel}.`);
  }

  const pointCount = stopPixel - startPixel + 1;
  if (pointCount < MIN_POINTS) {
    throw new Error(`RAW8: для анализа требуется минимум ${MIN_POINTS} точки.`);
  }
  if (pointCount > MAX_POINTS) {
    throw new Error(`RAW8: количество точек ${pointCount} превышает допустимый максимум ${MAX_POINTS}.`);
  }

  const integrationTimeMs = reader.readFloat32("время интеграции");
  reader.readUint32("задержка интеграции");
  const averages = reader.readUint32("число усреднений");
  if (!Number.isFinite(integrationTimeMs) || integrationTimeMs <= 0) {
    throw new Error("RAW8: время интеграции должно быть положительным конечным числом.");
  }
  if (averages < 1) throw new Error("RAW8: число усреднений должно быть не меньше одного.");

  reader.skip(2, "настройки коррекции тёмного сигнала");
  reader.skip(4, "настройки сглаживания");
  reader.skip(3, "настройки запуска");
  reader.skip(16, "настройки управления");
  reader.skip(4, "метка времени");
  reader.skip(4, "дата сохранения");
  reader.skip(20, "температурные и калибровочные параметры");
  reader.skip(40, "параметры аппроксимации");
  reader.skip(130, "комментарий");

  if (reader.offset !== RAW8_HEADER_SIZE) {
    throw new Error("RAW8: внутренняя структура заголовка не соответствует AVS84.");
  }

  const wavelengths = reader.readFloat32Array(pointCount, "wavelength");
  const scope = reader.readFloat32Array(pointCount, "scope");
  const dark = reader.readFloat32Array(pointCount, "dark");
  const reference = reader.readFloat32Array(pointCount, "reference");

  if (reader.offset > declaredLength + DECLARED_LENGTH_TRAILER_OFFSET) {
    throw new Error("RAW8: массивы данных выходят за объявленную границу блока канала.");
  }

  validateFiniteArray(wavelengths, "wavelength");
  validateFiniteArray(scope, "scope");
  validateFiniteArray(dark, "dark");
  validateFiniteArray(reference, "reference");

  const dataset = { wavelengths, intensities: scope };
  try {
    validateDataset(dataset);
  } catch (error) {
    const message = error instanceof Error ? error.message : "данные не прошли проверку";
    throw new Error(`RAW8: ${message}`);
  }

  return {
    dataset,
    auxiliaryData: { dark, reference },
    metadata: {
      serialNumber,
      integrationTimeMs,
      averages,
      channelCount: 1,
      startPixel,
      stopPixel,
    },
  };
}

class BinaryReader {
  readonly #view: DataView;
  offset = 0;

  constructor(data: ArrayBuffer) {
    this.#view = new DataView(data);
  }

  readUint8(label: string): number {
    this.#require(1, label);
    const value = this.#view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16(label: string): number {
    this.#require(2, label);
    const value = this.#view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readUint32(label: string): number {
    this.#require(4, label);
    const value = this.#view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat32(label: string): number {
    this.#require(4, label);
    const value = this.#view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat32Array(length: number, label: string): number[] {
    const byteLength = length * Float32Array.BYTES_PER_ELEMENT;
    this.#require(byteLength, `массив ${label}`);
    const values = Array.from({ length }, (_, index) => (
      this.#view.getFloat32(this.offset + index * Float32Array.BYTES_PER_ELEMENT, true)
    ));
    this.offset += byteLength;
    return values;
  }

  readAscii(length: number, label: string): string {
    this.#require(length, label);
    let value = "";
    for (let index = 0; index < length; index += 1) {
      value += String.fromCharCode(this.#view.getUint8(this.offset + index));
    }
    this.offset += length;
    return value;
  }

  skip(length: number, label: string): void {
    this.#require(length, label);
    this.offset += length;
  }

  #require(length: number, label: string): void {
    if (this.offset + length > this.#view.byteLength) {
      throw new Error(`RAW8: файл обрезан — не удалось прочитать ${label}.`);
    }
  }
}

function validateFiniteArray(values: readonly number[], label: string): void {
  const invalidIndex = values.findIndex((value) => !Number.isFinite(value));
  if (invalidIndex !== -1) {
    throw new Error(`RAW8: массив ${label}, значение ${invalidIndex + 1} не является конечным числом.`);
  }
}

function formatMeasurementMode(mode: number): string {
  const modes: Record<number, string> = {
    1: "ABS8",
    2: "RWD8",
    3: "TRM8",
    4: "RFL8",
    5: "IRR8",
    6: "RIR8",
    7: "STR8",
  };
  return modes[mode] ?? `с кодом ${mode}`;
}
