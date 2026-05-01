import type { MarkdownPostProcessorContext } from "obsidian";

export function detectLivePreview(el: HTMLElement): boolean {
  const modeElement = el.closest(".cm-preview-code-block, .cm-editor, .markdown-source-view, .markdown-reading-view, .markdown-preview-view");
  if (!modeElement) return false;

  if (modeElement.matches(".markdown-reading-view, .markdown-preview-view")) return false;
  return modeElement.matches(".cm-preview-code-block, .cm-editor, .markdown-source-view");
}

export function getScrollPositionKey(ctx: MarkdownPostProcessorContext, el: HTMLElement, fallback: string): string {
  const section = ctx.getSectionInfo(el);
  if (section) return `${ctx.sourcePath}:${section.lineStart}`;
  if (fallback) return fallback;

  return `${ctx.sourcePath}:${ctx.docId}`;
}
