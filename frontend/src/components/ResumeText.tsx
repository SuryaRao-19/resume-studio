// Renders resume / summary text as formatted markdown instead of showing the
// raw ** ** and - that the model emits. The underlying raw string is kept by
// callers for save/export; this component is display-only.

import ReactMarkdown from "react-markdown";

export function ResumeText({ text }: { text: string }) {
  return (
    <div className="output md">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
