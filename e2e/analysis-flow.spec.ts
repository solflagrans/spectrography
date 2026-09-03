import { expect, test } from "@playwright/test";

test("measurement to evidence and a linked peak", async ({ page }, testInfo) => {
  await page.goto("/data");

  await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
  await expect(page.locator("dd").filter({ hasText: "nasa-pds-h92649-iron-rich.json" })).toBeVisible();

  const spectrumType = page.getByRole("combobox", { name: "Тип спектра" });
  await expect(spectrumType).toHaveValue("plasma-emission");
  await expect(spectrumType.getByRole("option")).toHaveText("Эмиссия плазмы/разряда");
  await expect(spectrumType.getByRole("option")).toHaveCount(1);

  await page.getByRole("link", { name: "Анализ" }).click();
  await expect(page.getByRole("heading", { name: "Основные гипотезы" })).toBeVisible();
  await expect(page.getByText(/— основная гипотеза|Надёжных гипотез нет/).first()).toBeVisible();

  await page.getByRole("tab", { name: "Все пики" }).click();
  await expect(page.getByText("Ближайшая линия", { exact: true }).first()).toBeVisible();
  if (testInfo.project.name === "chromium") {
    const selectedRow = page.locator("tr[data-peak-id]").first();
    await selectedRow.click();
    const selectedPeakId = await selectedRow.getAttribute("data-peak-id");
    await expect(page.getByRole("heading", { name: "Назначения в гипотезах" })).toBeVisible();

    await page.getByRole("button", { name: /Все кандидаты \(\d+\)/ }).click();
    await page.getByLabel("Поиск кандидата по названию элемента или символу").fill("N");
    await page.getByLabel("Отношение к гипотезам").selectOption("diagnostic");
    await expect(page.locator("[data-candidate-count]")).not.toHaveText(/^0 /);
    await page.locator("[data-candidate-group] button").first().click();
    await expect(page.getByRole("tab", { name: "Состав" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Все пики" }).click();
    await expect(page.locator('tr[aria-selected="true"]')).toHaveAttribute("data-peak-id", selectedPeakId!);
  }

  await page.getByRole("tab", { name: "Состав" }).click();
  if (testInfo.project.name === "mobile") {
    const hypothesisSelect = page.getByRole("combobox", { name: "Выбрать гипотезу" });
    await expect(hypothesisSelect).toBeVisible();
    await hypothesisSelect.selectOption({ index: 0 });
  } else {
    const composition = page.getByRole("listbox", { name: "Основные гипотезы" });
    const mainHypothesis = composition.getByRole("option").first();
    await expect(mainHypothesis).toBeVisible();
    await mainHypothesis.click();
  }
  await expect(page.getByText("Ключевые признаки")).toBeVisible();

  await page.getByText("Доказательства и показатели").click();
  await page.locator('tr[tabindex="0"]').first().click();

  await expect(page.getByRole("tab", { name: "Все пики" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('tr[aria-selected="true"]')).toBeVisible();
});

test("desktop routes do not overflow horizontally", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Проверка геометрии выполняется в Chromium");

  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/data");
    await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
    await expect(page.locator("dd").filter({ hasText: "nasa-pds-h92649-iron-rich.json" })).toBeVisible();

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
  await expect(page.locator("dd").filter({ hasText: "nasa-pds-h92649-iron-rich.json" })).toBeVisible();

  await page.getByRole("link", { name: "Обработка", exact: true }).click();
  const tooltipTrigger = page.getByRole("button", { name: "Подсказка: Гладкость базовой линии" });
  await tooltipTrigger.hover();
  await expect(page.getByRole("tooltip")).toContainText("AsLS");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toBeHidden();

  const parameterGeometry = await page.locator('[data-parameter-panel="processing"]').evaluate((panel) => {
    const panelRect = panel.getBoundingClientRect();
    const controls = Array.from(panel.querySelectorAll<HTMLElement>("[data-parameter-control]"));
    const rects = controls.map((control) => control.getBoundingClientRect());
    return {
      controlCount: rects.length,
      contained: rects.every((rect) => rect.left >= panelRect.left - 1 && rect.right <= panelRect.right + 1),
      aligned: Math.max(...rects.map((rect) => rect.left)) - Math.min(...rects.map((rect) => rect.left)) <= 1,
    };
  });
  expect(parameterGeometry).toEqual({ controlCount: 5, contained: true, aligned: true });

  await page.getByRole("link", { name: "Анализ", exact: true }).click();
  const composition = page.getByRole("listbox", { name: "Основные гипотезы" });
  await composition.getByRole("option").first().click();
  await page.getByText("Доказательства и показатели").click();
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
      tableContained: tableRect.left >= containerRect.left - 1 && tableRect.right <= containerRect.right + 1,
      cellsContained: cellRects.every((rect) => rect.left >= tableRect.left - 1 && rect.right <= tableRect.right + 1),
      cellsSeparated: cellRects.slice(1).every((rect, index) => rect.left >= cellRects[index].right - 1),
      noPrimaryScroll: container.scrollWidth <= container.clientWidth + 1,
      contentContained: cells.every((cell) => cell.scrollWidth <= cell.clientWidth + 1),
    };
  });
  expect(tableGeometry).toEqual({
    cellCount: 5,
    tableContained: true,
    cellsContained: true,
    cellsSeparated: true,
    noPrimaryScroll: true,
    contentContained: true,
  });

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});
