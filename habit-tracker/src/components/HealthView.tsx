import type { AppApi } from "../lib/useAppData";
import { activeHabits } from "../lib/streaks";

export default function HealthView({ api }: { api: AppApi }) {
  const habits = activeHabits(api.data).sort((a, b) => a.order - b.order);

  return (
    <div className="view">
      {habits.length === 0 ? (
        <div className="empty">
          <h2>No habits yet</h2>
          <p>Add a habit to see health benefits.</p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {habits.map((habit) => (
            <li key={habit.id}>
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #e0e0e0",
                }}
              >
                <h3 style={{ margin: "0 0 8px 0", fontSize: 16 }}>
                  {habit.name}
                </h3>
                {habit.healthBenefits ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: "#666",
                      lineHeight: 1.5,
                    }}
                  >
                    {habit.healthBenefits}
                  </p>
                ) : (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: "#aaa",
                      fontStyle: "italic",
                    }}
                  >
                    Generating health benefits...
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
