export interface Activity {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  archived: boolean;
  favorite: boolean;
}
export interface Session {
  id: string;
  activityId: string;
  start: number;
  end: number | null;
  notes: string;
  mode?: "focus" | "agent";
  agentName?: string;
}
export const palette = [
  "#6366F1",
  "#0EA5E9",
  "#A855F7",
  "#10B981",
  "#F59E0B",
  "#F97373",
  "#EC4899",
  "#64748B",
];
export function createActivity(order: number): Activity {
  return {
    id: crypto.randomUUID(),
    name: "",
    color: palette[order % palette.length],
    icon: "leaf",
    order,
    archived: false,
    favorite: false,
  };
}
export const duration = (ms: number) => {
  const m = Math.floor(Math.max(0, ms) / 60000);
  if (ms > 0 && m === 0) return "<1m";
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
export const clock = (ms: number) => {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
};
export function dayStart(date: Date | number = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return +d;
}
export function addDays(date: number, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return +d;
}
export function dateKey(date: number) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const localInput = (t: number) =>
  dateKey(t) + "T" + new Date(t).toTimeString().slice(0, 5);
export function overlap(a: Session, b: Session, now = Date.now()) {
  return a.id !== b.id && a.start < (b.end ?? now) && (a.end ?? now) > b.start;
}
export const isAgent = (session: Session) => session.mode === "agent";
export function validateSession(s: Session) {
  if (s.mode !== undefined && s.mode !== "focus" && s.mode !== "agent")
    throw Error("Invalid tracking mode.");
  if (
    s.agentName !== undefined &&
    (typeof s.agentName !== "string" || s.agentName.length > 80)
  )
    throw Error("Agent names must be 80 characters or fewer.");
  if (
    !Number.isFinite(s.start) ||
    s.start < 0 ||
    s.start > 8640000000000000 ||
    (s.end !== null &&
      (!Number.isFinite(s.end) || s.end > 8640000000000000 || s.end <= s.start))
  )
    throw Error(
      "End time must be after start time. Check the date for overnight entries.",
    );
}
export function totals(
  sessions: Session[],
  start: number,
  end: number,
  now = Date.now(),
) {
  const map = new Map<string, { ms: number; count: number }>();
  for (const s of sessions) {
    const ms = Math.max(
      0,
      Math.min(s.end ?? now, end, now) - Math.max(s.start, start),
    );
    if (ms > 0) {
      const v = map.get(s.activityId) ?? { ms: 0, count: 0 };
      map.set(s.activityId, { ms: v.ms + ms, count: v.count + 1 });
    }
  }
  return map;
}
export function validateBackup(value: unknown): {
  version: 1;
  activities: Activity[];
  sessions: Session[];
} {
  const v = value as {
    version: number;
    activities: Activity[];
    sessions: Session[];
  };
  if (
    !v ||
    v.version !== 1 ||
    !Array.isArray(v.activities) ||
    !Array.isArray(v.sessions) ||
    v.activities.length > 500 ||
    v.sessions.length > 100000
  )
    throw Error("This is not a supported Still backup.");
  const ids = new Set<string>();
  for (const a of v.activities) {
    if (
      !a ||
      typeof a.id !== "string" ||
      ids.has(a.id) ||
      typeof a.name !== "string" ||
      !a.name.trim() ||
      a.name.length > 80 ||
      !/^#[0-9a-f]{6}$/i.test(a.color) ||
      typeof a.icon !== "string" ||
      !Number.isFinite(a.order) ||
      typeof a.archived !== "boolean" ||
      typeof a.favorite !== "boolean"
    )
      throw Error("Invalid activity in backup.");
    ids.add(a.id);
  }
  const sid = new Set();
  let active = 0;
  for (const s of v.sessions) {
    if (
      !s ||
      typeof s.id !== "string" ||
      sid.has(s.id) ||
      !ids.has(s.activityId) ||
      typeof s.notes !== "string"
    )
      throw Error("Invalid session in backup.");
    validateSession(s);
    sid.add(s.id);
    if (s.end === null && !isAgent(s)) active++;
  }
  if (active > 1)
    throw Error("Backup has more than one running personal focus timer.");
  const sorted = v.sessions
    .filter((s) => !isAgent(s))
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++)
    if ((sorted[i - 1].end ?? Infinity) > sorted[i].start)
      throw Error(
        "Backup contains overlapping sessions. Resolve them before restoring.",
      );
  return v as { version: 1; activities: Activity[]; sessions: Session[] };
}
