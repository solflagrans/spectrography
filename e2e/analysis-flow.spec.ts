import { expect, test } from "@playwright/test";

import { demoSpectra } from "../src/fixtures/demo-spectra";

test("measurement to evidence and a linked peak", async ({ page }, testInfo) => {
  await page.goto("/data");

  await page.getByLabel("Файл спектра").setInputFiles({
    name: "measurement.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(demoSpectra.fe12)),
  });
  await expect(page.locator("dd").filter({ hasText: "measurement.json" })).toBeVisible();

  const spectrumType = page.getByRole("combobox", { name: "Тип спектра" });
  await expect(spectrumType).toHaveValue("plasma-emission");
  await expect(spectrumType.getByRole("option")).toHaveText("Эмиссия плазмы/разряда");
  await expect(spectrumType.getByRole("option")).toHaveCount(1);

  await page.getByRole("link", { name: "Анализ" }).click();
  await expect(page.getByRole("heading", { name: "Основные гипотезы" })).toBeVisible();
  await expect(page.getByText(/— основная гипотеза|Надёжных гипотез нет/)).toBeVisible();

  await page.getByRole("tab", { name: "Все пики" }).click();
  await expect(page.getByText("Ближайшая линия", { exact: true }).first()).toBeVisible();
  if (testInfo.project.name === "chromium") {
    const selectedRow = page.locator("tr[data-peak-id]").first();
    await selectedRow.click();
    const selectedPeakId = await selectedRow.getAttribute("data-peak-id");
    await expect(page.getByRole("heading", { name: "Назначения в гипотезах" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ближайшая линия" })).toBeVisible();

    await page.getByRole("button", { name: /Все кандидаты \(\d+\)/ }).click();
    await page.getByLabel("Поиск кандидата по названию элемента или символу").fill("N");
    await page.getByLabel("Отношение к гипотезам").selectOption("diagnostic");
    await expect(page.getByText(/Найдено справочных записей: [1-9]/)).toBeVisible();
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
    await page.getByRole("button", { name: "Открыть демонстрационный спектр" }).click();

    for (const route of ["Данные", "Обработка", "Анализ", "Библиотека"]) {
      await page.getByRole("link", { name: route, exact: true }).click();
      await expect.poll(() => page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }))).toEqual({ client: width, scroll: width });
    }
  }
});
