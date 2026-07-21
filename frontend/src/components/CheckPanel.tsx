import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { CheckReport } from "../types";
import { ScoreBar } from "./ScoreBar";
import { SaveDialog } from "./SaveDialog";

interface Props {
  seedContent?: string;
  seedNonce?: number;
}

export function CheckPanel({ seedContent, seedNonce }: Props) {
  const [resumeText, setResumeText] = useState("");

  // Prefill when a saved resume is sent here to be re-checked.
  useEffect(() => {
    if (seedNonce && seedContent) setResumeText(seedContent);
  }, [seedNonce, seedContent]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CheckReport | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [saved, setSaved] = useState(false);

  async function check() {
    if (!resumeText.trim()) {
      setError("Paste a resume to check.");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    setSaved(false);
    try {
      const res = await api.check(resumeText);
      setReport(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="section-header">Check a resume</h2>
      <div className="field">
        <label className="label">Paste your resume</label>
        <textarea
          value={resumeText}
          rows={10}
          placeholder="Paste the full text of your resume…"
          onChange={(e) => setResumeText(e.target.value)}
        />
      </div>
      <div className="actions">
        <button className="btn" onClick={check} disabled={loading}>
          {loading ? "Checking…" : "Check resume"}
        </button>
      </div>

      {loading && <div className="loading">Scoring your resume…</div>}
      {error && <div className="msg error">{error}</div>}

      {report && (
        <>
          <hr className="divider" />
          <ScoreBar score={report.score} label="Resume score" />

          <p className="kicker" style={{ marginTop: "1rem" }}>
            Strengths
          </p>
          <ul className="marked-list good">
            {report.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>

          <p className="kicker">Issues</p>
          <ul className="marked-list bad">
            {report.issues.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>

          <p className="kicker">ATS flags</p>
          {report.ats_flags.length > 0 ? (
            <ul className="marked-list bad">
              {report.ats_flags.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <div className="score-label">No ATS formatting risks detected.</div>
          )}

          <div className="actions">
            <button className="btn secondary" onClick={() => setShowSave(true)}>
              Save this resume
            </button>
            {saved && <span className="score-label">Saved to My resumes.</span>}
          </div>
        </>
      )}

      {showSave && (
        <SaveDialog
          content={resumeText}
          mode="check"
          defaultTitle="Checked resume"
          report={
            report
              ? { type: "check", score: report.score, report_json: report }
              : undefined
          }
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
