const russianDecimalFormatters = new Map<number, Intl.NumberFormat>();

export function formatDecimal(value: number, precision: number): string {
  if (!Number.isFinite(value)) return String(value);
  const rounded = normalizeRoundedZero(value, precision);
  let formatter = russianDecimalFormatters.get(precision);
  if (!formatter) {
    formatter = new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
      useGrouping: false,
    });
    russianDecimalFormatters.set(precision, formatter);
  }
  return formatter.format(rounded);
}

export function formatSignedDecimal(value: number, precision: number): string {
  const rounded = normalizeRoundedZero(value, precision);
  if (rounded === 0) return formatDecimal(0, precision);
  return `${rounded > 0 ? "+" : ""}${formatDecimal(rounded, precision)}`;
}

export function pluralizeRu(value: number, one: string, few: string, many: string): string {
  const integer = Math.abs(Math.trunc(value));
  const mod100 = integer % 100;
  const mod10 = integer % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function formatCount(value: number, one: string, few: string, many: string): string {
  return `${value.toLocaleString("ru-RU")} ${pluralizeRu(value, one, few, many)}`;
}

function normalizeRoundedZero(value: number, precision: number): number {
  const factor = 10 ** precision;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) || Math.abs(rounded) < 0.5 / factor ? 0 : rounded;
}
