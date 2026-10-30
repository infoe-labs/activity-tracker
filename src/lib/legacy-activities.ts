import { palette, type Activity, type Session } from "./model";
const legacyDefaults: Activity[] = [
  "Job 1",
  "Job 2",
  "Startup Idea",
  "Break",
  "Lunch",
  "Exercise",
  "Personal",
  "Sleep",
].map((name, i) => ({
  id: "activity-" + i,
  name,
  color: palette[i],
  icon: [
    "briefcase",
    "laptop",
    "sparkles",
    "coffee",
    "utensils",
    "heart",
    "user",
    "moon",
  ][i],
  order: i,
  archived: false,
  favorite: false,
}));

/** Upgrade only untouched bundled records; user-created/customized activities survive. */
export function isLegacyPreset(a: Activity) {
  const original = legacyDefaults.find((old) => old.id === a.id);
  return (
    !!original &&
    Object.keys(original).every(
      (key) => a[key as keyof Activity] === original[key as keyof Activity],
    )
  );
}
export function legacyDisposition(a: Activity, sessions: Session[]) {
  return !isLegacyPreset(a)
    ? "keep"
    : sessions.some((s) => s.activityId === a.id)
      ? "archive"
      : "delete";
}
