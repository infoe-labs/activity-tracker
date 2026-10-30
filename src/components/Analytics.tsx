import { useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  Share2,
  X,
} from "lucide-react";
import {
  addDays,
  dateKey,
  dayStart,
  duration,
  isAgent,
  type Activity,
  type Session,
} from "../lib/model";
import {
  analyticsData,
  chartTitles,
  period,
  rangeLabel,
  trendRows,
  patternLanes,
  type ChartKind,
  type RangeKey,
} from "../lib/analytics";
import { exportChart } from "../lib/chart-export";
const kinds: ChartKind[] = [
  "distribution",
  "breakdown",
  "trends",
  "patterns",
  "ranking",
];
export default function Analytics({
  activities,
  sessions,
  now,
}: {
  activities: Activity[];
  sessions: Session[];
  now: number;
}) {
  const [scope, setScope] = useState<"focus" | "agent" | "combined">("focus");
  const scopedSessions = sessions.filter(
    (s) =>
      scope === "combined" || (scope === "agent" ? isAgent(s) : !isAgent(s)),
  );
  const scopeLabel =
    scope === "focus"
      ? "Personal focus"
      : scope === "agent"
        ? "AI agent-hours"
        : "Combined effort";
  const [range, setRange] = useState<RangeKey>("Last 7 days"),
    [bounds, setBounds] = useState<[number, number]>(() =>
      period("Last 7 days", now),
    ),
    [excluded, setExcluded] = useState(new Set<string>()),
    [expanded, setExpanded] = useState<ChartKind | null>(null),
    [pie, setPie] = useState(false),
    [focus, setFocus] = useState<string | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [exporting, setExporting] = useState(false),
    [message, setMessage] = useState(""),
    [format, setFormat] = useState("portrait"),
    [footer, setFooter] = useState(false);
  const [start, end] = bounds;
  const minute = Math.floor(now / 10000);
  const data = useMemo(
    () => analyticsData(activities, scopedSessions, start, end, now, excluded),
    [activities, sessions, start, end, minute, excluded, scope],
  );
  const label = rangeLabel(start, end);
  const trends = trendRows(data);
  const presentationRef = useRef<HTMLDivElement>(null);
  function toggle(id: string) {
    setExcluded((old) => {
      const v = new Set(old);
      v.has(id) ? v.delete(id) : v.add(id);
      return v;
    });
    if (focus === id) setFocus(null);
  }
  function shift(direction: number) {
    if (range === "This month") {
      setBounds(([a, b]) => {
        const d = new Date(a),
          e = new Date(b);
        return [
          +new Date(d.getFullYear(), d.getMonth() + direction, 1),
          +new Date(e.getFullYear(), e.getMonth() + direction, 1),
        ];
      });
    } else {
      const days = Math.round((dayStart(end) - dayStart(start)) / 86400000);
      setBounds([
        addDays(start, days * direction),
        addDays(end, days * direction),
      ]);
    }
  }
  async function save(kind: ChartKind, share: boolean) {
    setExporting(true);
    setMessage("");
    try {
      const blob = await exportChart({
        kind,
        data:
          kind === "trends"
            ? {
                ...data,
                days: trends,
                ...(focus
                  ? {
                      included: data.included.filter((a) => a.id === focus),
                      entries: data.entries.filter((a) => a.id === focus),
                      total: data.entries.find((a) => a.id === focus)?.ms ?? 0,
                    }
                  : {}),
              }
            : data,
        sessions: scopedSessions,
        scopeLabel,
        start,
        end,
        now,
        label,
        format,
        footer,
        pie,
      });
      const file = new File([blob], "still-" + kind + ".png", {
        type: "image/png",
      });
      if (share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: chartTitles[kind] });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError")
            return;
          // Some Safari versions expire user activation during Canvas rendering.
          // Keep the generated file and continue with the local download fallback.
        }
      }
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage("Your chart is ready in Downloads.");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setMessage(
          "Image export could not finish. Try downloading again, or use presentation mode for a screenshot.",
        );
    } finally {
      setExporting(false);
    }
  }
  const legend = (
    <div className="analytics-legend">
      {activities
        .filter(
          (a) => data.entries.some((e) => e.id === a.id) || excluded.has(a.id),
        )
        .map((a) => {
          const entry = data.entries.find((e) => e.id === a.id);
          return (
            <button
              className={excluded.has(a.id) ? "excluded" : ""}
              key={a.id}
              aria-pressed={!excluded.has(a.id)}
              onClick={() => toggle(a.id)}
            >
              <span className="color-dot" style={{ background: a.color }} />
              <span>{a.name}</span>
              <strong>{duration(entry?.ms ?? 0)}</strong>
              <small>
                {data.total && entry
                  ? ((entry.ms / data.total) * 100).toFixed(1)
                  : "0"}
                %
              </small>
            </button>
          );
        })}
    </div>
  );
  function chart(kind: ChartKind, large = false) {
    if (!data.total)
      return (
        <>
          <div className="chart-empty">
            <span className="empty-ring" />
            <h3>Room for a new rhythm.</h3>
            <p>
              {excluded.size
                ? "All tracked activities are hidden. Toggle an activity below to include it."
                : "Track a moment to see your time take shape."}
            </p>
          </div>
          {excluded.size > 0 && legend}
        </>
      );
    if (kind === "distribution")
      return (
        <>
          <div className={"donut-container " + (large ? "large" : "")}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.entries}
                  dataKey="ms"
                  nameKey="name"
                  startAngle={90}
                  endAngle={-270}
                  cx="50%"
                  cy="50%"
                  innerRadius={pie ? 0 : "72%"}
                  outerRadius="94%"
                  paddingAngle={data.entries.length > 1 ? 3 : 0}
                  cornerRadius={4}
                  stroke="none"
                  isAnimationActive={false}
                  onClick={(_, index) =>
                    setSelected(data.entries[index]?.id ?? null)
                  }
                >
                  {data.entries.map((a) => (
                    <Cell
                      key={a.id}
                      fill={a.color}
                      opacity={selected && selected !== a.id ? 0.45 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => duration(Number(v))}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {!pie && (
              <div className="donut-center">
                <span className="eyebrow">{scopeLabel.toUpperCase()}</span>
                <strong>{duration(data.total)}</strong>
                <small>{data.entries.length} activities, one life</small>
              </div>
            )}
          </div>
          {selected && (
            <button
              className="selection-detail"
              onClick={() => setSelected(null)}
            >
              {data.entries.find((a) => a.id === selected)?.name} ·{" "}
              {duration(data.entries.find((a) => a.id === selected)?.ms ?? 0)}{" "}
              <X size={14} />
            </button>
          )}
          {legend}
        </>
      );
    if (kind === "breakdown")
      return (
        <>
          <div className="chart-scroll">
            <div
              style={{
                minWidth: Math.max(300, data.days.length * 30),
                height: large ? 440 : 330,
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.days}
                  margin={{ top: 20, right: 10, bottom: 5, left: -24 }}
                >
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted)" }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={30}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted)" }}
                    axisLine={false}
                    tickLine={false}
                    unit="h"
                  />
                  <Tooltip
                    formatter={(v) => duration(Number(v) * 3600000)}
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                    cursor={{ fill: "var(--hover)" }}
                  />
                  {data.included.map((a) => (
                    <Bar
                      key={a.id}
                      dataKey={a.id}
                      name={a.name}
                      stackId="day"
                      fill={a.color}
                      maxBarSize={42}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {legend}
        </>
      );
    if (kind === "trends")
      return (
        <>
          <div className="focus-controls">
            <button
              className={!focus ? "chosen" : ""}
              onClick={() => setFocus(null)}
            >
              All activities
            </button>
            {data.entries.map((a) => (
              <button
                style={{ color: a.color }}
                className={focus === a.id ? "chosen" : ""}
                key={a.id}
                onClick={() => setFocus(focus === a.id ? null : a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
          <div className="line-chart">
            <ResponsiveContainer width="100%" height={large ? 440 : 330}>
              <LineChart
                data={trends}
                margin={{ top: 20, right: 15, bottom: 5, left: -24 }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={35}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                  unit="h"
                />
                <Tooltip
                  formatter={(v) => duration(Number(v) * 3600000)}
                  trigger="click"
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                  }}
                />
                {data.included
                  .filter((a) => !focus || a.id === focus)
                  .map((a) => (
                    <Line
                      key={a.id}
                      type="monotone"
                      dataKey={a.id}
                      name={a.name}
                      stroke={a.color}
                      strokeWidth={2.5}
                      dot={trends.length < 15 ? { r: 3 } : false}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {legend}
        </>
      );
    if (kind === "patterns")
      return (
        <>
          <div className="pattern-labels">
            <span />
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>24</span>
          </div>
          <div className="patterns">
            {data.days.map((day) => {
              const t = day.timestamp,
                e = addDays(t, 1);
              const lanes = patternLanes(
                scopedSessions.filter((s) => !excluded.has(s.activityId)),
                t,
                e,
                now,
              );
              return (
                <div className="pattern-row" key={t}>
                  <span>
                    {new Date(t).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <div style={{ height: lanes.length * 44 }}>
                    {lanes.flatMap((lane, laneIndex) =>
                      lane.map((s) => {
                        const a = activities.find((a) => a.id === s.activityId);
                        return (
                          <button
                            key={s.id}
                            title={
                              a?.name +
                              " · " +
                              duration(
                                Math.min(s.end ?? now, e) -
                                  Math.max(s.start, t),
                              )
                            }
                            aria-label={
                              a?.name +
                              " " +
                              new Date(s.start).toLocaleTimeString()
                            }
                            onClick={() =>
                              setMessage(
                                (a?.name ?? "Activity") +
                                  " · " +
                                  new Date(s.start).toLocaleString() +
                                  " · " +
                                  duration(
                                    Math.min(s.end ?? now, e) -
                                      Math.max(s.start, t),
                                  ),
                              )
                            }
                            style={{
                              background: a?.color,
                              top: laneIndex * 44,
                              left:
                                ((Math.max(t, s.start) - t) / (e - t)) * 100 +
                                "%",
                              width:
                                Math.max(
                                  0.4,
                                  ((Math.min(e, s.end ?? now) -
                                    Math.max(t, s.start)) /
                                    (e - t)) *
                                    100,
                                ) + "%",
                            }}
                          />
                        );
                      }),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {legend}
        </>
      );
    return (
      <div className="ranking">
        {[...data.entries]
          .sort((a, b) => b.ms - a.ms)
          .map((a, i) => (
            <div className="ranking-row" key={a.id}>
              <span className="rank-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="rank-detail">
                <div>
                  <strong>{a.name}</strong>
                  <strong>
                    {duration(a.ms)}{" "}
                    <small>{((a.ms / data.total) * 100).toFixed(1)}%</small>
                  </strong>
                </div>
                <div className="rank-bar">
                  <span
                    style={{
                      width: (a.ms / data.total) * 100 + "%",
                      background: a.color,
                    }}
                  />
                </div>
                <p>
                  {a.count} session{a.count === 1 ? "" : "s"} <span>·</span>{" "}
                  {duration(a.ms / a.count)} average
                </p>
              </div>
            </div>
          ))}
      </div>
    );
  }
  return (
    <>
      <div className="analytics-scope">
        <label>
          Whose work?
          <select
            aria-label="Analytics tracking mode"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as typeof scope);
              setSelected(null);
            }}
          >
            <option value="focus">My personal focus</option>
            <option value="agent">AI agent work</option>
            <option value="combined">Combined effort</option>
          </select>
        </label>
        <p>
          {scope === "focus"
            ? "Your own time, without parallel agent work."
            : scope === "agent"
              ? "Agent-hours include work running in parallel."
              : "Personal time plus agent-hours. Concurrent work adds effort, not elapsed calendar time."}
        </p>
      </div>
      <div className="analytics-toolbar">
        <div className="range-control">
          <select
            aria-label="Analytics date range"
            value={range}
            onChange={(e) => {
              const value = e.target.value as RangeKey;
              setRange(value);
              if (value !== "Custom") setBounds(period(value, now));
            }}
          >
            {[
              "Today",
              "Yesterday",
              "Last 7 days",
              "This week",
              "Last 30 days",
              "This month",
              "Custom",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <button
            className="icon-button"
            aria-label="Previous period"
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Next period"
            onClick={() => shift(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <span>{label}</span>
      </div>
      {range === "Custom" && (
        <div className="custom-dates">
          <label>
            From
            <input
              type="date"
              value={dateKey(start)}
              onChange={(e) => {
                if (e.target.value) {
                  const t = dayStart(new Date(e.target.value + "T12:00"));
                  if (t < end && end - t < 370 * 86400000) setBounds([t, end]);
                  else
                    setMessage(
                      "Choose a range of up to one year, ending after the start.",
                    );
                }
              }}
            />
          </label>
          <label>
            Through
            <input
              type="date"
              value={dateKey(addDays(end, -1))}
              onChange={(e) => {
                if (e.target.value) {
                  const t = addDays(
                    dayStart(new Date(e.target.value + "T12:00")),
                    1,
                  );
                  if (t > start && t - start < 370 * 86400000)
                    setBounds([start, t]);
                  else
                    setMessage(
                      "Choose a range of up to one year, ending after the start.",
                    );
                }
              }}
            />
          </label>
        </div>
      )}
      <div className="analytics-stats">
        <div>
          <span className="eyebrow">{scopeLabel.toUpperCase()}</span>
          <strong>{duration(data.total)}</strong>
        </div>
        <div>
          <span className="eyebrow">DAILY AVERAGE</span>
          <strong>
            {duration(data.total / Math.max(1, data.days.length))}
          </strong>
        </div>
        <div>
          <span className="eyebrow">MOMENTS RECORDED</span>
          <strong>{data.entries.reduce((s, a) => s + a.count, 0)}</strong>
        </div>
      </div>
      <div className="export-preferences">
        <label>
          Image layout
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="portrait">Portrait · 1080 × 1920</option>
            <option value="square">Square · 1080 × 1080</option>
            <option value="landscape">Landscape · 1920 × 1080</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={footer}
            onChange={(e) => setFooter(e.target.checked)}
          />{" "}
          Add Still footer
        </label>
      </div>
      {message && (
        <div role="status" className="info-banner">
          {message}
          <button
            className="icon-button"
            aria-label="Dismiss"
            onClick={() => setMessage("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <div className="chart-sections">
        {kinds.map((kind, i) => (
          <section className="chart-section" key={kind}>
            <div className="chart-heading">
              <div>
                <div className="eyebrow">
                  0{i + 1} /{" "}
                  {kind === "distribution"
                    ? "ACTIVITY DISTRIBUTION"
                    : kind === "breakdown"
                      ? "DAILY BREAKDOWN"
                      : kind === "trends"
                        ? "ACTIVITY TRENDS"
                        : kind === "patterns"
                          ? "TIME-OF-DAY PATTERNS"
                          : "ACTIVITY RANKING"}
                </div>
                <h2>{chartTitles[kind]}</h2>
              </div>
              <div className="chart-actions">
                <button
                  className="icon-button"
                  aria-label={"Expand " + kind}
                  onClick={() => {
                    setExpanded(kind);
                    document.body.style.overflow = "hidden";
                  }}
                >
                  <Expand size={18} />
                </button>
                <button
                  className="icon-button"
                  disabled={exporting}
                  aria-label={"Share " + kind}
                  onClick={() => save(kind, true)}
                >
                  <Share2 size={18} />
                </button>
                <button
                  className="icon-button"
                  disabled={exporting}
                  aria-label={"Download " + kind}
                  onClick={() => save(kind, false)}
                >
                  <Download size={18} />
                </button>
              </div>
            </div>
            {kind === "distribution" && (
              <div className="chart-mode">
                <button
                  className={!pie ? "chosen" : ""}
                  onClick={() => setPie(false)}
                >
                  Donut
                </button>
                <button
                  className={pie ? "chosen" : ""}
                  onClick={() => setPie(true)}
                >
                  Pie
                </button>
              </div>
            )}
            {chart(kind)}
            <div className="chart-footnote">
              {kind === "distribution"
                ? "Tap a segment to inspect. Tap a legend item to include or exclude."
                : kind === "patterns"
                  ? "Each row is a local day. Empty space is untracked time."
                  : kind === "trends"
                    ? "Tap the chart to inspect a day. Choose an activity to focus."
                    : "Calculated from your saved moments, including running timers."}
            </div>
          </section>
        ))}
      </div>
      {expanded && (
        <div
          className="presentation"
          role="dialog"
          aria-modal="true"
          aria-label={chartTitles[expanded]}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setExpanded(null);
              document.body.style.overflow = "";
            }
            if (e.key === "Tab") {
              const nodes =
                presentationRef.current?.querySelectorAll<HTMLElement>(
                  "button:not(:disabled)",
                );
              if (nodes?.length) {
                const first = nodes[0],
                  last = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }
          }}
          ref={presentationRef}
        >
          <div className="presentation-controls">
            <button
              autoFocus
              className="icon-button"
              aria-label="Close presentation"
              onClick={() => {
                setExpanded(null);
                document.body.style.overflow = "";
              }}
            >
              <X size={24} />
            </button>
            <div>
              <button
                className="icon-button"
                disabled={exporting}
                aria-label="Download image"
                onClick={() => save(expanded, false)}
              >
                <Download size={20} />
              </button>
              <button
                className="icon-button"
                disabled={exporting}
                aria-label="Share image"
                onClick={() => save(expanded, true)}
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
          <div className={"presentation-report presentation-" + expanded}>
            <div className="eyebrow">A LITTLE TIME, WELL SPENT</div>
            <h1>{chartTitles[expanded]}</h1>
            <p className="presentation-date">
              {label} · {scopeLabel}
            </p>
            {expanded !== "distribution" && (
              <div className="presentation-total">
                {duration(data.total)} <span>tracked</span>
              </div>
            )}
            {chart(expanded, true)}
          </div>
        </div>
      )}
    </>
  );
}
