import React from "react";
import { useCurrentFrame, interpolate, Easing, Img, staticFile, Interactive } from "remotion";
import { LogisticsMap } from "../components/LogisticsMap";

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
   Animated counter (counts from `from` to `to` over `duration` frames)
   ================================================================ */
const AnimatedCounter: React.FC<{
  from: number; to: number; startFrame: number; delay?: number; duration?: number;
}> = ({ from, to, startFrame, delay = 0, duration = 30 }) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - startFrame - delay);
  const val = interpolate(t, [0, duration], [from, to], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return <>{Math.round(val)}</>;
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
        fontSize: 24, fontWeight: 600, color: "#059669",
        letterSpacing: "0.12em", textTransform: "uppercase",
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
   Scene 1: Opening (0-450)
   ================================================================ */
const OpeningTitle: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Interactive.Div name="Opening" className="absolute inset-0 bg-stone-50 flex flex-col items-center justify-center" style={{ padding: 80 }}>
      <AnimatedBg />

      {/* Background Logistics Map */}
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
        <LogisticsMap startFrame={0} />
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
  { name: "Raihan Putra Kirana", role: "Project Lead and Software" },
  { name: "Husni Abdillah", role: "AI Engineer" },
  { name: "Steven Lie Wibowo", role: "Solution and Innovation Analyst" },
  { name: "Hilfani Rayyanne Subagio", role: "Product Strategy Analyst" },
  { name: "Muhammad Abyan Putra Wibowo", role: "Product Designer" },
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
              }}>
                <span style={{ fontSize: 22, fontWeight: 600, color: "#1c1917", display: "block" }}>{m.name}</span>
                <span style={{ fontSize: 18, color: "#44403c" }}>{m.role}</span>
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
              <SlideUp startFrame={base} delay={0} duration={22} className="flex flex-col items-center" style={{ padding: "48px 60px", minWidth: 500 }}>
                <Bar delay={5} />
                <span style={{ fontSize: 20, fontWeight: 600, color: "#44403c", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>
                  Indonesia Logistics Cost
                </span>
                <span style={{ fontSize: 80, fontWeight: 700, color: "#1c1917", lineHeight: 1, letterSpacing: "0.02em", marginBottom: 16 }}>
                  14.3% of GDP
                </span>
                <span style={{ fontSize: 24, color: "#78716c", letterSpacing: "0.04em" }}>
                  One of the highest in Southeast Asia
                </span>
              </SlideUp>
            )}
            {frame >= 1200 && frame < 1450 && (
              <SlideUp startFrame={1200} delay={0} duration={18} className="flex flex-col items-center" style={{ padding: "48px 60px", minWidth: 500 }}>
                <span style={{ fontSize: 28, fontWeight: 500, color: "#44403c", textAlign: "center", lineHeight: 1.6, maxWidth: 440 }}>
                  This creates major challenges and increases costs for consumers.
                </span>
              </SlideUp>
            )}
            {frame >= 1450 && (
              <SlideUp startFrame={1450} delay={0} duration={18} className="flex flex-col items-center" style={{ padding: "48px 60px", minWidth: 500 }}>
                <span style={{ fontSize: 28, fontWeight: 500, color: "#ef4444", textAlign: "center", lineHeight: 1.6, maxWidth: 440 }}>
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
        <>
          {frame < 2000 && (
            <SlideUp startFrame={1650} delay={0} duration={22} className="flex flex-col items-center" style={{ padding: "36px 48px", maxWidth: 620 }}>
              <Bar delay={5} />
              <span style={{ fontSize: 20, fontWeight: 600, color: "#44403c", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>
                World Bank LPI 2023
              </span>
              <div style={{ background: "rgba(5,150,105,0.06)", borderRadius: CARD_RADIUS, border: "1px solid rgba(5,150,105,0.12)", padding: "14px 40px", marginBottom: 22 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: "#1c1917", letterSpacing: "0.04em" }}>
                  Indonesia: Rank 61
                </span>
              </div>
              <AnimatedBarChart data={LPI_DATA} startFrame={1650} delay={12} stagger={5} duration={26} />
              <span style={{ fontSize: 14, color: "#a8a29e", marginTop: 12 }}>
                Source: World Bank Logistics Performance Index 2023
              </span>
            </SlideUp>
          )}
          {frame >= 2000 && (
            <SlideUp startFrame={2000} delay={0} duration={22} className="flex flex-col items-center" style={{ padding: "44px 52px", maxWidth: 540 }}>
              <span style={{ fontSize: 28, fontWeight: 500, color: "#292524", textAlign: "center", lineHeight: 1.5, maxWidth: 480 }}>
                This is the problem we set out to solve.
              </span>
            </SlideUp>
          )}
        </>
      )}

      {frame >= 2400 && frame < 3000 && (
        <div className="flex items-center justify-between w-full h-full max-w-[1720px] gap-12">
          {/* Left Side: Text Box */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <SlideUp startFrame={2400} delay={0} duration={22} className="flex flex-col items-center" style={{ padding: "44px 56px", maxWidth: 600 }}>
              <Bar delay={5} />
              <span style={{ fontSize: 30, fontWeight: 600, color: "#1c1917", textAlign: "center", lineHeight: 1.5, marginBottom: 18 }}>
                Indonesia is one of the fastest growing ecommerce markets in Asia.
              </span>
              <span style={{ fontSize: 24, color: "#44403c", textAlign: "center", lineHeight: 1.5, maxWidth: 480 }}>
                How do you maintain service quality amid exponential volume increases?
              </span>
            </SlideUp>
          </div>

          {/* Right Side: Map showing active shipment flow */}
          <div className="flex-1 flex items-center justify-center" style={{
            opacity: interpolate(frame, [2400, 2430], [0, 1], {extrapolateLeft: "clamp"}),
          }}>
            <LogisticsMap startFrame={2400} congested={false} />
          </div>
        </div>
      )}
    </Interactive.Div>
  );
};

/* ================================================================
   Scene 4:     ORCA: 3 Pillars (3000-3600)
   ================================================================ */
const PILLARS = [
  { title: "Delay Prediction", sub: "LightGBM", num: "01" },
  { title: "Route Optimization", sub: "NSGA-II", num: "02" },
  { title: "Carbon Tracking", sub: "GLEC Framework", num: "03" },
];

const OrcaIntro: React.FC = () => {
  const base = 3000;

  return (
    <Interactive.Div name="OrcaIntro" className="absolute inset-0 bg-stone-50 flex flex-col items-center justify-center" style={{ padding: 80 }}>
      <AnimatedBg />

      <SlideUp startFrame={base} delay={0} duration={20} className="flex flex-col items-center" style={{ padding: "16px 40px", marginBottom: 32 }}>
        <Img src={staticFile("logo.png")} style={{ height: 60, width: "auto", marginBottom: 12 }} alt="ORCA" />
        <TextRotator startFrame={base} delay={26} interval={48} />
      </SlideUp>

      <div className="flex items-stretch" style={{ gap: 24 }}>
        {PILLARS.map((p, i) => (
          <SlideUp key={p.title} startFrame={base} delay={22 + i * 10} duration={18} className="flex flex-col items-center" style={{ width: 290, padding: "36px 32px", gap: 12 }}>
            <div style={{
              width: 44, height: 44,
              borderRadius: "50%", background: "rgba(0,0,0,0.04)",
              border: "1px solid rgba(0,0,0,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: "#1c1917" }}>{p.num}</span>
            </div>
            <span style={{ fontSize: 24, fontWeight: 600, color: "#1c1917", textAlign: "center" }}>{p.title}</span>
            <span style={{ fontSize: 20, color: "#78716c", fontWeight: 500 }}>{p.sub}</span>
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

  return (
    <Interactive.Div name="Metrics" className="absolute inset-0 bg-stone-50 flex items-center justify-center" style={{ padding: 80 }}>
      <AnimatedBg />
      <div className="flex items-stretch" style={{ gap: 28 }}>
        {METRICS.map((m, i) => (
          <SlideUp
            key={m.title}
            startFrame={base}
            delay={8 + i * 12}
            duration={20}
            className="flex flex-col items-center"
            style={{ width: 320, padding: "40px 36px", gap: 6 }}
          >
            <span style={{ fontSize: 20, fontWeight: 600, color: "#44403c", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
              {m.title}
            </span>
            <span style={{ fontSize: 60, fontWeight: 700, color: "#1c1917", lineHeight: 1, marginBottom: 10 }}>
              <AnimatedCounter from={0} to={m.low} startFrame={base} delay={8 + i * 12 + 5} duration={28} /> to {m.high}{m.suffix}
            </span>
            <span style={{ fontSize: 20, color: "#78716c", textAlign: "center" }}>
              {m.sub}
            </span>
          </SlideUp>
        ))}
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

      <SlideUp startFrame={base} delay={0} duration={20} className="flex flex-col items-center" style={{ padding: "16px 40px", marginBottom: 28 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: "#78716c", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Impact Summary
        </span>
        <div style={{ width: 40, height: 2, background: "rgba(5,150,105,0.3)", borderRadius: 1, marginTop: 12 }} />
      </SlideUp>

      <div className="flex items-stretch" style={{ gap: 28 }}>
        {IMPACT_METRICS.map((m, i) => (
          <SlideUp
            key={m.label}
            startFrame={base}
            delay={8 + i * 10}
            duration={20}
            className="flex flex-col items-center"
            style={{ width: 300, padding: "36px 32px", gap: 6 }}
          >
            <CircularProgress
              value={m.value}
              maxValue={100}
              startFrame={base}
              delay={8 + i * 10 + 6}
              duration={30}
            >
              <span style={{ fontSize: 30, fontWeight: 700, color: "#1c1917", lineHeight: 1 }}>
                <AnimatedCounter from={0} to={m.value} startFrame={base} delay={8 + i * 10 + 6} duration={30} />{m.suffix}
              </span>
            </CircularProgress>

            <span style={{ fontSize: 22, fontWeight: 600, color: "#44403c", textAlign: "center", marginTop: 8 }}>
              {m.label}
            </span>
            <span style={{ fontSize: 18, color: "#78716c", textAlign: "center", marginTop: 2 }}>
              {m.sub}
            </span>
          </SlideUp>
        ))}
      </div>
      <span style={{ fontSize: 14, color: "#a8a29e", marginTop: 28 }}>
        Projected outcomes based on ORCA pilot simulations
      </span>
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

        <span style={{ fontSize: 22, fontWeight: 700, color: "#1c1917", marginBottom: 20 }}>
          Manusia yang tak pakai AI akan kalah
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
