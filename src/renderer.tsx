import type { App, MarkdownPostProcessorContext } from "obsidian";
import { Notice, setIcon } from "obsidian";
import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

const scrollPositions = new Map<string, number>();

export function QuiddityRenderer({ app, ctx, el, source }: QuiddityRendererProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const editIconRef = useRef<HTMLSpanElement | null>(null);
  const scrollKeyRef = useRef("");
  const [currentSource, setCurrentSource] = useState(source);
  const [isUpdating, setIsUpdating] = useState(false);
  const parsed = useMemo(() => parseQuiddity(currentSource), [currentSource]);
  const isLivePreview = useMemo(() => detectLivePreview(el), [el]);
  const nativeEditButton = useLivePreviewEditButton(el, isLivePreview);
  const dateMetas = useMemo(() => buildDateMetas(parsed.timeline), [parsed.timeline]);
  const rows = useMemo(() => buildRows(parsed.config.habits, parsed.timeline), [
    parsed.config.habits,
    parsed.timeline
  ]);
  const longestHabitName = useMemo(() => Math.max(0, ...rows.map((row) => row.name.length)), [rows]);

  useEffect(() => {
    setCurrentSource(source);
  }, [source]);

  useEffect(() => {
    if (editIconRef.current) setIcon(editIconRef.current, "pencil");
  }, [isLivePreview]);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const key = getScrollPositionKey(ctx, el, scrollKeyRef.current);
    scrollKeyRef.current = key;

    const scrollLeft = scrollPositions.get(key);
    if (typeof scrollLeft === "number") {
      scrollContainer.scrollLeft = scrollLeft;
    }
  }, [ctx, currentSource, el, parsed.timeline.length]);

  function saveScrollPosition() {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const key = scrollKeyRef.current || getScrollPositionKey(ctx, el, "");
    scrollKeyRef.current = key;
    scrollPositions.set(key, scrollContainer.scrollLeft);
  }

  async function handleToggle(habitName: string, date: string) {
    if (isUpdating) return;

    const nextSource = toggleHabitDateInSource(currentSource, habitName, date);
    if (nextSource === currentSource) {
      new Notice(`Quiddity could not update ${habitName}.`);
      return;
    }

    saveScrollPosition();
    const previousSource = currentSource;
    setCurrentSource(nextSource);
    setIsUpdating(true);
    try {
      const didReplace = await replaceQuiddityBlockInFile(app, ctx, el, nextSource);
      if (!didReplace) setCurrentSource(previousSource);
    } catch (error) {
      setCurrentSource(previousSource);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }

  function handleEditBlock() {
    if (!nativeEditButton) {
      new Notice("Quiddity could not locate Obsidian's edit control.");
      return;
    }

    nativeEditButton.click();
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
        className="quiddity-habit-tracker__table"
        style={{
          "--quiddity-habit-date-columns": parsed.timeline.length,
          "--quiddity-habit-name-width": `clamp(96px, ${longestHabitName + 3}ch, var(--quiddity-habit-name-max-width))`
        } as CSSProperties}
      >
        <div className="quiddity-habit-tracker__names">
          <div className="quiddity-habit-tracker__cell quiddity-habit-tracker__cell--name quiddity-habit-tracker__cell--corner" aria-hidden="true" />
          {rows.map((row) => (
            <HabitName key={row.name} name={row.name} />
          ))}
        </div>

        <div
          className="quiddity-habit-tracker__timeline"
          ref={scrollContainerRef}
          onScroll={saveScrollPosition}
        >
          <div className="quiddity-habit-tracker__dates-grid">
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

            {rows.map((row) => row.cells.map((cell) => (
              <button
                key={`${row.name}-${cell.date}`}
                aria-label={`${row.name} ${cell.date} ${cell.active ? "completed" : "not completed"}`}
                className={cell.className}
                disabled={isUpdating}
                onClick={() => void handleToggle(row.name, cell.date)}
                type="button"
              >
                <span className="quiddity-habit-tick__inner">{cell.label}</span>
              </button>
            )))}
          </div>
        </div>
      </div>

      {isLivePreview && (
        <div className="quiddity-action-bar" role="toolbar" aria-label="Quiddity habit tracker actions">
          <span className="quiddity-action-bar__title">Quiddity Habit Tracker</span>
          <div className="quiddity-action-bar__buttons">
            <button
              aria-label="Edit Quiddity code block"
              className="quiddity-action-bar__button"
              disabled={!nativeEditButton}
              onClick={handleEditBlock}
              type="button"
            >
              <span ref={editIconRef} className="quiddity-action-bar__button-icon" aria-hidden="true" />
              <span>Edit block</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function useLivePreviewEditButton(el: HTMLElement, isLivePreview: boolean): HTMLElement | null {
  const [editButton, setEditButton] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isLivePreview) {
      setEditButton(null);
      return;
    }

    const codeBlock = el.closest<HTMLElement>(".cm-preview-code-block");
    if (!codeBlock) {
      setEditButton(null);
      return;
    }

    codeBlock.classList.add("quiddity-live-preview-code-block");

    const syncEditButton = () => {
      const nextEditButton = codeBlock.querySelector<HTMLElement>(".edit-block-button");
      setEditButton((currentEditButton) => (
        currentEditButton === nextEditButton ? currentEditButton : nextEditButton
      ));
    };

    syncEditButton();
    const observer = new MutationObserver(syncEditButton);
    observer.observe(codeBlock, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      codeBlock.classList.remove("quiddity-live-preview-code-block");
    };
  }, [el, isLivePreview]);

  return editButton;
}

function HabitName({ name }: { name: string }) {
  return (
    <div className="quiddity-habit-tracker__cell quiddity-habit-tracker__cell--name" title={name}>
      <span className="quiddity-habit-tracker__name-text">{name}</span>
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

function detectLivePreview(el: HTMLElement): boolean {
  const modeElement = el.closest(".cm-preview-code-block, .cm-editor, .markdown-source-view, .markdown-reading-view, .markdown-preview-view");
  if (!modeElement) return false;

  if (modeElement.matches(".markdown-reading-view, .markdown-preview-view")) return false;
  return modeElement.matches(".cm-preview-code-block, .cm-editor, .markdown-source-view");
}

function getScrollPositionKey(ctx: MarkdownPostProcessorContext, el: HTMLElement, fallback: string): string {
  const section = ctx.getSectionInfo(el);
  if (section) return `${ctx.sourcePath}:${section.lineStart}`;
  if (fallback) return fallback;

  return `${ctx.sourcePath}:${ctx.docId}`;
}
