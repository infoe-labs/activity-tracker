import { lazy, Suspense, useEffect, useState, type CSSProperties } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUp,
  ArrowDown,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Leaf,
  Moon,
  Play,
  Plus,
  Settings2,
  Square,
  Star,
  Sun,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { db } from "./lib/db";
import {
  addDays,
  clock,
  dateKey,
  dayStart,
  defaults,
  duration,
  totals,
  validateBackup,
  type Activity,
  type Session,
} from "./lib/model";
import { Sheet } from "./components/Sheet";
import { Button } from "./components/ui/button";
import { ActivityIcon } from "./components/ActivityIcon";
import { Timeline, DayStrip } from "./components/Timeline";
import { SessionEditor, ActivityEditor } from "./components/Editors";
import { pwa } from "./lib/pwa.js";
import {
  installationState,
  promptInstall,
  subscribeInstall,
} from "./lib/install.js";
const Analytics = lazy(() => import("./components/Analytics"));
const colorStyle = (color: string) =>
  ({ "--activity": color }) as CSSProperties;
export function downloadFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export default function App() {
  const activities =
    useLiveQuery(() => db.activities.orderBy("order").toArray(), []) ?? [];
  const sessions =
    useLiveQuery(() => db.sessions.orderBy("start").toArray(), []) ?? [];
  const [tab, setTab] = useState("Today"),
    [now, setNow] = useState(Date.now()),
    [date, setDate] = useState(dayStart()),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<Session | null>(null),
    [activityEditor, setActivityEditor] = useState<Activity | null>(null),
    [confirm, setConfirm] = useState<{
      message: string;
      action: () => Promise<unknown>;
    } | null>(null);
  const prefKey = JSON.stringify([
    "still-activity-tracker",
    import.meta.env.BASE_URL,
    "preferences",
    1,
  ]);
  const [theme, setTheme] = useState(() => {
      try {
        return (
          JSON.parse(localStorage.getItem(prefKey) ?? "{}").theme ?? "system"
        );
      } catch {
        return "system";
      }
    }),
    [hour24, setHour24] = useState(() => {
      try {
        return !!JSON.parse(localStorage.getItem(prefKey) ?? "{}").hour24;
      } catch {
        return false;
      }
    });
  const [install, setInstall] = useState(installationState()),
    [pwaState, setPwaState] = useState({
      ready: pwa.ready,
      update: pwa.update,
    });
  useEffect(() => {
    db.seed().catch(() =>
      setError(
        "Storage could not be opened. Check browser storage permissions.",
      ),
    );
    const t = setInterval(() => setNow(Date.now()), 1000);
    const vis = () => setNow(Date.now());
    document.addEventListener("visibilitychange", vis);
    const refresh = () => setPwaState({ ready: pwa.ready, update: pwa.update });
    pwa.events.addEventListener("change", refresh);
    const unsub = subscribeInstall(setInstall);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
      pwa.events.removeEventListener("change", refresh);
      unsub();
    };
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme);
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem(prefKey, JSON.stringify({ theme, hour24 }));
    } catch {
      setError("Your display preference could not be saved.");
    }
    return () => media.removeEventListener("change", apply);
  }, [theme, hour24, prefKey]);
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The change could not be saved. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const active = sessions.find((s) => s.end === null),
    activeActivity = activities.find((a) => a.id === active?.activityId);
  const time = (t: number) =>
    new Date(t).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: !hour24,
    });
  const selectedDay = tab === "Today" ? dayStart(now) : date;
  const dayEnd = addDays(selectedDay, 1);
  const daily = totals(sessions, selectedDay, dayEnd, now);
  const total = [...daily.values()].reduce((sum, v) => sum + v.ms, 0);
  const visible = sessions.filter(
    (s) => s.start < dayEnd && (s.end ?? now) > selectedDay,
  );
  const quick = activities
    .filter((a) => !a.archived)
    .sort(
      (a, b) => Number(b.favorite) - Number(a.favorite) || a.order - b.order,
    );
  function newSession() {
    const start = tab === "History" ? selectedDay + 9 * 3600000 : now - 3600000;
    setEditor({
      id: crypto.randomUUID(),
      activityId: quick[0]?.id ?? activities[0]?.id ?? "",
      start,
      end: tab === "History" ? start + 3600000 : now,
      notes: "",
    });
  }
  async function exportJson() {
    downloadFile(
      new Blob(
        [
          JSON.stringify(
            {
              version: 1,
              activities: await db.activities.toArray(),
              sessions: await db.sessions.toArray(),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "still-backup-" + dateKey(now) + ".json",
    );
  }
  async function csv() {
    const quote = (v: string) => '"' + v.replaceAll('"', '""') + '"';
    const rows = [
      ["Activity", "Start", "End", "Duration seconds", "Notes"],
      ...sessions.map((s) => [
        activities.find((a) => a.id === s.activityId)?.name ?? "",
        new Date(s.start).toISOString(),
        s.end ? new Date(s.end).toISOString() : "",
        String(Math.max(0, (s.end ?? now) - s.start) / 1000),
        s.notes,
      ]),
    ];
    downloadFile(
      new Blob(
        [
          "\uFEFF" +
            rows
              .map((r) =>
                r
                  .map((v) => quote(/^\s*[=+@-]/.test(v) ? "'" + v : v))
                  .join(","),
              )
              .join("\r\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
      "still-sessions.csv",
    );
  }
  async function reorder(a: Activity, step: number) {
    const list = [...activities];
    const i = list.findIndex((x) => x.id === a.id),
      j = i + step;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await db.transaction("rw", db.activities, () =>
      db.activities.bulkPut(list.map((x, n) => ({ ...x, order: n }))),
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("Today");
          }}
        >
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          still<span className="brand-dot">.</span>
        </a>
        <p className="brand-caption">MAKE TIME FOR WHAT MATTERS</p>
        <nav>
          {[
            ["Today", Timer],
            ["History", History],
            ["Analytics", BarChart3],
            ["Settings", Settings2],
          ].map(([name, Icon]) => {
            const I = Icon as typeof Timer;
            return (
              <button
                key={String(name)}
                className={tab === name ? "nav-item selected" : "nav-item"}
                onClick={() => setTab(String(name))}
              >
                <I size={20} />
                <span>{String(name)}</span>
                {tab === name && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span className="small-leaf">
            <Leaf size={18} />
          </span>
          <p>
            A little more intention.
            <br />
            <strong>A little more you.</strong>
          </p>
          <div className="local-badge">
            <span /> Local first. Just yours.
          </div>
        </div>
      </aside>
      <main className={tab === "Analytics" ? "main analytics-main" : "main"}>
        <header className="page-header">
          <div>
            <div className="eyebrow">
              {tab === "Today"
                ? new Date(now).toLocaleDateString([], {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : "YOUR TIME, WITH INTENTION"}
            </div>
            <h1>
              {tab === "Today"
                ? "A little focus goes a long way."
                : tab === "History"
                  ? "A day at a time."
                  : tab === "Analytics"
                    ? "See where your time goes."
                    : "Make yourself at home."}
            </h1>
            <p>
              {tab === "Today"
                ? "Make room for the things that matter."
                : tab === "History"
                  ? "Your days, thoughtfully recorded."
                  : tab === "Analytics"
                    ? "Small moments. A bigger picture."
                    : "A few preferences. A space that feels like you."}
            </p>
          </div>
          <button
            className="icon-button theme-button"
            aria-label="Toggle theme"
            onClick={() =>
              setTheme(
                document.documentElement.dataset.theme === "dark"
                  ? "light"
                  : "dark",
              )
            }
          >
            {document.documentElement.dataset.theme === "dark" ? (
              <Sun size={20} />
            ) : (
              <Moon size={20} />
            )}
          </button>
        </header>
        {error && (
          <div role="alert" className="error-banner">
            {error}
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {tab === "Today" && (
          <>
            <section
              className={"timer-panel " + (active ? "is-running" : "")}
              style={colorStyle(activeActivity?.color ?? "#577365")}
            >
              <div className="timer-top">
                <span className="eyebrow">
                  <span className={"status-dot " + (active ? "pulse" : "")} />
                  {active ? "IN THE MOMENT" : "A MOMENT OF POSSIBILITY"}
                </span>
                <span className="timer-label">
                  {active ? "Tracking now" : "Ready when you are"}
                </span>
              </div>
              <div className="timer-content">
                <div className="timer-identity">
                  <span className="active-icon">
                    {activeActivity ? (
                      <ActivityIcon activity={activeActivity} size={26} />
                    ) : (
                      <Leaf size={26} />
                    )}
                  </span>
                  <div>
                    <h2>{activeActivity?.name ?? "What’s next?"}</h2>
                    <p>
                      {active ? (
                        <button
                          className="timer-edit"
                          onClick={() => setEditor(active)}
                        >
                          {"Started at " + time(active.start)} · Edit
                        </button>
                      ) : (
                        "Choose an activity below to begin."
                      )}
                    </p>
                  </div>
                </div>
                <div className="timer-controls">
                  <div className="timer-digits">
                    {active ? clock(now - active.start) : "00:00:00"}
                  </div>
                  {active && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      className="stop-button"
                      onClick={() => run(() => db.switchTo(null))}
                    >
                      <Square size={15} fill="currentColor" /> Stop
                    </Button>
                  )}
                </div>
              </div>
              {active && now < active.start && (
                <p role="alert">
                  Your clock changed. Edit this session to correct its start
                  time.
                </p>
              )}
            </section>
            <div className="today-layout">
              <div className="tracking-column">
                <section className="quick-section">
                  <div className="section-heading">
                    <h2>What are you making time for?</h2>
                    <button
                      className="text-button"
                      onClick={() =>
                        setActivityEditor({
                          ...defaults[0],
                          id: crypto.randomUUID(),
                          name: "",
                          order: activities.length,
                        })
                      }
                    >
                      <Plus size={16} /> New activity
                    </button>
                  </div>
                  <div className="activity-grid">
                    {quick.map((a) => (
                      <button
                        disabled={busy}
                        key={a.id}
                        style={colorStyle(a.color)}
                        className={
                          "activity-button " +
                          (active?.activityId === a.id ? "active" : "")
                        }
                        onClick={() => run(() => db.switchTo(a.id))}
                      >
                        <span className="activity-icon">
                          <ActivityIcon activity={a} />
                        </span>
                        <span className="activity-name">
                          {a.name}
                          <small>
                            {duration(daily.get(a.id)?.ms ?? 0)} today
                          </small>
                        </span>
                        {active?.activityId === a.id ? (
                          <span className="equalizer">
                            <i />
                            <i />
                            <i />
                          </span>
                        ) : (
                          <Play className="activity-play" size={15} />
                        )}
                      </button>
                    ))}
                  </div>
                  {!quick.length && (
                    <p className="empty">
                      Create an activity to start making time.
                    </p>
                  )}
                  <p className="quiet-tip">
                    <span /> Switching activities automatically saves your
                    current session.
                  </p>
                </section>
                <Timeline
                  {...{
                    visible,
                    activities,
                    time,
                    now,
                    selectedDay,
                    dayEnd,
                    setEditor,
                    newSession,
                  }}
                />
              </div>
              <aside className="day-summary">
                <div className="eyebrow">TODAY, SO FAR</div>
                <h2>{duration(total)}</h2>
                <p>of intentionally tracked time</p>
                <div className="distribution-bar">
                  {activities.map((a) => (
                    <span
                      key={a.id}
                      style={{
                        background: a.color,
                        width:
                          ((daily.get(a.id)?.ms ?? 0) / Math.max(1, total)) *
                            100 +
                          "%",
                      }}
                    />
                  ))}
                </div>
                <div className="summary-legend">
                  {activities
                    .filter((a) => daily.has(a.id))
                    .map((a) => (
                      <div key={a.id}>
                        <span
                          className="color-dot"
                          style={{ background: a.color }}
                        />
                        <span>{a.name}</span>
                        <strong>{duration(daily.get(a.id)!.ms)}</strong>
                      </div>
                    ))}
                </div>
                {!total && (
                  <p className="empty">
                    Your day is a blank page.
                    <br />
                    Let’s make a little time.
                  </p>
                )}
                <button
                  className="summary-link"
                  onClick={() => setTab("Analytics")}
                >
                  Explore your time <ChevronRight size={16} />
                </button>
                <div className="summary-note">
                  <Leaf size={20} />
                  <p>
                    It’s not about doing more.
                    <br />
                    It’s about what you make time for.
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
        {tab === "History" && (
          <>
            <div className="history-toolbar">
              <div className="date-navigation">
                <button
                  className="icon-button"
                  aria-label="Previous day"
                  onClick={() => setDate(addDays(date, -1))}
                >
                  <ChevronLeft size={20} />
                </button>
                <input
                  aria-label="History date"
                  type="date"
                  value={dateKey(date)}
                  onChange={(e) =>
                    e.target.value &&
                    setDate(dayStart(new Date(e.target.value + "T12:00")))
                  }
                />
                <button
                  className="icon-button"
                  aria-label="Next day"
                  onClick={() => setDate(addDays(date, 1))}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <span>{duration(total)} tracked</span>
            </div>
            <DayStrip
              sessions={visible}
              activities={activities}
              start={selectedDay}
              end={dayEnd}
              now={now}
            />
            <Timeline
              {...{
                visible,
                activities,
                time,
                now,
                selectedDay,
                dayEnd,
                setEditor,
                newSession,
              }}
            />
          </>
        )}
        {tab === "Analytics" && (
          <Suspense
            fallback={<div className="empty">Gathering your moments…</div>}
          >
            <Analytics activities={activities} sessions={sessions} now={now} />
          </Suspense>
        )}
        {tab === "Settings" && (
          <div className="settings-layout">
            <section className="settings-section">
              <div className="section-heading">
                <h2>Your activities</h2>
                <button
                  className="text-button"
                  onClick={() =>
                    setActivityEditor({
                      ...defaults[0],
                      id: crypto.randomUUID(),
                      name: "",
                      order: activities.length,
                    })
                  }
                >
                  <Plus size={17} /> Add activity
                </button>
              </div>
              {activities.map((a, i) => (
                <div
                  className="manage-activity"
                  key={a.id}
                  style={colorStyle(a.color)}
                >
                  <button
                    className="manage-name"
                    onClick={() => setActivityEditor(a)}
                  >
                    <span className="activity-icon">
                      <ActivityIcon activity={a} />
                    </span>
                    <span>
                      {a.name}
                      {a.archived && <small>Archived</small>}
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    aria-label={"Favorite " + a.name}
                    onClick={() =>
                      run(() =>
                        db.activities.update(a.id, { favorite: !a.favorite }),
                      )
                    }
                  >
                    <Star
                      size={16}
                      fill={a.favorite ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    className="icon-button"
                    disabled={i === 0}
                    aria-label={"Move " + a.name + " up"}
                    onClick={() => run(() => reorder(a, -1))}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={i === activities.length - 1}
                    aria-label={"Move " + a.name + " down"}
                    onClick={() => run(() => reorder(a, 1))}
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
              ))}
            </section>
            <div>
              <section className="settings-section">
                <h2>Your preferences</h2>
                <label>
                  Appearance
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  >
                    <option value="system">Match device</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={hour24}
                    onChange={(e) => setHour24(e.target.checked)}
                  />{" "}
                  Use 24-hour time
                </label>
              </section>
              <section className="settings-section">
                <h2>Your data, in your hands</h2>
                <p className="muted">
                  Activities and sessions stay in this browser until you delete
                  them. Browser storage can be cleared or evicted. Keep a backup
                  of the moments you want to keep.
                </p>
                <button
                  className="setting-action"
                  onClick={() => run(exportJson)}
                >
                  <ArrowDownToLine size={18} /> Export JSON backup{" "}
                  <ChevronRight size={16} />
                </button>
                <button className="setting-action" onClick={() => run(csv)}>
                  <Download size={18} /> Export sessions as CSV{" "}
                  <ChevronRight size={16} />
                </button>
                <label className="setting-action import-label">
                  <ArrowUpFromLine size={18} /> Restore JSON backup
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      if (f.size > 30e6) {
                        setError("Backup is too large.");
                        return;
                      }
                      try {
                        const data = JSON.parse(await f.text());
                        validateBackup(data);
                        setConfirm({
                          message:
                            "Replace all current activities and sessions with this backup? Export a backup first if you want to keep your current data.",
                          action: () => db.restore(data),
                        });
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Could not read backup.",
                        );
                      }
                    }}
                  />
                </label>
                <button
                  className="setting-action"
                  onClick={() =>
                    run(async () => {
                      const granted = await navigator.storage?.persist?.();
                      if (!granted)
                        setError(
                          "Your browser did not grant persistent storage. Backups are still the best protection.",
                        );
                      else
                        setError(
                          "Persistent storage is enabled. Keep regular backups too.",
                        );
                    })
                  }
                >
                  <Check size={18} /> Request persistent storage
                </button>
                <button
                  className="setting-action danger"
                  onClick={() =>
                    setConfirm({
                      message:
                        "Permanently delete all activities and sessions? This cannot be undone. Export a backup first.",
                      action: () =>
                        db.transaction(
                          "rw",
                          db.sessions,
                          db.activities,
                          async () => {
                            await db.sessions.clear();
                            await db.activities.clear();
                            await db.activities.bulkAdd(defaults);
                          },
                        ),
                    })
                  }
                >
                  <Trash2 size={18} /> Delete tracking data
                </button>
              </section>
              <section className="settings-section">
                <h2>Always close at hand</h2>
                <p className="muted">
                  {install.installed
                    ? "Still is installed on this device."
                    : install.canPrompt
                      ? "Install Still for a quieter, full-screen experience."
                      : "To install: use your browser’s Install app menu. On iPhone, open in Safari, then Share → Add to Home Screen → Open as Web App."}
                </p>
                {install.canPrompt && (
                  <button
                    className="primary-button"
                    onClick={() => promptInstall()}
                  >
                    Install Still
                  </button>
                )}
                <p className="offline-label">
                  <span />
                  {pwaState.ready
                    ? "Offline shell ready"
                    : "Offline shell becomes available after the first production visit"}
                </p>
                {pwaState.update && (
                  <button
                    className="primary-button"
                    onClick={() => run(() => pwa.applyUpdate())}
                  >
                    Update and reload
                  </button>
                )}
              </section>
            </div>
          </div>
        )}
        <footer className="page-footer">
          <span>Less rushing. More living.</span>
          <span>
            <span className="tiny-dot" /> Saved on this device
          </span>
        </footer>
      </main>
      <nav className="bottom-nav">
        {[
          ["Today", Timer],
          ["History", CalendarDays],
          ["Analytics", BarChart3],
          ["Settings", Settings2],
        ].map(([name, Icon]) => {
          const I = Icon as typeof Timer;
          return (
            <button
              key={String(name)}
              className={tab === name ? "selected" : ""}
              onClick={() => setTab(String(name))}
            >
              <I size={21} />
              <span>{String(name)}</span>
            </button>
          );
        })}
      </nav>
      {editor && (
        <SessionEditor
          error={error}
          session={editor}
          activities={activities}
          busy={busy}
          onClose={() => setEditor(null)}
          onSave={(s) =>
            run(async () => {
              await db.saveSession(s);
              setEditor(null);
            })
          }
          onDelete={() =>
            setConfirm({
              message: "Delete this session? This cannot be undone.",
              action: async () => {
                await db.sessions.delete(editor.id);
                setEditor(null);
              },
            })
          }
          exists={sessions.some((s) => s.id === editor.id)}
        />
      )}
      {activityEditor && (
        <ActivityEditor
          error={error}
          activity={activityEditor}
          busy={busy}
          onClose={() => setActivityEditor(null)}
          onSave={(a) =>
            run(async () => {
              await db.activities.put(a);
              setActivityEditor(null);
            })
          }
          onArchive={() =>
            run(async () => {
              if (active?.activityId === activityEditor.id)
                throw Error("Stop this activity before archiving it.");
              await db.activities.update(activityEditor.id, {
                archived: !activityEditor.archived,
              });
              setActivityEditor(null);
            })
          }
          onDelete={() =>
            setConfirm({
              message: sessions.some((s) => s.activityId === activityEditor.id)
                ? "This activity has recorded sessions. Archive it instead to keep its history."
                : "Permanently delete this activity?",
              action: async () => {
                if (sessions.some((s) => s.activityId === activityEditor.id)) {
                  await db.activities.update(activityEditor.id, {
                    archived: true,
                  });
                } else await db.activities.delete(activityEditor.id);
                setActivityEditor(null);
              },
            })
          }
          exists={activities.some((a) => a.id === activityEditor.id)}
        />
      )}
      {confirm && (
        <Sheet title="A quick check" onClose={() => setConfirm(null)}>
          <p className="confirm-copy">{confirm.message}</p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              disabled={busy}
              className="primary-button"
              onClick={() =>
                run(async () => {
                  await confirm.action();
                  setConfirm(null);
                })
              }
            >
              Confirm
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
