import type { App, MarkdownPostProcessorContext } from "obsidian";
import { Notice, setIcon } from "obsidian";
import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { HabitName } from "./components/HabitName";
import { parseQuiddity } from "./parser";
import { replaceQuiddityBlockInFile, toggleHabitDateInSource } from "./updater";
import { buildDateMetas, buildRows } from "./utils/tracker-models";

export type QuiddityRendererProps = {
  source: string;
  app: App;
  ctx: MarkdownPostProcessorContext;
  el: HTMLElement;
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
      <DiagnosticsPanel diagnostics={parsed.diagnostics} />

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
