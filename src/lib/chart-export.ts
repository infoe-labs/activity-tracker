import { type analyticsData, type ChartKind, chartTitles } from "./analytics";
import { addDays, duration, type Session } from "./model";
type ExportOptions = {
  kind: ChartKind;
  data: ReturnType<typeof analyticsData>;
  sessions: Session[];
  start: number;
  end: number;
  now: number;
  label: string;
  format: string;
  footer: boolean;
  pie: boolean;
};
export async function exportChart(o: ExportOptions): Promise<Blob> {
  const { kind, data, label, footer } = o;
  const width = o.format === "landscape" ? 1920 : 1080;
  const baseHeight = o.format === "portrait" ? 1920 : 1080;
  // Long legends and date ranges grow the report rather than silently cropping it.
  const height =
    Math.max(
      baseHeight,
      width > 1080 && kind === "distribution"
        ? 450 + data.entries.length * 66
        : 0,
      kind === "ranking"
        ? 420 + data.entries.length * 115
        : kind === "patterns"
          ? 640 + data.days.length * 34
          : kind === "distribution"
            ? (o.format === "square" ? 760 : 1160) +
              Math.ceil(data.entries.length / (width > 1080 ? 3 : 2)) * 75
            : 1050 + Math.ceil(data.entries.length / 3) * 65,
    ) + (footer ? 150 : 0);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas unavailable");
  ctx.fillStyle = "#f8f7f3";
  ctx.fillRect(0, 0, width, height);
  const pad = 72,
    inner = width - pad * 2;
  const text = (
    value: string,
    x: number,
    y: number,
    size = 26,
    color = "#29372f",
    weight = 400,
  ) => {
    ctx.fillStyle = color;
    ctx.font = weight + " " + size + "px system-ui, -apple-system, sans-serif";
    ctx.fillText(value, x, y);
  };
  const line = (
    x: number,
    y: number,
    x2: number,
    y2: number,
    color = "#dedfd8",
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const fit = (s: string, max: number) => {
    while (ctx.measureText(s).width > max && s.length > 1)
      s = s.slice(0, -2) + "…";
    return s;
  };
  text("A LITTLE TIME, WELL SPENT", pad, 95, 20, "#6d7a70", 600);
  text(chartTitles[kind], pad, 165, width > 1080 ? 64 : 49, "#263b30", 600);
  text(label, pad, 215, 26, "#788079");
  let legendY = 0;
  if (kind === "distribution") {
    const available =
      width > 1080
        ? Math.min(inner * 0.57, 650)
        : Math.min(inner * 0.9, o.format === "square" ? 400 : 790);
    const r = available / 2,
      cx = width > 1080 ? pad + r : width / 2,
      cy = width > 1080 ? 600 : 280 + r;
    let angle = -Math.PI / 2;
    for (const a of data.entries) {
      const next = angle + (a.ms / Math.max(1, data.total)) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const gap = Math.min(0.006, (next - angle) / 4);
      ctx.arc(cx, cy, r, angle + gap, next - gap);
      ctx.closePath();
      ctx.fillStyle = a.color;
      ctx.fill();
      angle = next;
    }
    if (!o.pie) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = "#f8f7f3";
      ctx.fill();
      ctx.textAlign = "center";
      text("TRACKED TIME", cx, cy - 45, 20, "#788079", 600);
      text(
        duration(data.total),
        cx,
        cy + 25,
        Math.min(r * 0.23, 70),
        "#263b30",
        600,
      );
      text(data.entries.length + " activities", cx, cy + 75, 24, "#788079");
      ctx.textAlign = "left";
    }
    if (!data.total) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "#e6e8e0";
      ctx.lineWidth = 50;
      ctx.stroke();
      ctx.textAlign = "center";
      text("No tracked time", cx, cy + 10, 35);
      ctx.textAlign = "left";
    }
    legendY = width > 1080 ? 330 : cy + r + 80;
    if (width > 1080) {
      data.entries.forEach((a, i) => {
        const x = width * 0.59,
          y = legendY + i * 66;
        ctx.fillStyle = a.color;
        ctx.fillRect(x, y - 18, 16, 16);
        text(fit(a.name, width * 0.22), x + 34, y, 26);
        text(
          duration(a.ms) +
            " · " +
            ((a.ms / Math.max(1, data.total)) * 100).toFixed(1) +
            "%",
          x + 34,
          y + 29,
          21,
          "#788079",
        );
      });
    }
  }
  if (kind === "breakdown" || kind === "trends") {
    text(duration(data.total), pad, 310, 64, "#263b30", 600);
    text(
      "tracked across " + data.days.length + " days",
      pad,
      353,
      24,
      "#788079",
    );
    const x = pad + 55,
      y = 430,
      w = inner - 65,
      h = 480;
    const max = Math.max(
      1,
      ...data.days.map((d) =>
        kind === "breakdown"
          ? data.included.reduce((s, a) => s + Number(d[a.id] ?? 0), 0)
          : Math.max(0, ...data.included.map((a) => Number(d[a.id] ?? 0))),
      ),
    );
    for (let i = 0; i <= 4; i++) {
      const yy = y + h - (h * i) / 4;
      line(x, yy, x + w, yy);
      text(((max * i) / 4).toFixed(1) + "h", pad, yy + 7, 18, "#788079");
    }
    if (kind === "breakdown") {
      const bw = w / Math.max(1, data.days.length);
      data.days.forEach((d, i) => {
        let bottom = y + h;
        data.included.forEach((a) => {
          const hh = (Number(d[a.id] ?? 0) / max) * h;
          ctx.fillStyle = a.color;
          ctx.fillRect(
            x + i * bw + bw * 0.15,
            bottom - hh,
            Math.max(1, bw * 0.7),
            hh,
          );
          bottom -= hh;
        });
      });
    } else {
      for (const a of data.included) {
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        data.days.forEach((d, i) => {
          const xx =
              x +
              (data.days.length === 1 ? 0.5 : i / (data.days.length - 1)) * w,
            yy = y + h - (Number(d[a.id] ?? 0) / max) * h;
          i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
        });
        ctx.stroke();
        if (data.days.length === 1) {
          ctx.beginPath();
          ctx.arc(
            x + w / 2,
            y + h - (Number(data.days[0][a.id] ?? 0) / max) * h,
            6,
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = a.color;
          ctx.fill();
        }
      }
    }
    data.days.forEach((d, i) => {
      if (i % Math.max(1, Math.ceil(data.days.length / 7)) === 0)
        text(
          d.label,
          x + (i / data.days.length) * w,
          y + h + 35,
          18,
          "#788079",
        );
    });
    legendY = 1020;
  }
  if (kind === "patterns") {
    text(duration(data.total) + " tracked", pad, 310, 50, "#263b30", 600);
    const x = pad + 120,
      w = inner - 120;
    [0, 6, 12, 18, 24].forEach((h) =>
      text(
        String(h).padStart(2, "0") + ":00",
        x + (h / 24) * w - 20,
        382,
        20,
        "#788079",
      ),
    );
    data.days.forEach((day, i) => {
      const t = day.timestamp,
        end = addDays(t, 1),
        y = 410 + i * 34;
      ctx.fillStyle = "#e9eae4";
      ctx.fillRect(x, y, w, 23);
      text(day.label, pad, y + 19, 20, "#788079");
      o.sessions
        .filter(
          (s) =>
            s.start < end &&
            (s.end ?? o.now) > t &&
            data.included.some((a) => a.id === s.activityId),
        )
        .forEach((s) => {
          ctx.fillStyle = data.included.find(
            (a) => a.id === s.activityId,
          )!.color;
          ctx.fillRect(
            x + ((Math.max(s.start, t) - t) / (end - t)) * w,
            y,
            Math.max(
              1,
              ((Math.min(s.end ?? o.now, end) - Math.max(s.start, t)) /
                (end - t)) *
                w,
            ),
            23,
          );
        });
    });
    legendY = 470 + data.days.length * 34;
  }
  if (kind === "ranking") {
    text(duration(data.total) + " tracked", pad, 310, 50, "#263b30", 600);
    [...data.entries]
      .sort((a, b) => b.ms - a.ms)
      .forEach((a, i) => {
        const y = 400 + i * 115;
        text(String(i + 1).padStart(2, "0"), pad, y, 23, "#9a9f98");
        text(fit(a.name, inner - 380), pad + 65, y, 28, "#29372f", 600);
        ctx.textAlign = "right";
        text(
          duration(a.ms) + " · " + ((a.ms / data.total) * 100).toFixed(1) + "%",
          width - pad,
          y,
          25,
        );
        ctx.textAlign = "left";
        ctx.fillStyle = "#e4e6df";
        ctx.fillRect(pad + 65, y + 20, inner - 65, 10);
        ctx.fillStyle = a.color;
        ctx.fillRect(pad + 65, y + 20, ((inner - 65) * a.ms) / data.total, 10);
        text(
          a.count + " sessions · " + duration(a.ms / a.count) + " average",
          pad + 65,
          y + 63,
          21,
          "#788079",
        );
      });
  }
  if (kind !== "ranking" && !(kind === "distribution" && width > 1080)) {
    const columns = kind === "distribution" ? 2 : 3;
    const cw = inner / columns;
    data.entries.forEach((a, i) => {
      const x = pad + (i % columns) * cw,
        y = legendY + Math.floor(i / columns) * 75;
      ctx.fillStyle = a.color;
      ctx.fillRect(x, y - 18, 15, 15);
      ctx.font = "500 24px system-ui";
      text(fit(a.name, cw - 45), x + 30, y, 24, "#29372f", 500);
      text(
        duration(a.ms) + " · " + ((a.ms / data.total) * 100).toFixed(1) + "%",
        x + 30,
        y + 30,
        21,
        "#788079",
      );
    });
  }
  if (footer) {
    line(pad, height - 100, width - pad, height - 100);
    text(
      "still.   Make time for what matters.",
      pad,
      height - 50,
      22,
      "#788079",
    );
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(Error("PNG generation failed"))),
      "image/png",
    ),
  );
}
