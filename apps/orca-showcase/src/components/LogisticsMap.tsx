/* eslint-disable @remotion/non-pure-animation */
import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";

type Point = { x: number; y: number };

type Route = {
  id: string;
  from: string;
  to: string;
  p0: Point;
  p1: Point; // control point
  p2: Point;
  isCongested?: boolean;
};

const HUBS: Record<string, Point & { label: string }> = {
  medan: { x: 150, y: 150, label: "Medan" },
  jakarta: { x: 320, y: 295, label: "Jakarta" },
  surabaya: { x: 430, y: 305, label: "Surabaya" },
  balikpapan: { x: 390, y: 160, label: "Balikpapan" },
  makassar: { x: 550, y: 195, label: "Makassar" },
  jayapura: { x: 890, y: 190, label: "Jayapura" },
};

const ROUTES: Route[] = [
  {
    id: "jkt-medan",
    from: "jakarta",
    to: "medan",
    p0: HUBS.jakarta,
    p1: { x: 200, y: 200 },
    p2: HUBS.medan,
  },
  {
    id: "jkt-sub",
    from: "jakarta",
    to: "surabaya",
    p0: HUBS.jakarta,
    p1: { x: 375, y: 270 },
    p2: HUBS.surabaya,
  },
  {
    id: "sub-upg",
    from: "surabaya",
    to: "makassar",
    p0: HUBS.surabaya,
    p1: { x: 500, y: 230 },
    p2: HUBS.makassar,
    isCongested: true, // will turn red in congested mode
  },
  {
    id: "upg-bpn",
    from: "makassar",
    to: "balikpapan",
    p0: HUBS.makassar,
    p1: { x: 470, y: 150 },
    p2: HUBS.balikpapan,
  },
  {
    id: "upg-djj",
    from: "makassar",
    to: "jayapura",
    p0: HUBS.makassar,
    p1: { x: 720, y: 130 },
    p2: HUBS.jayapura,
  },
];

// Quadratic Bezier interpolation helper
const getBezierPoint = (p0: Point, p1: Point, p2: Point, t: number): Point => {
  const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
  const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
  return { x, y };
};

interface LogisticsMapProps {
  congested?: boolean;
  opacity?: number;
  startFrame: number;
}

export const LogisticsMap: React.FC<LogisticsMapProps> = ({
  congested = false,
  opacity = 1,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - startFrame);

  // Animation progress for route path drawing
  const pathDrawProgress = interpolate(localFrame, [10, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transition: "opacity 0.5s ease-in-out",
      }}
    >
      <svg
        viewBox="0 0 1000 400"
        style={{
          width: "100%",
          height: "auto",
          overflow: "visible",
        }}
      >
        <defs>
          {/* Glowing filter for nodes and particles */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Gradients for islands */}
          <linearGradient id="islandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5f5f4" />
            <stop offset="100%" stopColor="#e7e5e4" />
          </linearGradient>

          <linearGradient id="islandGradActive" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0fdf4" />
            <stop offset="100%" stopColor="#dcfce7" />
          </linearGradient>
        </defs>

        {/* ================= ISLANDS (Simplified high-tech polygons) ================= */}
        <g id="islands" opacity={0.85}>
          {/* Sumatra */}
          <path
            d="M 80,140 L 160,110 L 260,200 L 280,240 L 250,270 L 180,250 Z"
            fill="url(#islandGrad)"
            stroke="#d6d3d1"
            strokeWidth={1.5}
            style={{ filter: "drop-shadow(0px 4px 10px rgba(0,0,0,0.02))" }}
          />

          {/* Java */}
          <path
            d="M 290,290 L 490,305 L 485,315 L 290,300 Z"
            fill="url(#islandGradActive)"
            stroke="#bbf7d0"
            strokeWidth={1.5}
            style={{ filter: "drop-shadow(0px 4px 10px rgba(5,150,105,0.03))" }}
          />

          {/* Kalimantan */}
          <path
            d="M 330,120 L 430,95 L 470,145 L 435,210 L 375,210 L 330,165 Z"
            fill="url(#islandGrad)"
            stroke="#d6d3d1"
            strokeWidth={1.5}
            style={{ filter: "drop-shadow(0px 4px 10px rgba(0,0,0,0.02))" }}
          />

          {/* Sulawesi */}
          <path
            d="M 530,130 L 590,130 L 590,165 L 620,165 L 620,175 L 590,175 L 610,230 L 595,230 L 580,185 L 545,200 L 535,185 L 565,165 L 530,165 Z"
            fill="url(#islandGrad)"
            stroke="#d6d3d1"
            strokeWidth={1.5}
            style={{ filter: "drop-shadow(0px 4px 10px rgba(0,0,0,0.02))" }}
          />

          {/* Bali & Nusa Tenggara */}
          <path
            d="M 500,308 L 505,308 L 515,310 L 530,311 L 550,312 L 580,314 L 600,315 M 500,312 L 600,318"
            stroke="#d6d3d1"
            strokeWidth={2}
            strokeDasharray="4 4"
            fill="none"
          />

          {/* Papua */}
          <path
            d="M 750,180 L 830,150 L 920,180 L 920,225 L 850,240 L 795,215 Z"
            fill="url(#islandGrad)"
            stroke="#d6d3d1"
            strokeWidth={1.5}
            style={{ filter: "drop-shadow(0px 4px 10px rgba(0,0,0,0.02))" }}
          />
        </g>

        {/* ================= ROUTES (Animated curved lines) ================= */}
        <g id="routes">
          {ROUTES.map((route) => {
            const isRouteRed = congested && route.isCongested;
            const strokeColor = isRouteRed
              ? "#ef4444"
              : "#10b981"; // Red vs Emerald
            const strokeWidth = isRouteRed ? 2.5 : 1.5;
            const pathData = `M ${route.p0.x},${route.p0.y} Q ${route.p1.x},${route.p1.y} ${route.p2.x},${route.p2.y}`;

            return (
              <path
                key={route.id}
                d={pathData}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={isRouteRed ? "6 4" : "1000"}
                strokeDashoffset={isRouteRed ? -localFrame * 0.8 : (1 - pathDrawProgress) * 1000}
                opacity={isRouteRed ? 0.9 : 0.45}
                style={{
                  transition: "stroke 0.4s, stroke-width 0.4s",
                }}
              />
            );
          })}
        </g>

        {/* ================= PARTICLES (Shipments flowing along curves) ================= */}
        <g id="particles">
          {ROUTES.map((route) => {
            const isRouteRed = congested && route.isCongested;
            
            // Two staggered particles per route
            const particleOffsets = [0, 45];
            const duration = 90; // frames for 1 full cycle

            return particleOffsets.map((offset, pIdx) => {
              const progress = ((localFrame + offset) % duration) / duration;
              const pos = getBezierPoint(route.p0, route.p1, route.p2, progress);

              // Don't show particle if route is not drawn yet
              if (pathDrawProgress < 0.1) return null;

              const size = isRouteRed ? 5 : 4;
              const color = isRouteRed ? "#f87171" : "#34d399";
              const opacityVal = interpolate(
                progress,
                [0, 0.15, 0.85, 1],
                [0, 0.9, 0.9, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );

              return (
                <circle
                  key={`${route.id}-p-${pIdx}`}
                  cx={pos.x}
                  cy={pos.y}
                  r={size}
                  fill={color}
                  opacity={opacityVal}
                  filter="url(#glow)"
                />
              );
            });
          })}
        </g>

        {/* ================= HUBS (Pulsing city nodes) ================= */}
        <g id="hubs">
          {Object.keys(HUBS).map((key) => {
            const hub = HUBS[key];
            const isRedHub = congested && key === "makassar"; // highlight Makassar congestion
            const hubColor = isRedHub ? "#ef4444" : "#059669";
            
            // Pulsing circle ring scale
            const pulseScale = interpolate(
              (localFrame + (key.charCodeAt(0) * 5)) % 60,
              [0, 60],
              [1, 2.5]
            );
            const pulseOpacity = interpolate(
              (localFrame + (key.charCodeAt(0) * 5)) % 60,
              [0, 45, 60],
              [0.6, 0.4, 0]
            );

            return (
              <g key={key}>
                {/* Glowing pulse ring */}
                <circle
                  cx={hub.x}
                  cy={hub.y}
                  r={7 * pulseScale}
                  fill="none"
                  stroke={hubColor}
                  strokeWidth={1.5}
                  opacity={pulseOpacity}
                />

                {/* Core node */}
                <circle
                  cx={hub.x}
                  cy={hub.y}
                  r={5}
                  fill={hubColor}
                  filter={isRedHub ? "url(#glow-red)" : "url(#glow)"}
                  style={{ transition: "fill 0.4s" }}
                />

                {/* Label */}
                <text
                  x={hub.x}
                  y={hub.y - 12}
                  textAnchor="middle"
                  fill={isRedHub ? "#b91c1c" : "#1c1917"}
                  style={{
                    fontSize: isRedHub ? "13px" : "11px",
                    fontWeight: isRedHub ? 700 : 600,
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "0.02em",
                    transition: "fill 0.4s, font-size 0.4s",
                  }}
                >
                  {hub.label}
                </text>

                {/* Warning icon for congested hub */}
                {isRedHub && (
                  <g transform={`translate(${hub.x - 8}, ${hub.y + 12}) scale(0.7)`}>
                    <rect
                      x={-2}
                      y={-2}
                      width={20}
                      height={20}
                      rx={4}
                      fill="#fee2e2"
                      stroke="#ef4444"
                      strokeWidth={1}
                    />
                    <path
                      d="M 8,2 L 14,13 L 2,13 Z"
                      fill="#ef4444"
                      transform="scale(0.8) translate(2, 2)"
                    />
                    <text
                      x={8}
                      y={12}
                      textAnchor="middle"
                      fill="#ffffff"
                      style={{ fontSize: "8px", fontWeight: "bold", fontFamily: "sans-serif" }}
                    >
                      !
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
