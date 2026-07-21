interface Props {
  words: string[];
  kind: "good" | "bad";
}

export function KeywordChips({ words, kind }: Props) {
  if (words.length === 0) {
    return <div className="score-label">None</div>;
  }
  return (
    <div className="chips">
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className={`chip ${kind}`}>
          {w}
        </span>
      ))}
    </div>
  );
}
