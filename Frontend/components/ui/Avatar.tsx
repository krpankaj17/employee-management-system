import React from "react";

interface AvatarProps {
  name: string;
  size?: number;
  src?: string;
  className?: string;
  ring?: boolean;
}

export function Avatar({ name, size = 38, src, className = "", ring = false }: AvatarProps) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  let initials = "U";
  if (parts.length >= 2) {
    const first = parts[0][0] || "";
    const last = parts[parts.length - 1][0] || "";
    initials = `${first}${last}`;
  } else if (parts.length === 1 && parts[0]) {
    initials = parts[0].slice(0, 2);
  }
  initials = initials.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2) || "U";

  // Generate deterministic gradient based on name string
  const colors = [
    "linear-gradient(135deg, #6366f1, #22d3ee)",
    "linear-gradient(135deg, #8b5cf6, #ec4899)",
    "linear-gradient(135deg, #10b981, #06b6d4)",
    "linear-gradient(135deg, #f59e0b, #ef4444)",
    "linear-gradient(135deg, #3b82f6, #6366f1)",
  ];

  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = (name || "").charCodeAt(i) + ((hash << 5) - hash);
  }
  const bg = colors[Math.abs(hash) % colors.length];

  const ringStyle: React.CSSProperties = ring
    ? {
        boxShadow: "0 0 0 2px var(--bg-surface), 0 0 0 4px rgba(6, 182, 212, 0.4)",
      }
    : {
        border: "1px solid rgba(255, 255, 255, 0.15)",
      };

  if (src) {
    return (
      <div
        suppressHydrationWarning
        className={`avatar ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          ...ringStyle,
        }}
        title={name}
      >
        <img
          src={src}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => {
            // Fallback to gradient initials if image fails
            (e.currentTarget.style as any).display = "none";
          }}
        />
      </div>
    );
  }

  return (
    <div
      suppressHydrationWarning
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        flexShrink: 0,
        fontSize: Math.max(11, Math.round(size * 0.38)),
        fontWeight: 700,
        lineHeight: 1,
        userSelect: "none",
        background: bg,
        ...ringStyle,
      }}
      title={name}
    >
      {initials.toUpperCase()}
    </div>
  );
}
