/**
 * Stepped progress UI for the download spine (ticket 05 / ADR-0002).
 *
 * `graflet <slug>` spends ~30s inside two network legs — a ~40 MB codeload
 * tarball and the broker's KG bundle — and used to print NOTHING until the
 * final summary line. Users read the silence as a hang. This module is the
 * only thing that speaks during those legs.
 *
 * Two shapes, one API:
 *   • TTY      — a live multi-line frame redrawn in place on an ~80ms tick:
 *                braille spinner, a 12-cell bar per step that knows its size.
 *   • non-TTY  — one plain line per step, emitted when that step COMPLETES,
 *                with zero ANSI bytes. Piped output and CI logs are files, and
 *                a file full of cursor-up escapes is unreadable garbage.
 *
 * Everything here goes to STDERR. The caller keeps stdout for exactly one line —
 * the absolute destination path — so `graflet react > where.txt` yields a path
 * and nothing else. The write sink is injectable purely so tests can assert bytes.
 *
 * Why you rarely see a percentage: a null `total` is the NORMAL case for both
 * legs today, not a bug. codeload.github.com answers node's fetch over HTTP/1.1
 * with `transfer-encoding: chunked` and no `content-length` (curl sees one only
 * because it negotiates HTTP/2; `accept-encoding: identity` does not change it),
 * and the KG broker is a Worker streaming a body, which sends none either. So
 * both legs degrade to a live bytes-so-far counter — enough to prove the thing
 * is moving, which is the entire job. The bar/percentage branch stays because it
 * is correct the moment a total does arrive (the broker could forward one in a
 * line of Worker code) and it costs five lines.
 *
 * ADR-0002 alignment is unaffected: the caller checks the sha from the KG
 * response HEADERS before a byte is written, then runs both legs concurrently,
 * so a mismatch still leaves nothing on disk. This module only draws.
 */

export type StepState = "pending" | "active" | "done" | "failed";

export interface StepView {
  id: string;
  label: string;
  state: StepState;
  /** Bytes so far; 0 when the step isn't byte-shaped (e.g. resolving a pin). */
  done: number;
  /** null = size unknown → no bar, no percentage. */
  total: number | null;
  /** done: "149 files (40 MB)" · failed: "connection reset". */
  detail: string;
}

export interface Progress {
  begin(id: string): void;
  update(id: string, done: number, total: number | null): void;
  finish(id: string, detail: string): void;
  fail(id: string, reason: string): void;
  stop(): void;
}

export interface ProgressOptions {
  isTTY?: boolean;
  write?: (chunk: string) => void;
  columns?: number;
}

/** Ten braille frames; the eye reads them as one rotating dot at ~80ms. */
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const TICK_MS = 80;
const BAR_CELLS = 12;

const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const CLEAR_LINE = "\x1b[2K";

/** Decimal (1000-based) units: matches what GitHub/CDNs quote, so "40 MB" here
 *  equals the 40 MB the user sees on the release page — 1024-based would say 38. */
const UNITS = ["B", "kB", "MB", "GB", "TB"];

export function startProgress(
  steps: Array<{ id: string; label: string }>,
  opts: ProgressOptions = {},
): Progress {
  const isTTY = opts.isTTY ?? process.stderr.isTTY === true;
  const write = opts.write ?? ((chunk: string) => void process.stderr.write(chunk));
  // Sampled at DRAW time, never once at construction: the legs run for ~30s, and a window
  // dragged narrower in that window makes a stale width stop truncating — the now-wrapped
  // rows desync the cursor-up count and every later frame smears. Node keeps
  // `process.stderr.columns` live via SIGWINCH, so a fresh read is the current width.
  // `||` not `??`: a TTY with no winsize reports columns === 0 (a pty opened by
  // `script`, ssh -T, some CI runners), and 0 is not nullish — it would survive
  // `??` and truncate every line to "", drawing a blank frame forever.
  const columnsNow = () => opts.columns || process.stderr.columns || 80;

  const views: StepView[] = steps.map((s) => ({
    id: s.id,
    label: s.label,
    state: "pending",
    done: 0,
    total: null,
    detail: "",
  }));
  const byId = new Map(views.map((v) => [v.id, v]));

  // ── non-TTY ──────────────────────────────────────────────────────────────
  // No timer, no redraw, no escape bytes. begin()/update() are deliberately
  // silent: a log line per byte-chunk would be megabytes of noise, and the only
  // information a log reader wants is the outcome of each step.
  if (!isTTY) {
    let stopped = false;
    return {
      begin() {},
      update() {},
      finish(id, detail) {
        const v = byId.get(id);
        if (!v || stopped) return;
        v.state = "done";
        v.detail = detail;
        write(`${doneText(v)}\n`);
      },
      fail(id, reason) {
        const v = byId.get(id);
        if (!v || stopped) return;
        v.state = "failed";
        v.detail = reason;
        write(`${failText(v)}\n`);
      },
      stop() {
        stopped = true;
      },
    };
  }

  // ── TTY ──────────────────────────────────────────────────────────────────
  let frame = 0;
  let prevLines = 0;
  let stopped = false;

  // Redraw in place. The previous frame ended with a newline per line, so the
  // cursor sits one line BELOW it: walk back `prevLines`, then clear-and-rewrite
  // each line. Line count only ever grows (a step never returns to `pending`,
  // and done/failed keep their line), so there is never a stale tail to erase.
  const draw = () => {
    if (stopped) return;
    const body = renderFrame(views, frame, columnsNow());
    const lines = body === "" ? [] : body.split("\n");
    let out = prevLines > 0 ? `\x1b[${prevLines}A` : "";
    for (const line of lines) out += `${CLEAR_LINE}${line}\n`;
    prevLines = lines.length;
    if (out) write(out);
  };

  const timer = setInterval(() => {
    frame++;
    draw();
  }, TICK_MS);
  // A live spinner must never be the reason node refuses to exit.
  timer.unref();

  // A resize re-wraps the rows already on screen, so our count of them is now a guess.
  // Forget it rather than rewind by a wrong number: the next frame draws fresh below,
  // which leaves one stale copy on screen instead of smearing every frame from here on.
  const onResize = () => {
    prevLines = 0;
  };
  process.stderr.on("resize", onResize);

  const teardown = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    process.removeListener("SIGINT", onSigint);
    process.stderr.removeListener("resize", onResize);
    write(SHOW_CURSOR);
  };

  // Ctrl-C during a download must not leave the user in a shell with an
  // invisible cursor. Restore, unhook, then re-raise so the default kill
  // semantics (and the shell's 130) still apply.
  function onSigint() {
    teardown();
    process.kill(process.pid, "SIGINT");
  }

  write(HIDE_CURSOR);
  process.on("SIGINT", onSigint);

  return {
    begin(id) {
      const v = byId.get(id);
      if (!v || v.state !== "pending") return;
      v.state = "active";
      draw(); // paint immediately rather than waiting up to a tick for the line
    },
    update(id, done, total) {
      const v = byId.get(id);
      if (!v) return;
      // No draw here: chunk callbacks fire hundreds of times a second and the
      // tick already repaints. This just moves the numbers the tick will read.
      v.done = done;
      v.total = total;
    },
    finish(id, detail) {
      const v = byId.get(id);
      if (!v) return;
      v.state = "done";
      v.detail = detail;
      draw();
    },
    fail(id, reason) {
      const v = byId.get(id);
      if (!v) return;
      v.state = "failed";
      v.detail = reason;
      draw();
    },
    stop() {
      if (stopped) return;
      draw(); // flush the final frame before the timer dies
      teardown();
    },
  };
}

/**
 * PURE. The whole frame, no cursor movement and no trailing newline — the
 * caller owns both. Exported so rendering can be asserted without a terminal.
 */
export function renderFrame(steps: StepView[], frame: number, columns: number): string {
  const spin = SPINNER[frame % SPINNER.length];
  // Pad against EVERY label (not just the visible ones) so the bar column stays
  // put as steps come and go — a shifting column reads as flicker.
  const width = steps.reduce((w, s) => Math.max(w, s.label.length), 0);

  const lines: string[] = [];
  for (const s of steps) {
    if (s.state === "pending") continue; // a step nobody has started says nothing
    if (s.state === "done") lines.push(`✔ ${doneText(s)}`);
    else if (s.state === "failed") lines.push(`✘ ${failText(s)}`);
    else lines.push(`${spin} ${s.label.padEnd(width)}  ${activeTail(s)}`);
  }
  return lines.map((l) => truncate(l.trimEnd(), columns)).join("\n");
}

/** "Downloading docs" + "149 files (40 MB)" → "Downloaded docs → 149 files (40 MB)". */
function doneText(s: StepView): string {
  return `${pastTense(s.label)}${s.detail ? ` → ${s.detail}` : ""}`;
}

/** Failure keeps the present tense — the thing was never done. */
function failText(s: StepView): string {
  return `${s.label}${s.detail ? ` — ${s.detail}` : ""}`;
}

function activeTail(s: StepView): string {
  // total===0 is as unknowable as null (and would divide by zero), so it takes
  // the same branch.
  if (s.total !== null && s.total > 0) {
    const ratio = Math.min(1, Math.max(0, s.done / s.total));
    const filled = Math.round(ratio * BAR_CELLS);
    const bar = "█".repeat(filled) + "░".repeat(BAR_CELLS - filled);
    // floor, so 99.9% never reads as a finished 100%. padStart keeps the byte
    // counts from jittering left and right as the number gains a digit.
    const pct = String(Math.floor(ratio * 100)).padStart(3);
    return `${bar}  ${pct}%  ${formatRange(s.done, s.total)}`;
  }
  return s.done > 0 ? formatBytes(s.done) : "";
}

/**
 * A wrapped line destroys the cursor-up arithmetic — the terminal counts the
 * wrap as an extra row, we don't, and every later frame smears. Cheaper to lose
 * the tail than to track wrapping.
 */
function truncate(line: string, columns: number): string {
  if (line.length <= columns) return line;
  return columns > 1 ? `${line.slice(0, columns - 1)}…` : line.slice(0, Math.max(0, columns));
}

/**
 * "Downloading docs" → "Downloaded docs". Only the leading verb moves.
 * ponytail: regular verbs only — an irregular label ("Building index") would
 * render "Builded index". All three spine labels are regular; add a small
 * irregular map here the day one isn't.
 */
function pastTense(label: string): string {
  return label.replace(/^(\w+?)ing\b/, (_m, stem: string) => `${stem}ed`);
}

/** 40262219 → "40 MB" · 1100000 → "1.1 MB" · 900 → "900 B". */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  let v = n;
  let i = 0;
  while (v >= 1000 && i < UNITS.length - 1) {
    v /= 1000;
    i++;
  }
  return `${trimZero(v, i === 0)} ${UNITS[i]}`;
}

/** Both sides in the LARGER side's unit, printed once: "25/40 MB". */
function formatRange(done: number, total: number): string {
  const label = formatBytes(total);
  const unit = label.split(" ")[1] ?? "B";
  const scaled = done / 1000 ** Math.max(0, UNITS.indexOf(unit));
  return `${trimZero(scaled, unit === "B")}/${label}`;
}

/** One decimal below 10 ("1.1 MB"), none above ("40 MB") or for whole bytes. */
function trimZero(v: number, whole: boolean): string {
  if (whole || v >= 10) return String(Math.round(v));
  return v.toFixed(1).replace(/\.0$/, "");
}

/** 31 → "31s" · 612 → "10m 12s" · 34711 → "9h 38m". */
export function formatDuration(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  if (total < 60) return `${total}s`;
  if (total < 3600) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** 2803 → "2,803". Hand-rolled rather than toLocaleString: identical on a
 *  small-icu node build, and the closing lines must not shift with $LANG. */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
