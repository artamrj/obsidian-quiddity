import type { App, MarkdownPostProcessorContext } from "obsidian";
import { Notice } from "obsidian";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { formatTooltipDate, parseQuiddity, toDisplayDay } from "./parser";
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
};

type RowModel = {
  name: string;
  cells: CellModel[];
};

export function QuiddityRenderer({ app, ctx, el, source }: QuiddityRendererProps) {
  const [currentSource, setCurrentSource] = useState(source);
  const [isUpdating, setIsUpdating] = useState(false);
  const parsed = useMemo(() => parseQuiddity(currentSource), [currentSource]);
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
    <section className="quiddity-root">
      {parsed.diagnostics.length > 0 && (
        <div className="quiddity-diagnostics" role="status">
          {parsed.diagnostics.map((diagnostic, index) => (
            <div key={`${diagnostic.line}-${index}`} className="mod-error">
              Line {diagnostic.line}: {diagnostic.message}
            </div>
          ))}
        </div>
      )}

      <div
        className="quiddity-scroll"
        style={{
          "--quiddity-days": parsed.timeline.length,
          "--quiddity-days-min-width": `${parsed.timeline.length * 28}px`,
          "--quiddity-name-width": `clamp(96px, ${longestHabitName + 3}ch, var(--quiddity-name-max-width))`
        } as CSSProperties}
      >
        <div className="quiddity-grid">
          <div className="quiddity-corner" />
          {parsed.timeline.map((date) => (
            <div key={date} className="quiddity-date" title={date}>
              <span>{toDisplayDay(date)}</span>
              <small>{formatTooltipDate(date).split(" ")[0]}</small>
            </div>
          ))}

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
    <>
      <div className="quiddity-habit-name" title={row.name}>
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
        />
      ))}
    </>
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
        const className = [
          "quiddity-cell",
          active ? "is-active" : "",
          active && previousActive ? "is-joined-before" : "",
          active && nextActive ? "is-joined-after" : "",
          active && !previousActive && !nextActive ? "is-single" : ""
        ].filter(Boolean).join(" ");

        return {
          date,
          active,
          className
        };
      })
    };
  });
}
