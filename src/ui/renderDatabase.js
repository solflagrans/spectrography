import { parseFiniteNumber } from "../core/validation.js";

export function serializeDatabase(database) {
  return JSON.stringify(database, null, 2);
}

export function parseDatabase(text) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("База должна быть JSON-массивом.");
  return parsed.map((item) => {
    if (!item.symbol || !item.name || !Array.isArray(item.lines)) {
      throw new Error("Каждая запись базы должна содержать symbol, name и lines.");
    }
    return {
      symbol: String(item.symbol),
      name: String(item.name),
      lines: item.lines.map(Number).filter(Number.isFinite),
    };
  });
}

export function renderDatabaseEditor(elements, database) {
  elements.databaseEditor.innerHTML = `
    <div class="database-grid">
      <div class="database-head">Символ</div>
      <div class="database-head">Название</div>
      <div class="database-head">Линии, нм</div>
      <div class="database-head"></div>
      ${database.map((item, index) => renderDatabaseRow(item, index)).join("")}
    </div>
  `;
}

export function readDatabaseEditor(elements) {
  const rows = [...elements.databaseEditor.querySelectorAll(".db-symbol")].map((symbolInput) => {
    const index = symbolInput.dataset.index;
    const nameInput = elements.databaseEditor.querySelector(`.db-name[data-index="${index}"]`);
    const linesInput = elements.databaseEditor.querySelector(`.db-lines[data-index="${index}"]`);
    const symbol = symbolInput.value.trim();
    const name = nameInput.value.trim();
    const lines = linesInput.value
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map((value, lineIndex) => parseFiniteNumber(value, `База: ${symbol || `строка ${Number(index) + 1}`}, линия ${lineIndex + 1}`));

    if (!symbol) throw new Error(`База: строка ${Number(index) + 1}, укажите символ элемента.`);
    if (!name) throw new Error(`База: строка ${Number(index) + 1}, укажите название элемента.`);
    if (!lines.length) throw new Error(`База: ${symbol}, добавьте хотя бы одну линию.`);
    return { symbol, name, lines };
  });

  if (!rows.length) throw new Error("База должна содержать хотя бы один элемент.");
  return rows;
}

export function syncDatabaseInput(elements, state) {
  elements.databaseInput.value = serializeDatabase(state.database);
}

function renderDatabaseRow(item, index) {
  return `
    <div>
      <input class="db-symbol" data-index="${index}" value="${escapeHtml(item.symbol)}" aria-label="Символ элемента ${index + 1}" />
    </div>
    <div>
      <input class="db-name" data-index="${index}" value="${escapeHtml(item.name)}" aria-label="Название элемента ${index + 1}" />
    </div>
    <div>
      <input class="db-lines" data-index="${index}" value="${escapeHtml(item.lines.join(", "))}" aria-label="Спектральные линии элемента ${index + 1}" />
    </div>
    <div>
      <button class="delete-row" data-index="${index}" type="button" title="Удалить элемент">×</button>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
