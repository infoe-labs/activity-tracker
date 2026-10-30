import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TrackerDB } from "../src/lib/db";
import {
  addDays,
  dayStart,
  defaults,
  totals,
  validateBackup,
  type Session,
} from "../src/lib/model";
import { analyticsData, period } from "../src/lib/analytics";
if (!globalThis.crypto)
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
let db: TrackerDB;
beforeEach(async () => {
  db = new TrackerDB("test-" + crypto.randomUUID());
  await db.seed();
});
afterEach(async () => {
  await db.delete();
});
const session = (
  start: number,
  end: number | null,
  id = crypto.randomUUID(),
): Session => ({ id, activityId: defaults[0].id, start, end, notes: "" });
describe("transactional timer", () => {
  it("recovers a running session after a new database connection", async () => {
    await db.switchTo(defaults[0].id, 1000);
    const second = new TrackerDB(db.name);
    expect((await second.sessions.toArray())[0].start).toBe(1000);
    second.close();
  });
  it("switches at the exact same timestamp and stops", async () => {
    await db.switchTo(defaults[0].id, 1000);
    await db.switchTo(defaults[1].id, 5000);
    let rows = await db.sessions.orderBy("start").toArray();
    expect(rows.map((s) => [s.start, s.end])).toEqual([
      [1000, 5000],
      [5000, null],
    ]);
    await db.switchTo(null, 9000);
    expect(
      (await db.sessions.toArray()).filter((s) => s.end === null),
    ).toHaveLength(0);
  });
  it("serializes rapid concurrent taps across database connections", async () => {
    const other = new TrackerDB(db.name);
    await Promise.all([
      db.switchTo(defaults[0].id, 1000),
      other.switchTo(defaults[1].id, 1000),
      db.switchTo(defaults[2].id, 1000),
    ]);
    expect(
      (await db.sessions.toArray()).filter((s) => s.end === null),
    ).toHaveLength(1);
    other.close();
  });
  it("same activity taps do not restart or duplicate a timer", async () => {
    await db.switchTo(defaults[0].id, 1000);
    await db.switchTo(defaults[0].id, 2000);
    expect(await db.sessions.count()).toBe(1);
    expect((await db.sessions.toArray())[0].start).toBe(1000);
  });
  it("rejects backwards clock changes without modifying the running timer", async () => {
    await db.switchTo(defaults[0].id, 5000);
    await expect(db.switchTo(defaults[1].id, 4000)).rejects.toThrow("clock");
    expect((await db.sessions.toArray())[0].end).toBeNull();
  });
  it("rolls back switch when a future entry conflicts", async () => {
    await db.sessions.add(session(5000, 9000));
    await expect(db.switchTo(defaults[0].id, 4000)).rejects.toThrow("future");
    expect(await db.sessions.count()).toBe(1);
  });
});
describe("editing and restoration", () => {
  it("rejects overlaps and accepts adjacent sessions", async () => {
    await db.saveSession(session(1000, 3000));
    await expect(db.saveSession(session(2000, 4000))).rejects.toThrow(
      "overlaps",
    );
    await db.saveSession(session(3000, 4000));
    expect(await db.sessions.count()).toBe(2);
  });
  it("edits a session without conflicting with itself", async () => {
    const s = session(1000, 2000);
    await db.saveSession(s);
    await db.saveSession({ ...s, end: 3000, notes: "Synthetic fixture" });
    expect((await db.sessions.get(s.id))?.end).toBe(3000);
  });
  it("rejects negative durations", async () => {
    await expect(db.saveSession(session(2000, 1000))).rejects.toThrow("after");
  });
  it("preserves history when an activity is archived", async () => {
    const s = session(1000, 2000);
    await db.saveSession(s);
    await db.activities.update(s.activityId, { archived: true });
    expect((await db.sessions.get(s.id))?.activityId).toBe(s.activityId);
  });
  it("validates restore before replacing any current data", async () => {
    await db.saveSession(session(1000, 2000));
    await expect(db.restore({ version: 2 })).rejects.toThrow();
    expect(await db.sessions.count()).toBe(1);
  });
  it("rejects duplicate IDs, orphaned sessions and overlapping backups", () => {
    const s = session(1000, 3000);
    expect(() =>
      validateBackup({
        version: 1,
        activities: defaults,
        sessions: [s, { ...s, id: "other", start: 2000, end: 4000 }],
      }),
    ).toThrow("overlapping");
    expect(() =>
      validateBackup({
        version: 1,
        activities: defaults,
        sessions: [{ ...s, activityId: "unknown" }],
      }),
    ).toThrow();
    expect(() =>
      validateBackup({ version: 1, activities: defaults, sessions: [s, s] }),
    ).toThrow();
  });
  it("restores activities and sessions atomically", async () => {
    const s = session(1000, 2000);
    await db.restore({ version: 1, activities: defaults, sessions: [s] });
    expect(await db.sessions.count()).toBe(1);
    expect(await db.activities.count()).toBe(8);
  });
});
describe("local-day analytics", () => {
  it("splits overnight sessions at midnight and clips range boundaries", () => {
    const start = +new Date(2026, 9, 20, 23),
      midnight = +new Date(2026, 9, 21),
      end = +new Date(2026, 9, 21, 2);
    const s = session(start, end);
    expect(
      totals([s], dayStart(start), midnight, end).get(s.activityId)?.ms,
    ).toBe(3600000);
    expect(
      totals([s], midnight, addDays(midnight, 1), end).get(s.activityId)?.ms,
    ).toBe(7200000);
  });
  it("includes running time only through now", () => {
    const s = session(1000, null);
    expect(totals([s], 0, 10000, 5000).get(s.activityId)?.ms).toBe(4000);
  });
  it("does not generate negative durations on clock anomalies", () => {
    expect(totals([session(5000, null)], 0, 10000, 4000).size).toBe(0);
  });
  it("recalculates percentages denominator after excluding activities", () => {
    const entries = [
      session(1000, 2000),
      { ...session(2000, 5000), activityId: defaults[1].id },
    ];
    const d = analyticsData(
      defaults,
      entries,
      0,
      10000,
      10000,
      new Set([defaults[1].id]),
    );
    expect(d.total).toBe(1000);
    expect(d.entries).toHaveLength(1);
  });
  it("uses calendar midnights over daylight saving transitions", () => {
    const start = +new Date(2026, 2, 8);
    const end = addDays(start, 1);
    const ms = end - start;
    expect(ms / 3600000).toBe(23);
    const fall = +new Date(2026, 10, 1);
    expect((addDays(fall, 1) - fall) / 3600000).toBe(25);
    expect(
      totals([session(start, end)], start, end, end).get(defaults[0].id)?.ms,
    ).toBe(ms);
  });
  it("uses Monday for this week and real month boundaries", () => {
    const now = +new Date(2026, 9, 30, 12);
    const week = period("This week", now);
    expect(new Date(week[0]).getDay()).toBe(1);
    const month = period("This month", now);
    expect(new Date(month[0]).getDate()).toBe(1);
    expect(new Date(month[1]).getMonth()).toBe(10);
  });
});
