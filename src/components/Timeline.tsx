import { CalendarDays, MoreHorizontal, Plus } from "lucide-react";
import { duration, type Session, type Activity } from "../lib/model";
const colorStyle = (color: string) =>
  ({ "--activity": color }) as import("react").CSSProperties;
export function Timeline({
  visible,
  activities,
  time,
  now,
  selectedDay,
  dayEnd,
  setEditor,
  newSession,
}: {
  visible: Session[];
  activities: Activity[];
  time: (t: number) => string;
  now: number;
  selectedDay: number;
  dayEnd: number;
  setEditor: (s: Session) => void;
  newSession: () => void;
}) {
  const chronological = [...visible].sort((a, b) => a.start - b.start);
  return (
    <section className="timeline-section">
      <div className="section-heading">
        <h2>
          The day’s moments <span className="count">{visible.length}</span>
        </h2>
        <button className="text-button" onClick={newSession}>
          <Plus size={16} /> Log time
        </button>
      </div>
      {!visible.length ? (
        <div className="timeline-empty">
          <CalendarDays size={27} />
          <h3>A little space for your day.</h3>
          <p>Start an activity or log a moment that’s already passed.</p>
          <button className="secondary-button" onClick={newSession}>
            Log your first session
          </button>
        </div>
      ) : (
        <div className="timeline">
          {chronological.map((s, i) => {
            const a = activities.find((a) => a.id === s.activityId);
            const prev = chronological[i - 1];
            const gap = prev ? s.start - (prev.end ?? now) : 0;
            return (
              <div key={s.id}>
                {gap >= 60000 && (
                  <div className="gap">{duration(gap)} untracked</div>
                )}
                <button
                  className="timeline-row"
                  onClick={() => setEditor(s)}
                  style={colorStyle(a?.color ?? "#64748B")}
                >
                  <div className="timeline-time">
                    {time(Math.max(selectedDay, s.start))}
                    <small>
                      {s.start < selectedDay
                        ? "Previous day"
                        : s.end === null
                          ? "In progress"
                          : time(Math.min(s.end, dayEnd))}
                    </small>
                  </div>
                  <span className="timeline-marker" />
                  <span className="timeline-activity">
                    <strong>{a?.name ?? "Archived activity"}</strong>
                    <small>
                      {s.notes ||
                        (s.end === null
                          ? "A little focus, right now"
                          : s.end > dayEnd
                            ? "Continues next day"
                            : "")}
                    </small>
                  </span>
                  <span className="session-duration">
                    {duration(
                      Math.max(
                        0,
                        Math.min(s.end ?? now, dayEnd) -
                          Math.max(s.start, selectedDay),
                      ),
                    )}
                  </span>
                  <MoreHorizontal size={17} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
export function DayStrip({
  sessions,
  activities,
  start,
  end,
  now,
}: {
  sessions: Session[];
  activities: Activity[];
  start: number;
  end: number;
  now: number;
}) {
  return (
    <section className="day-strip">
      <div className="eyebrow">YOUR DAY AT A GLANCE</div>
      <div className="day-strip-track">
        {sessions.map((s) => (
          <span
            key={s.id}
            title={activities.find((a) => a.id === s.activityId)?.name}
            style={{
              background: activities.find((a) => a.id === s.activityId)?.color,
              left: Math.max(0, (s.start - start) / (end - start)) * 100 + "%",
              width:
                Math.max(
                  0,
                  (Math.min(s.end ?? now, end) - Math.max(s.start, start)) /
                    (end - start),
                ) *
                  100 +
                "%",
            }}
          />
        ))}
      </div>
      <div className="day-strip-labels">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>12am</span>
      </div>
    </section>
  );
}
