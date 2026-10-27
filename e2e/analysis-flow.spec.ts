import { expect, test } from "@playwright/test";

test("measurement to evidence and a linked peak", async ({ page }, testInfo) => {
  await page.goto("/data");

  await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
  await expect(page.getByText("nasa-pds-h92649-iron-rich.json", { exact: true })).toBeVisible();

  const spectrumType = page.getByRole("combobox", { name: "Тип спектра" });
  await expect(spectrumType).toHaveText("Эмиссия плазмы/разряда");
  await spectrumType.click();
  await expect(page.getByRole("option", { name: "Эмиссия плазмы/разряда", exact: true })).toBeVisible();
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(spectrumType).toBeFocused();


  await page.getByRole("link", { name: "Анализ" }).click();
  await expect(page.getByRole("region", { name: "Краткая интерпретация" })).toContainText("Fe");
  await page.getByRole("tab", { name: "Спектр и пики" }).click();
  await expect(page.getByRole("slider", { name: "Минимальное отношение сигнал/шум" })).toHaveCount(0);
  await page.locator("tr[data-peak-id]").first().click();
  await expect(page.getByRole("tab", { name: "Параметры", exact: true })).toBeVisible();
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Закрыть инспектор" }).click();
  await page.screenshot({ path: `/tmp/spectro-analysis-${testInfo.project.name}.png`, fullPage: true });
  const peakBeforeSettings = await page.locator('tr[aria-selected="true"]').getAttribute("data-peak-id");
  await page.getByRole("link", { name: "Обработка", exact: true }).click();
  await page.getByRole("tab", { name: "Поиск пиков", exact: true }).click();
  await expect(page).toHaveURL(/processing#peak-settings$/);
  await expect(page.getByRole("slider", { name: "Минимальное отношение сигнал/шум" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Сглаживание" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Подготовка", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Сглаживание" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Минимальное отношение сигнал/шум" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Подготовка", exact: true }).press("ArrowRight");
  await expect(page.getByRole("slider", { name: "Минимальное отношение сигнал/шум" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Вернуться к анализу" })).toHaveCount(0);
  await page.getByRole("link", { name: "Анализ", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Спектр и пики" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('tr[aria-selected="true"]')).toHaveAttribute("data-peak-id", peakBeforeSettings!);

  if (testInfo.project.name === "chromium") {
    const selectedRow = page.locator("tr[data-peak-id]").first();
    await selectedRow.click();
    const selectedPeakId = await selectedRow.getAttribute("data-peak-id");
    await page.getByRole("tab", { name: "Соответствия", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Назначения в составе" })).toBeVisible();

    await page.getByRole("button", { name: /Все соответствия · \d+/ }).click();
    await page.getByLabel("Поиск кандидата по названию элемента или символу").fill("N");
    await page.getByLabel("Отношение к составу").click();
    await page.getByRole("option", { name: "Другое совпадение", exact: true }).click();
    await expect(page.locator("[data-candidate-count]")).not.toHaveText(/^0 /);
    await page.locator("[data-candidate-group] summary").first().click();
    await page.locator("[data-candidate-group] button").filter({ hasText: "Доказательства:" }).first().click();
    await expect(page.getByRole("tab", { name: "Интерпретация" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Спектр и пики" }).click();
    await expect(page.locator('tr[aria-selected="true"]')).toHaveAttribute("data-peak-id", selectedPeakId!);
  }

  await page.getByRole("tab", { name: "Интерпретация" }).click();
  if (testInfo.project.name === "mobile") {
    const hypothesisSelect = page.getByRole("combobox", { name: "Выбрать результат" });
    await expect(hypothesisSelect).toBeVisible();
    await hypothesisSelect.click();
    await page.getByRole("listbox").getByRole("option").first().click();
  } else {
    await page.getByRole("tab", { name: "Интерпретация", exact: true }).click();
  const composition = page.getByRole("listbox", { name: "Состав" });
    const mainHypothesis = composition.getByRole("option").first();
    await expect(mainHypothesis).toBeVisible();
    await mainHypothesis.click();
  }
  await expect(page.getByRole("heading", { name: "Доказательства", exact: true })).toBeVisible();

  await page.locator('tr[tabindex="0"]').first().click();
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Закрыть инспектор" }).click();

  await expect(page.getByRole("tab", { name: "Спектр и пики" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('tr[aria-selected="true"]')).toBeVisible();
});

test("desktop routes do not overflow horizontally", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Проверка геометрии выполняется в Chromium");

  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/data");
    await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
    await expect(page.getByText("nasa-pds-h92649-iron-rich.json", { exact: true })).toBeVisible();

    for (const route of ["Данные", "Обработка", "Анализ", "Библиотека"]) {
      await page.getByRole("link", { name: route, exact: true }).click();
      await expect.poll(() => page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }))).toEqual({ client: width, scroll: width });
    }
  }
});

test("desktop tooltips, settings and evidence table keep their geometry at 1024 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Проверка геометрии выполняется в Chromium");

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/data");
  await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
  await expect(page.getByText("nasa-pds-h92649-iron-rich.json", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Обработка", exact: true }).click();
  const tooltipTrigger = page.getByRole("button", { name: "Подсказка: Гладкость базовой линии" });
  await tooltipTrigger.hover();
  await expect(page.getByRole("tooltip")).toContainText("насколько плавно меняется фон");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toBeHidden();

  const parameterGeometry = await page.locator('[data-parameter-panel="processing"]').evaluate((panel) => {
    const panelRect = panel.getBoundingClientRect();
    const controls = Array.from(panel.querySelectorAll<HTMLElement>("[data-parameter-control]"));
    const rects = controls.filter((control) => !control.closest("details:not([open])") && control.getClientRects().length > 0).map((control) => control.getBoundingClientRect());
    return {
      controlCount: rects.length,
      contained: rects.every((rect) => rect.left >= panelRect.left - 1 && rect.right <= panelRect.right + 1),
      aligned: Math.max(...rects.map((rect) => rect.left)) - Math.min(...rects.map((rect) => rect.left)) <= 1,
    };
  });
  expect(parameterGeometry).toEqual({ controlCount: 5, contained: true, aligned: true });

  await page.getByRole("link", { name: "Анализ", exact: true }).click();
  await page.getByRole("tab", { name: "Интерпретация", exact: true }).click();
  const composition = page.getByRole("listbox", { name: "Состав" });
  await composition.getByRole("option").first().click();
  const evidenceRow = page.locator("tr[data-evidence-row]").first();
  await expect(evidenceRow).toBeVisible();

  await evidenceRow.locator("td").last().locator("span").last().evaluate((node) => {
    node.textContent = "Высокая достоверность совпадения по нескольким независимым признакам";
  });

  const tableGeometry = await evidenceRow.evaluate((row) => {
    const cells = Array.from(row.querySelectorAll<HTMLElement>(":scope > td"));
    const cellRects = cells.map((cell) => cell.getBoundingClientRect());
    const table = row.closest("table")!;
    const container = table.parentElement!;
    const tableRect = table.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return {
      cellCount: cells.length,
      qualityAligned: Math.abs(cells[4].querySelector("span > span")!.getBoundingClientRect().left - table.querySelector("thead th:last-child > span")!.getBoundingClientRect().left) <= 1,
      groupAligned: Math.abs(cells[0].querySelector("div > div")!.getBoundingClientRect().left - (table.querySelector("thead th")!.getBoundingClientRect().left + parseFloat(getComputedStyle(table.querySelector("thead th")!).paddingLeft))) <= 1,
      tableContained: tableRect.left >= containerRect.left - 1 && tableRect.right <= containerRect.right + 1,
      cellsContained: cellRects.every((rect) => rect.left >= tableRect.left - 1 && rect.right <= tableRect.right + 1),
      cellsSeparated: cellRects.slice(1).every((rect, index) => rect.left >= cellRects[index].right - 1),
      noPrimaryScroll: container.scrollWidth <= container.clientWidth + 1,
      contentContained: cells.every((cell) => cell.scrollWidth <= cell.clientWidth + 1),
    };
  });
  expect(tableGeometry).toEqual({
    cellCount: 5,
    qualityAligned: true,
    groupAligned: true,
    tableContained: true,
    cellsContained: true,
    cellsSeparated: true,
    noPrimaryScroll: true,
    contentContained: true,
  });

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("composition settings survive navigation but workspace resets on reload", async ({ page }) => {
  await page.goto("/data");
  await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
  await expect(page.getByText("nasa-pds-h92649-iron-rich.json", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Обработка", exact: true }).click();
  await page.getByRole("tab", { name: "Состав", exact: true }).click();
  await page.getByRole("combobox", { name: "Режим отбора" }).click();
  await page.getByRole("option", { name: "Чувствительный", exact: true }).click();
  await page.getByRole("combobox", { name: "Область поиска" }).click();
  await page.getByRole("option", { name: "Только выбранные", exact: true }).click();
  await expect(page.getByText("Выберите хотя бы один элемент.", { exact: false })).toBeVisible();
  await page.getByRole("checkbox", { name: "Fe Железо" }).check();
  await expect(page.getByText("Обновляем графики и результаты…")).toBeHidden();
  await page.getByRole("link", { name: "Анализ", exact: true }).click();
  await expect(page.getByText("Чувствительный · Только: Fe")).toBeVisible();
  await page.getByRole("link", { name: "Обработка", exact: true }).click();
  await page.getByRole("tab", { name: "Состав", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Режим отбора" })).toHaveText("Чувствительный");
  await expect(page.getByRole("checkbox", { name: "Fe Железо" })).toBeChecked();
  await page.reload();
  await page.getByRole("link", { name: "Данные", exact: true }).click();
  await expect(page.getByRole("button", { name: "Открыть образец NASA PDS" })).toBeVisible();
  await expect(page.getByText("nasa-pds-h92649-iron-rich.json", { exact: true })).toHaveCount(0);
});

test("analysis range and exports retain source measurement", async ({ page }) => {
  await page.goto("/data");
  await page.getByLabel("Файл спектра", { exact: true }).setInputFiles({ name: "range.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ wavelengths: [500, 501, 502, 503, 504, 505, 506], intensities: [0, 0, 1, 4, 1, 0, 0] })) });
  await expect(page.getByRole("combobox", { name: "Тип спектра" })).toBeVisible();
  await page.getByRole("link", { name: "Обработка", exact: true }).click();
  await page.getByLabel("Ограничить диапазон, нм", { exact: true }).check();
  const minimum = page.getByRole("spinbutton", { name: "Границы анализа, от" });
  await minimum.fill("501"); await minimum.press("Enter");
  await expect(page.getByText("Обновляем анализ…", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Анализ", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Спектр и пики" })).toHaveAttribute("aria-selected", "true");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт результатов" }).click();
  await page.getByRole("menuitem", { name: /Все результаты и параметры/ }).click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks = []; for await (const chunk of stream!) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.analysis.rawDataset.wavelengths).toHaveLength(7);
  expect(exported.analysis.parameters.processing.analysisRange.minimum).toBe(501);
  expect(Math.min(...exported.analysis.channels[0].preparedDataset.wavelengths)).toBeGreaterThanOrEqual(501);
});

test("processing controls keep one scale and tab previews retain layer choices", async ({ page }, testInfo) => {
  if (testInfo.project.name === "chromium") await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/data");
  await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
  await expect(page.getByText("nasa-pds-h92649-iron-rich.json", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Обработка", exact: true }).click();

  const layers = page.getByRole("group", { name: "Слои графика" });
  await expect(layers.getByRole("button", { name: "Исходный", exact: true })).toHaveAttribute("aria-pressed", "true");
  await layers.getByRole("button", { name: "Исходный", exact: true }).click();
  await page.getByRole("tab", { name: "Поиск пиков", exact: true }).click();
  await expect(layers.getByRole("button", { name: "Порог", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(layers.getByRole("button", { name: "Пики", exact: true })).toHaveAttribute("aria-pressed", "true");
  await layers.getByRole("button", { name: "Порог", exact: true }).click();
  await page.getByRole("tab", { name: "Подготовка", exact: true }).click();
  await expect(layers.getByRole("button", { name: "Исходный", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("tab", { name: "Поиск пиков", exact: true }).click();
  await expect(layers.getByRole("button", { name: "Порог", exact: true })).toHaveAttribute("aria-pressed", "false");

  const sizes = await page.getByRole("tabpanel", { name: "Поиск пиков" }).evaluate((panel) => {
    const inputs = [...panel.querySelectorAll<HTMLInputElement>('input[type="number"]')].filter((input) => !input.closest("details:not([open])"));
    const bounds = panel.getBoundingClientRect();
    return inputs.map((input) => { const rect = (input.closest('[data-ui="number-field"]') ?? input).getBoundingClientRect(); return { height: rect.height, contained: rect.left >= bounds.left && rect.right <= bounds.right }; });
  });
  expect(sizes).toHaveLength(3);
  for (const size of sizes) {
    expect(size.height).toBe(testInfo.project.name === "mobile" ? 44 : 32);
    expect(size.contained).toBe(true);
  }
  await page.getByRole("tab", { name: "Подготовка", exact: true }).click();
  await page.getByText("Оценка шума", { exact: true }).click();
  const plotBefore = await page.getByRole("img", { name: /Исходный и подготовленный спектры/ }).boundingBox();
  if (testInfo.project.name === "chromium") {
    await page.getByRole("complementary", { name: "Панель текущего раздела" }).evaluate((panel) => { panel.scrollTop = panel.scrollHeight; });
    const plotAfter = await page.getByRole("img", { name: /Исходный и подготовленный спектры/ }).boundingBox();
    expect(plotAfter?.y).toBe(plotBefore?.y);
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("compact disclosures show current values and keep failed edits available", async ({ page }) => {
  await page.goto("/data");
  await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
  await expect(page.getByText("nasa-pds-h92649-iron-rich.json", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Обработка", exact: true }).click();
  const parameterError = page.getByRole("complementary", { name: "Панель текущего раздела" }).getByRole("alert");
  const summary = page.locator("summary").filter({ hasText: "Оценка шума" });
  const details = summary.locator("..");
  await expect(summary).toContainText("окно 3 нм");
  await summary.click();
  const windowInput = page.getByRole("spinbutton", { name: "Окно", exact: true });
  await windowInput.fill("-1"); await windowInput.press("Enter");
  await expect(parameterError).toBeVisible();
  await page.getByRole("tab", { name: "Поиск пиков", exact: true }).click();
  await page.getByRole("tab", { name: "Подготовка", exact: true }).click();
  await expect(details).toHaveAttribute("open", "");
  await summary.click();
  await expect(details).toHaveAttribute("open", "");
  await windowInput.fill("4"); await windowInput.press("Enter");
  await expect(parameterError).toHaveCount(0);
  await expect(page.getByText("Обновляем графики и результаты…")).toBeHidden();
  await summary.click();
  await expect(details).not.toHaveAttribute("open", "");
  await expect(summary).toContainText("окно 4 нм");
});

test("independent peak inspector preserves selection, opens records and reveals sorted rows", async ({ page }, testInfo) => {
  await page.goto("/data");
  await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
  await expect(page.getByText("nasa-pds-h92649-iron-rich.json", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Анализ", exact: true }).click();
  await page.locator("tr[data-peak-id]").first().click();
  await expect(page.getByRole("tab", { name: "Параметры", exact: true })).toHaveAttribute("aria-selected", "true");
  const original = await page.locator('tr[aria-selected="true"]').getAttribute("data-peak-id");
  await page.getByRole("button", { name: "Следующий пик", exact: true }).click();
  await page.getByRole("tab", { name: "Соответствия", exact: true }).click();
  await page.getByRole("button", { name: "Предыдущий пик", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Соответствия", exact: true })).toHaveAttribute("aria-selected", "true");
  const candidate = page.locator("[data-candidate-group]").first();
  await candidate.locator("summary").first().click();
  const record = candidate.getByRole("button", { name: /Справочная запись/ });
  await record.click();
  const dialog = page.getByRole("dialog", { name: /Справочные линии/ });
  await expect(dialog.getByText("Идентификатор", { exact: true }).first()).toBeVisible({ timeout: 15000 });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(record).toBeFocused();
  if (testInfo.project.name === "mobile") {
    await expect(page.getByRole("dialog", { name: "Инспектор пика", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Закрыть инспектор" }).click();
    await expect(page.locator('tr[aria-selected="true"]')).toHaveAttribute("data-peak-id", original!);
  } else {
    const plot = page.getByRole("img", { name: "Подготовленный спектр с отмеченными пиками" });
    await page.getByRole("button", { name: /Все соответствия ·/ }).click();
    const before = await plot.boundingBox();
    await page.getByRole("complementary").evaluate((panel) => { panel.scrollTop = 600; });
    const after = await plot.boundingBox();
    expect(after?.y).toBe(before?.y);
    const header = page.getByRole("heading", { name: /247,166 нм/ });
    await expect(header).toBeVisible();
    await page.getByRole("columnheader", { name: /SNR/ }).getByRole("button").click();
    const visible = await page.locator('tr[aria-selected="true"]').evaluate((row) => {
      const container = row.closest("table")!.parentElement!;
      const box = container.getBoundingClientRect();
      const selected = row.getBoundingClientRect();
      const head = container.querySelector("thead")!.getBoundingClientRect().height;
      return selected.top >= box.top + head - 1 && selected.bottom <= box.bottom + 1;
    });
    expect(visible).toBe(true);
  }
});

test("select popups keep page width and inline channel pickers stay inside cards", async ({ page }, testInfo) => {
  await page.goto("/data");
  // Exercise a real reserved gutter even when headless Chromium uses overlay scrollbars.
  await page.addStyleTag({ content: "html { overflow-y: scroll; } ::-webkit-scrollbar { width: 15px; }" });
  await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
  const type = page.getByRole("combobox", { name: "Тип спектра", exact: true });
  await expect(type).toBeVisible();
  await type.scrollIntoViewIfNeeded();
  const geometry = () => page.locator("#spectrum-type").evaluate((trigger) => {
    const field = trigger.closest("section")!.getBoundingClientRect();
    const main = document.querySelector("main")!.getBoundingClientRect();
    return { bodyWidth: document.body.getBoundingClientRect().width, mainWidth: main.width, fieldX: field.x, fieldWidth: field.width };
  });
  const before = await geometry();
  await type.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  expect(await geometry()).toEqual(before);
  await page.keyboard.press("Escape");
  expect(await geometry()).toEqual(before);

  const widths = testInfo.project.name === "chromium" ? [1440, 1024] : [393];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("link", { name: "Обработка", exact: true }).click();
    const channel = page.getByRole("combobox", { name: "Канал обработки", exact: true });
    const contained = () => page.locator("#processing-channel").evaluate((trigger) => {
      const rect = trigger.getBoundingClientRect();
      const card = trigger.closest("section")!.getBoundingClientRect();
      const main = document.querySelector("main")!;
      return rect.left >= card.left && rect.right <= card.right && main.scrollWidth <= main.clientWidth + 1;
    });
    await expect(channel).toBeVisible();
    expect(await contained()).toBe(true);
    await channel.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    expect(await contained()).toBe(true);
    await page.keyboard.press("Escape");
  }
});

test("interpretation separates a rejected result from composition and expands one evidence row", async ({ page }, testInfo) => {
  await page.goto("/data");
  await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
  await expect(page.getByText("nasa-pds-h92649-iron-rich.json", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Анализ", exact: true }).click();
  await page.getByRole("tab", { name: "Интерпретация", exact: true }).click();
  if (testInfo.project.name === "mobile") {
    const picker = page.getByRole("combobox", { name: "Выбрать результат" });
    await picker.click();
    await page.getByRole("option", { name: "Кислород (O) · не подтверждён", exact: true }).click();
    await expect(picker).toHaveText("Кислород (O) · не подтверждён");
  } else {
    await expect(page.getByRole("combobox", { name: "Выбрать результат" })).toBeHidden();
    const other = page.getByText(/^Другие совпадения ·/);
    expect(await other.evaluate((node) => node.closest("details")?.open)).toBe(true);
    await expect(page.getByRole("combobox", { name: "Сортировка", exact: true })).toBeVisible();
    await other.click();
    await expect(page.getByRole("heading", { name: "Железо · Fe", exact: true })).toBeVisible();
    await other.click();
    await expect(page.getByRole("heading", { name: "Железо · Fe", exact: true })).toBeVisible();
    await page.getByRole("option", { name: /^O Кислород/ }).click();
    await page.getByRole("listbox", { name: "Состав", exact: true }).getByRole("option").first().click();
    expect(await other.evaluate((node) => node.closest("details")?.open)).toBe(true);
    await page.getByRole("option", { name: /^O Кислород/ }).click();
  }
  const selected = page.getByRole("region", { name: "Кислород · O", exact: true });
  await expect(selected).toContainText("Не подтверждён");
  await expect(page.locator("#analysis-conclusion-title")).toContainText("Железо (Fe)");
  await expect(page.locator("#analysis-conclusion-title")).not.toContainText("Кислород");
  await expect(page.getByText("Ключевые признаки", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Доказательства", exact: true })).toBeVisible();
  const graph = page.getByRole("img", { name: /и линии элемента Кислород/ });
  expect(await graph.evaluate((node) => node.closest("section")?.nextElementSibling?.querySelector("h2")?.textContent)).toBe("Доказательства");
  await expect(page.locator('tr[id^="evidence-"]')).toHaveCount(0);
  const expanders = page.getByRole("button", { name: /^Подробности группы/ });
  await expanders.nth(0).click();
  await expect(page.locator('tr[id^="evidence-"]')).toHaveCount(1);
  await expect(page.getByText("Индекс совпадения", { exact: true })).toBeVisible();
  await expect(page.locator('tr[id^="evidence-"]')).not.toContainText("nist-asd-");
  const records = page.getByRole("button", { name: /^Справочные линии ·/ });
  await records.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Идентификатор", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Закрыть справочную запись", exact: true }).click();
  await expect(records).toBeFocused();
  await expect(selected).toContainText("Не подтверждён");
  await expanders.nth(1).click();
  await expect(expanders.nth(0)).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('tr[id^="evidence-"]')).toHaveCount(1);
  await expect(page.getByRole("tab", { name: "Интерпретация", exact: true })).toHaveAttribute("aria-selected", "true");
  const characteristicCount = await page.locator("tr[data-evidence-row]").count();
  await page.getByRole("button", { name: /^Все совпадения ·/ }).click();
  expect(await page.locator("tr[data-evidence-row]").count()).toBeGreaterThan(characteristicCount);
  await expect(page.getByText("Подробности расчёта", { exact: true })).toBeVisible();
  expect(await page.getByText("Подробности расчёта", { exact: true }).evaluate((node) => node.closest("details")?.open)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
