import React from "react";

export default function DashboardLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeIn 150ms ease-out" }}>
      {/* Header bar placeholder skeleton */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              width: 220,
              height: 28,
              borderRadius: "var(--radius-sm)",
              background: "linear-gradient(90deg, var(--bg-surface-elevated) 25%, var(--bg-surface-hover) 50%, var(--bg-surface-elevated) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.2s infinite",
            }}
          />
          <div
            style={{
              width: 320,
              height: 16,
              borderRadius: "var(--radius-sm)",
              background: "linear-gradient(90deg, var(--bg-surface-elevated) 25%, var(--bg-surface-hover) 50%, var(--bg-surface-elevated) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.2s infinite",
            }}
          />
        </div>

        <div
          style={{
            width: 140,
            height: 38,
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(90deg, var(--bg-surface-elevated) 25%, var(--bg-surface-hover) 50%, var(--bg-surface-elevated) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.2s infinite",
          }}
        />
      </div>

      {/* Grid of Metric / Content Skeletons */}
      <div className="grid-cols-3" style={{ gap: 16 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="card"
            style={{
              height: 100,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: "45%",
                height: 14,
                borderRadius: "var(--radius-sm)",
                background: "linear-gradient(90deg, var(--bg-surface-elevated) 25%, var(--bg-surface-hover) 50%, var(--bg-surface-elevated) 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.2s infinite",
              }}
            />
            <div
              style={{
                width: "70%",
                height: 24,
                borderRadius: "var(--radius-sm)",
                background: "linear-gradient(90deg, var(--bg-surface-elevated) 25%, var(--bg-surface-hover) 50%, var(--bg-surface-elevated) 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.2s infinite",
              }}
            />
          </div>
        ))}
      </div>

      {/* Main Table / Feed Skeleton */}
      <div
        className="card"
        style={{
          padding: 24,
          minHeight: 280,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            width: "30%",
            height: 20,
            borderRadius: "var(--radius-sm)",
            background: "linear-gradient(90deg, var(--bg-surface-elevated) 25%, var(--bg-surface-hover) 50%, var(--bg-surface-elevated) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.2s infinite",
          }}
        />
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 44,
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(90deg, var(--bg-surface-elevated) 25%, var(--bg-surface-hover) 50%, var(--bg-surface-elevated) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.2s infinite",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
