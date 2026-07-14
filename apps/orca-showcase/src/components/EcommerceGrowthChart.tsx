import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";

const chartPoints = [
  { year: "2021", val: 1.2, x: 60, y: 193 },
  { year: "2022", val: 2.0, x: 140, y: 175 },
  { year: "2023", val: 3.4, x: 220, y: 143.5 },
  { year: "2024", val: 4.8, x: 300, y: 112 },
  { year: "2025", val: 6.2, x: 380, y: 80.5 },
  { year: "2026", val: 7.8, x: 460, y: 44.5 },
];

const RollingDigit: React.FC<{
  target: number;
  progress: number;
  height: number;
}> = ({ target, progress, height }) => {
  const digits = Array.from({ length: target + 1 }, (_, idx) => idx);
  const currentOffset = progress * target * height;

  return (
    <div style={{
      height: `${height}px`,
      overflow: "hidden",
      display: "inline-block",
      position: "relative",
      width: "0.55em",
    }}>
      <div style={{
        transform: `translateY(-${currentOffset}px)`,
        display: "flex",
        flexDirection: "column",
        height: `${(target + 1) * height}px`,
      }}>
        {digits.map((d) => (
          <span key={d} style={{
            height: `${height}px`,
            lineHeight: `${height}px`,
            display: "block",
            textAlign: "center",
          }}>
            {d}
          </span>
        ))}
      </div>
    </div>
  );
};

const RollingCounter: React.FC<{
  value: number | string;
  startFrame: number;
  delay?: number;
  duration?: number;
  fontSize?: number;
}> = ({ value, startFrame, delay = 0, duration = 30, fontSize = 48 }) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - startFrame - delay);
  
  const progress = interpolate(t, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const height = fontSize;
  const digitsStr = String(value).split("");

  return (
    <div style={{
      display: "inline-flex",
      justifyContent: "center",
      alignItems: "center",
      fontSize: `${fontSize}px`,
      height: `${height}px`,
      lineHeight: `${height}px`,
      fontFamily: "Inter, sans-serif",
    }}>
      {digitsStr.map((char, i) => {
        if (isNaN(Number(char)) || char === " ") {
          return (
            <span key={i} style={{
              width: char === "." ? "0.22em" : "auto",
              display: "inline-block",
              textAlign: "center",
            }}>
              {char}
            </span>
          );
        }
        return (
          <RollingDigit
            key={i}
            target={Number(char)}
            progress={progress}
            height={height}
          />
        );
      })}
    </div>
  );
};

interface EcommerceGrowthChartProps {
  startFrame: number;
}

export const EcommerceGrowthChart: React.FC<EcommerceGrowthChartProps> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - startFrame);

  // Line drawing animation progress
  const progress = interpolate(localFrame, [15, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 1, 0.5, 1),
  });

  const currentX = 60 + progress * 400;

  // Build points path dynamically
  const activePoints: { x: number; y: number }[] = [];
  let currentY = chartPoints[0].y;

  for (let i = 0; i < chartPoints.length; i++) {
    const pt = chartPoints[i];
    if (pt.x <= currentX) {
      activePoints.push({ x: pt.x, y: pt.y });
      currentY = pt.y;
    } else {
      const prev = chartPoints[i - 1];
      const segmentProgress = (currentX - prev.x) / (pt.x - prev.x);
      currentY = prev.y + (pt.y - prev.y) * segmentProgress;
      activePoints.push({ x: currentX, y: currentY });
      break;
    }
  }

  const linePath = activePoints.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");
  const areaPath = activePoints.length > 0 ? `${linePath} L ${currentX} 220 L 60 220 Z` : "";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 40px",
      }}
    >
      {/* Chart Title and Scrolling Metric Counter */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#78716c", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          Annual Shipment Volume
        </span>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span style={{ color: "#059669" }}>
            <RollingCounter value="7.8" startFrame={startFrame} delay={15} duration={105} fontSize={54} />
          </span>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#10b981", letterSpacing: "-0.01em", marginTop: 4 }}>
            Billion Packages
          </span>
        </div>
      </div>

      {/* SVG Line and Area Chart */}
      <div style={{ width: "100%", maxWidth: 500, background: "rgba(0,0,0,0.01)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.04)", padding: 12 }}>
        <svg viewBox="0 0 500 260" style={{ width: "100%", height: "auto", overflow: "visible" }}>
          <defs>
            {/* Area gradient */}
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines (Y axis markers at 0, 2, 4, 6, 8 Billions) */}
          {[220, 175, 130, 85, 40].map((y, idx) => (
            <g key={y}>
              <line x1="60" y1={y} x2="460" y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth={1} strokeDasharray="4 4" />
              <text x="45" y={y + 4} textAnchor="end" style={{ fontSize: 12, fill: "#78716c", fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
                {idx * 2}B
              </text>
            </g>
          ))}

          {/* Year Labels along X axis */}
          {chartPoints.map((pt) => (
            <text
              key={pt.year}
              x={pt.x}
              y="245"
              textAnchor="middle"
              style={{ fontSize: 13, fill: "#78716c", fontWeight: 600, fontFamily: "Inter, sans-serif" }}
            >
              {pt.year}
            </text>
          ))}

          {/* Area under the curve */}
          {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

          {/* Sparkline path */}
          {linePath && <path d={linePath} fill="none" stroke="#10b981" strokeWidth={3.5} strokeLinecap="round" />}

          {/* Pulsing leading node */}
          {progress > 0.01 && (
            <g filter="url(#glow)">
              <circle cx={currentX} cy={currentY} r={8} fill="#059669" />
              <circle cx={currentX} cy={currentY} r={4} fill="#ffffff" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
