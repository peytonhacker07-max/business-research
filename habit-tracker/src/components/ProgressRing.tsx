interface Props {
  done: number;
  total: number;
}

/**
 * The signature element: a large arc that fills as the day's habits are
 * completed. SVG stroke-dashoffset animates the fill (CSS handles the
 * transition, which is disabled under prefers-reduced-motion).
 */
export default function ProgressRing({ done, total }: Props) {
  const size = 188;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = total === 0 ? 0 : done / total;
  const offset = circumference * (1 - ratio);
  const allDone = total > 0 && done === total;

  return (
    <div className="ring-wrap">
      <div
        className="ring"
        role="img"
        aria-label={`${done} of ${total} habits done today`}
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
          <div className={"ring-label" + (allDone ? " ring-all-done" : "")}>
            {total === 0
              ? "no habits yet"
              : allDone
                ? "all done today"
                : "habits today"}
          </div>
        </div>
      </div>
    </div>
  );
}
