// Line-level before/after diff between the original resume and the AI's
// tailored rewrite. Added lines are green, removed lines red, unchanged muted.

import { diffLines } from "diff";

export function DiffView({ original, tailored }: { original: string; tailored: string }) {
  const parts = diffLines(original.trim(), tailored.trim());
  return (
    <div className="diff">
      {parts.map((part, i) => {
        const cls = part.added ? "diff-add" : part.removed ? "diff-del" : "diff-same";
        const sign = part.added ? "+" : part.removed ? "−" : " ";
        // Render each line of the hunk with a gutter sign.
        return part.value
          .replace(/\n$/, "")
          .split("\n")
          .map((line, j) => (
            <div className={`diff-line ${cls}`} key={`${i}-${j}`}>
              <span className="diff-sign">{sign}</span>
              <span>{line || " "}</span>
            </div>
          ));
      })}
    </div>
  );
}
