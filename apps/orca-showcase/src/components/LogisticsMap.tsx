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

// Hub coordinates scaled for 260x82 viewBox
const HUBS: Record<string, Point & { label: string }> = {
  medan: { x: 28, y: 25, label: "Medan" },
  jakarta: { x: 75, y: 63, label: "Jakarta" },
  surabaya: { x: 100, y: 68, label: "Surabaya" },
  balikpapan: { x: 118, y: 34, label: "Balikpapan" },
  makassar: { x: 138, y: 50, label: "Makassar" },
  jayapura: { x: 252, y: 35, label: "Jayapura" },
};

const ROUTES: Route[] = [
  {
    id: "jkt-medan",
    from: "jakarta",
    to: "medan",
    p0: HUBS.jakarta,
    p1: { x: 55, y: 38 },
    p2: HUBS.medan,
  },
  {
    id: "jkt-sub",
    from: "jakarta",
    to: "surabaya",
    p0: HUBS.jakarta,
    p1: { x: 99, y: 62 },
    p2: HUBS.surabaya,
  },
  {
    id: "sub-upg",
    from: "surabaya",
    to: "makassar",
    p0: HUBS.surabaya,
    p1: { x: 132, y: 64 },
    p2: HUBS.makassar,
    isCongested: true, // will turn red in congested mode
  },
  {
    id: "upg-bpn",
    from: "makassar",
    to: "balikpapan",
    p0: HUBS.makassar,
    p1: { x: 138, y: 42 },
    p2: HUBS.balikpapan,
  },
  {
    id: "upg-djj",
    from: "makassar",
    to: "jayapura",
    p0: HUBS.makassar,
    p1: { x: 200, y: 30 },
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
        viewBox="-8 -8 276 98"
        style={{
          width: "100%",
          height: "auto",
          overflow: "visible",
        }}
      >
        <defs>
          {/* Glowing filter for nodes and particles */}
          <filter id="mapGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          <filter id="mapGlowRed" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Gradients for islands */}
          <linearGradient id="islandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5f5f4" />
            <stop offset="100%" stopColor="#e7e5e4" />
          </linearGradient>
        </defs>

        {/* ================= INDONESIA MAP (Neat public domain outline) ================= */}
        <g id="indonesia-outline" opacity={0.85}>
          <path
            d="M124.786,30.3l1.038-8.14l5.332-0.26l-0.519-2.383l-4.861-3.138l1.133-2.076l-5.12-6.914l-0.236-4.011l-8.376,1.463
	l-0.637,6.135l-4.695,8.801l-4.53,1.321L99.87,19.66l-4.507,0.707L93.57,22.82l-8.352,0.496l-5.215-4.766l-2.312,6.04l1.321,5.686
	l5.592,5.285l1.746,9.084l3.681-0.826l9.06,2.407l2.926-2.006l6.134,1.581l1.888,3.846l7.055-3.35l2.925-6.819l-1.51-3.445
	L124.786,30.3z M101.002,68.098l-1.014-3.303l-5.026-0.661l-5.403-0.944l-0.92,2.431l-8.471-0.213l-3.893-2.902l-6.535-0.401
	l-1.392-0.024l-3.705-0.707l-1.227,3.468l3.516,2.359l0.778,2.195l10.429,1.533l1.793-0.943l6.701,0.802l4.365,1.415l0.543,0.118
	l11.986-0.377l4.247,1.628l2.383-4.341l-6.229,0.094L101.002,68.098z M160.177,79.494l3.634,0.566l3.421-3.751l-0.802-2.855
	L160.177,79.494z M140.924,70.458l-1.463,3.186l10.051-0.236l5.427-1.628l0.873-2.548l-3.657,2.76L140.924,70.458z M164.306,19.163
	l-2.052-2.005l-3.776,3.114l-8.966-0.566l-7.101-1.369l-1.676,3.162l-2.737,0.377l-2.241,8.612l-0.944,6.159l-2.926,4.483
	l1.109,4.199l3.044-0.566l0.92,4.412l-1.25,5.663l2.524,1.722l2.761-1.109l0.448-4.766l-0.637-7.597l3.728-1.817l-0.897,3.445
	l3.634,3.586l5.804,0.661l-1.651-6.229l-4.672-6.158l4.389-3.28l2.265-3.209h-7.15l-2.17,3.162l-5.545-3.846l1.227-6.205
	l-5.214-0.189l8.943-0.59l2.666,0.779l4.719-0.732L164.306,19.163z M185.282,14.658l-7.22,2.312l4.152,10.547l0.795-0.636
	l-1.62-5.947l3.94-3.492L185.282,14.658z M175.679,45.188l1.817-3.705l-6.088,0.496l-0.896,2.581L175.679,45.188z M184.463,40.77
	l-0.283,2.761l7.205-0.526l7.204,1.475l-1.628-4.129l-5.577-0.813L184.463,40.77z M122.945,72.298l1.038,3.161l9.249-1.981
	l1.133-2.69l-6.205,0.472L122.945,72.298z M257.74,35.421l-6.771-1.18l-12.6-4.837l-8.069,4.625l-5.238,6.818l-2.831-0.118
	l-1.911-2.784l-2.855-2.524l0.283-5.946l-1.935-3.516l-3.374,0.165l-4.011-1.887l-8.235,3.02l-1.439,3.586l5.356,0.661l5.073,6.654
	l0.118,4.978l3.138,2.029l1.746-2.831l7.527,3.775l6.417,1.392l10.264,3.988l6.63,9.367l1.557,4.506l-1.242,2.728l-0.457-3.86
	l-4.601,1.368l-2.359,4.554l4.742,0.023l2.582-1.879l-0.222,0.487l6.512-0.047l6.111,6.182L258,58.118L257.74,35.421z
	 M63.888,47.288l-2.69-4.46l-4.034-0.377l-3.115-6.607l-5.19-1.25l1.462-5.427l-7.196-2.524l-2.053-3.233l-3.846-1.557l-2.099-2.69
	l-4.224-1.652l-3.232-3.303l-8.14-4.624L14.859,3.26L7.238,3.285L2,1.939l1.392,3.988l5.757,5.403l2.572,0.708l5.073,7.573
	l2.005,0.425l3.775,3.445l2.525,6.913l3.374,1.392l7.786,12.953l14.888,12.293l3.964,3.681l8.069,0.472l-0.306-8.99L63.888,47.288z
	 M114.49,74.372l-4.333-2.917l6.083-0.667l1.417,2.167L114.49,74.372z"
            fill="url(#islandGrad)"
            stroke="#d6d3d1"
            strokeWidth={0.7}
            style={{
              filter: "drop-shadow(0px 2px 5px rgba(0,0,0,0.03))",
            }}
          />
        </g>

        {/* ================= ROUTES (Animated curved lines) ================= */}
        <g id="routes">
          {ROUTES.map((route) => {
            const isRouteRed = congested && (
              route.id === "sub-upg" ? true :
              (route.id === "upg-bpn" || route.id === "upg-djj") ? (frame >= 1480) : false
            );
            const strokeColor = isRouteRed ? "#ef4444" : "#10b981";
            const strokeWidth = isRouteRed ? 0.9 : 0.6;
            const pathData = `M ${route.p0.x},${route.p0.y} Q ${route.p1.x},${route.p1.y} ${route.p2.x},${route.p2.y}`;

            return (
              <path
                key={route.id}
                d={pathData}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={isRouteRed ? "2 1" : "1000"}
                strokeDashoffset={isRouteRed ? -localFrame * 0.3 : (1 - pathDrawProgress) * 1000}
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
            const isRouteRed = congested && (
              route.id === "sub-upg" ? true :
              (route.id === "upg-bpn" || route.id === "upg-djj") ? (frame >= 1480) : false
            );
            const particleOffsets = [0, 45];
            const duration = 90;

            return particleOffsets.map((offset, pIdx) => {
              const progress = ((localFrame + offset) % duration) / duration;
              const pos = getBezierPoint(route.p0, route.p1, route.p2, progress);

              if (pathDrawProgress < 0.1) return null;

              const size = isRouteRed ? 1.5 : 1.2;
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
                  filter="url(#mapGlow)"
                />
              );
            });
          })}
        </g>

        {/* ================= HUBS (Pulsing city nodes) ================= */}
        <g id="hubs">
          {Object.keys(HUBS).map((key) => {
            const hub = HUBS[key];
            const isRedHub = congested && (
              key === "makassar" ? true :
              (key === "balikpapan" || key === "jayapura") ? (frame >= 1480) : false
            );
            const hubColor = isRedHub ? "#ef4444" : "#059669";
            
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
                {/* Pulse ring */}
                <circle
                  cx={hub.x}
                  cy={hub.y}
                  r={1.5 * pulseScale}
                  fill="none"
                  stroke={hubColor}
                  strokeWidth={0.5}
                  opacity={pulseOpacity}
                />

                {/* Core node */}
                <circle
                  cx={hub.x}
                  cy={hub.y}
                  r={1.2}
                  fill={hubColor}
                  filter={isRedHub ? "url(#mapGlowRed)" : "url(#mapGlow)"}
                  style={{ transition: "fill 0.4s" }}
                />

                {/* Label */}
                <text
                  x={hub.x}
                  y={hub.y - 3.5}
                  textAnchor="middle"
                  fill={isRedHub ? "#b91c1c" : "#1c1917"}
                  style={{
                    fontSize: isRedHub ? "4px" : "3.2px",
                    fontWeight: isRedHub ? 800 : 600,
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "0.02em",
                    transition: "fill 0.4s, font-size 0.4s",
                  }}
                >
                  {hub.label}
                </text>

                {/* Warning icon for red hubs */}
                {isRedHub && (
                  <g transform={`translate(${hub.x - 2.5}, ${hub.y + 2.5}) scale(0.3)`}>
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
