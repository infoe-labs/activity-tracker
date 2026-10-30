import {
  addDays,
  dayStart,
  dateKey,
  totals,
  type Activity,
  type Session,
} from "./model";
export type ChartKind =
  "distribution" | "breakdown" | "trends" | "patterns" | "ranking";
export const chartTitles: Record<ChartKind, string> = {
  distribution: "A picture of your time",
  breakdown: "Every day, a little different",
  trends: "Find your rhythm",
  patterns: "The shape of your days",
  ranking: "What you made time for",
};
export type RangeKey =
  | "Today"
  | "Yesterday"
  | "Last 7 days"
  | "This week"
  | "Last 30 days"
  | "This month"
  | "Custom";
export function period(key: RangeKey, now: number): [number, number] {
  const today = dayStart(now),
    d = new Date(today);
  if (key === "Yesterday") return [addDays(today, -1), today];
  if (key === "Last 7 days") return [addDays(today, -6), addDays(today, 1)];
  if (key === "Last 30 days") return [addDays(today, -29), addDays(today, 1)];
  if (key === "This week") {
    const start = addDays(today, -((d.getDay() + 6) % 7));
    return [start, addDays(start, 7)];
  }
  if (key === "This month")
    return [
      +new Date(d.getFullYear(), d.getMonth(), 1),
      +new Date(d.getFullYear(), d.getMonth() + 1, 1),
    ];
  return [today, addDays(today, 1)];
}
export function analyticsData(
  activities: Activity[],
  sessions: Session[],
  start: number,
  end: number,
  now: number,
  excluded: Set<string>,
) {
  const included = activities.filter((a) => !excluded.has(a.id));
  const summary = totals(
    sessions.filter((s) => !excluded.has(s.activityId)),
    start,
    end,
    now,
  );
  const entries = included
    .filter((a) => summary.has(a.id))
    .map((a) => ({ ...a, ...summary.get(a.id)! }));
  const total = entries.reduce((t, a) => t + a.ms, 0);
  const days: {
    timestamp: number;
    label: string;
    [key: string]: number | string;
  }[] = [];
  for (let t = start; t < end; t = addDays(t, 1)) {
    const values = totals(sessions, t, Math.min(addDays(t, 1), end), now);
    const row: {
      timestamp: number;
      label: string;
      [key: string]: number | string;
    } = {
      timestamp: t,
      label: new Date(t).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
    };
    for (const a of included) row[a.id] = (values.get(a.id)?.ms ?? 0) / 3600000;
    days.push(row);
  }
  return { entries, total, days, included };
}
export function rangeLabel(start: number, end: number) {
  const a = new Date(start),
    b = new Date(addDays(end, -1));
  return dateKey(start) === dateKey(+b)
    ? a.toLocaleDateString([], {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : a.toLocaleDateString([], { month: "short", day: "numeric" }) +
        " – " +
        b.toLocaleDateString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
}

/** Keep long ranges readable by grouping trends into calendar weeks. */
export function trendRows(data: ReturnType<typeof analyticsData>) {
  if (data.days.length <= 45) return data.days;
  const weeks = new Map<number, (typeof data.days)[number]>();
  for (const day of data.days) {
    const date = new Date(day.timestamp);
    const week = addDays(day.timestamp, -((date.getDay() + 6) % 7));
    let row = weeks.get(week);
    if (!row) {
      row = {
        timestamp: week,
        label:
          "Week of " +
          new Date(week).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          }),
      };
      for (const a of data.included) row[a.id] = 0;
      weeks.set(week, row);
    }
    for (const a of data.included)
      row[a.id] = Number(row[a.id]) + Number(day[a.id]);
  }
  return [...weeks.values()];
}

/** Parallel work occupies separate lanes instead of hiding underneath another block. */
export function patternLanes(
  sessions: Session[],
  start: number,
  end: number,
  now: number,
) {
  const lanes: Session[][] = [];
  for (const session of sessions
    .filter((s) => s.start < end && (s.end ?? now) > start)
    .sort((a, b) => a.start - b.start)) {
    let lane = lanes.find(
      (row) => (row[row.length - 1].end ?? now) <= session.start,
    );
    if (!lane) {
      lane = [];
      lanes.push(lane);
    }
    lane.push(session);
  }
  return lanes.length ? lanes : [[]];
}
