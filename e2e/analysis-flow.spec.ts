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

  const spectrumType = page.getByRole("combobox", { name: /Допустимый способ интерпретации/ });
  await expect(spectrumType).toHaveValue("plasma-emission");
  await expect(spectrumType.getByRole("option")).toHaveText("Эмиссия плазмы/разряда");
  await expect(spectrumType.getByRole("option")).toHaveCount(1);

  await page.getByRole("link", { name: "Анализ" }).click();
  await expect(page.getByText("Краткий вывод", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Есть признаки|Надёжного вывода/ })).toBeVisible();

  await page.getByRole("tab", { name: "Все пики" }).click();
  await expect(page.getByText("Ближайший кандидат", { exact: true }).first()).toBeVisible();
  if (testInfo.project.name === "chromium") {
    const selectedRow = page.locator("tr[data-peak-id]").first();
    await selectedRow.click();
    const selectedPeakId = await selectedRow.getAttribute("data-peak-id");
    await expect(page.getByRole("heading", { name: "Назначения в гипотезах" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ближайший кандидат" })).toBeVisible();

    await page.getByRole("button", { name: /Показать все кандидаты ·/ }).click();
    await page.getByLabel("Поиск кандидата по названию элемента или символу").fill("N");
    await page.getByLabel("Отношение к гипотезам").selectOption("diagnostic");
    await expect(page.getByText(/Найдено справочных записей: [1-9]/)).toBeVisible();
    await page.getByRole("button", { name: "Открыть гипотезу" }).first().click();
    await expect(page.getByRole("tab", { name: "Состав" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Все пики" }).click();
    await expect(page.locator('tr[aria-selected="true"]')).toHaveAttribute("data-peak-id", selectedPeakId!);
  }

  const composition = page.getByRole("list", { name: "Наиболее надёжные варианты состава" });
  await page.getByRole("tab", { name: "Состав" }).click();
  const mainHypothesis = composition.getByRole("button").first();
  await expect(mainHypothesis).toBeVisible();
  await mainHypothesis.click();
  await expect(page.getByText("Наиболее надёжные спектральные признаки")).toBeVisible();

  await page.getByText("Подробности идентификации и технические показатели").click();
  await page.getByRole("button", { name: "Открыть пик" }).first().click();

  await expect(page.getByRole("tab", { name: "Все пики" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('tr[aria-selected="true"]')).toBeVisible();
});
