import { useState, type FormEvent } from "react";
import { Archive, Check, Trash2 } from "lucide-react";
import { localInput, palette, type Session, type Activity } from "../lib/model";
import { Sheet } from "./Sheet";
import { icons } from "./ActivityIcon";
export function SessionEditor({
  error,
  session,
  activities,
  busy,
  onClose,
  onSave,
  onDelete,
  exists,
}: {
  error: string;
  session: Session;
  activities: Activity[];
  busy: boolean;
  onClose: () => void;
  onSave: (s: Session) => void;
  onDelete: () => void;
  exists: boolean;
}) {
  const [activityId, setActivityId] = useState(session.activityId),
    [start, setStart] = useState(localInput(session.start)),
    [end, setEnd] = useState(
      session.end === null ? "" : localInput(session.end),
    ),
    [notes, setNotes] = useState(session.notes),
    [formError, setFormError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const s = {
      ...session,
      activityId,
      start:
        start === localInput(session.start) ? session.start : +new Date(start),
      end: end
        ? session.end !== null && end === localInput(session.end)
          ? session.end
          : +new Date(end)
        : null,
      notes,
    };
    if (!activityId || !start || (!end && session.end !== null)) {
      setFormError("Choose an activity and both times.");
      return;
    }
    onSave(s);
  };
  return (
    <Sheet
      title={exists ? "Edit this moment" : "Log a moment"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>
          Activity
          <select
            required
            value={activityId}
            onChange={(e) => setActivityId(e.target.value)}
          >
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Started
          <input
            type="datetime-local"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          {session.end === null
            ? "End time (leave empty to keep running)"
            : "Ended"}
          <input
            type="datetime-local"
            required={session.end !== null}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        {end && start && (
          <label>
            Duration in minutes
            <input
              type="number"
              min="0"
              value={Math.max(
                0,
                Math.round((+new Date(end) - +new Date(start)) / 60000),
              )}
              onChange={(e) =>
                setEnd(
                  localInput(+new Date(start) + Number(e.target.value) * 60000),
                )
              }
            />
          </label>
        )}
        <p className="field-hint">
          For overnight sessions, choose the following day as the end date.
          Overlapping entries must be adjusted before saving.
        </p>
        <label>
          Notes <span className="muted">optional</span>
          <textarea
            maxLength={3000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="A little context, if you like…"
          />
        </label>
        {(formError || error) && (
          <p role="alert" className="form-error">
            {formError || error}
          </p>
        )}
        <div className="form-actions">
          {exists && (
            <button
              type="button"
              className="icon-button danger"
              aria-label="Delete session"
              onClick={onDelete}
            >
              <Trash2 size={19} />
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy} className="primary-button">
            Save moment
          </button>
        </div>
      </form>
    </Sheet>
  );
}
export function ActivityEditor({
  error,
  activity,
  busy,
  onClose,
  onSave,
  onArchive,
  onDelete,
  exists,
}: {
  error: string;
  activity: Activity;
  busy: boolean;
  onClose: () => void;
  onSave: (a: Activity) => void;
  onArchive: () => void;
  onDelete: () => void;
  exists: boolean;
}) {
  const [a, setA] = useState(activity);
  return (
    <Sheet
      title={exists ? "Shape your activity" : "Make time for something"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (a.name.trim()) onSave({ ...a, name: a.name.trim() });
        }}
      >
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <label>
          Name
          <input
            autoFocus
            required
            maxLength={80}
            placeholder="What matters to you?"
            value={a.name}
            onChange={(e) => setA({ ...a, name: e.target.value })}
          />
        </label>
        <label>Color</label>
        <div className="color-picker">
          {palette.map((c) => (
            <button
              type="button"
              key={c}
              aria-label={"Choose " + c}
              aria-pressed={a.color === c}
              style={{ background: c }}
              onClick={() => setA({ ...a, color: c })}
            >
              {a.color === c && <Check size={20} />}
            </button>
          ))}
          <input
            aria-label="Custom activity color"
            type="color"
            value={a.color}
            onChange={(e) => setA({ ...a, color: e.target.value })}
          />
        </div>
        <label>Icon</label>
        <div className="icon-picker">
          {Object.entries(icons).map(([key, Icon]) => (
            <button
              type="button"
              className={"icon-button " + (a.icon === key ? "chosen" : "")}
              key={key}
              aria-label={key}
              aria-pressed={a.icon === key}
              onClick={() => setA({ ...a, icon: key })}
            >
              <Icon size={23} />
            </button>
          ))}
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={a.favorite}
            onChange={(e) => setA({ ...a, favorite: e.target.checked })}
          />{" "}
          Keep this activity at the top
        </label>
        {exists && (
          <div className="archive-actions">
            <button type="button" className="text-button" onClick={onArchive}>
              <Archive size={16} />
              {a.archived ? "Unarchive" : "Archive activity"}
            </button>
            <button
              type="button"
              className="text-button danger"
              onClick={onDelete}
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy} className="primary-button">
            Save activity
          </button>
        </div>
      </form>
    </Sheet>
  );
}
