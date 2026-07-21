import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { OptimizeReport } from "../types";
import { ScoreBar } from "./ScoreBar";
import { KeywordChips } from "./KeywordChip";
import { SaveDialog } from "./SaveDialog";
import { ResumeText } from "./ResumeText";
import { CopyButton } from "./CopyButton";
import { DiffView } from "./DiffView";
import { downloadPdf, downloadDocx } from "../lib/export";

interface Props {
  seedContent?: string;
  seedNonce?: number;
}

export function OptimizePanel({ seedContent, seedNonce }: Props) {
  const [resumeText, setResumeText] = useState("");

  // Prefill when a saved resume is sent here to be re-optimized.
  useEffect(() => {
    if (seedNonce && seedContent) setResumeText(seedContent);
  }, [seedNonce, seedContent]);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<OptimizeReport | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [saved, setSaved] = useState(false);

  async function optimize() {
    if (!resumeText.trim()) {
      setError("Paste your resume to optimize.");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Paste the job description to optimize against.");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    setSaved(false);
    try {
      const res = await api.optimize(resumeText, jobDescription);
      setReport(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="section-header">Optimize for a job</h2>
      <div className="grid-2">
        <div className="field">
          <label className="label">Your resume</label>
          <textarea
            value={resumeText}
            rows={10}
            placeholder="Paste your resume…"
            onChange={(e) => setResumeText(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Job description</label>
          <textarea
            value={jobDescription}
            rows={10}
            placeholder="Paste the job posting…"
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </div>
      </div>
      <div className="actions">
        <button className="btn" onClick={optimize} disabled={loading}>
          {loading ? "Optimizing…" : "Optimize"}
        </button>
      </div>

      {loading && <div className="loading">Comparing against the job…</div>}
      {error && <div className="msg error">{error}</div>}

      {report && (
        <>
          <hr className="divider" />
          <ScoreBar score={report.match_score} label="Match score" />

          <p className="kicker" style={{ marginTop: "1rem" }}>
            Matched keywords
          </p>
          <KeywordChips words={report.matched_keywords} kind="good" />

          <p className="kicker">Missing keywords</p>
          <KeywordChips words={report.missing_keywords} kind="bad" />

          <p className="kicker" style={{ marginTop: "0.75rem" }}>
            Rewrite suggestions
          </p>
          <ul className="marked-list good">
            {report.rewrite_suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>

          <div className="output-head">
            <p className="kicker" style={{ margin: 0 }}>Tailored summary</p>
            <CopyButton text={report.tailored_summary} />
          </div>
          <ResumeText text={report.tailored_summary} />

          {report.tailored_resume && (
            <>
              <div className="output-head" style={{ marginTop: "1rem" }}>
                <p className="kicker" style={{ margin: 0 }}>Suggested rewrite (diff)</p>
                <div className="nav-links">
                  <CopyButton text={report.tailored_resume} label="Copy rewrite" />
                  <button className="linkbtn" onClick={() => downloadPdf("Optimized resume", report.tailored_resume)}>
                    PDF
                  </button>
                  <button className="linkbtn" onClick={() => downloadDocx("Optimized resume", report.tailored_resume)}>
                    DOCX
                  </button>
                </div>
              </div>
              <DiffView original={resumeText} tailored={report.tailored_resume} />
            </>
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
          mode="optimize"
          defaultTitle="Optimized resume"
          report={
            report
              ? {
                  type: "optimize",
                  score: report.match_score,
                  report_json: report,
                  job_description: jobDescription,
                }
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
