import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

interface RouteBundleStats {
  readonly route: string;
  readonly firstLoadUncompressedJsBytes: number;
}

const MAX_FIRST_LOAD_BYTES = 1_250_000;
const statsPath = resolve(process.cwd(), ".next/diagnostics/route-bundle-stats.json");

let stats: readonly RouteBundleStats[];
try {
  stats = JSON.parse(await readFile(statsPath, "utf8")) as readonly RouteBundleStats[];
} catch (error) {
  throw new Error("Сначала выполните pnpm build: статистика клиентского пакета не найдена.", { cause: error });
}

const oversized = stats.filter((item) => item.firstLoadUncompressedJsBytes > MAX_FIRST_LOAD_BYTES);
for (const item of stats) {
  console.log(`${item.route}: ${formatMegabytes(item.firstLoadUncompressedJsBytes)} МБ JS при первом открытии`);
}

if (oversized.length) {
  throw new Error(
    `Превышен лимит ${formatMegabytes(MAX_FIRST_LOAD_BYTES)} МБ: ${oversized
      .map((item) => `${item.route} (${formatMegabytes(item.firstLoadUncompressedJsBytes)} МБ)`)
      .join(", ")}.`,
  );
}

function formatMegabytes(bytes: number): string {
  return (bytes / 1_000_000).toFixed(2);
}
