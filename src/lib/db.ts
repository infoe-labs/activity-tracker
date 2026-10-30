import { legacyDisposition } from "./legacy-activities";
import Dexie, { type Table } from "dexie";
import {
  validateSession,
  isAgent,
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
    this.version(2)
      .stores({ activities: "id,order", sessions: "id,activityId,start" })
      .upgrade(async (tx) => {
        const activities = await tx
          .table<Activity, string>("activities")
          .toArray();
        const sessions = await tx.table<Session, string>("sessions").toArray();
        for (const activity of activities) {
          const disposition = legacyDisposition(activity, sessions);
          if (disposition === "delete")
            await tx.table("activities").delete(activity.id);
          if (disposition === "archive")
            await tx
              .table("activities")
              .update(activity.id, { archived: true });
        }
      });
  }
  async switchTo(
    activityId: string | null,
    now = Date.now(),
    options: {
      keepAsAgent?: boolean;
      agentName?: string;
      expectedFocusId?: string;
    } = {},
  ) {
    await this.transaction("rw", this.sessions, this.activities, async () => {
      const all = await this.sessions.toArray();
      const active = all.filter((s) => s.end === null && !isAgent(s));
      if (
        options.expectedFocusId &&
        !active.some((s) => s.id === options.expectedFocusId)
      )
        throw Error(
          "Your focus changed in another tab. Close this sheet and choose again.",
        );
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
      if (options.keepAsAgent && active.length && activityId) {
        const previous = active[0];
        const agentName = (options.agentName ?? "").trim();
        if (agentName.length > 80)
          throw Error("Agent names must be 80 characters or fewer.");
        if (
          all.some(
            (s) =>
              s.end === null &&
              isAgent(s) &&
              s.activityId === previous.activityId &&
              (s.agentName ?? "") === agentName,
          )
        )
          throw Error(
            "An agent timer with this name is already running for that activity.",
          );
        await this.sessions.add({
          id: crypto.randomUUID(),
          activityId: previous.activityId,
          start: now,
          end: null,
          notes: "",
          mode: "agent",
          agentName,
        });
      }
      for (const s of active) {
        if (now === s.start) await this.sessions.delete(s.id);
        else await this.sessions.update(s.id, { end: now });
      }
      if (activityId) {
        if (all.some((s) => !isAgent(s) && s.end !== null && s.end > now))
          throw Error(
            "A saved entry is in the future. Edit it before starting a timer.",
          );
        await this.sessions.add({
          id: crypto.randomUUID(),
          activityId,
          start: now,
          end: null,
          notes: "",
          mode: "focus",
        });
      }
    });
  }
  async startAgent(activityId: string, now = Date.now(), agentName = "") {
    const name = agentName.trim();
    if (name.length > 80)
      throw Error("Agent names must be 80 characters or fewer.");
    await this.transaction("rw", this.sessions, this.activities, async () => {
      const activity = await this.activities.get(activityId);
      if (!activity || activity.archived)
        throw Error("Choose an available activity.");
      if (
        (await this.sessions.toArray()).some(
          (s) =>
            s.end === null &&
            isAgent(s) &&
            s.activityId === activityId &&
            (s.agentName ?? "") === name,
        )
      )
        return;
      await this.sessions.add({
        id: crypto.randomUUID(),
        activityId,
        start: now,
        end: null,
        mode: "agent",
        agentName: name,
        notes: "",
      });
    });
  }
  async stopSession(id: string, now = Date.now()) {
    await this.transaction("rw", this.sessions, async () => {
      const session = await this.sessions.get(id);
      if (!session || session.end !== null) return;
      if (now < session.start)
        throw Error(
          "The device clock moved backwards. Edit the session start before stopping.",
        );
      if (now === session.start) await this.sessions.delete(id);
      else await this.sessions.update(id, { end: now });
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
      if (
        !isAgent(s) &&
        all.some(
          (x) => !isAgent(x) && overlap(s, x, Math.max(Date.now(), s.end ?? 0)),
        )
      )
        throw Error(
          "This overlaps another session. Adjust the times or edit the conflicting entry first.",
        );
      if (
        !isAgent(s) &&
        s.end === null &&
        all.some((x) => !isAgent(x) && x.end === null && x.id !== s.id)
      )
        throw Error("Another timer is already running.");
      await this.sessions.put(s);
    });
  }
  async clearActivityList() {
    await this.transaction("rw", this.activities, this.sessions, async () => {
      const referenced = new Set(
        (await this.sessions.toArray()).map((s) => s.activityId),
      );
      for (const activity of await this.activities.toArray()) {
        if (referenced.has(activity.id))
          await this.activities.update(activity.id, { archived: true });
        else await this.activities.delete(activity.id);
      }
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
