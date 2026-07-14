import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

type Subtitle = {
  startFrame: number;
  endFrame: number;
  text: string;
};

const SUBTITLES: Subtitle[] = [
  // Scene 1: Opening (300-450)
  { startFrame: 300, endFrame: 380, text: "Every day, packages cross the archipelago." },
  { startFrame: 380, endFrame: 450, text: "Connecting Indonesia's thousands of islands." },

  // Scene 2: Team (450-900)
  { startFrame: 450, endFrame: 530, text: "Meet our team of five." },
  { startFrame: 530, endFrame: 610, text: "Built for AI Open Innovation 2026." },
  { startFrame: 610, endFrame: 690, text: "Raihan, Husni, and Steven." },
  { startFrame: 690, endFrame: 770, text: "Hilfani and Abyan." },
  { startFrame: 770, endFrame: 900, text: "AI engineering, strategy, and design." },

  // Scene 3: Indonesia Logistics Cost (900-1650)
  { startFrame: 900, endFrame: 1000, text: "Indonesia's logistics cost: 14.3% of GDP." },
  { startFrame: 1000, endFrame: 1100, text: "One of the highest in Southeast Asia." },
  { startFrame: 1100, endFrame: 1200, text: "This creates major challenges." },
  { startFrame: 1200, endFrame: 1300, text: "And increases costs for consumers." },
  { startFrame: 1300, endFrame: 1420, text: "Delays and inefficiencies everywhere." },
  { startFrame: 1420, endFrame: 1540, text: "It affects businesses and customers alike." },
  { startFrame: 1540, endFrame: 1650, text: "Something has to change." },

  // Scene 4: World Bank LPI (1650-2400)
  { startFrame: 1650, endFrame: 1770, text: "The World Bank ranks Indonesia 61st globally." },
  { startFrame: 1770, endFrame: 1890, text: "Every SLA breach means financial penalties." },
  { startFrame: 1890, endFrame: 2010, text: "And lost customer trust." },
  { startFrame: 2010, endFrame: 2130, text: "This is the problem we set out to solve." },
  { startFrame: 2130, endFrame: 2250, text: "How do you maintain service quality?" },
  { startFrame: 2250, endFrame: 2400, text: "Amid exponential growth in volume." },

  // Scene 5: Market Context (2400-3000)
  { startFrame: 2400, endFrame: 2520, text: "Indonesia is one of the fastest growing ecommerce markets." },
  { startFrame: 2520, endFrame: 2640, text: "In all of Asia." },
  { startFrame: 2640, endFrame: 2760, text: "This is where ORCA comes in." },
  { startFrame: 2760, endFrame: 2880, text: "Logistics intelligence for the future." },
  { startFrame: 2880, endFrame: 3000, text: "Predictive, optimized, sustainable." },

  // Scene 6: ORCA Intro - 3 Pillars (3000-3600)
  { startFrame: 3000, endFrame: 3120, text: "ORCA predicts SLA failures before they happen." },
  { startFrame: 3120, endFrame: 3240, text: "And optimizes routes in real time." },
  { startFrame: 3240, endFrame: 3360, text: "Delay prediction with LightGBM." },
  { startFrame: 3360, endFrame: 3480, text: "Multi objective routing with NSGA-II." },
  { startFrame: 3480, endFrame: 3600, text: "And GLEC certified carbon tracking." },

  // Scene 7: Metric Counters (3600-4200)
  { startFrame: 3600, endFrame: 3720, text: "Targeting 20 to 30 percent fewer delays." },
  { startFrame: 3720, endFrame: 3840, text: "5 to 20 percent lower costs." },
  { startFrame: 3840, endFrame: 3960, text: "And 10 to 15 percent carbon reduction." },
  { startFrame: 3960, endFrame: 4080, text: "AI driven predictive engine." },
  { startFrame: 4080, endFrame: 4200, text: "Optimization and sustainability." },

  // Scene 8: Architecture diagram (4200-4800)
  { startFrame: 4200, endFrame: 4350, text: "Our architecture: AI, data, and optimization." },
  { startFrame: 4350, endFrame: 4500, text: "LightGBM for calibrated delay predictions." },
  { startFrame: 4500, endFrame: 4650, text: "NSGA-II for multi objective routing." },
  { startFrame: 4650, endFrame: 4800, text: "GLEC certified carbon tracking." },

  // ===== App Demo: demo-only-app.mp4 subtitle track (4804-8104) =====
  // Transkrip dari audio narration, dibagi per natural phrase
  { startFrame: 4804, endFrame: 4960, text: "Meet ORCA. An AI driven logistics platform engineered to predict delivery failures before they even happen." },
  { startFrame: 4960, endFrame: 5110, text: "In the complex world of modern logistics, unpredictable delays cause massive SLA failures and skyrocketing costs." },
  { startFrame: 5110, endFrame: 5250, text: "Dispatchers are often completely blind to these disruptions, forced to react only after a customer calls to complain." },
  { startFrame: 5250, endFrame: 5410, text: "Our solution? An advanced AI delay prediction model that constantly evaluates real-time weather and live traffic conditions." },
  { startFrame: 5410, endFrame: 5540, text: "Dynamically assigning a live risk score to every single shipment in your fleet." },
  { startFrame: 5540, endFrame: 5690, text: "Instead of waiting for failure, ORCA automatically flags vulnerable at risk shipments as critical." },
  { startFrame: 5690, endFrame: 5820, text: "Instantly alerting your team for immediate proactive action." },
  { startFrame: 5820, endFrame: 5950, text: "When disruptions inevitably occur, rerouting is highly needed." },
  { startFrame: 5950, endFrame: 6100, text: "We select the at risk shipment and let our powerful AI take over the decision." },
  { startFrame: 6100, endFrame: 6270, text: "Behind the scenes, our sophisticated multi objective optimization engine evaluates many routing combinations in seconds." },
  { startFrame: 6270, endFrame: 6410, text: "Accounting for distance, transit time, and environmental emissions simultaneously." },
  { startFrame: 6410, endFrame: 6580, text: "The system provides three distinct Pareto optimal choices to match your operational strategy." },
  { startFrame: 6580, endFrame: 6720, text: "Option one prioritizes maximum speed to rescue the deadline." },
  { startFrame: 6720, endFrame: 6880, text: "Another option provides a perfectly balanced route weighing speed, cost, and CO2 emissions." },
  { startFrame: 6880, endFrame: 7030, text: "With one simple click on the balanced option, the decision is made." },
  { startFrame: 7030, endFrame: 7180, text: "The driver's manifest is updated instantly, the SLA is rescued, and costs stay controlled." },
  { startFrame: 7180, endFrame: 7350, text: "Furthermore, every single route generated by ORCA tracks precise carbon emissions using global ESG standards." },
  { startFrame: 7350, endFrame: 7500, text: "Giving executives a real time comprehensive view of the entire fleet's carbon footprint." },
  { startFrame: 7500, endFrame: 7680, text: "This is the future of supply chain management." },
  { startFrame: 7680, endFrame: 8104, text: "ORCA transforms logistics from reactive dispatching to true predictive intelligence." },

  // Scene 16: Impact Summary (8130-8280)
  { startFrame: 8130, endFrame: 8205, text: "From reactive to predictive logistics." },
  { startFrame: 8205, endFrame: 8280, text: "From costly to optimized and sustainable." },

  // Scene 17: Closing (8280-8580)
  { startFrame: 8280, endFrame: 8380, text: "Built for AI Open Innovation 2026." },
  { startFrame: 8380, endFrame: 8480, text: "Presented by Team Manusia." },
  { startFrame: 8480, endFrame: 8580, text: "Those who don't use AI will be left behind." },
];

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();

  const activeSubtitle = SUBTITLES.find(
    (sub) => frame >= sub.startFrame && frame < sub.endFrame
  );

  if (!activeSubtitle) return null;

  const segmentDuration = activeSubtitle.endFrame - activeSubtitle.startFrame;
  const localFrame = frame - activeSubtitle.startFrame;

  // Guard: segments shorter than 4 frames, skip animation to avoid monotonic error
  if (segmentDuration < 4) {
    return (
      <div className="absolute bottom-16 left-0 right-0 flex justify-center px-12 z-50">
        <div
          style={{
            background: "rgba(41, 37, 36, 0.85)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderRadius: 12,
            border: "1px solid rgba(0, 0, 0, 0.06)",
            padding: "12px 32px",
            maxWidth: 900,
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 500, color: "#f1f5f9", lineHeight: 1.4, letterSpacing: "0.02em" }}>
            {activeSubtitle.text}
          </span>
        </div>
      </div>
    );
  }

  const fadeLen = Math.max(1, Math.min(12, Math.floor(segmentDuration / 4)));
  const fadeOutStart = segmentDuration - fadeLen;
  // Guaranteed: 0 < fadeLen < fadeOutStart < segmentDuration

  const opacity = interpolate(
    localFrame,
    [0, fadeLen, fadeOutStart, segmentDuration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div className="absolute bottom-16 left-0 right-0 flex justify-center px-12 z-50" style={{ opacity }}>
      <div
        style={{
          background: "rgba(41, 37, 36, 0.85)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderRadius: 12,
          border: "1px solid rgba(0, 0, 0, 0.06)",
          padding: "12px 32px",
          maxWidth: 900,
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: "#f1f5f9",
            lineHeight: 1.4,
            letterSpacing: "0.02em",
          }}
        >
          {activeSubtitle.text}
        </span>
      </div>
    </div>
  );
};
