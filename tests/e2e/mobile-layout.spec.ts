import { test, expect } from "@playwright/test";
test.use({ isMobile: true, hasTouch: true });
test("mobile pages and sheets retain gutters without horizontal overflow", async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("./");
    for (const tab of ["Today", "History", "Analytics", "Settings"]) {
      await page
        .locator(".bottom-nav")
        .getByRole("button", { name: tab, exact: true })
        .click();
      await expect(page.locator(".page-header")).toBeVisible();
      const bounds = await page.evaluate(() => {
        const main = document.querySelector(".main")!;
        const style = getComputedStyle(main);
        return {
          left: parseFloat(style.paddingLeft),
          right: parseFloat(style.paddingRight),
          overflow:
            document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      });
      expect(bounds.left).toBeGreaterThanOrEqual(24);
      expect(bounds.right).toBeGreaterThanOrEqual(24);
      expect(bounds.overflow).toBe(false);
    }
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "Today", exact: true })
      .click();
    await page
      .getByRole("button", { name: "New activity", exact: true })
      .click();
    const name = page.getByLabel("Name", { exact: true });
    await name.focus();
    const field = await name.evaluate((input) => {
      const sheet = input.closest(".sheet")!.getBoundingClientRect();
      const rect = input.getBoundingClientRect();
      return {
        left: rect.left - sheet.left,
        right: sheet.right - rect.right,
        font: parseFloat(getComputedStyle(input).fontSize),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    expect(field.left).toBeGreaterThanOrEqual(24);
    expect(field.right).toBeGreaterThanOrEqual(24);
    expect(field.font).toBeGreaterThanOrEqual(16);
    expect(field.overflow).toBe(false);
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
});
