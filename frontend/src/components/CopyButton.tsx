// Copy-to-clipboard button. Shows a brief "Copied" confirmation.

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; no-op */
    }
  }

  return (
    <button className="linkbtn" type="button" onClick={copy} aria-live="polite">
      {copied ? "Copied ✓" : label}
    </button>
  );
}
