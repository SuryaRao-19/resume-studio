import { useState } from "react";
import { api, ApiError } from "../api";
import type { Mode, SaveReport } from "../types";
import { useModal } from "../hooks/useModal";

interface Props {
  content: string;
  mode: Mode;
  defaultTitle: string;
  report?: SaveReport;
  onClose: () => void;
  onSaved: () => void;
}

export function SaveDialog({ content, mode, defaultTitle, report, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(defaultTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useModal<HTMLDivElement>(onClose);

  async function save() {
    if (!title.trim()) {
      setError("Give this resume a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.saveResume(title.trim(), content, mode, report);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Save resume"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="kicker">Save resume</p>
        <div className="field">
          <label className="label" htmlFor="save-title">
            Title
          </label>
          <input
            id="save-title"
            type="text"
            value={title}
            autoFocus
            placeholder="e.g. PM resume — fintech"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        {error && <div className="msg error" aria-live="polite">{error}</div>}
        <div className="actions">
          <button className="btn" onClick={save} disabled={saving} aria-busy={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="btn secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
