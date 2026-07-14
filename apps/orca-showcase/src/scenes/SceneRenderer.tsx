import React from "react";
import { useCurrentFrame, interpolate, Easing, Img, staticFile, Interactive } from "remotion";
import { LogisticsMap } from "../components/LogisticsMap";
import { EcommerceGrowthChart } from "../components/EcommerceGrowthChart";
import { Terminal, Cpu, Lightbulb, Compass, Palette, Clock, Route, Leaf } from "lucide-react";

/* ================================================================
   Warm Light palette (clean professional, great for projectors)
   Background: #fafaf9 (stone-50)
   Card bg:    #ffffff
   Title:      #1c1917 (stone-900)
   Body:       #44403c (stone-600)
   Muted:      #78716c (stone-500)
   Accent:     #059669 (emerald-600)
   Border:     rgba(0,0,0,0.06)
   Shadow:     0 2px 16px rgba(0,0,0,0.05)
   ================================================================ */

const CARD_BG = "#ffffff";
const CARD_RADIUS = 16;
const CARD_SHADOW = "0 2px 16px rgba(0,0,0,0.05)";
const CARD_PAD = 36;

type SlideProps = {
  children: React.ReactNode;
  startFrame: number;
  delay?: number;
  duration?: number;
  style?: React.CSSProperties;
  className?: string;
};

const SlideUp: React.FC<SlideProps> = ({
  children, startFrame, delay = 0, duration = 22, style, className,
}) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - startFrame - delay);
  return (
    <div
      className={className}
      style={{
        opacity: interpolate(t, [0, duration], [0, 1], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:Easing.bezier(0.16,1,0.3,1)}),
        translate: `0px ${interpolate(t, [0, duration], [20, 0], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:Easing.bezier(0.16,1,0.3,1)})}px`,
        background: CARD_BG,
        borderRadius: CARD_RADIUS,
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: CARD_SHADOW,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* ================================================================
   AnimatedBg (gentle drifting gradient + floating decorative dots)
   ================================================================ */
const PARTICLE_COUNT = 8;

const AnimatedBg: React.FC = () => {
  const frame = useCurrentFrame();
  const x = 30 + ((frame * 5) % 800) / 800 * 40;
  const y = 40 + ((frame * 3 + 200) % 600) / 600 * 30;

  return (
    <>
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at ${x}% ${y}%, rgba(5,150,105,0.04) 0%, transparent 60%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at ${100 - x}% ${100 - y}%, rgba(251,191,36,0.025) 0%, transparent 55%)`,
        pointerEvents: "none",
      }} />
      {/* Floating decorative dots */}
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const seed = i * 137.5;
        const cx = 10 + ((seed * 7 + frame * 0.15) % 80);
        const cy = 10 + ((seed * 11 + frame * 0.1 + 50) % 80);
        const size = 3 + (seed % 5);
        const opa = 0.04 + ((seed + frame * 0.5) % 100) / 100 * 0.06;
        return (
          <div key={i} style={{
            position: "absolute", left: `${cx}%`, top: `${cy}%`,
            width: size, height: size, borderRadius: "50%",
            background: "rgba(5,150,105,0.3)", opacity: opa,
            pointerEvents: "none",
          }} />
        );
      })}
    </>
  );
};

/* Small accent bar - white */
const Bar: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{
      width: interpolate(Math.max(0, frame - delay), [0, 16], [0, 48], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:Easing.bezier(0.16,1,0.3,1)}),
      height: 2, borderRadius: 1, background: "rgba(0,0,0,0.08)", marginBottom: 20,
    }} />
  );
};



/* ================================================================
   Animated bar chart (horizontal bars growing with stagger)
   ================================================================ */
type BarItem = {
  country: string;
  rank: number;
  score: number;
};

const LPI_DATA: BarItem[] = [
  { country: "Singapore", rank: 1, score: 100 },
  { country: "Netherlands", rank: 2, score: 94 },
  { country: "Germany", rank: 5, score: 86 },
  { country: "Japan", rank: 13, score: 72 },
  { country: "Indonesia", rank: 61, score: 42 },
];

const AnimatedBarChart: React.FC<{
  data: BarItem[];
  startFrame: number;
  delay?: number;
  stagger?: number;
  duration?: number;
}> = ({ data, startFrame, delay = 0, stagger: st = 6, duration = 28 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((item, i) => {
        const t = Math.max(0, frame - startFrame - delay - i * st);
        const w = interpolate(t, [0, duration], [0, item.score], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        const isID = item.country === "Indonesia";
        const glowOpacity = isID
          ? interpolate(Math.sin(frame * 0.12), [-1, 1], [0.08, 0.22])
          : 0;
        return (
          <div
            key={item.country}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: isID ? `rgba(5,150,105,${glowOpacity})` : "transparent",
              borderRadius: 8,
              padding: "4px 10px",
              border: isID ? "1px solid rgba(5,150,105,0.25)" : "1px solid transparent",
              boxShadow: isID ? "0 2px 10px rgba(5,150,105,0.05)" : "none",
              margin: "0 -10px",
            }}
          >
            <span style={{
              width: 100, fontSize: 15, fontWeight: isID ? 700 : 500,
              color: isID ? "#059669" : "#44403c", textAlign: "right", flexShrink: 0,
            }}>
              {item.country}
            </span>
            <div style={{ flex: 1, height: 26, background: "rgba(0,0,0,0.04)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{
                width: `${w}%`, height: "100%",
                background: isID ? "#059669" : "rgba(0,0,0,0.1)",
                borderRadius: 6,
              }} />
            </div>
            <span style={{
              width: 44, fontSize: 15, fontWeight: 700,
              color: isID ? "#059669" : "#1c1917", flexShrink: 0,
            }}>
              #{item.rank}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ================================================================
   Text rotator (cycles through phrases with crossfade)
   ================================================================ */
const TAGLINES = [
    "AI Powered Logistics Intelligence Platform",
  "Predict SLA Failures Before They Happen",
    "Multi Objective Route Optimization",
    "GLEC Certified Carbon Tracking",
];

const TextRotator: React.FC<{
  startFrame: number; delay?: number; interval?: number;
  style?: React.CSSProperties;
}> = ({ startFrame, delay = 0, interval = 45, style }) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - startFrame - delay);
  const idx = Math.floor(t / interval) % TAGLINES.length;
  const cycleT = t % interval;

  return (
    <span
      style={{
        fontSize: 15, fontWeight: 500, color: "#44403c",
        letterSpacing: "0.04em",
        opacity: interpolate(
          cycleT, [0, 10, interval - 12, interval], [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) },
        ),
        translate: `0px ${interpolate(
          cycleT, [0, 10, interval - 12, interval], [8, 0, 0, -8],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) },
        )}px`,
        ...style,
      }}
    >
      {TAGLINES[idx]}
    </span>
  );
};

/* ================================================================
   Abstract Constellation / Network Plexus for Opening background
   ================================================================ */
const NetworkNodes: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - startFrame);

  // 16 node points with drift offsets
  const nodes = [
    { x: 150, y: 80, dx: 30, dy: 20, speed: 0.012 },
    { x: 300, y: 180, dx: 40, dy: 30, speed: 0.008 },
    { x: 500, y: 110, dx: 20, dy: 40, speed: 0.016 },
    { x: 680, y: 220, dx: 45, dy: 20, speed: 0.01 },
    { x: 850, y: 90, dx: 30, dy: 35, speed: 0.014 },
    { x: 220, y: 260, dx: 25, dy: 25, speed: 0.018 },
    { x: 420, y: 280, dx: 35, dy: 20, speed: 0.011 },
    { x: 580, y: 70, dx: 40, dy: 25, speed: 0.009 },
    { x: 740, y: 260, dx: 20, dy: 40, speed: 0.013 },
    { x: 920, y: 160, dx: 40, dy: 30, speed: 0.011 },
    { x: 100, y: 200, dx: 20, dy: 45, speed: 0.02 },
    { x: 260, y: 60, dx: 35, dy: 35, speed: 0.013 },
    { x: 520, y: 230, dx: 30, dy: 25, speed: 0.015 },
    { x: 780, y: 140, dx: 25, dy: 30, speed: 0.017 },
    { x: 880, y: 290, dx: 40, dy: 20, speed: 0.012 },
    { x: 360, y: 100, dx: 25, dy: 25, speed: 0.02 },
  ];

  const currentPositions = nodes.map((node) => {
    const angle = localFrame * node.speed;
    const x = node.x + Math.sin(angle) * node.dx;
    const y = node.y + Math.cos(angle) * node.dy;
    return { x, y };
  });

  return (
    <svg viewBox="0 0 1000 400" style={{ width: "100%", height: "100%", overflow: "visible" }}>
      {/* Dynamic connection lines */}
      {currentPositions.map((p1, i) => {
        return currentPositions.slice(i + 1).map((p2, j) => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 180) return null;

          const opacity = interpolate(dist, [70, 180], [0.3, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <line
              key={`line-${i}-${i + 1 + j}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#059669"
              strokeWidth={1}
              opacity={opacity}
            />
          );
        });
      })}

      {/* Nodes */}
      {currentPositions.map((pos, i) => {
        return (
          <circle
            key={`node-${i}`}
            cx={pos.x}
            cy={pos.y}
            r={nodes[i].speed * 200 + 1.5}
            fill="#059669"
            opacity={0.45}
            style={{
              filter: "drop-shadow(0px 0px 4px rgba(5,150,105,0.4))",
            }}
          />
        );
      })}
    </svg>
  );
};

/* ================================================================
   Rolling Digit Odometer counter for premium metric scrolling
   ================================================================ */
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
}> = ({ value, startFrame, delay = 0, duration = 30, fontSize = 64 }) => {
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

/* ================================================================
   Scene 1: Opening (0-450)
   ================================================================ */
const OpeningTitle: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Interactive.Div name="Opening" className="absolute inset-0 bg-stone-50 flex flex-col items-center justify-center" style={{ padding: 80 }}>
      <AnimatedBg />

      {/* Background Abstract Network Nodes */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: interpolate(frame, [0, 20, 420, 450], [0, 0.45, 0.45, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
        pointerEvents: "none",
        transform: `scale(${interpolate(frame, [0, 450], [0.95, 1.05], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})})`,
      }}>
        <NetworkNodes startFrame={0} />
      </div>

      <SlideUp startFrame={0} delay={8} duration={28} className="flex flex-col items-center" style={{ padding: `${CARD_PAD}px 64px`, minWidth: 640, maxWidth: 820, zIndex: 10 }}>
        <div style={{ scale: String(interpolate(frame, [15, 70], [0.85, 1], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:Easing.bezier(0.16,1,0.3,1)})) }}>
          <Img src={staticFile("logo.png")} style={{ height: 100, width: "auto", marginBottom: 24 }} alt="ORCA" />
        </div>

        <span style={{
          fontSize: 28, fontWeight: 600, color: "#059669", letterSpacing: "0.15em", textTransform: "uppercase",
          textAlign: "center",
          opacity: interpolate(Math.max(0, frame-70), [0, 22], [0, 1], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:Easing.bezier(0.16,1,0.3,1)}),
          translate: `0px ${interpolate(Math.max(0, frame-70), [0, 22], [14, 0], {extrapolateLeft:"clamp",extrapolateRight:"clamp"})}px`,
        }}>
          AI Powered Carbon Aware Logistics Intelligence
        </span>

        <div style={{
          width: "60%", height: 1, background: "rgba(0,0,0,0.06)", marginTop: 28, marginBottom: 28,
          opacity: interpolate(Math.max(0, frame-105), [0, 14], [0, 1], {extrapolateLeft:"clamp",extrapolateRight:"clamp"}),
        }} />

        <div className="flex items-center justify-center" style={{
          gap: 42,
          opacity: interpolate(Math.max(0, frame-120), [0, 20], [0, 1], {extrapolateLeft:"clamp",extrapolateRight:"clamp"}),
          translate: `0px ${interpolate(Math.max(0, frame-120), [0, 20], [12, 0], {extrapolateLeft:"clamp",extrapolateRight:"clamp"})}px`,
        }}>
          <Img src={staticFile("blibli_logo.png")} style={{ height: 56, width: "auto", opacity: 0.9 }} alt="Blibli" />
          <Img src={staticFile("fablab_logo.png")} style={{ height: 56, width: "auto", opacity: 0.85 }} alt="FabLab" />
          <Img src={staticFile("kemenko_logo.png")} style={{ height: 56, width: "auto", opacity: 0.85 }} alt="Kemenko" />
        </div>
      </SlideUp>
    </Interactive.Div>
  );
};

/* ================================================================
   Scene 2: Team (450-900)
   ================================================================ */
const TEAM = [
  { name: "Raihan Putra Kirana", role: "Project Lead and Software", icon: Terminal },
  { name: "Husni Abdillah", role: "AI Engineer", icon: Cpu },
  { name: "Steven Lie Wibowo", role: "Solution and Innovation Analyst", icon: Lightbulb },
  { name: "Hilfani Rayyanne Subagio", role: "Product Strategy Analyst", icon: Compass },
  { name: "Muhammad Abyan Putra Wibowo", role: "Product Designer", icon: Palette },
];

const TeamShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const base = 450;

  return (
    <Interactive.Div name="Team" className="absolute inset-0 bg-stone-50 flex flex-col items-center justify-center" style={{ padding: 80 }}>
      <AnimatedBg />
      <div className="flex flex-col items-center" style={{ maxWidth: 720, width: "100%" }}>
        <SlideUp startFrame={base} delay={5} duration={22} className="flex flex-col" style={{ width: "100%", padding: CARD_PAD, gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 600, color: "#1c1917", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            Team
          </span>
          {TEAM.map((m, i) => {
            const t = Math.max(0, frame - base - 28 - i * 8);
            return (
              <div key={m.name} style={{
                opacity: interpolate(t, [0, 12], [0, 1], {extrapolateLeft:"clamp",extrapolateRight:"clamp"}),
                translate: `0px ${interpolate(t, [0, 12], [10, 0], {extrapolateLeft:"clamp",extrapolateRight:"clamp"})}px`,
                background: "rgba(0,0,0,0.03)", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)",
                padding: "12px 18px",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "30%",
                  background: "rgba(5,150,105,0.06)",
                  border: "1px solid rgba(5,150,105,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <m.icon size={22} color="#059669" />
                </div>
                <div>
                  <span style={{ fontSize: 24, fontWeight: 600, color: "#1c1917", display: "block" }}>{m.name}</span>
                  <span style={{ fontSize: 20, fontWeight: 500, color: "#292524" }}>{m.role}</span>
                </div>
              </div>
            );
          })}
        </SlideUp>
      </div>
    </Interactive.Div>
  );
};

/* ================================================================
   Scenes 3-5: Problem (900-3000)
   ================================================================ */
const ProblemScenes: React.FC = () => {
  const frame = useCurrentFrame();
  const base = 900;

  return (
    <Interactive.Div name="Problem" className="absolute inset-0 bg-stone-50 flex items-center justify-center" style={{ padding: 60 }}>
      <AnimatedBg />

      {frame >= 900 && frame < 1650 && (
        <div className="flex items-center justify-between w-full h-full max-w-[1720px] gap-12">
          {/* Left Side: Stats/Text Card */}
          <div className="flex flex-col items-center justify-center flex-1">
            {frame < 1200 && (
              <SlideUp startFrame={base} delay={0} duration={22} className="flex flex-col items-center" style={{ padding: "52px 60px", minWidth: 500 }}>
                <Bar delay={5} />
                <span style={{ fontSize: 18, fontWeight: 600, color: "#78716c", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>
                  Indonesia Logistics Cost
                </span>
                <span style={{
                  fontSize: 80, fontWeight: 800, color: "#dc2626", lineHeight: 1, letterSpacing: "-0.03em", marginBottom: 16,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4
                }}>
                  <RollingCounter value="14.3" startFrame={base} delay={10} duration={32} fontSize={80} />
                  <span>% of GDP</span>
                </span>
                <span style={{ fontSize: 22, fontWeight: 600, color: "#44403c", letterSpacing: "-0.01em", marginBottom: 24 }}>
                  One of the highest in Southeast Asia
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#a8a29e", letterSpacing: "0.02em", textAlign: "center" }}>
                  Kementerian Perekonomian RI, 2026
                </span>
              </SlideUp>
            )}
            {frame >= 1200 && frame < 1450 && (
              <SlideUp startFrame={1200} delay={0} duration={18} className="flex flex-col items-center" style={{ padding: "52px 56px", minWidth: 500 }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: "#1c1917", textAlign: "center", lineHeight: 1.25, letterSpacing: "-0.02em", maxWidth: 440 }}>
                  This creates major challenges and increases costs for consumers.
                </span>
              </SlideUp>
            )}
            {frame >= 1450 && (
              <SlideUp startFrame={1450} delay={0} duration={18} className="flex flex-col items-center" style={{ padding: "52px 56px", minWidth: 500 }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: "#dc2626", textAlign: "center", lineHeight: 1.25, letterSpacing: "-0.02em", maxWidth: 440 }}>
                  Delays and inefficiencies everywhere. Something has to change.
                </span>
              </SlideUp>
            )}
          </div>

          {/* Right Side: Map Visualization */}
          <div className="flex-1 flex items-center justify-center" style={{
            opacity: interpolate(frame, [900, 930], [0, 1], {extrapolateLeft: "clamp"}),
          }}>
            <LogisticsMap startFrame={900} congested={frame >= 1450} />
          </div>
        </div>
      )}

      {frame >= 1650 && frame < 2400 && (
        <div className="flex items-center justify-between w-full h-full max-w-[1720px] gap-12">
          {/* Left: persistent card with 3 fading states */}
          <div className="flex flex-col items-center justify-center flex-1">
            <SlideUp startFrame={1650} delay={0} duration={22} className="flex flex-col relative" style={{ padding: "48px 52px", width: 540, minHeight: 380 }}>
              {/* State 1: LPI rank data (1650-2010) — centered, no inline country prefix */}
              <div style={{
                position: "absolute", inset: "48px 52px",
                display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
                opacity: interpolate(frame, [1650, 1665, 1995, 2010], [0, 1, 1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
              }}>
                <Bar delay={5} />
                <span style={{ fontSize: 16, fontWeight: 600, color: "#78716c", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, textAlign: "center" }}>
                  World Bank LPI 2023
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
                  <RollingCounter value={61} startFrame={1650} delay={12} duration={30} fontSize={80} />
                  <span style={{ fontSize: 28, fontWeight: 500, color: "#a8a29e" }}>/160</span>
                </div>
                <span style={{ fontSize: 20, fontWeight: 500, color: "#44403c", lineHeight: 1.3, marginBottom: 24, textAlign: "center" }}>
                  Global Logistics Performance Index
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#a8a29e", letterSpacing: "0.02em", textAlign: "center" }}>
                  World Bank LPI Report, 2023
                </span>
              </div>

              {/* State 2: This is the problem (2010-2130) */}
              <div style={{
                position: "absolute", inset: "48px 52px",
                display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
                opacity: interpolate(frame, [2010, 2025, 2115, 2130], [0, 1, 1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
              }}>
                <span style={{ fontSize: 34, fontWeight: 700, color: "#1c1917", lineHeight: 1.2, letterSpacing: "-0.02em", textAlign: "center" }}>
                  This is the problem we set out to solve.
                </span>
              </div>

              {/* State 3: Service quality question (2130-2400) */}
              <div style={{
                position: "absolute", inset: "48px 52px",
                display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
                opacity: interpolate(frame, [2130, 2145], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
              }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: "#059669", lineHeight: 1.2, letterSpacing: "-0.02em", marginBottom: 16, textAlign: "center" }}>
                  How do you maintain service quality?
                </span>
                <span style={{ fontSize: 22, fontWeight: 500, color: "#44403c", lineHeight: 1.35, textAlign: "center" }}>
                  Amid exponential growth in volume.
                </span>
              </div>
            </SlideUp>
          </div>

          {/* Right: rotating visualization */}
          <div className="flex-1 flex items-center justify-center relative" style={{ minHeight: 380 }}>
            {/* State 1: LPI bar chart (1650-1770) */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: interpolate(frame, [1650, 1665, 1755, 1770], [0, 1, 1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
            }}>
              <AnimatedBarChart data={LPI_DATA} startFrame={1650} delay={12} stagger={5} duration={26} />
            </div>

            {/* State 2: SLA impact cards (1770-2010) */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", gap: 16, justifyContent: "center",
              opacity: interpolate(frame, [1770, 1785, 1995, 2010], [0, 1, 1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
            }}>
              <div style={{
                background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.12)",
                borderRadius: 12, padding: "24px 28px",
                opacity: interpolate(frame, [1770, 1790], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
                translate: `0px ${interpolate(frame, [1770, 1790], [12, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}px`,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#78716c", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>Financial Penalties</span>
                <span style={{ fontSize: 48, fontWeight: 800, color: "#dc2626", letterSpacing: "-0.03em", lineHeight: 1, display: "block" }}>Up to 5%</span>
                <span style={{ fontSize: 18, fontWeight: 500, color: "#44403c", display: "block", marginTop: 8 }}>revenue loss per SLA breach</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#a8a29e", display: "block", marginTop: 12, letterSpacing: "0.02em" }}>Corporate SLA Benchmarks, 2025</span>
              </div>
              <div style={{
                background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 12, padding: "24px 28px",
                opacity: interpolate(frame, [1800, 1820], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
                translate: `0px ${interpolate(frame, [1800, 1820], [12, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}px`,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#78716c", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>Customer Churn</span>
                <span style={{ fontSize: 48, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.03em", lineHeight: 1, display: "block" }}>84% higher</span>
                <span style={{ fontSize: 18, fontWeight: 500, color: "#44403c", display: "block", marginTop: 8 }}>B2B client defection after delays</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#a8a29e", display: "block", marginTop: 12, letterSpacing: "0.02em" }}>Logistics Customer Experience Report, 2025</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {frame >= 2400 && frame < 3000 && (
        <>
          {frame < 2640 && (
            <div className="flex items-center justify-between w-full h-full max-w-[1720px] gap-12">
              <div className="flex-1 flex flex-col items-center justify-center">
                <SlideUp startFrame={2400} delay={0} duration={22} className="flex flex-col" style={{ padding: "48px 52px", maxWidth: 580 }}>
                  <Bar delay={5} />
                  <span style={{ fontSize: 18, fontWeight: 600, color: "#78716c", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>
                    Market Context
                  </span>
                  <span style={{ fontSize: 30, fontWeight: 700, color: "#1c1917", lineHeight: 1.25, letterSpacing: "-0.02em", marginBottom: 16 }}>
                    Indonesia is one of the fastest growing ecommerce markets in Asia.
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 500, color: "#44403c", lineHeight: 1.4, marginBottom: 24 }}>
                    How do you maintain service quality amid exponential volume increases?
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#a8a29e", letterSpacing: "0.02em" }}>
                    RedSeer Southeast Asia E-Commerce Report, 2026
                  </span>
                </SlideUp>
              </div>
              <div className="flex-1 flex items-center justify-center" style={{
                opacity: interpolate(frame, [2400, 2430], [0, 1], {extrapolateLeft: "clamp"}),
              }}>
                <EcommerceGrowthChart startFrame={2400} />
              </div>
            </div>
          )}
          {frame >= 2640 && (
            <div className="flex flex-col items-center justify-center w-full h-full">
              <SlideUp startFrame={2640} delay={0} duration={22} className="flex flex-col items-center" style={{ padding: "48px 64px", maxWidth: 680 }}>
                <Img src={staticFile("logo.png")} style={{ height: 52, width: "auto", marginBottom: 28 }} alt="ORCA" />
                <span style={{ fontSize: 36, fontWeight: 700, color: "#1c1917", textAlign: "center", lineHeight: 1.2, letterSpacing: "-0.02em", marginBottom: 32 }}>
                  This is where ORCA comes in.
                </span>
                <div style={{ display: "flex", gap: 16 }}>
                  {["Predictive", "Optimized", "Sustainable"].map((tag, i) => (
                    <div key={tag} style={{
                      opacity: interpolate(Math.max(0, frame - 2640 - i * 18), [0, 16], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
                      translate: `0px ${interpolate(Math.max(0, frame - 2640 - i * 18), [0, 16], [10, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}px`,
                      background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 8, padding: "12px 24px",
                    }}>
                      <span style={{ fontSize: 20, fontWeight: 600, color: "#1c1917", letterSpacing: "-0.01em" }}>{tag}</span>
                    </div>
                  ))}
                </div>
              </SlideUp>
            </div>
          )}
        </>
      )}
    </Interactive.Div>
  );
};

/* ================================================================
   Scene 4:     ORCA: 3 Pillars (3000-3600)
   ================================================================ */
const PILLARS = [
  { title: "Delay Prediction", sub: "LightGBM", num: "01", icon: Clock, startFrame: 3240 },
  { title: "Route Optimization", sub: "NSGA-II", num: "02", icon: Route, startFrame: 3360 },
  { title: "Carbon Tracking", sub: "GLEC Framework", num: "03", icon: Leaf, startFrame: 3480 },
];

const OrcaIntro: React.FC = () => {
  const base = 3000;

  return (
    <Interactive.Div name="OrcaIntro" className="absolute inset-0 bg-stone-50 flex flex-col items-center justify-center" style={{ padding: 80 }}>
      <AnimatedBg />

      <SlideUp startFrame={base} delay={0} duration={20} className="flex flex-col items-center" style={{ padding: "16px 40px", marginBottom: 32 }}>
        <Img src={staticFile("logo.png")} style={{ height: 60, width: "auto" }} alt="ORCA" />
      </SlideUp>

      <div className="flex items-stretch" style={{ gap: 24 }}>
        {PILLARS.map((p) => (
          <SlideUp
            key={p.title}
            startFrame={p.startFrame}
            delay={0}
            duration={18}
            className="flex flex-col items-center justify-center"
            style={{
              width: 290,
              height: 180,
              padding: "28px 24px",
              gap: 16,
            }}
          >
            <div style={{
              width: 52, height: 52,
              borderRadius: "50%", background: "rgba(5,150,105,0.06)",
              border: "1px solid rgba(5,150,105,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <p.icon size={24} color="#059669" />
            </div>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#1c1917", textAlign: "center", lineHeight: 1.2, width: "100%" }}>{p.title}</span>
          </SlideUp>
        ))}
      </div>
    </Interactive.Div>
  );
};

/* ================================================================
   Scene 5: Metrics (3600-4200)
   ================================================================ */
const METRICS = [
  { title: "FEWER DELAYS", low: 20, high: 30, suffix: "%", sub: "AI Predictive Engine" },
  { title: "LOWER COSTS", low: 5, high: 20, suffix: "%", sub: "Multi Objective Optimization" },
  { title: "CARBON REDUCTION", low: 10, high: 15, suffix: "%", sub: "GLEC Certified" },
];

const MetricCards: React.FC = () => {
  const base = 3600;
  const frame = useCurrentFrame();

  // Caption sync — highlight the card matching the current subtitle
  // 3600-3720: "Targeting 20 to 30 percent fewer delays"
  // 3720-3840: "5 to 20 percent lower costs"
  // 3840-3960: "10 to 15 percent carbon reduction"
  // 3960+: all equal
  const activeIdx = frame < 3720 ? 0 : frame < 3840 ? 1 : frame < 3960 ? 2 : -1;

  return (
    <Interactive.Div name="Metrics" className="absolute inset-0 bg-stone-50 flex items-center justify-center" style={{ padding: 80 }}>
      <AnimatedBg />
      <div className="flex flex-col items-center" style={{ gap: 20 }}>
        <div className="flex items-stretch" style={{ gap: 28 }}>
          {METRICS.map((m, i) => {
            const isActive = activeIdx === -1 || activeIdx === i;
            return (
              <div key={m.title} style={{
                opacity: isActive ? 1 : 0.4,
                transform: `scale(${isActive ? 1 : 0.96})`,
                transformOrigin: "center center",
              }}>
                <SlideUp
                  startFrame={base}
                  delay={8 + i * 12}
                  duration={20}
                  className="flex flex-col items-center justify-between"
                  style={{ width: 320, height: 240, padding: "36px 28px", gap: 0 }}
                >
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#1c1917", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12, display: "block", textAlign: "center" }}>
                    {m.title}
                  </span>
                  <span style={{
                    fontSize: 54, fontWeight: 800, color: "#059669", lineHeight: 1, marginBottom: 12,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%"
                  }}>
                    <RollingCounter value={m.low} startFrame={base} delay={8 + i * 12 + 5} duration={28} fontSize={54} />
                    <span style={{ fontSize: 32, fontWeight: 600, color: "#a8a29e" }}>-</span>
                    <RollingCounter value={m.high} startFrame={base} delay={8 + i * 12 + 5} duration={28} fontSize={54} />
                    <span>{m.suffix}</span>
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 500, color: "#44403c", textAlign: "center", letterSpacing: "-0.01em", lineHeight: 1.2, width: "100%", display: "block" }}>
                    {m.sub}
                  </span>
                </SlideUp>
              </div>
            );
          })}
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#a8a29e", letterSpacing: "0.02em" }}>
          ORCA Pilot Phase, Simulation Data, 2026
        </span>
      </div>
    </Interactive.Div>
  );
};

/* ================================================================
   Scene 6: Architecture (4200-4800)
   ================================================================ */
const ArchDiagram: React.FC = () => {
  return (
    <Interactive.Div name="Arch" className="absolute inset-0 bg-stone-50 flex items-center justify-center" style={{ padding: 40 }}>
      <Img
        src={staticFile("diagram-architecture.png")}
        style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 12 }}
        alt="Solution Architecture Diagram"
      />
    </Interactive.Div>
  );
};

/* ================================================================
   Scene 7: Impact Summary (8130-8280)
   ================================================================ */
const IMPACT_METRICS = [
  { label: "Fewer Delays", value: 30, suffix: "%", sub: "Predictive AI Engine" },
  { label: "Lower Costs", value: 20, suffix: "%", sub: "Route Optimization" },
  { label: "Carbon Reduction", value: 15, suffix: "%", sub: "GLEC Certified" },
];

const CircularProgress: React.FC<{
  value: number;
  maxValue: number;
  startFrame: number;
  delay: number;
  duration: number;
  children: React.ReactNode;
}> = ({ value, maxValue, startFrame, delay, duration, children }) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - startFrame - delay);
  const animatedVal = interpolate(t, [0, duration], [0, value], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const r = 45;
  const circ = 2 * Math.PI * r;
  const pct = animatedVal / maxValue;
  const strokeDashoffset = circ * (1 - pct);

  return (
    <div style={{ position: "relative", width: 110, height: 110, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg style={{ width: "100%", height: "100%", transform: "rotate(-90deg)", overflow: "visible" }}>
        <circle
          cx="55"
          cy="55"
          r={r}
          stroke="#f5f5f4"
          strokeWidth="8"
          fill="transparent"
        />
        <circle
          cx="55"
          cy="55"
          r={r}
          stroke="#059669"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circ}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            filter: "drop-shadow(0px 0px 4px rgba(5,150,105,0.25))",
          }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
};

const ImpactSummary: React.FC = () => {
  const base = 8130;

  return (
    <Interactive.Div name="Impact" className="absolute inset-0 bg-stone-50 flex flex-col items-center justify-center" style={{ padding: 80 }}>
      <AnimatedBg />

      <SlideUp startFrame={base} delay={0} duration={20} className="flex flex-col items-center" style={{ padding: "16px 40px", marginBottom: 24 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#78716c", letterSpacing: "0.07em", textTransform: "uppercase" }}>
          Impact Summary
        </span>
        <div style={{ width: 40, height: 2, background: "rgba(5,150,105,0.3)", borderRadius: 1, marginTop: 12 }} />
      </SlideUp>

      <div className="flex flex-col items-center" style={{ gap: 24 }}>
        <div className="flex items-stretch" style={{ gap: 28 }}>
          {IMPACT_METRICS.map((m, i) => (
            <SlideUp
              key={m.label}
              startFrame={base}
              delay={8 + i * 10}
              duration={20}
              className="flex flex-col items-center justify-between"
              style={{ width: 300, height: 280, padding: "36px 28px", gap: 0 }}
            >
              <CircularProgress
                value={m.value}
                maxValue={100}
                startFrame={base}
                delay={8 + i * 10 + 6}
                duration={30}
              >
                <span style={{
                  fontSize: 30, fontWeight: 700, color: "#1c1917", lineHeight: 1,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <RollingCounter value={m.value} startFrame={base} delay={8 + i * 10 + 6} duration={30} fontSize={30} />
                  <span>{m.suffix}</span>
                </span>
              </CircularProgress>

              <div className="flex flex-col items-center" style={{ gap: 4, width: "100%" }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#1c1917", textAlign: "center", letterSpacing: "-0.01em" }}>
                  {m.label}
                </span>
                <span style={{ fontSize: 18, color: "#44403c", fontWeight: 500, textAlign: "center", lineHeight: 1.25 }}>
                  {m.sub}
                </span>
              </div>
            </SlideUp>
          ))}
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#a8a29e", letterSpacing: "0.02em" }}>
          ORCA Operational Performance Metrics, 2026
        </span>
      </div>
    </Interactive.Div>
  );
};

/* ================================================================
   Scene 8: Closing Credits (8280-8580)
   ================================================================ */
const ClosingCredits: React.FC = () => {
  const base = 8280;

  return (
    <Interactive.Div name="Credits" className="absolute inset-0 bg-stone-50 flex flex-col items-center justify-center" style={{ padding: 80 }}>
      <AnimatedBg />

      <SlideUp startFrame={base} delay={0} duration={26} className="flex flex-col items-center" style={{ padding: "40px 56px", minWidth: 540, gap: 8 }}>
        <Img src={staticFile("logo.png")} style={{ height: 64, width: "auto", marginBottom: 10 }} alt="ORCA" />
        <span style={{ fontSize: 22, fontWeight: 600, color: "#059669", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 24 }}>
          Driving the Future of Ecommerce Logistics
        </span>

        <div className="flex items-center" style={{ gap: 32, marginBottom: 24 }}>
          <Img src={staticFile("blibli_logo.png")} style={{ height: 56, width: "auto", opacity: 0.9 }} alt="Blibli" />
          <Img src={staticFile("fablab_logo.png")} style={{ height: 56, width: "auto", opacity: 0.85 }} alt="FabLab" />
          <Img src={staticFile("kemenko_logo.png")} style={{ height: 56, width: "auto", opacity: 0.85 }} alt="Kemenko" />
        </div>

        <span style={{ fontSize: 13, fontWeight: 600, color: "#78716c", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 20 }}>
          Team Manusia yang tak pakai AI akan kalah
        </span>

        <div className="flex flex-col items-center" style={{ gap: 6, marginBottom: 18 }}>
          {TEAM.map((m) => (
            <span key={m.name} style={{ fontSize: 20, color: "#44403c" }}>{m.name} · {m.role}</span>
          ))}
        </div>

        <span style={{ fontSize: 18, color: "#78716c", letterSpacing: "0.08em" }}>
          AI Open Innovation 2026
        </span>
      </SlideUp>
    </Interactive.Div>
  );
};

export const SceneRenderer: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <>
      {frame < 450 && <OpeningTitle />}
      {frame >= 450 && frame < 900 && <TeamShowcase />}
      {frame >= 900 && frame < 3000 && <ProblemScenes />}
      {frame >= 3000 && frame < 3600 && <OrcaIntro />}
      {frame >= 3600 && frame < 4200 && <MetricCards />}
      {frame >= 4200 && frame < 4800 && <ArchDiagram />}
      {frame >= 8130 && frame < 8280 && <ImpactSummary />}
      {frame >= 8280 && <ClosingCredits />}
    </>
  );
};
