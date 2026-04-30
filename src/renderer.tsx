import type { App, MarkdownPostProcessorContext } from "obsidian";
import { Notice } from "obsidian";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { parseQuiddity, toDisplayDay } from "./parser";
import { replaceQuiddityBlockInFile, toggleHabitDateInSource } from "./updater";

export type QuiddityRendererProps = {
  source: string;
  app: App;
  ctx: MarkdownPostProcessorContext;
  el: HTMLElement;
};

type CellModel = {
  date: string;
  active: boolean;
  className: string;
  label: string;
};

type RowModel = {
  name: string;
  cells: CellModel[];
};

type DateMeta = {
  date: string;
  day: string;
  className: string;
  prettyDate: string;
};

export function QuiddityRenderer({ app, ctx, el, source }: QuiddityRendererProps) {
  const [currentSource, setCurrentSource] = useState(source);
  const [isUpdating, setIsUpdating] = useState(false);
  const parsed = useMemo(() => parseQuiddity(currentSource), [currentSource]);
  const dateMetas = useMemo(() => buildDateMetas(parsed.timeline), [parsed.timeline]);
  const rows = useMemo(() => buildRows(parsed.config.habits, parsed.timeline), [
    parsed.config.habits,
    parsed.timeline
  ]);
  const longestHabitName = useMemo(() => Math.max(0, ...rows.map((row) => row.name.length)), [rows]);

  useEffect(() => {
    setCurrentSource(source);
  }, [source]);

  async function handleToggle(habitName: string, date: string) {
    if (isUpdating) return;

    const nextSource = toggleHabitDateInSource(currentSource, habitName, date);
    if (nextSource === currentSource) {
      new Notice(`Quiddity could not update ${habitName}.`);
      return;
    }

    setIsUpdating(true);
    try {
      const didReplace = await replaceQuiddityBlockInFile(app, ctx, el, nextSource);
      if (didReplace) setCurrentSource(nextSource);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <section className="quiddity-habit-tracker">
      {parsed.diagnostics.length > 0 && (
        <div className="quiddity-diagnostics" role="status">
          {parsed.diagnostics.map((diagnostic, index) => (
            <div key={`${diagnostic.line}-${index}`} className="quiddity-diagnostics__item quiddity-diagnostics__item--error">
              Line {diagnostic.line}: {diagnostic.message}
            </div>
          ))}
        </div>
      )}

      <div
        className="quiddity-habit-tracker__scroll"
        style={{
          "--quiddity-habit-date-columns": parsed.timeline.length,
          "--quiddity-habit-name-width": `clamp(96px, ${longestHabitName + 3}ch, var(--quiddity-habit-name-max-width))`
        } as CSSProperties}
      >
        <div className="quiddity-habit-tracker__grid">
          <div className="quiddity-habit-tracker__row quiddity-habit-tracker__row--header">
            <div className="quiddity-habit-tracker__cell quiddity-habit-tracker__cell--name quiddity-habit-tracker__cell--corner" aria-hidden="true" />
            {dateMetas.map((dateMeta) => (
              <div
                key={dateMeta.date}
                className={dateMeta.className}
                data-quiddity-pretty-date={dateMeta.prettyDate}
                title={dateMeta.prettyDate}
              >
                <span className="quiddity-habit-tracker__date-number">{dateMeta.day}</span>
              </div>
            ))}
          </div>

          {rows.map((row) => (
            <HabitRow
              key={row.name}
              disabled={isUpdating}
              row={row}
              onToggle={handleToggle}
            />
          ))}
        </div>
      </div>

      <div className="quiddity-action-bar" aria-hidden="true">
        <span className="quiddity-action-bar__title">Quiddity Habit Tracker</span>
        <div className="quiddity-action-bar__buttons">
          <button className="quiddity-action-bar__button" disabled type="button">Updates</button>
          <button className="quiddity-action-bar__button" disabled type="button">Edit block</button>
          <button className="quiddity-action-bar__button" disabled type="button">Settings</button>
        </div>
      </div>
    </section>
  );
}

function HabitRow({
  disabled,
  onToggle,
  row
}: {
  disabled: boolean;
  onToggle: (habitName: string, date: string) => Promise<void>;
  row: RowModel;
}) {
  return (
    <div className="quiddity-habit-tracker__row">
      <div className="quiddity-habit-tracker__cell quiddity-habit-tracker__cell--name" title={row.name}>
        {row.name}
      </div>
      {row.cells.map((cell) => (
        <button
          key={`${row.name}-${cell.date}`}
          aria-label={`${row.name} ${cell.date} ${cell.active ? "completed" : "not completed"}`}
          className={cell.className}
          disabled={disabled}
          onClick={() => void onToggle(row.name, cell.date)}
          title={`${row.name} - ${cell.date}`}
          type="button"
        >
          <span className="quiddity-habit-tick__inner">{cell.label}</span>
        </button>
      ))}
    </div>
  );
}

function buildRows(habits: { name: string; entries: string[] }[], timeline: string[]): RowModel[] {
  return habits.map((habit) => {
    const activeDates = new Set(habit.entries);

    return {
      name: habit.name,
      cells: timeline.map((date, index) => {
        const active = activeDates.has(date);
        const previousActive = index > 0 && activeDates.has(timeline[index - 1]);
        const nextActive = index < timeline.length - 1 && activeDates.has(timeline[index + 1]);
        const streakLength = active ? countStreakLength(activeDates, timeline, index) : 0;
        const isStreak = active && (previousActive || nextActive);
        const className = [
          "quiddity-habit-tracker__cell",
          "quiddity-habit-tick",
          active ? "quiddity-habit-tick--ticked" : "",
          active && !previousActive && !nextActive ? "quiddity-habit-tick--single" : "",
          isStreak ? "quiddity-habit-tick--streak" : "",
          active && !previousActive && nextActive ? "quiddity-habit-tick--streak-start" : "",
          active && previousActive && nextActive ? "quiddity-habit-tick--streak-middle" : "",
          active && previousActive && !nextActive ? "quiddity-habit-tick--streak-end" : "",
          isWeekendDate(date) ? "quiddity-habit-tick--weekend" : ""
        ].filter(Boolean).join(" ");

        return {
          date,
          active,
          className,
          label: active && previousActive && !nextActive && streakLength > 1 ? String(streakLength) : ""
        };
      })
    };
  });
}

function buildDateMetas(timeline: string[]): DateMeta[] {
  const today = toLocalDateKey(new Date());

  return timeline.map((date) => {
    const isWeekend = isWeekendDate(date);
    const className = [
      "quiddity-habit-tracker__cell",
      "quiddity-habit-tracker__cell--date",
      isWeekend ? "quiddity-habit-tracker__cell--weekend" : "",
      date === today ? "quiddity-habit-tracker__cell--today" : ""
    ].filter(Boolean).join(" ");

    return {
      date,
      day: toDisplayDay(date),
      className,
      prettyDate: formatPrettyDate(date)
    };
  });
}

function countStreakLength(activeDates: Set<string>, timeline: string[], index: number): number {
  let start = index;
  let end = index;

  while (start > 0 && activeDates.has(timeline[start - 1])) start -= 1;
  while (end < timeline.length - 1 && activeDates.has(timeline[end + 1])) end += 1;

  return end - start + 1;
}

function isWeekendDate(dateKey: string): boolean {
  const date = toUtcDate(dateKey);
  if (!date) return false;

  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function formatPrettyDate(dateKey: string): string {
  const date = toUtcDate(dateKey);
  if (!date) return dateKey;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
    year: "numeric"
  }).format(date);
}

function toUtcDate(dateKey: string): Date | null {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  return new Date(Date.UTC(year, month - 1, day));
}

function toLocalDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}
