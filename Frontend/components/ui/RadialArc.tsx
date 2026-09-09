import React from "react";

interface RadialArcProps {
  percentage?: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  variant?: "cyan" | "purple" | "blue" | "teal" | "emerald";
  className?: string;
  rotation?: number; // deg
}

export function RadialArc({
  percentage = 70,
  size = 72,
  strokeWidth = 4.5,
  variant = "cyan",
  className = "",
  rotation = 120,
}: RadialArcProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  // Arc spans a portion of the circle (e.g. 40% to 75%)
  const maxArcLength = circumference * 0.72;
  const strokeDashoffset = maxArcLength - (percentage / 100) * maxArcLength;

  // Gradients and glow colors based on variant
  const config = {
    cyan: {
      from: "#00f2fe",
      to: "#06b6d4",
      glow: "rgba(6, 182, 212, 0.75)",
      track: "rgba(6, 182, 212, 0.12)",
    },
    purple: {
      from: "#8b5cf6",
      to: "#6366f1",
      glow: "rgba(99, 102, 241, 0.75)",
      track: "rgba(99, 102, 241, 0.12)",
    },
    blue: {
      from: "#38bdf8",
      to: "#6366f1",
      glow: "rgba(56, 189, 248, 0.75)",
      track: "rgba(56, 189, 248, 0.12)",
    },
    teal: {
      from: "#2dd4bf",
      to: "#0ea5e9",
      glow: "rgba(45, 212, 191, 0.75)",
      track: "rgba(45, 212, 191, 0.12)",
    },
    emerald: {
      from: "#34d399",
      to: "#059669",
      glow: "rgba(52, 211, 153, 0.75)",
      track: "rgba(52, 211, 153, 0.12)",
    },
  }[variant];

  const gradientId = `radial-grad-${variant}-${percentage}`;

  return (
    <div
      className={`radial-arc-container ${className}`}
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          transform: `rotate(${rotation}deg)`,
          overflow: "visible",
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.from} />
            <stop offset="100%" stopColor={config.to} />
          </linearGradient>
        </defs>

        {/* Ambient Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={config.track}
          strokeWidth={strokeWidth}
          strokeDasharray={`${maxArcLength} ${circumference}`}
          strokeLinecap="round"
        />

        {/* Glowing Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={`${maxArcLength} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${config.glow}) drop-shadow(0 0 12px ${config.glow})`,
            transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </svg>
    </div>
  );
}
