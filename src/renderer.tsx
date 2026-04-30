import type { App, MarkdownPostProcessorContext } from "obsidian";
import { MarkdownView, Notice, setIcon, TFile } from "obsidian";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  streakLength: number | null;
};

type RowModel = {
  name: string;
  cells: CellModel[];
};

export function QuiddityRenderer({ app, ctx, el, source }: QuiddityRendererProps) {
  const [currentSource, setCurrentSource] = useState(source);
  const [isUpdating, setIsUpdating] = useState(false);
  const iconRef = useRef<HTMLSpanElement>(null);
  const parsed = useMemo(() => parseQuiddity(currentSource), [currentSource]);
  const rows = useMemo(() => buildRows(parsed.config.habits, parsed.timeline), [
    parsed.config.habits,
    parsed.timeline
  ]);

  useEffect(() => {
    setCurrentSource(source);
  }, [source]);

  useEffect(() => {
    if (iconRef.current) setIcon(iconRef.current, "file-code");
  }, []);

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

  async function handleRevealSource() {
    const section = ctx.getSectionInfo(el);
    const file = app.vault.getAbstractFileByPath(ctx.sourcePath);

    if (!file || !(file instanceof TFile)) {
      new Notice("Quiddity could not locate the source file.");
      return;
    }

    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file, {
      active: true,
      state: { mode: "source" }
    });
    app.workspace.setActiveLeaf(leaf, { focus: true });

    if (leaf.view instanceof MarkdownView && section) {
      const line = section.lineStart;
      leaf.view.editor.setCursor({ line, ch: 0 });
      leaf.view.editor.scrollIntoView({
        from: { line, ch: 0 },
        to: { line, ch: 0 }
      }, true);
      leaf.view.editor.focus();
    }
  }

  return (
    <section className="quiddity-root">
      <div className="quiddity-toolbar">
        <div className="quiddity-summary">
          <span>{rows.length} habits</span>
          <span>{parsed.timeline.length} days</span>
        </div>
        <button
          aria-label="Reveal Quiddity source"
          className="clickable-icon quiddity-source-action"
          onClick={() => void handleRevealSource()}
          type="button"
        >
          <span ref={iconRef} aria-hidden="true" />
        </button>
      </div>

      {parsed.diagnostics.length > 0 && (
        <div className="quiddity-diagnostics" role="status">
          {parsed.diagnostics.map((diagnostic, index) => (
            <div key={`${diagnostic.line}-${index}`} className="mod-error">
              Line {diagnostic.line}: {diagnostic.message}
            </div>
          ))}
        </div>
      )}

      <div className="quiddity-scroll" style={{ "--quiddity-days": parsed.timeline.length } as CSSProperties}>
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
        >
          {cell.streakLength !== null && (
            <span className="quiddity-streak-length">{cell.streakLength}</span>
          )}
        </button>
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
          className,
          streakLength: active && !nextActive ? countStreakEnd(activeDates, timeline, index) : null
        };
      })
    };
  });
}

function countStreakEnd(activeDates: Set<string>, timeline: string[], endIndex: number): number {
  let length = 0;

  for (let index = endIndex; index >= 0 && activeDates.has(timeline[index]); index -= 1) {
    length += 1;
  }

  return length;
}
