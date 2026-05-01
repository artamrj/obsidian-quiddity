import type { MarkdownPostProcessorContext } from "obsidian";
import { useEffect, useRef } from "react";
import { getScrollPositionKey } from "../utils/obsidian-utils";

const scrollPositions = new Map<string, number>();

export function useScrollPosition(
  scrollContainerRef: { current: HTMLDivElement | null },
  ctx: MarkdownPostProcessorContext,
  el: HTMLElement,
  deps: readonly unknown[]
) {
  const scrollKeyRef = useRef("");

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const key = getScrollPositionKey(ctx, el, scrollKeyRef.current);
    scrollKeyRef.current = key;

    const scrollLeft = scrollPositions.get(key);
    if (typeof scrollLeft === "number") {
      scrollContainer.scrollLeft = scrollLeft;
    }
  }, deps);

  function saveScrollPosition() {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const key = scrollKeyRef.current || getScrollPositionKey(ctx, el, "");
    scrollKeyRef.current = key;
    scrollPositions.set(key, scrollContainer.scrollLeft);
  }

  return { saveScrollPosition };
}
