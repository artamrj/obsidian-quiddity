import { useEffect, useState } from "react";
import { detectLivePreview } from "../utils/obsidian-utils";

export function useLivePreviewMode(el: HTMLElement) {
  const [isLivePreview, setIsLivePreview] = useState(false);
  const [editButton, setEditButton] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setIsLivePreview(detectLivePreview(el));
  }, [el]);

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

  return { isLivePreview, editButton };
}
