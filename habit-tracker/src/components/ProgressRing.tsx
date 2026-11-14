interface Props {
  done: number;
  total: number;
  /** Shown beside the ring — the date, and anything else worth a glance. */
  caption?: string;
  stats?: { label: string; value: string }[];
}

/**
 * The day's progress. It used to be a 210px disc that pushed the habits
 * themselves below the fold on a phone; now it's a compact ring sharing a
 * card with the numbers it was competing against, which is both smaller and
 * more informative.
 */
export default function ProgressRing({ done, total, caption, stats = [] }: Props) {
  const size = 92;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = total === 0 ? 0 : done / total;
  const offset = circumference * (1 - ratio);
  const allDone = total > 0 && done === total;

  return (
    <div className="ring-card">
      <div
        className="ring"
        role="img"
        aria-label={`${done} of ${total} habits done today`}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            className="ring-track"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
          />
          <circle
            className="ring-fill"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="ring-center">
          <div className="ring-count mono">
            {done}
            <span className="of">/{total}</span>
          </div>
        </div>
      </div>

      <div className="ring-side">
        <p className={"ring-label" + (allDone ? " ring-all-done" : "")}>
          {total === 0
            ? "No habits yet"
            : allDone
              ? "All done today"
              : `${total - done} left today`}
        </p>
        {caption && <p className="ring-caption">{caption}</p>}
        {stats.length > 0 && (
          <dl className="ring-stats">
            {stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd className="mono">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
