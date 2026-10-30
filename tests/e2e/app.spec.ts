import { test, expect } from "@playwright/test";
test("one tap timers recover, switch and stop; analytics exports and presents", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Job 1", exact: false }).click();
  await expect(page.locator(".timer-identity h2")).toHaveText("Job 1");
  await page.reload();
  await expect(page.locator(".timer-identity h2")).toHaveText("Job 1");
  await page.getByRole("button", { name: "Job 2", exact: false }).click();
  await expect(page.locator(".timer-identity h2")).toHaveText("Job 2");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.locator(".timer-identity h2")).toHaveText("What’s next?");
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Analytics" })
    .click();
  await expect(
    page.getByRole("heading", { name: "A picture of your time" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Expand distribution", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close presentation" }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download distribution", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("still-distribution.png");
});
test("manual entry, edit, overlap rejection, backup and settings", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Log time", exact: true }).click();
  await page.getByLabel("Started", { exact: true }).fill("2026-10-20T23:00");
  await page.getByLabel("Ended", { exact: true }).fill("2026-10-21T01:00");
  await page.getByRole("button", { name: "Save moment" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Log time", exact: true }).click();
  await page.getByLabel("Started", { exact: true }).fill("2026-10-20T23:30");
  await page.getByLabel("Ended", { exact: true }).fill("2026-10-21T02:00");
  await page.getByRole("button", { name: "Save moment" }).click();
  await expect(page.getByRole("alert")).toContainText("overlaps");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "History" })
    .click();
  await page.getByLabel("History date").fill("2026-10-21");
  await expect(page.locator(".timeline-row")).toContainText("1h 0m");
  await page.locator(".timeline-row").click();
  await page.getByLabel("Notes optional").fill("Updated synthetic note");
  await page.getByRole("button", { name: "Save moment" }).click();
  await expect(page.locator(".timeline-row")).toContainText(
    "Updated synthetic note",
  );
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Settings" })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON backup" }).click();
  expect((await download).suggestedFilename()).toMatch(/still-backup/);
});
test("offline shell and active timer survive reload under deployment subpath", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Job 1", exact: false }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".timer-identity h2")).toHaveText("Job 1");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Analytics" })
    .click();
  await expect(
    page.getByRole("heading", { name: "A picture of your time" }),
  ).toBeVisible();
  await context.setOffline(false);
});
test("notes-only edits preserve exact timer timestamps, including short sessions", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Job 1", exact: false }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  async function readSaved() {
    return page.evaluate(async () => {
      const name = (await indexedDB.databases()).find((d) =>
        d.name?.includes('"tracking"'),
      )!.name!;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = reject;
      });
      const rows = await new Promise<{ start: number; end: number }[]>(
        (resolve, reject) => {
          const request = db
            .transaction("sessions")
            .objectStore("sessions")
            .getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = reject;
        },
      );
      db.close();
      return rows;
    });
  }
  const before = await readSaved();
  await page.locator(".timeline-row").click();
  await page.getByLabel("Notes optional").fill("A quick moment");
  await page.getByRole("button", { name: "Save moment" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await readSaved();
  expect(after[0].start).toBe(before[0].start);
  expect(after[0].end).toBe(before[0].end);
});
test("all analytics filters can be reversed and every report exports", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Job 1", exact: false }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Analytics" })
    .click();
  const distribution = page.locator(".chart-section").first();
  await distribution.locator(".analytics-legend button").first().click();
  await expect(distribution).toContainText("All tracked activities are hidden");
  await distribution.locator(".analytics-legend button").first().click();
  await expect(distribution.locator(".donut-container")).toBeVisible();
  await page.getByLabel("Analytics date range").selectOption("Custom");
  await page.getByLabel("From", { exact: true }).fill("2026-10-01");
  await page.getByLabel("Through", { exact: true }).fill("2026-10-31");
  for (const kind of ["breakdown", "trends", "patterns", "ranking"]) {
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download " + kind, exact: true })
      .click();
    expect((await download).suggestedFilename()).toBe("still-" + kind + ".png");
  }
});
test("backup restoration requires confirmation and replaces data atomically", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Settings" })
    .click();
  const now = Date.now();
  const backup = {
    version: 1,
    activities: [
      {
        id: "restored",
        name: "Restored focus",
        color: "#6366F1",
        icon: "briefcase",
        order: 0,
        archived: false,
        favorite: true,
      },
    ],
    sessions: [
      {
        id: "restored-session",
        activityId: "restored",
        start: now - 7200000,
        end: now - 3600000,
        notes: "Synthetic backup",
      },
    ],
  };
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await expect(page.getByRole("dialog")).toContainText(
    "Replace all current activities",
  );
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".manage-activity")).toHaveCount(1);
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Today", exact: true })
    .click();
  await expect(page.locator(".activity-button")).toHaveCount(1);
  await expect(page.locator(".activity-button")).toContainText(
    "Restored focus",
  );
});
