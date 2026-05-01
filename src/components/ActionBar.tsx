import { setIcon } from "obsidian";
import { useEffect, useRef } from "react";

export type ActionBarProps = {
  isLivePreview: boolean;
  canEdit: boolean;
  onEdit: () => void;
};

export function ActionBar({ isLivePreview, canEdit, onEdit }: ActionBarProps) {
  const editIconRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!editIconRef.current) return;
    setIcon(editIconRef.current, "pencil");
  }, []);

  if (!isLivePreview) return null;

  return (
    <div className="quiddity-action-bar" role="toolbar" aria-label="Quiddity habit tracker actions">
      <span className="quiddity-action-bar__title">Quiddity Habit Tracker</span>
      <div className="quiddity-action-bar__buttons">
        <button
          aria-label="Edit Quiddity code block"
          className="quiddity-action-bar__button"
          disabled={!canEdit}
          onClick={onEdit}
          type="button"
        >
          <span ref={editIconRef} className="quiddity-action-bar__button-icon" aria-hidden="true" />
          <span>Edit block</span>
        </button>
      </div>
    </div>
  );
}