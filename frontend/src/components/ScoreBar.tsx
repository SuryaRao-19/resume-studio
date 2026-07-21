interface Props {
  score: number;
  label?: string;
}

export function ScoreBar({ score, label = "Score" }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div>
      <div className="score">
        <div className="score-number">{clamped}</div>
        <div className="score-bar">
          <div className="score-fill" style={{ width: `${clamped}%` }} />
        </div>
      </div>
      <div className="score-label">
        {label} · {clamped} / 100
      </div>
    </div>
  );
}
