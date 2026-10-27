import { expect, test } from "@playwright/test";

test("analysis modes keep the sidebar and mode switch in fixed positions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop independent panels");
  await page.goto("/data");
  await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
  await expect(page.getByRole("combobox", { name: "Тип спектра" })).toBeVisible();
  await page.getByRole("link", { name: "Анализ", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Панель текущего раздела" });
  const main = page.getByRole("main", { name: "Рабочая область" });
  const tabs = page.getByRole("tablist", { name: "Режим анализа" });
  const before = await tabs.boundingBox();
  const panelBefore = await panel.boundingBox();
  await page.getByRole("tab", { name: "Интерпретация", exact: true }).click();
  await expect(panel.getByRole("listbox", { name: "Состав" })).toBeVisible();
  const after = await tabs.boundingBox();
  const panelAfter = await panel.boundingBox();
  expect(after!.x).toBeCloseTo(before!.x, 0);
  expect(after!.y).toBeCloseTo(before!.y, 0);
  expect(panelAfter!.x).toBeCloseTo(panelBefore!.x, 0);
  expect(panelAfter!.width).toBe(360);
  expect(panelAfter!.x).toBeGreaterThan((await main.boundingBox())!.x);
  await main.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(tabs).toBeInViewport();
  await page.getByRole("tab", { name: "Спектр и пики", exact: true }).click();
  await expect(tabs).toBeInViewport();
  expect((await panel.boundingBox())!.x).toBeCloseTo(panelBefore!.x, 0);
});
