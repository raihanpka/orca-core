# ORCA AI Video Production Script
## Format: Film Screenplay - Visual and Audio Direction
### Total Duration: 5 minutes 30 seconds | 30 fps | 9000 frames
### Language: English (all narration and on-screen text)

---

## CAST AND CREW NOTES

| Code | Role | Style | Camera | Pace |
|------|------|-------|--------|------|
| **V1** | Voice 1 (Narrator) | Calm, deep, authoritative. Tech documentary style. | No camera | ~130 wpm |
| **PA** | Presenter A (AI Focus) | Enthusiastic, confident, technical-visual. | On camera (bottom-left) | ~135 wpm |
| **PB** | Presenter B (Tech + Feasibility) | Convincing, solution-oriented, authoritative. | On camera (bottom-right) | ~135 wpm |

**Voice Allocation:**

- **00:00 - 02:40** - VOICE 1 (non-camera, full dubbing): Opening, Business Case, Metrics, Architecture
- **02:40 - 03:30** - PRESENTER A (on camera, AI focus): Dashboard, AI Predictions, Alerts
- **03:30 - 05:00** - PRESENTER B (on camera, tech + feasibility): Route Optimizer, Carbon, Tech Stack
- **05:00 - 05:30** - VOICE 1 returns (dubbing closing): Impact Summary, Closing Credits

**PRODUCTION NOTES:**

- No emojis, em dashes, or decorative symbols in any text or graphics.
- All percentages written as "percent" (e.g. "20 percent").
- All numbers spelled out for voiceover consistency.
- Lower third labels for presenters: "Presenter A - AI Engine" and "Presenter B - Route Optimizer".

---

## TEAM AND PARTNER IDENTITY

| Role | Name |
|------|------|
| **Team Name** | Manusia yang tak pakai AI akan kalah |
| **Project Lead and Software** | Raihan Putra Kirana |
| **AI Engineer** | Husni Abdillah |
| **Solution and Innovation Analyst** | Steven Lie Wibowo |
| **Product Strategy Analyst** | Hilfani Rayyanne Subagio |
| **Product Designer** | Muhammad Abyan Putra Wibowo |

| Partner | Role |
|---------|------|
| **Case Provider** | Blibli (Blibli Open Innovation 2026) |
| **Collaborator** | FabLab Jababeka |
| **Collaborator** | Coordinating Ministry for Economic Affairs of the Republic of Indonesia (Kemenko Perekonomian) |

---

## LOGO PLACEMENT STRATEGY

**Persistent Header Bar (visible in ALL 9000 frames):**

A fixed glassmorphism bar at the top of every frame (z-index: 45, height: 56px):

```
[ORCA AI logo - 32px h]  |  [Team name - 13px, slate-300]  |  [spacer]  |  [Blibli]  [FabLab]  [Kemenko]
```

Left side:
- ORCA AI logo (28px h) + "ORCA" text (16px bold, emerald-400) + vertical divider
- Team name "Manusia yang tak pakai AI akan kalah" (13px, font-medium, tracking-wide, slate-300)

Right side:
- Blibli logo (20px h)
- FabLab Jababeka logo (18px h)
- Kemenko Perekonomian logo (18px h)

Styling: background rgba(15, 23, 42, 0.85), backdrop-blur-md, border bottom white/10
Implementation: React component <PartnerHeader /> imported in MainShowcase.tsx

**Large Logo Showcase (Scene 1 - Opening):**
All four logos displayed large (40-60px h) below the title, centered, with fade-in on frame 15-45.

**Large Logo Showcase (Scene 17 - Closing):**
All four logos displayed large on the closing slide alongside team credits.

---

## PERSISTENT PARTNER HEADER COMPONENT

This React component must be placed at the top of the MainShowcase render tree, wrapping all scene content. It must have z-45 to layer above all scene content.

```
<PartnerHeader />  // Renders in every frame, always visible
<SceneContent />   // Scene-specific content renders below
```

The header must contain:
- Full width bar, 56px height
- Left: ORCA icon + "ORCA AI" text + "Manusia yang tak pakai AI akan kalah"
- Right: Blibli, FabLab Jababeka, Kemenko Perekonomian logos
- Glassmorphism: dark transparent background with backdrop blur
- Visible throughout all 9000 frames without any fade in or out
- Must not block presenter webcam overlays (those need z-50 or higher)

---

## ACT 1: OPENING AND BUSINESS CASE

---

### SCENE 1: OPENING TITLE WITH PARTNER SHOWCASE

**Time:** 00:00 - 00:15 (Frames 0-450)
**Audio:** V1 (Voice 1)
**Visual Style:** Cinematic opening with particle effects

| Timecode | Visual | Audio |
|----------|--------|-------|
| 00:00-00:03 (0-90) | Black screen. ORCA logo emerges from darkness with blue particle effects. | [Silence - 1 second] Ambient tech music starts. Low, cinematic. |
| 00:03-00:07 (90-210) | Logo fully formed. Tagline fades in below: "AI-Powered Carbon-Aware Logistics Intelligence" | V1: "Every day, thousands of packages move across the Indonesian archipelago. From Jakarta to Surabaya. From Medan to Makassar." |
| 00:07-00:12 (210-360) | Tagline shrinks to top. Below it, 4 partner logos animate in: Blibli, FabLab Jababeka, Kemenko Perekonomian. Each logo gets 0.3s stagger. | V1: "We are a team of five, united by a vision to transform logistics through artificial intelligence." |
| 00:12-00:15 (360-450) | Logos settle. Subtle glow on ORCA logo. "Blibli Open Innovation 2026" in small text under Blibli logo. | V1: "Built for Blibli Open Innovation 2026, in collaboration with FabLab Jababeka and the Coordinating Ministry for Economic Affairs of the Republic of Indonesia." |

**Production Notes:**
- Background: dark gradient (#0B1120 to #0F172A) with subtle animated data-grid texture
- ORCA logo: 120px h, with fade-in + scale-up (0.8 to 1.0)
- Tagline: 22px, emerald-400, tracking-wide, uppercase
- Partner logos row: centered, 40-60px h each, 32px gap, fade-in
- Sub-text: smaller (11px), slate-400, "Team: Manusia yang tak pakai AI akan kalah"

---

### SCENE 2: TEAM AND PARTNER SHOWCASE

**Time:** 00:15 - 00:30 (Frames 450-900)
**Audio:** V1 (Voice 1)

| Timecode | Visual | Audio |
|----------|--------|-------|
| 00:15-00:30 (450-900) | Split-screen layout. Left half shows team info. Right half shows large partner logos. | V1 (continues from Scene 1 seamlessly) |

LEFT HALF (Team section):
- Header: "The Team" (20px, slate-400, uppercase, tracking-wide)
- 5 team member cards stacked vertically, each showing:
  - Name (16px bold, white)
  - Role (13px, slate-400)
- Card styling: glassmorphism background, rounded corners, subtle border

RIGHT HALF (Partner section):
- Three partner logos displayed large and centered vertically
- Blibli logo (80px h)
- FabLab Jababeka logo (60px h)
- Kemenko Perekonomian logo (60px h)

**Production Notes:**
- Background: data-grid continues from Scene 1
- Team cards: staggered fade-in (0.15s between each)
- Partner logos: subtle horizontal slide-in from right
- Music: uplifting, building

---

### SCENE 3: THE PROBLEM

**Time:** 00:30 - 00:55 (Frames 900-1650)
**Audio:** V1 (Voice 1)

| Timecode | Visual | Audio |
|----------|--------|-------|
| 00:30-00:35 (900-1050) | Team cards dissolve. Full-screen Indonesia map appears with heat map overlay showing logistics bottlenecks. Red/orange hotspots pulse around Jakarta, Surabaya, Medan. | V1: "But every day, unexpected disruptions - severe rainstorms, traffic gridlock, hub congestion - put hundreds of shipments at risk of missing their SLA deadlines." |
| 00:35-00:40 (1050-1200) | Zoom in to Java island. Animated truck icons show routes with delay indicators (yellow to red). Data nodes pulse. | V1: "Indonesia's logistics cost averages 14.3 percent of GDP, one of the highest in Southeast Asia." |
| 00:40-00:50 (1200-1500) | Text overlay appears: "14.3% of GDP - Logistics Cost" in large bold white. Background shows chaotic warehouse footage. | V1: "Most dispatchers only find out a delivery is late when a customer complains. By then, it is already too late." |
| 00:50-00:55 (1500-1650) | Text fades. Camera pulls back from the problem. Darker tone. Brief silence. | V1: [Silence for impact] |

**Production Notes:**
- Indonesia map: use a simplified outline map with heat data
- Hotspots: pulsing circles with gradient opacity
- Music: tension builds, slightly faster tempo
- Color palette: shifts to amber/red tones for problem framing

---

### SCENE 4: BUSINESS IMPACT

**Time:** 00:55 - 01:20 (Frames 1650-2400)
**Audio:** V1 (Voice 1)

| Timecode | Visual | Audio |
|----------|--------|-------|
| 00:55-01:05 (1650-1950) | World Bank LPI ranking visualization. Animated bar chart showing Indonesia ranked 61st with Southeast Asian peers for comparison (Singapore higher, Malaysia/Thailand/Vietnam). | V1: "The World Bank Logistics Performance Index ranks Indonesia 61st globally, with significant gaps in timeliness and tracking infrastructure." |
| 01:05-01:15 (1950-2250) | Transition to Blibli logistics scenario. Animated warehouse with packages moving through conveyor. SLA breach indicators flash red on certain packages. Penalty cost counter ticks up. | V1: "For e-commerce companies like Blibli, every SLA breach means financial penalties and lost customer trust. The current approach is reactive - dispatchers manually guess alternative routes, often sacrificing cost or sustainability just to save a single delivery." |
| 01:15-01:20 (2250-2400) | Screen dims. Text appears: "This is the problem we set out to solve." Centered, white, 24px. | V1: "This is the problem we set out to solve." |

**Production Notes:**
- LPI visualization: horizontal bar chart style
- Blibli warehouse: simplified illustration or mockup
- Penalty counter: red numbers ticking up
- Music: contemplative, problem-focused

---

### SCENE 5: MARKET CONTEXT

**Time:** 01:20 - 01:40 (Frames 2400-3000)
**Audio:** V1 (Voice 1)

| Timecode | Visual | Audio |
|----------|--------|-------|
| 01:20-01:27 (2400-2610) | E-commerce growth chart. Animated upward-trending line graph showing Indonesia's e-commerce market growth (projected to $XXXB+). Shopping cart icons at data points. | V1: "Indonesia is one of the fastest-growing e-commerce markets in Asia. Shipping volumes surge every year." |
| 01:27-01:35 (2610-2850) | Visual transitions to show complexity: branching lines representing delivery routes multiply, interconnect, showing network complexity. | V1: "But this growth brings new complexity: how do you maintain service quality amid exponential volume increases?" |
| 01:35-01:40 (2850-3000) | Branches resolve into a single node. ORCA logo glows at center. | V1: "This is where ORCA comes in as the solution." |

**Production Notes:**
- Growth chart: upward curve, emerald gradient fill under the line
- Branching lines: initial chaos then resolving to order
- ORCA logo appears with soft glow effect
- Music: transition from tension to hope

---

### SCENE 6: ORCA INTRODUCTION

**Time:** 01:40 - 02:00 (Frames 3000-3600)
**Audio:** V1 (Voice 1)

| Timecode | Visual | Audio |
|----------|--------|-------|
| 01:40-01:48 (3000-3240) | ORCA logo large center. Tagline appears below: "AI-Powered Logistics Intelligence Platform". Data particles orbit the logo. | V1: "ORCA is an AI-powered logistics intelligence platform that predicts SLA failures before they happen and automatically generates optimized, multi-objective routing recommendations." |
| 01:48-02:00 (3240-3600) | Three pillar icons appear in sequence: 1) LightGBM brain icon (predict), 2) NSGA-II route branching (optimize), 3) GLEC leaf icon (sustain). Each has a brief label. | V1: "Three main pillars: delay prediction using LightGBM, multi-objective route optimization with NSGA-II, and carbon tracking using GLEC standards. All built for the Blibli ecosystem." |

**Production Notes:**
- Text size: "Meet ORCA" large, subtitle smaller
- Three pillars: staggered animation, each pillar appears with brief scale-up
- Icons: simple, clean line-art style
- Music: building confidence, uplifting

---

### SCENE 7: METRIC COUNTERS (SaaS Style)

**Time:** 02:00 - 02:25 (Frames 3600-4200)
**Audio:** V1 (Voice 1)
**Visual:** SaaS-style animated metric counters

| Timecode | Visual | Audio |
|----------|--------|-------|
| 02:00-02:08 (3600-3840) | Card 1 slides in from left: Icon (checkmark/green), Title "Fewer Delays", Large counter animates from 0% to "20-30%". Subtitle: "AI Predictive Engine". | V1: "ORCA targets a 20 to 30 percent reduction in delivery delays through our AI-powered predictive engine." |
| 02:08-02:16 (3840-4080) | Card 2 slides in from right: Icon (lightning), Title "Lower Costs", Counter: "5-20%". Subtitle: "Multi-Objective Optimization". | V1: "Operational costs are projected to decrease by 5 to 20 percent through multi-objective route optimization." |
| 02:16-02:25 (4080-4200) | Card 3 slides in from bottom: Icon (leaf), Title "Carbon Reduction", Counter: "10-15%". Subtitle: "GLEC Certified". All three counters pulse briefly after appearing. | V1: "And with carbon-aware routing, we estimate a 10 to 15 percent reduction in fuel consumption and emissions, all tracked using the GLEC framework version 3.0." |

**Production Notes:**
- Staggered: Card 1 starts, 0.4s delay for Card 2, 0.4s for Card 3
- Each card: glassmorphism background, 260px w, 180px h with soft white border
- Counters use React animated counter component that counts up from 0
- Counter icon: 32px in a colored circle (emerald, amber, emerald respectively)
- Background: dark with subtle grid pattern
- Text for each card: bold white number, smaller subtitle below

---

### SCENE 8: SOLUTION ARCHITECTURE

**Time:** 02:25 - 02:40 (Frames 4200-4800)
**Audio:** V1 (Voice 1)

| Timecode | Visual | Audio |
|----------|--------|-------|
| 02:25-02:28 (4200-4440) | Architecture flow diagram background appears. Clean minimal box/arrow layout. | V1: "ORCA's architecture is designed for production reliability." |

Architecture Flow:
```
[Data Sources] -> [ML Engine] -> [Optimizer] -> [Dashboard]
    Weather      LightGBM        NSGA-II        Next.js
    Traffic      Calibrated     4 Objectives    Real-time
    Congestion   Probability    Pareto Front    TimescaleDB
```

| 02:28-02:35 (4440-4650) | Data Sources box highlights (weather icon, traffic lines, hub icon). Arrow animates to ML Engine. | V1: "Data is collected from multiple sources - real-time weather from Open-Meteo, historical traffic patterns, and hub congestion levels." |
| 02:35-02:40 (4650-4800) | ML Engine highlights. Flow continues through Optimizer to Dashboard. Each box glows briefly as journey completes. | V1: "Our LightGBM engine processes this to generate calibrated delay probabilities. Then NSGA-II optimizes routes across four objectives simultaneously. All results are displayed in a real-time dashboard built with Next.js and TimescaleDB." |

**Production Notes:**
- Architecture diagram: clean node boxes, 200x80px each, connected by animated line flow
- Nodes: glassmorphism background, labeled with technology name
- Active node: bright cyan glow and slight scale-up
- Flow animation: small dots moving along connecting lines
- Music: steady, reliable, confident

---

## ACT 2: APP DEMO - DASHBOARD AND AI ENGINE

---

### SCENE 9: DASHBOARD LIVE OPS (Presenter A)

**Time:** 02:40 - 03:10 (Frames 4800-5400)
**Audio:** PA (Presenter A - on camera, bottom-left)

| Timecode | Visual | Audio |
|----------|--------|-------|
| 02:40-02:45 (4800-4950) | Full-screen ORCA Operations Dashboard appears. PA appears in bottom-left webcam overlay (180x180px, rounded, white border). | PA: "Welcome to the ORCA Operations Control Tower. This is the nerve center of your logistics operation." |
| 02:45-03:00 (4950-5400) | Dashboard shows active shipments table with columns: ID, Origin, Destination, SLA Status (GREEN/YELLOW/RED), ETA, Risk Score. PA gestures naturally toward the dashboard. | PA: "Every active shipment is tracked in real-time, not just location, but a dynamic SLA risk score calculated by our AI engine." |

**Production Notes:**
- Dashboard: real webapp rendered via iframe or screen recording
- PA overlay: bottom-left, 180x180px, rounded-xl, white border 2px, shadow-2xl
- PA appears with slide-in animation (left to final position)
- Background in dashboard: dark theme with data tables
- Label under PA: "Presenter A - AI Engine" - 11px, slate-400
- Music: down slightly to let PA voice be primary

---

### SCENE 10: AI PREDICTION ENGINE AND SHAP (Presenter A)

**Time:** 03:10 - 03:30 (Frames 5400-6000)
**Audio:** PA (Presenter A)

| Timecode | Visual | Audio |
|----------|--------|-------|
| 03:10-03:20 (5400-5700) | Dashboard transitions to prediction detail view. Feature breakdown visualization appears: weather data, hub congestion, traffic patterns, calendar events as labeled cards. | PA: "Our LightGBM model evaluates over a dozen features in real-time - current weather from Open-Meteo, hub congestion levels, historical traffic patterns, and calendar events." |
| 03:20-03:30 (5700-6000) | SHAP waterfall chart appears. Shows a specific shipment with "Risk: 87%" prominently displayed. SHAP bars show: heavy rain (+0.34), peak-hour congestion (+0.28), origin hub delay (+0.15) pushing risk higher. | PA: "Each shipment receives a calibrated delay probability score. Here you can see a shipment with 87 percent risk. SHAP values tell us exactly why - heavy rain at the origin hub combined with peak-hour congestion." |

**Production Notes:**
- Prediction detail: clean card layout showing calibrated probability
- SHAP chart: horizontal bar chart, red bars pushing right (increasing risk), green bars pushing left (decreasing risk)
- 87% risk: prominent, red highlighted
- Feature cards: weather icon, traffic icon, hub icon, calendar icon
- PA remains visible in corner throughout

---

### SCENE 11: ALERT SYSTEM AND AUTOMATION (Presenter A)

**Time:** 03:30 - 03:45 (Frames 6000-6300)
**Audio:** PA (Presenter A)

| Timecode | Visual | Audio |
|----------|--------|-------|
| 03:30-03:37 (6000-6210) | Alert notification pops up on dashboard: red banner "SLA Risk Alert: Shipment #ORC-7842 exceeds threshold (Risk: 87%)". WhatsApp notification mockup slides in. | PA: "When a shipment's risk score exceeds our threshold of 70, ORCA automatically generates an alert. No manual monitoring needed." |
| 03:37-03:45 (6210-6300) | Split screen: left shows alert dashboard, right shows WhatsApp message on phone mockup. Fonnte API integration label visible. | PA: "Our system can even send WhatsApp notifications directly to dispatchers through our Fonnte integration. This is proactive logistics - the system catches problems before they happen. But ORCA does not just predict problems. It solves them." |

**Production Notes:**
- Alert banner: red/orange gradient, slides down from top of dashboard
- WhatsApp mockup: phone frame with WhatsApp chat showing the alert message
- Transition: smooth from prediction to alert view
- PA emphasis on "proactive logistics" with hand gesture
- Music: subtle underscore, maintaining energy

---

## ACT 3: APP DEMO - ROUTE OPTIMIZER

---

### SCENE 12: ROUTE OPTIMIZER INTRODUCTION (Presenter B)

**Time:** 03:45 - 04:05 (Frames 6300-6900)
**Audio:** PB (Presenter B - on camera, bottom-right)
**Transition:** PA exits, PB enters bottom-right

| Timecode | Visual | Audio |
|----------|--------|-------|
| 03:45-03:50 (6300-6450) | Route Optimizer page loads on screen. Map view showing Jabodetabek road network with pin markers. PB appears bottom-right. | PB: "Now let me show you how ORCA solves at-risk shipments. I have loaded our flagged shipment into the Route Optimizer." |
| 03:50-04:05 (6450-6900) | Split-screen view: left shows route optimizer interface with origin/destination fields, constraints sliders (Speed, Cost, Carbon, SLA). Right shows animated particle flow on map between hubs. | PB: "Behind this interface, our NSGA-II algorithm evaluates millions of routing combinations simultaneously - balancing four competing objectives: travel time, fuel cost, carbon emissions, and SLA risk." |

**Production Notes:**
- PB appears bottom-right (mirror of PA position)
- PB overlay: 180x180px, rounded-xl, white border, shadow-2xl
- Label: "Presenter B - Route Optimizer" - 11px, slate-400
- Route optimizer UI: clean, modern, slider controls
- Map: OSMnx road network for Jabodetabek
- Particle flow: animated dots moving along graph edges
- Music: technical, focused

---

### SCENE 13: PARETO FRONT AND ROUTE COMPARISON (Presenter B)

**Time:** 04:05 - 04:30 (Frames 6900-7650)
**Audio:** PB (Presenter B)

| Timecode | Visual | Audio |
|----------|--------|-------|
| 04:05-04:10 (6900-7050) | Scatter plot appears showing Pareto front. 3 highlighted points on the curve. | PB: "ORCA generates three Pareto-optimal choices." |
| 04:10-04:18 (7050-7200) | Option 1 highlights on chart. Route shown on map - fastest path in blue. | PB: "Option one prioritizes speed - guaranteeing the SLA with the fastest route." |
| 04:18-04:24 (7200-7500) | Option 2 highlights. Green route on map - lowest carbon path with leaf indicator. | PB: "Option two minimizes fuel consumption and carbon emissions - our greenest choice." |
| 04:24-04:30 (7500-7650) | Option 3 highlights. Gold/balanced route on map. Final selection animation: the balanced option is confirmed with a checkmark. | PB: "Option three provides a perfectly balanced route across all objectives. With one click, we select the balanced option. The SLA is rescued. Fuel costs are controlled. Carbon is minimized." |

**Production Notes:**
- Pareto chart: 2D scatter plot with Pareto frontier curve highlighted
- Three options: distinct colors (blue, green, gold), each pulsing when highlighted
- Map: different color routes overlay on Jabodetabek network
- Selection animation: route highlights, checkmark confirms
- PB gestures toward each option as described

---

### SCENE 14: CARBON ANALYTICS AND GLEC (Presenter B)

**Time:** 04:30 - 04:45 (Frames 7650-8100)
**Audio:** PB (Presenter B)

| Timecode | Visual | Audio |
|----------|--------|-------|
| 04:30-04:37 (7650-7830) | Dashboard transitions to Carbon Analytics view. Carbon footprint breakdown for each route option: tons CO2 per route, per package, per km. Bar chart comparison. | PB: "Every route generated by ORCA automatically calculates precise carbon footprints using the GLEC framework version 3.0 - the global standard for logistics emissions reporting." |
| 04:37-04:45 (7830-8100) | ESG dashboard view: cumulative carbon savings, monthly trend, fleet-wide metrics. GLEC certification badge visible. | PB: "This gives executives a real-time ESG dashboard to track sustainability impact across the entire fleet." |

**Production Notes:**
- Carbon analytics: clean metric cards (CO2 tonnage, equivalent trees, offset data)
- GLEC badge: small certification mark
- ESG dashboard: professional, boardroom-ready
- Music: responsible, sustainable tone

---

### SCENE 15: TECH STACK AND FEASIBILITY (Presenter B)

**Time:** 04:45 - 05:00 (Frames 8100-8550)
**Audio:** PB (Presenter B)

| Timecode | Visual | Audio |
|----------|--------|-------|
| 04:45-04:52 (8100-8280) | Tech stack visualization appears. Technology logos in a clean grid layout: FastAPI, LightGBM, TimescaleDB, Redis, Docker. Each logo is a minimal card. | PB: "From a technical feasibility standpoint, ORCA is built on production-grade infrastructure: FastAPI for low-latency inference, LightGBM with calibrated probabilities for trustworthy predictions, TimescaleDB for time-series data, and Redis for pub-sub event streaming." |
| 04:52-05:00 (8280-8550) | Docker Compose architecture diagram. Containers interconnect with labeled arrows. The entire stack visualizes as a cohesive system. | PB: "The entire stack runs on Docker Compose - fully containerized and reproducible. This architecture ensures ORCA is ready for real-world production deployment." |

**Production Notes:**
- Tech logos: simple icon + text cards, arranged in 2x3 grid
- Each card: glassmorphism, rounded, labeled
- Docker diagram: container boxes with dependence arrows
- PB overlay continues bottom-right

---

## ACT 4: CLOSING

---

### SCENE 16: IMPACT SUMMARY

**Time:** 05:00 - 05:10 (Frames 8550-8700)
**Audio:** V1 (Voice 1, returns)
**Visual:** PB fades out. Full-screen impact summary.

| Timecode | Visual | Audio |
|----------|--------|-------|
| 05:00-05:10 (8550-8700) | PB overlay fades out. Three metric cards from Scene 7 (Fewer Delays, Lower Costs, Carbon Reduction) slide back in, now showing the final achieved values. Each card has "LIVE" glow. Background dark. | V1: "In the past five minutes, you have seen how ORCA transforms logistics - from reactive to predictive, from costly to optimized, from carbon-intensive to sustainable." |

**Production Notes:**
- Metric cards: reprised from Scene 7, now with final values
- "LIVE" badge: small, pulsing on each card
- Music: emotional, reflective, swelling slightly

---

### SCENE 17: CLOSING AND CREDITS

**Time:** 05:10 - 05:30 (Frames 8700-9000)
**Audio:** V1 (Voice 1)

| Timecode | Visual | Audio |
|----------|--------|-------|
| 05:10-05:15 (8700-8850) | Partner logos row appears large, centered, with tagline: "Driving the Future of E-Commerce Logistics". | V1: "ORCA does not just deliver packages on time. It delivers operational efficiency, financial savings, and a greener future for e-commerce logistics in Indonesia." |
| 05:15-05:20 (8850-9000) | Full credits roll: Three partner logos (Blibli, FabLab Jababeka, Kemenko Perekonomian). Team name "Manusia yang tak pakai AI akan kalah" and 5 member names listed below. | V1: "Built for Blibli Open Innovation 2026. In collaboration with FabLab Jababeka and the Coordinating Ministry for Economic Affairs of the Republic of Indonesia." |
| 05:20-05:25 | All logos remain visible. Final tagline: "ORCA AI - Team Manusia yang tak pakai AI akan kalah". | V1: "This was presented by Team Manusia yang tak pakai AI akan kalah. Thank you." |
| 05:25-05:30 | Fade to black slowly over last 5 seconds. ORCA logo remains. | [2 seconds silence] Music fades out completely by frame 9000. |

**Credits Layout:**

```
[ORCA AI Logo - 60px h]

Driving the Future of E-Commerce Logistics

--- Partner Logos Row ---
Blibli | FabLab Jababeka | Kemenko Perekonomian

--- Team ---
Manusia yang tak pakai AI akan kalah

Raihan Putra Kirana - Project Lead and Software
Husni Abdillah - AI Engineer
Steven Lie Wibowo - Solution and Innovation Analyst
Hilfani Rayyanne Subagio - Product Strategy Analyst
Muhammad Abyan Putra Wibowo - Product Designer

---

Blibli Open Innovation 2026
```

**Production Notes:**
- Partner logos: large (60px h), centered, with subtle glow
- Team name: 18px white, bold
- Member names: 14px, slate-300
- Music: emotional swell, then gentle fade
- Final frame: black with small ORCA logo and "Thank you" text
- Credits should be on screen long enough to read comfortably (5-7 seconds)

---

## APPENDIX A: REMOTION PRODUCTION NOTES

### Component Architecture

```
MainShowcase.tsx
  +-- <PartnerHeader />          (persistent, ALL frames, z-45)
  +-- Scene-specific content
       +-- <WebRenderFrame />    (scenes 1-6, 9-15)
       +-- <WebcamOverlay />     (scenes 9-15, PA or PB)
       +-- <MetricCards />       (scene 7)
       +-- <ArchDiagram />       (scene 8)
       +-- <ImpactSummary />     (scene 16)
       +-- <ClosingCredits />    (scene 17)
  +-- <Audio />                   (background music)
```

### PartnerHeader Component Spec

```typescript
// Props: none (always visible)
// Position: fixed top, full width, 56px height
// z-index: 45
// Background: bg-slate-950/85 backdrop-blur-md
// Border-bottom: border-white/10
// Left section: ORCA logo (28px) + "ORCA AI" (16px bold, emerald-400) + "|" + team name (13px)
// Right section: 3 partner logo Img components (20px, 18px, 18px)
// Visibility: always visible, no opacity animation
```

### WebRenderFrame Component Spec

```typescript
// Props: sceneIndex (determines which URL to load)
// URLs by scene:
//   Scenes 9-11 (PA): https://orca-ai.thelunareix.my.id/ (dashboard)
//   Scenes 12-13 (PB): https://orca-ai.thelunareix.my.id/optimize
//   Scene 14 (PB): https://orca-ai.thelunareix.my.id/ (carbon section)
//   Other scenes: can show static graphics
// Uses IFrame from remotion package
```

### WebcamOverlay Component Spec

```typescript
// Props: presenterFile (mp4), position ("left" | "right")
// Position: bottom corners (left for PA, right for PB)
// Size: 180x180px
// Corner radius: rounded-xl
// Border: white border 2px
// Shadow: shadow-2xl
// Animation: slide-in from side on appear
// z-index: 50 (above PartnerHeader)
// Label: "Presenter A - AI Engine" or "Presenter B - Route Optimizer" at bottom
```

### Metric Cards Component Spec

```typescript
// Scene 7 - 3 cards staggered
// Each card:
//   Icon circle (32px) with colored background
//   Title text (14px, uppercase, slate-400)
//   Value counter (36px, bold, white) - animated count-up
//   Subtitle (12px, slate-500)
// Animation: slide-in from respective directions
// Duration: each card visible for ~6-8 seconds
```

### Scene Index Mapping

| Scene | Frames | Component | Audio |
|-------|--------|-----------|-------|
| 1 | 0-450 | Opening title + partner logos | V1 |
| 2 | 450-900 | Team + partner showcase | V1 |
| 3 | 900-1650 | Problem - Indonesia map | V1 |
| 4 | 1650-2400 | Business impact - LPI chart | V1 |
| 5 | 2400-3000 | Market context - growth chart | V1 |
| 6 | 3000-3600 | ORCA intro + 3 pillars | V1 |
| 7 | 3600-4200 | Metric counters (3 cards) | V1 |
| 8 | 4200-4800 | Solution architecture diagram | V1 |
| 9 | 4800-5400 | Dashboard live ops | PA |
| 10 | 5400-6000 | AI prediction + SHAP | PA |
| 11 | 6000-6300 | Alert system | PA |
| 12 | 6300-6900 | Route optimizer intro | PB |
| 13 | 6900-7650 | Pareto front + comparison | PB |
| 14 | 7650-8100 | Carbon analytics + GLEC | PB |
| 15 | 8100-8550 | Tech stack + feasibility | PB |
| 16 | 8550-8700 | Impact summary | V1 |
| 17 | 8700-9000 | Closing + credits | V1 |
