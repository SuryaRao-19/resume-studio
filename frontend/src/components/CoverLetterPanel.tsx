import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { SaveDialog } from "./SaveDialog";
import { ResumeText } from "./ResumeText";
import { CopyButton } from "./CopyButton";
import { downloadPdf, downloadDocx } from "../lib/export";

interface Props {
  seedContent?: string;
  seedNonce?: number;
}

export function CoverLetterPanel({ seedContent, seedNonce }: Props) {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tone, setTone] = useState("professional");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [saved, setSaved] = useState(false);

  // Prefill the resume field when a saved resume is sent here.
  useEffect(() => {
    if (seedNonce && seedContent) setResumeText(seedContent);
  }, [seedNonce, seedContent]);

  async function write() {
    if (!resumeText.trim()) {
      setError("Paste your resume to write a cover letter.");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Paste the job description to tailor the letter.");
      return;
    }
    setLoading(true);
    setError(null);
    setLetter(null);
    setSaved(false);
    try {
      const res = await api.coverLetter(resumeText, jobDescription, tone);
      setLetter(res.letterText);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="section-header">Write a cover letter</h2>
      <div className="grid-2">
        <div className="field">
          <label className="label">Your resume</label>
          <textarea
            value={resumeText}
            rows={10}
            placeholder="Paste the resume to base the letter on…"
            onChange={(e) => setResumeText(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Job description</label>
          <textarea
            value={jobDescription}
            rows={10}
            placeholder="Paste the job you're applying to…"
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </div>
      </div>
      <div className="field" style={{ maxWidth: 220 }}>
        <label className="label">Tone</label>
        <select value={tone} onChange={(e) => setTone(e.target.value)}>
          <option value="professional">Professional</option>
          <option value="concise">Concise</option>
          <option value="impactful">Impactful</option>
          <option value="warm">Warm</option>
        </select>
      </div>

      <div className="actions">
        <button className="btn" onClick={write} disabled={loading} aria-busy={loading}>
          {loading ? "Writing…" : "Write cover letter"}
        </button>
      </div>

      {loading && <div className="loading" aria-live="polite">Drafting your letter…</div>}
      {error && <div className="msg error" aria-live="polite">{error}</div>}

      {letter && (
        <>
          <hr className="divider" />
          <div className="output-head">
            <p className="kicker" style={{ margin: 0 }}>Cover letter</p>
            <div className="nav-links">
              <CopyButton text={letter} />
              <button className="linkbtn" onClick={() => downloadPdf("Cover letter", letter)}>
                PDF
              </button>
              <button className="linkbtn" onClick={() => downloadDocx("Cover letter", letter)}>
                DOCX
              </button>
            </div>
          </div>
          <ResumeText text={letter} />
          <div className="actions">
            <button className="btn secondary" onClick={() => setShowSave(true)}>
              Save this letter
            </button>
            {saved && <span className="score-label">Saved to My resumes.</span>}
          </div>
        </>
      )}

      {showSave && letter && (
        <SaveDialog
          content={letter}
          mode="cover"
          defaultTitle="Cover letter"
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
