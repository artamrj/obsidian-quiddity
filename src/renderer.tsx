import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { App, MarkdownPostProcessorContext } from "obsidian";
import { formatTooltipDate, parseQuiddity, toDisplayDay } from "./parser";
import { replaceQuiddityBlockInFile, toggleHabitDateInSource } from "./updater";
import type { Habit, ParsedQuiddity } from "./types";

type QuiddityRendererProps = {
  app: App;
  ctx: MarkdownPostProcessorContext;
  el: HTMLElement;
  source: string;
};

type StreakCell = {
  date: string;
  active: boolean;
  start: boolean;
  end: boolean;
  length: number;
};

type HabitRowView = {
  habit: Habit;
  cells: StreakCell[];
};

type RenderCacheEntry = {
  source: string;
  scrollLeft: number;
  updatedAt: number;
};

const RENDER_CACHE = new Map<string, RenderCacheEntry>();
const RENDER_CACHE_TTL_MS = 10_000;
const SAVE_DEBOUNCE_MS = 600;

export function QuiddityRenderer({ app, ctx, el, source }: QuiddityRendererProps) {
  const scrollKey = useMemo(() => getScrollKey(ctx, el), [ctx, el]);
  const cachedRender = getFreshRenderCache(scrollKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isWritingRef = useRef(false);
  const isMountedRef = useRef(true);
  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef(false);
  const [isWriting, setIsWriting] = useState(false);
  const [currentSource, setCurrentSource] = useState(cachedRender?.source ?? source);
  const currentSourceRef = useRef(currentSource);
  const parsed = useMemo(() => parseQuiddity(currentSource), [currentSource]);
  const rows = useMemo(() => buildHabitRows(parsed.config.habits, parsed.timeline), [parsed.config.habits, parsed.timeline]);
  const gridStyle = useMemo(() => ({
    "--quiddity-days": parsed.timeline.length,
    gridTemplateColumns: `minmax(8.5rem, 11rem) repeat(${parsed.timeline.length}, var(--quiddity-cell-size))`
  }) as React.CSSProperties, [parsed.timeline.length]);

  useLayoutEffect(() => {
    currentSourceRef.current = currentSource;

    const cached = getFreshRenderCache(scrollKey);
    if (cached && scrollRef.current) {
      scrollRef.current.scrollLeft = cached.scrollLeft;
    }
  }, [currentSource, scrollKey]);

  const flushSave = useCallback(async () => {
    if (!pendingSaveRef.current || isWritingRef.current) return;

    pendingSaveRef.current = false;
    isWritingRef.current = true;
    if (isMountedRef.current) setIsWriting(true);
    cacheRender(scrollKey, currentSourceRef.current, getScrollLeft(scrollRef.current));

    try {
      const changed = await replaceQuiddityBlockInFile(app, ctx, el, currentSourceRef.current);
      if (!changed) {
        pendingSaveRef.current = true;
      }
    } catch (error) {
      pendingSaveRef.current = true;
      throw error;
    } finally {
      cacheRender(scrollKey, currentSourceRef.current, getScrollLeft(scrollRef.current));
      isWritingRef.current = false;
      if (isMountedRef.current) setIsWriting(false);

      if (pendingSaveRef.current && !saveTimerRef.current) {
        saveTimerRef.current = activeWindow.setTimeout(() => {
          saveTimerRef.current = null;
          void flushSave();
        }, SAVE_DEBOUNCE_MS);
      }
    }
  }, [app, ctx, el, scrollKey]);

  const scheduleSave = useCallback(() => {
    pendingSaveRef.current = true;

    if (saveTimerRef.current) {
      activeWindow.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = activeWindow.setTimeout(() => {
      saveTimerRef.current = null;
      void flushSave();
    }, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (saveTimerRef.current) {
        activeWindow.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      if (pendingSaveRef.current) {
        void flushSave();
      }
    };
  }, [flushSave]);

  const handleToggle = useCallback(async (habit: Habit, date: string) => {
    const scrollLeft = getScrollLeft(scrollRef.current);
    setCurrentSource((previous) => {
      const next = toggleHabitDateInSource(previous, habit.name, date);
      currentSourceRef.current = next;
      cacheRender(scrollKey, next, scrollLeft);
      return next;
    });
    scheduleSave();
  }, [scheduleSave, scrollKey]);

  return (
    <section className={`quiddity-root${isWriting ? " is-writing" : ""}`}>
      <Diagnostics parsed={parsed} />
      <div
        className="quiddity-scroll"
        onScroll={() => cacheRender(scrollKey, currentSource, getScrollLeft(scrollRef.current))}
        ref={scrollRef}
      >
        <div className="quiddity-grid" style={gridStyle}>
          <DateHeader timeline={parsed.timeline} />
          {rows.map((row) => (
            <HabitRow
              key={row.habit.name}
              row={row}
              onToggle={handleToggle}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Diagnostics({ parsed }: { parsed: ParsedQuiddity }) {
  if (parsed.diagnostics.length === 0) return null;

  return (
    <div className="quiddity-diagnostics">
      {parsed.diagnostics.map((diagnostic, index) => (
        <div key={`${diagnostic.line}-${index}`}>Line {diagnostic.line}: {diagnostic.message}</div>
      ))}
    </div>
  );
}

function DateHeader({ timeline }: { timeline: string[] }) {
  return (
    <>
      <div className="quiddity-corner" />
      {timeline.map((date) => (
        <div className="quiddity-date" key={date} title={formatTooltipDate(date)}>{toDisplayDay(date)}</div>
      ))}
    </>
  );
}

const HabitRow = memo(function HabitRow({
  row,
  onToggle
}: {
  row: HabitRowView;
  onToggle: (habit: Habit, date: string) => Promise<void>;
}) {
  return (
    <>
      <div className="quiddity-habit-name">{row.habit.name}</div>
      {row.cells.map((cell) => (
        <HabitCell
          cell={cell}
          habit={row.habit}
          key={cell.date}
          onToggle={onToggle}
        />
      ))}
    </>
  );
});

const HabitCell = memo(function HabitCell({
  cell,
  habit,
  onToggle
}: {
  cell: StreakCell;
  habit: Habit;
  onToggle: (habit: Habit, date: string) => Promise<void>;
}) {
  const label = `${habit.name} · ${formatTooltipDate(cell.date)} · ${cell.active ? "done" : "empty"}`;

  return (
    <button
      aria-label={label}
      className={cellClass(cell)}
      onClick={(event) => {
        if (event.detail === 0) {
          void onToggle(habit, cell.date);
        }
      }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;

        event.preventDefault();
        void onToggle(habit, cell.date);
      }}
      title={label}
      type="button"
    >
      {cell.active ? <span className="quiddity-mark">{cell.end ? cell.length : ""}</span> : null}
    </button>
  );
});

function buildHabitRows(habits: Habit[], timeline: string[]): HabitRowView[] {
  return habits.map((habit) => ({
    habit,
    cells: buildStreakCells(habit, timeline)
  }));
}

function buildStreakCells(habit: Habit, timeline: string[]): StreakCell[] {
  const done = new Set(habit.entries);
  const cells = timeline.map((date) => ({
    date,
    active: done.has(date),
    start: false,
    end: false,
    length: 0
  }));

  let index = 0;
  while (index < cells.length) {
    if (!cells[index].active) {
      index += 1;
      continue;
    }

    const start = index;
    while (index + 1 < cells.length && cells[index + 1].active) index += 1;
    const end = index;
    const length = end - start + 1;

    cells[start].start = true;
    cells[end].end = true;
    for (let cursor = start; cursor <= end; cursor += 1) {
      cells[cursor].length = length;
    }

    index += 1;
  }

  return cells;
}

function cellClass(cell: StreakCell): string {
  const classes = ["quiddity-cell"];
  if (cell.active) classes.push("is-active");
  if (cell.start) classes.push("is-start");
  if (cell.end) classes.push("is-end");
  if (cell.length === 1) classes.push("is-single");
  return classes.join(" ");
}

function cacheRender(key: string, source: string, scrollLeft: number): void {
  RENDER_CACHE.set(key, {
    source,
    scrollLeft,
    updatedAt: Date.now()
  });
}

function getFreshRenderCache(key: string): RenderCacheEntry | undefined {
  const cached = RENDER_CACHE.get(key);
  if (!cached) return undefined;

  if (Date.now() - cached.updatedAt > RENDER_CACHE_TTL_MS) {
    RENDER_CACHE.delete(key);
    return undefined;
  }

  return cached;
}

function getScrollLeft(element: HTMLDivElement | null): number {
  return element?.scrollLeft ?? 0;
}

function getScrollKey(ctx: MarkdownPostProcessorContext, el: HTMLElement): string {
  const section = ctx.getSectionInfo(el);
  return section ? `${ctx.sourcePath}:${section.lineStart}:${section.lineEnd}` : ctx.sourcePath;
}
