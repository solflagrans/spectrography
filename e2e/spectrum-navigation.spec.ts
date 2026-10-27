import { expect, test } from "@playwright/test";

test("spectrum range selection, numeric entry and reset change only the view", async ({ page }, testInfo) => {
  await page.goto("/data");
  await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
  const chart = page.getByRole("img", { name: /Спектр nasa/ });
  await expect(chart).toBeVisible();
  const box = (await chart.boundingBox())!;
  if (testInfo.project.name !== "mobile") {
  await expect(page.getByRole("button", { name: "Выделить участок", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Сбросить масштаб" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Выделить участок", exact: true })).toHaveAttribute("aria-pressed", "false");
  }
  await page.getByRole("button", { name: "Диапазон…", exact: true }).click();
  await page.getByLabel("От, нм", { exact: true }).fill("400");
  await page.getByLabel("До, нм", { exact: true }).fill("410");
  await page.getByRole("button", { name: "Применить", exact: true }).click();
  if (testInfo.project.name !== "mobile") {
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.4, { steps: 8 });
    await page.mouse.up();
    await page.getByRole("button", { name: "Диапазон…", exact: true }).click();
    const from = Number(await page.getByLabel("От, нм", { exact: true }).inputValue());
    const to = Number(await page.getByLabel("До, нм", { exact: true }).inputValue());
    expect(from).toBeLessThan(400);
    expect(to - from).toBeCloseTo(10, 3);
    await page.getByRole("button", { name: "Закрыть диапазон" }).click();
    await page.getByRole("button", { name: "Диапазон…", exact: true }).click();
    await page.getByLabel("От, нм", { exact: true }).fill("400");
    await page.getByLabel("До, нм", { exact: true }).fill("410");
    await page.getByRole("button", { name: "Применить", exact: true }).click();
  }
  await page.getByRole("button", { name: "Диапазон…", exact: true }).click();
  await expect(page.getByLabel("От, нм", { exact: true })).toHaveValue("400");
  await expect(page.getByLabel("До, нм", { exact: true })).toHaveValue("410");
  await page.getByRole("button", { name: "Закрыть диапазон" }).click();
  await chart.dblclick({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.getByRole("button", { name: "Сбросить масштаб" })).toHaveCount(0);
  await page.getByRole("button", { name: "Диапазон…", exact: true }).click();
  await expect(page.getByLabel("От, нм", { exact: true })).not.toHaveValue("400");
  await expect(page.getByLabel("До, нм", { exact: true })).not.toHaveValue("410");
});
