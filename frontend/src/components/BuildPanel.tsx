import { useState } from "react";
import { api, ApiError } from "../api";
import { SaveDialog } from "./SaveDialog";
import { ResumeText } from "./ResumeText";
import { CopyButton } from "./CopyButton";
import { downloadPdf, downloadDocx } from "../lib/export";

export function BuildPanel() {
  const [role, setRole] = useState("");
  const [tone, setTone] = useState("professional");
  const [history, setHistory] = useState("");
  const [skills, setSkills] = useState("");
  const [education, setEducation] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [original, setOriginal] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saved, setSaved] = useState(false);

  async function draft() {
    if (!history.trim()) {
      setError("Add some work history or notes before drafting.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult("");
    setOriginal("");
    setEditing(false);
    setSaved(false);
    try {
      const text = await api.buildStream(
        { role, tone, history, skills, education },
        (chunk) => setResult((prev) => (prev ?? "") + chunk)
      );
      setResult(text);
      setOriginal(text);
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const title = role ? `${role} resume` : "Built resume";
  const hasDraft = result != null && result.length > 0;

  return (
    <div>
      <h2 className="section-header">Build a resume</h2>
      <div className="grid-2">
        <div className="field">
          <label className="label">Target role</label>
          <input
            type="text"
            value={role}
            placeholder="e.g. Product Manager"
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Tone</label>
          <select value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="professional">Professional</option>
            <option value="concise">Concise</option>
            <option value="impactful">Impactful</option>
            <option value="warm">Warm</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label">Work history / notes</label>
        <textarea
          value={history}
          rows={6}
          placeholder="Rough notes about roles, companies, dates, what you did…"
          onChange={(e) => setHistory(e.target.value)}
        />
      </div>
      <div className="grid-2">
        <div className="field">
          <label className="label">Skills</label>
          <textarea
            value={skills}
            rows={3}
            placeholder="Comma-separated or freeform"
            onChange={(e) => setSkills(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Education</label>
          <textarea
            value={education}
            rows={3}
            placeholder="Degrees, schools, years"
            onChange={(e) => setEducation(e.target.value)}
          />
        </div>
      </div>

      <div className="actions">
        <button className="btn" onClick={draft} disabled={loading} aria-busy={loading}>
          {loading ? "Drafting…" : "Draft resume"}
        </button>
      </div>

      {loading && !hasDraft && <div className="loading" aria-live="polite">Generating draft…</div>}
      {error && <div className="msg error" aria-live="polite">{error}</div>}

      {hasDraft && (
        <>
          <hr className="divider" />
          <div className="output-head">
            <p className="kicker" style={{ margin: 0 }}>
              Draft{loading ? " · streaming…" : ""}
            </p>
            {!loading && (
              <div className="nav-links">
                <button className="linkbtn" onClick={() => setEditing((e) => !e)}>
                  {editing ? "Preview" : "Edit"}
                </button>
                {editing && original && result !== original && (
                  <button className="linkbtn" onClick={() => setResult(original)}>
                    Reset
                  </button>
                )}
                <CopyButton text={result ?? ""} />
                <button className="linkbtn" onClick={() => downloadPdf(title, result ?? "")}>
                  PDF
                </button>
                <button className="linkbtn" onClick={() => downloadDocx(title, result ?? "")}>
                  DOCX
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <textarea
              value={result ?? ""}
              rows={16}
              onChange={(e) => setResult(e.target.value)}
              aria-label="Edit draft resume"
            />
          ) : (
            <ResumeText text={result ?? ""} />
          )}

          {!loading && (
            <div className="actions">
              <button className="btn secondary" onClick={() => setShowSave(true)}>
                Save this resume
              </button>
              {saved && <span className="score-label">Saved to My resumes.</span>}
            </div>
          )}
        </>
      )}

      {showSave && result && (
        <SaveDialog
          content={result}
          mode="build"
          defaultTitle={title}
          onClose={() => setShowSave(false)}
          onSaved={() => {
            setShowSave(false);
            setSaved(true);
          }}
        />
      )}
    </div>
  );
}
