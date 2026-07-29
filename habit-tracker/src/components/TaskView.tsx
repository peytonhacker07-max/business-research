import { useState } from "react";
import type { AppApi } from "../lib/useAppData";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon } from "./Icons";

export default function TaskView({ api }: { api: AppApi }) {
  const todos = api.data.todos.sort((a, b) => a.order - b.order);
  const active = todos.filter((t) => !t.done);
  const completed = todos.filter((t) => t.done);
  const [input, setInput] = useState("");

  const handleAdd = () => {
    if (input.trim()) {
      api.addTodo(input);
      setInput("");
    }
  };

  return (
    <div className="view">
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input
            type="text"
            placeholder="Add a task..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: 6,
              fontSize: 14,
              fontFamily: "inherit",
            }}
          />
          <button className="btn primary" onClick={handleAdd} style={{ flexShrink: 0 }}>
            <PlusIcon className="" />
          </button>
        </div>
      </div>

      {active.length > 0 && (
        <div>
          <div className="view-title" style={{ padding: "0 20px", textAlign: "left", fontSize: 12, marginBottom: 12 }}>
            ACTIVE
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {active.map((todo, i) => (
              <li key={todo.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 20px",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <button
                    className="icon-btn"
                    onClick={() => api.toggleTodo(todo.id)}
                    style={{
                      width: 24,
                      height: 24,
                      minWidth: 24,
                      minHeight: 24,
                      border: "2px solid #ddd",
                      borderRadius: 4,
                      background: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 15 }}>{todo.text}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="icon-btn"
                      onClick={() => api.reorderTodos(todo.id, -1)}
                      disabled={i === 0}
                    >
                      <ChevronUpIcon className="" />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => api.reorderTodos(todo.id, 1)}
                      disabled={i === active.length - 1}
                    >
                      <ChevronDownIcon className="" />
                    </button>
                    <button className="icon-btn" onClick={() => api.deleteTodo(todo.id)}>
                      <span style={{ fontSize: 14, lineHeight: 1 }}>✕</span>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {completed.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="view-title" style={{ padding: "0 20px", textAlign: "left", fontSize: 12, marginBottom: 12, color: "#999" }}>
            COMPLETED
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {completed.map((todo) => (
              <li key={todo.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 20px",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <button
                    className="icon-btn"
                    onClick={() => api.toggleTodo(todo.id)}
                    style={{
                      width: 24,
                      height: 24,
                      minWidth: 24,
                      minHeight: 24,
                      border: "none",
                      borderRadius: 4,
                      background: "#1f5e54",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                    }}
                  >
                    <CheckIcon className="" />
                  </button>
                  <span style={{ flex: 1, fontSize: 15, textDecoration: "line-through", color: "#999" }}>
                    {todo.text}
                  </span>
                  <button className="icon-btn" onClick={() => api.deleteTodo(todo.id)}>
                    <span style={{ fontSize: 14, lineHeight: 1 }}>✕</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {active.length === 0 && completed.length === 0 && (
        <div className="empty">
          <div className="mark">✓</div>
          <h2>No tasks yet</h2>
          <p>Add one to get started.</p>
        </div>
      )}
    </div>
  );
}
