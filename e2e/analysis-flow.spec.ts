import { expect, test } from "@playwright/test";

import { demoSpectra } from "../src/fixtures/demo-spectra";

test("measurement to evidence and a linked peak", async ({ page }) => {
  await page.goto("/data");

  await page.getByLabel("Файл спектра").setInputFiles({
    name: "measurement.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(demoSpectra.fe12)),
  });
  await expect(page.locator("dd").filter({ hasText: "measurement.json" })).toBeVisible();

  await page.getByRole("combobox", { name: /Допустимый способ интерпретации/ }).selectOption("unspecified");
  await expect(page.getByRole("status").filter({ hasText: "Обновляем анализ" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Обновляем анализ" })).toBeHidden();

  await page.getByRole("link", { name: "Анализ" }).click();
  await expect(page.getByText("Краткий вывод", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Есть признаки|Надёжного вывода/ })).toBeVisible();

  const composition = page.getByRole("list", { name: "Наиболее надёжные варианты состава" });
  const mainHypothesis = composition.getByRole("button").first();
  await expect(mainHypothesis).toBeVisible();
  await mainHypothesis.click();
  await expect(page.getByText("Наиболее надёжные спектральные признаки")).toBeVisible();

  await page.getByText("Подробности идентификации и технические показатели").click();
  await page.getByRole("button", { name: "Открыть пик" }).first().click();

  await expect(page.getByRole("tab", { name: "Все пики" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('tr[aria-selected="true"]')).toBeVisible();
});
