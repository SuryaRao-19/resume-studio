import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { ResumeListItem, ResumeDetail } from "../types";
import { ResumeDetailModal } from "./ResumeDetailModal";

interface Props {
  onUse: (content: string, target: "check" | "optimize" | "cover") => void;
}

export function MyResumes({ onUse }: Props) {
  const [items, setItems] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<ResumeDetail | null>(null);
  const [openLoading, setOpenLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listResumes();
      setItems(res.resumes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load resumes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openResume(id: string) {
    setOpenLoading(true);
    setError(null);
    try {
      const detail = await api.getResume(id);
      setOpen(detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not open resume.");
    } finally {
      setOpenLoading(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.deleteResume(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete resume.");
    }
  }

  return (
    <div>
      <h2 className="section-header">My resumes</h2>
      {loading && <div className="loading">Loading…</div>}
      {error && <div className="msg error">{error}</div>}
      {!loading && items.length === 0 && (
        <p className="app-sub">
          Nothing saved yet. Build, check, or optimize a resume, then use “Save
          this resume”.
        </p>
      )}

      <ul className="resume-list">
        {items.map((r) => (
          <li className="resume-item" key={r.id}>
            <div>
              <div className="r-title">{r.title}</div>
              <div className="r-meta">
                {r.modeOrigin} · {new Date(r.updatedAt).toLocaleDateString()}
              </div>
            </div>
            <div className="nav-links">
              <button className="linkbtn" onClick={() => openResume(r.id)}>
                Open
              </button>
              <button className="linkbtn" onClick={() => remove(r.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {openLoading && <div className="loading">Opening…</div>}

      {open && (
        <ResumeDetailModal detail={open} onClose={() => setOpen(null)} onUse={onUse} />
      )}
    </div>
  );
}
