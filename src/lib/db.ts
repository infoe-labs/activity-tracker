import Dexie, { type Table } from "dexie";
import {
  defaults,
  validateSession,
  overlap,
  validateBackup,
  type Activity,
  type Session,
} from "./model";
export class TrackerDB extends Dexie {
  activities!: Table<Activity, string>;
  sessions!: Table<Session, string>;
  constructor(
    name = JSON.stringify([
      "still-activity-tracker",
      import.meta.env.BASE_URL,
      "tracking",
      1,
    ]),
  ) {
    super(name);
    this.version(1).stores({
      activities: "id,order",
      sessions: "id,activityId,start",
    });
  }
  async seed() {
    await this.transaction("rw", this.activities, async () => {
      if ((await this.activities.count()) === 0)
        await this.activities.bulkAdd(defaults);
    });
  }
  async switchTo(activityId: string | null, now = Date.now()) {
    await this.transaction("rw", this.sessions, this.activities, async () => {
      const all = await this.sessions.toArray();
      const active = all.filter((s) => s.end === null);
      if (active.some((s) => s.start > now))
        throw Error(
          "The device clock moved backwards. Edit the running session before continuing.",
        );
      if (active.length === 1 && active[0].activityId === activityId) return;
      if (activityId) {
        const a = await this.activities.get(activityId);
        if (!a || a.archived)
          throw Error("This activity is no longer available.");
      }
      for (const s of active) {
        if (now === s.start) await this.sessions.delete(s.id);
        else await this.sessions.update(s.id, { end: now });
      }
      if (activityId) {
        if (all.some((s) => s.end !== null && s.end > now))
          throw Error(
            "A saved entry is in the future. Edit it before starting a timer.",
          );
        await this.sessions.add({
          id: crypto.randomUUID(),
          activityId,
          start: now,
          end: null,
          notes: "",
        });
      }
    });
  }
  async saveSession(s: Session) {
    validateSession(s);
    if (s.start > Date.now() || (s.end !== null && s.end > Date.now()))
      throw Error(
        "Choose a time in the past. If your device clock changed, check it before saving.",
      );
    await this.transaction("rw", this.sessions, this.activities, async () => {
      if (!(await this.activities.get(s.activityId)))
        throw Error("Choose an activity.");
      const all = await this.sessions.toArray();
      if (all.some((x) => overlap(s, x, Math.max(Date.now(), s.end ?? 0))))
        throw Error(
          "This overlaps another session. Adjust the times or edit the conflicting entry first.",
        );
      if (s.end === null && all.some((x) => x.end === null && x.id !== s.id))
        throw Error("Another timer is already running.");
      await this.sessions.put(s);
    });
  }
  async restore(data: unknown) {
    const v = validateBackup(data);
    await this.transaction("rw", this.activities, this.sessions, async () => {
      await this.activities.clear();
      await this.sessions.clear();
      await this.activities.bulkAdd(v.activities);
      await this.sessions.bulkAdd(v.sessions);
    });
  }
}
export const db = new TrackerDB();
