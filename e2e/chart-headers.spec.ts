import { expect, test } from "@playwright/test";

test("chart header controls fit beside metadata and composition selectors", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop header alignment");
  await page.goto("/data");
  await page.getByRole("button", { name: "Открыть образец NASA PDS" }).click();
  await expect(page.getByRole("button", { name: "Диапазон…", exact: true })).toBeVisible();
  const title = (await page.getByRole("heading", { name: "Исходный спектр", exact: true }).boundingBox())!;
  const tools = (await page.getByRole("button", { name: "Диапазон…", exact: true }).boundingBox())!;
  expect(tools.y).toBeLessThan(title.y + 52);
  await page.getByRole("link", { name: "Обработка", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Панель текущего раздела" });
  const widthBefore = await panel.evaluate((element) => element.clientWidth);
  const inputBefore = await page.getByRole("spinbutton", { name: "Гладкость базовой линии, точное значение" }).boundingBox();
  await page.getByText("Другие участки и каналы", { exact: true }).click();
  await expect(page.getByText("Участок 2", { exact: true })).toBeVisible();
  expect(await panel.evaluate((element) => element.clientWidth)).toBe(widthBefore);
  const inputAfter = await page.getByRole("spinbutton", { name: "Гладкость базовой линии, точное значение" }).boundingBox();
  expect(inputAfter!.x).toBeCloseTo(inputBefore!.x, 1);
  expect(inputAfter!.width).toBeCloseTo(inputBefore!.width, 1);
  await page.getByRole("tab", { name: "Состав", exact: true }).click();
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const channel = (await page.getByRole("combobox", { name: "Канал обработки" }).boundingBox())!;
    const hypothesis = (await page.getByRole("combobox", { name: "Гипотеза на графике" }).boundingBox())!;
    expect(hypothesis.y).toBeCloseTo(channel.y, 0);
    expect(hypothesis.x).toBeGreaterThanOrEqual(channel.x + channel.width);
    const layers = (await page.getByRole("group", { name: "Слои графика" }).boundingBox())!;
    const range = (await page.getByRole("button", { name: "Диапазон…", exact: true }).boundingBox())!;
    expect(range.x).toBeGreaterThanOrEqual(layers.x + layers.width);
    for (const button of await page.getByRole("group", { name: "Слои графика" }).getByRole("button").all()) {
      expect((await button.boundingBox())!.y).toBeCloseTo(range.y, 0);
    }
  }
  await page.getByRole("tab", { name: "Подготовка", exact: true }).click();
  await page.getByRole("button", { name: "Подсказка: Коррекция шкалы длины волны", exact: true }).first().click();
  await expect(page.getByText(/Общее смещение длин волн не применено:/).first()).toBeVisible();
});
