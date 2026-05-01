import type { App, MarkdownPostProcessorContext } from "obsidian";
import { Notice } from "obsidian";
import { useEffect, useRef, useState } from "react";
import { ActionBar } from "./components/ActionBar";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { HabitTable } from "./components/HabitTable";
import { replaceQuiddityBlockInFile, toggleHabitDateInSource } from "./updater";
import { useLivePreviewMode } from "./hooks/useLivePreviewMode";
import { useQuiddityData } from "./hooks/useQuiddityData";
import { useScrollPosition } from "./hooks/useScrollPosition";

export type QuiddityRendererProps = {
  source: string;
  app: App;
  ctx: MarkdownPostProcessorContext;
  el: HTMLElement;
};

export function QuiddityRenderer({ app, ctx, el, source }: QuiddityRendererProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [currentSource, setCurrentSource] = useState(source);
  const [isUpdating, setIsUpdating] = useState(false);

  const { parsed, dateMetas, rows, longestHabitName } = useQuiddityData(currentSource);
  const { isLivePreview, editButton } = useLivePreviewMode(el);
  const { saveScrollPosition } = useScrollPosition(scrollContainerRef, ctx, el, [
    ctx,
    currentSource,
    el,
    parsed.timeline.length
  ]);

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
    if (!editButton) {
      new Notice("Quiddity could not locate Obsidian's edit control.");
      return;
    }

    editButton.click();
  }

  return (
    <section className="quiddity-habit-tracker">
      <DiagnosticsPanel diagnostics={parsed.diagnostics} />
      <HabitTable
        rows={rows}
        dateMetas={dateMetas}
        longestHabitName={longestHabitName}
        isUpdating={isUpdating}
        onToggle={(habitName: string, date: string) => {
          void handleToggle(habitName, date);
        }}
        scrollContainerRef={scrollContainerRef}
        onScroll={saveScrollPosition}
      />
      <ActionBar
        canEdit={Boolean(editButton)}
        isLivePreview={isLivePreview}
        onEdit={handleEditBlock}
      />
    </section>
  );
}


