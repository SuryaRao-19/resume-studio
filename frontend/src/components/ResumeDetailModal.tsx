import type { ResumeDetail } from "../types";
import { ResumeText } from "./ResumeText";
import { CopyButton } from "./CopyButton";
import { downloadPdf, downloadDocx } from "../lib/export";
import { useModal } from "../hooks/useModal";

interface Props {
  detail: ResumeDetail;
  onClose: () => void;
  onUse: (content: string, target: "check" | "optimize" | "cover") => void;
}

export function ResumeDetailModal({ detail, onClose, onUse }: Props) {
  const modalRef = useModal<HTMLDivElement>(onClose);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={detail.title}
        style={{ maxWidth: 620 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="output-head">
          <p className="kicker" style={{ margin: 0 }}>{detail.mode_origin}</p>
          <div className="nav-links">
            <CopyButton text={detail.content} />
            <button className="linkbtn" onClick={() => downloadPdf(detail.title, detail.content)}>
              PDF
            </button>
            <button className="linkbtn" onClick={() => downloadDocx(detail.title, detail.content)}>
              DOCX
            </button>
          </div>
        </div>
        <h2 className="section-header">{detail.title}</h2>
        <div style={{ maxHeight: 360, overflow: "auto" }}>
          <ResumeText text={detail.content} />
        </div>
        {detail.latest_report && (
          <div className="score-label" style={{ marginTop: "0.75rem" }}>
            Latest {detail.latest_report.type} report · score{" "}
            {detail.latest_report.score}/100
          </div>
        )}
        <div className="actions">
          <span className="score-label">Use in:</span>
          <button className="linkbtn" onClick={() => { onUse(detail.content, "check"); onClose(); }}>
            Check
          </button>
          <button className="linkbtn" onClick={() => { onUse(detail.content, "optimize"); onClose(); }}>
            Optimize
          </button>
          <button className="linkbtn" onClick={() => { onUse(detail.content, "cover"); onClose(); }}>
            Cover letter
          </button>
        </div>
        <div className="actions">
          <button className="btn secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
