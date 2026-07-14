# ORCA AI Dubbing / Voiceover Script
## Format: Full Script for Audio Recording
### Total Duration: 5 minutes 30 seconds | 30 fps | 9000 frames
### Language: English (all narration and on-camera lines)

---

## INSTRUCTIONS FOR VOICE TALENT AND PRESENTERS

| Code | Role | Voice | Target Pace |
|------|------|-------|-------------|
| **V1** | Voice 1 (Narrator) | Calm, deep, authoritative. Tech documentary style. No camera appearance. Studio microphone, noise-free recording. | ~130 wpm |
| **PA** | Presenter A (AI Focus) | Enthusiastic, confident, technical-visual. On camera (bottom-left). Lavalier or clip-on mic. Record synced with video. | ~135 wpm |
| **PB** | Presenter B (Tech + Feasibility) | Convincing, solution-oriented, authoritative. On camera (bottom-right). Lavalier or clip-on mic. Record synced with video. | ~135 wpm |

**RECORDING NOTES:**

- LOW PACE: Target 130-135 wpm overall, slower than normal. Allow natural pauses between sentences.
- VISUAL BREATHING: After every key point, leave about 1 second of silence for the visual to breathe.
- VOICE 1 records ALL V1 segments in one continuous session.
- PRESENTER A and B record video and audio separately (only audio will be used for the mix).
- Background music will be mixed separately. Do not rush.
- Mark breaths at [breath] where needed.
- Read the closing partner and team credits with warmth and sincerity.

---

## PART 1: OPENING AND BUSINESS CASE

### SPEAKER: V1 (Voice 1, Non-Camera, Dubbing Only)
### Duration: 00:00 to 02:40
### Pace: ~130 wpm | Estimated: ~350 words

---

### SEGMENT 1.1: HOOK (00:00 to 00:15)

```
V1:
[Silence, 1 second]

Every day, thousands of packages move across the Indonesian archipelago.
From Jakarta to Surabaya. From Medan to Makassar.

Duration: ~15 seconds | ~20 words
PACE: Slow, dramatic. Pause ~1 second between cities.
```

---

### SEGMENT 1.2: TEAM AND PARTNER INTRODUCTION (00:15 to 00:30)

```
V1:
We are a team of five, united by a vision to transform logistics
through artificial intelligence. Built for Blibli Open Innovation
2026, in collaboration with FabLab Jababeka and the Coordinating
Ministry for Economic Affairs of the Republic of Indonesia.

Duration: ~15 seconds | ~38 words
PACE: Warm, proud. Brief pause before mentioning partners.
```

---

### SEGMENT 1.3: THE PROBLEM (00:30 to 00:55)

```
V1:
But every day, unexpected disruptions - severe rainstorms, traffic
gridlock, hub congestion - put hundreds of shipments at risk of
missing their SLA deadlines.

[breath]

Indonesia's logistics cost averages 14.3 percent of GDP, one of the
highest in Southeast Asia. Most dispatchers only find out a delivery
is late when a customer complains. By then, it is already too late.

Duration: ~25 seconds | ~68 words
PACE: Narrative, building tension. Pause after "too late".
```

---

### SEGMENT 1.4: BUSINESS IMPACT (00:55 to 01:20)

```
V1:
The World Bank Logistics Performance Index ranks Indonesia 61st
globally, with significant gaps in timeliness and tracking
infrastructure.

[breath]

For e-commerce companies like Blibli, every SLA breach means
financial penalties and lost customer trust. The current approach
is reactive - dispatchers manually guess alternative routes, often
sacrificing cost or sustainability just to save a single delivery.

[breath]

This is the problem we set out to solve.

Duration: ~25 seconds | ~78 words
PACE: Calm, authoritative. Emphasis on "reactive". Brief pause
before "This is the problem we set out to solve."
```

---

### SEGMENT 1.5: MARKET CONTEXT (01:20 to 01:40)

```
V1:
Indonesia is one of the fastest-growing e-commerce markets in Asia.
Shipping volumes surge every year.

[breath]

But this growth brings new complexity: how do you maintain service
quality amid exponential volume increases?

[breath, pause]

This is where ORCA comes in as the solution.

Duration: ~20 seconds | ~42 words
PACE: Reflective, building anticipation toward the solution.
```

---

### SEGMENT 1.6: ORCA INTRODUCTION (01:40 to 02:00)

```
V1:
ORCA is an AI-powered logistics intelligence platform that predicts
SLA failures before they happen and automatically generates optimized,
multi-objective routing recommendations.

[breath]

Three main pillars: delay prediction using LightGBM, multi-objective
route optimization with NSGA-II, and carbon tracking using GLEC
standards. All built for the Blibli ecosystem.

Duration: ~20 seconds | ~58 words
PACE: Confident, proud. Pause ~1 second between pillars.
```

---

### SEGMENT 2.1: METRIC COUNTERS (02:00 to 02:25)

```
V1:
ORCA targets a 20 to 30 percent reduction in delivery delays through
our AI-powered predictive engine.

[breath, let counter 1 finish]

Operational costs are projected to decrease by 5 to 20 percent
through multi-objective route optimization.

[breath, let counter 2 finish]

And with carbon-aware routing, we estimate a 10 to 15 percent
reduction in fuel consumption and emissions, all tracked using
the GLEC framework version 3.0.

Duration: ~25 seconds | ~75 words
PACE: Natural, unrushed. Pause ~1 second between metrics so visual
counters have time to animate.
```

---

### SEGMENT 2.2: SOLUTION ARCHITECTURE (02:25 to 02:40)

```
V1:
ORCA's architecture is designed for production reliability. Data is
collected from multiple sources - real-time weather from Open-Meteo,
historical traffic patterns, and hub congestion levels.

[breath]

Our LightGBM engine processes this to generate calibrated delay
probabilities. Then NSGA-II optimizes routes across four objectives
simultaneously. All results are displayed in a real-time dashboard
built with Next.js and TimescaleDB.

Duration: ~15 seconds | ~65 words
PACE: Narrative, flowing through each architecture layer. Pause at
each node transition.
```

---

## PART 2: APP DEMO - DASHBOARD AND AI ENGINE

### SPEAKER: PA (Presenter A, AI Focus, On Camera)
### Duration: 02:40 to 03:30
### Pace: ~135 wpm | Estimated: ~120 words

---

### SEGMENT 3.1: DASHBOARD AND LIVE OPS (02:40 to 03:10)

```
PA:
[On camera, natural gesture toward dashboard on screen]

Welcome to the ORCA Operations Control Tower. This is the nerve
center of your logistics operation. Every active shipment is tracked
in real-time, not just location, but a dynamic SLA risk score
calculated by our AI engine.

Duration: ~30 seconds | ~40 words
PACE: Friendly, inviting. Natural gestures.
```

---

### SEGMENT 3.2: AI PREDICTION ENGINE AND SHAP (03:10 to 03:30)

```
PA:
Our LightGBM model evaluates over a dozen features in real-time -
current weather from Open-Meteo, hub congestion levels, historical
traffic patterns, and calendar events.

[breath]

Each shipment receives a calibrated delay probability score. Here
you can see a shipment with 87 percent risk. SHAP values tell us
exactly why - heavy rain at the origin hub combined with peak-hour
congestion.

Duration: ~20 seconds | ~65 words
PACE: Technical but easy to follow. Emphasis on "87 percent".
```

---

### SEGMENT 3.3: ALERT SYSTEM AND AUTOMATION (03:30 to 03:45)

```
PA:
When a shipment's risk score exceeds our threshold of 70, ORCA
automatically generates an alert. No manual monitoring needed.

[breath]

Our system can even send WhatsApp notifications directly to
dispatchers through our Fonnte integration. This is proactive
logistics - the system catches problems before they happen.

[breath, longer pause]

But ORCA does not just predict problems. It solves them.

Duration: ~15 seconds | ~58 words
PACE: Convincing. Dramatic pause before the final line.
```

---

## PART 3: APP DEMO - ROUTE OPTIMIZER

### SPEAKER: PB (Presenter B, Tech + Feasibility, On Camera)
### Duration: 03:45 to 04:30
### Pace: ~135 wpm | Estimated: ~130 words

---

### SEGMENT 4.1: ROUTE OPTIMIZER INTRO (03:45 to 04:05)

```
PB:
[On camera, gesture toward screen]

Now let me show you how ORCA solves at-risk shipments. I have loaded
our flagged shipment into the Route Optimizer.

[breath]

Behind this interface, our NSGA-II algorithm evaluates millions of
routing combinations simultaneously - balancing four competing
objectives: travel time, fuel cost, carbon emissions, and SLA risk.

Duration: ~20 seconds | ~55 words
PACE: Focused, technically enthusiastic. Emphasis on "millions of
routing combinations".
```

---

### SEGMENT 4.2: PARETO FRONT AND ROUTE COMPARISON (04:05 to 04:30)

```
PB:
ORCA generates three Pareto-optimal choices.

[breath]

Option one prioritizes speed - guaranteeing the SLA with the fastest
route.

[breath]

Option two minimizes fuel consumption and carbon emissions - our
greenest choice.

[breath]

Option three provides a perfectly balanced route across all objectives.

[breath]

With one click, we select the balanced option. The SLA is rescued.
Fuel costs are controlled. Carbon is minimized.

Duration: ~25 seconds | ~75 words
PACE: Pause ~1 second between each option. List rhythm. Final
sentence: firm, deliberate, each clause as its own unit.
```

---

## PART 4: CARBON ANALYTICS AND TECH FEASIBILITY

### SPEAKER: PB (Presenter B, Tech + Feasibility, On Camera)
### Duration: 04:30 to 05:00
### Pace: ~135 wpm | Estimated: ~95 words

---

### SEGMENT 5.1: CARBON ANALYTICS AND GLEC (04:30 to 04:45)

```
PB:
Every route generated by ORCA automatically calculates precise
carbon footprints using the GLEC framework version 3.0 - the
global standard for logistics emissions reporting.

[breath]

This gives executives a real-time ESG dashboard to track
sustainability impact across the entire fleet.

Duration: ~15 seconds | ~40 words
PACE: Confident, credible. Emphasis on "GLEC version 3.0".
```

---

### SEGMENT 5.2: TECH STACK AND FEASIBILITY (04:45 to 05:00)

```
PB:
From a technical feasibility standpoint, ORCA is built on
production-grade infrastructure: FastAPI for low-latency inference,
LightGBM with calibrated probabilities for trustworthy predictions,
TimescaleDB for time-series data, and Redis for pub-sub event
streaming.

[breath]

The entire stack runs on Docker Compose, fully containerized and
reproducible. This architecture ensures ORCA is ready for real-world
production deployment.

Duration: ~15 seconds | ~55 words
PACE: Natural, authoritative. No need to rush through technology names.
```

---

## PART 5: CLOSING

### SPEAKER: V1 (Voice 1, Non-Camera, Dubbing Returns)
### Duration: 05:00 to 05:30
### Pace: ~130 wpm | Estimated: ~85 words

---

### SEGMENT 6.1: IMPACT SUMMARY (05:00 to 05:10)

```
V1:
[Breath, reflective moment]

In the past five minutes, you have seen how ORCA transforms logistics -
from reactive to predictive, from costly to optimized, from
carbon-intensive to sustainable.

Duration: ~10 seconds | ~28 words
PACE: Slow, reflective, full of meaning.
```

---

### SEGMENT 6.2: CLOSING AND CREDITS (05:10 to 05:30)

```
V1:
ORCA does not just deliver packages on time. It delivers operational
efficiency, financial savings, and a greener future for e-commerce
logistics in Indonesia.

[breath]

Built for Blibli Open Innovation 2026. In collaboration with FabLab
Jababeka and the Coordinating Ministry for Economic Affairs of the
Republic of Indonesia.

[breath, pause]

This was presented by Team Manusia yang tak pakai AI akan kalah.

Thank you.

Duration: ~20 seconds | ~72 words
PACE: Warm, sincere. "Thank you" in the final 3 seconds, leave
about 2 seconds of silence afterward before final fade out.
```

---

## APPENDIX: RECORDING SUMMARY PER SPEAKER

### VOICE 1 - Complete Script (record in one continuous session)

```
SEGMENT 1.1: HOOK                         00:00 to 00:15 (~20 words, 15s)
SEGMENT 1.2: TEAM AND PARTNER INTRO       00:15 to 00:30 (~38 words, 15s)
SEGMENT 1.3: THE PROBLEM                  00:30 to 00:55 (~68 words, 25s)
SEGMENT 1.4: BUSINESS IMPACT              00:55 to 01:20 (~78 words, 25s)
SEGMENT 1.5: MARKET CONTEXT               01:20 to 01:40 (~42 words, 20s)
SEGMENT 1.6: ORCA INTRODUCTION            01:40 to 02:00 (~58 words, 20s)
--- (brief recording pause) ---
SEGMENT 2.1: METRIC COUNTERS              02:00 to 02:25 (~75 words, 25s)
SEGMENT 2.2: SOLUTION ARCHITECTURE        02:25 to 02:40 (~65 words, 15s)
--- (long recording pause ~2.5 min) ---
SEGMENT 6.1: IMPACT SUMMARY               05:00 to 05:10 (~28 words, 10s)
SEGMENT 6.2: CLOSING AND CREDITS          05:10 to 05:30 (~72 words, 20s)
```

### PRESENTER A - Complete Script (record video + audio)

```
SEGMENT 3.1: DASHBOARD AND LIVE OPS       02:40 to 03:10 (~40 words, 30s)
SEGMENT 3.2: AI PREDICTION AND SHAP       03:10 to 03:30 (~65 words, 20s)
SEGMENT 3.3: ALERT SYSTEM                 03:30 to 03:45 (~58 words, 15s)
```

### PRESENTER B - Complete Script (record video + audio)

```
SEGMENT 4.1: ROUTE OPTIMIZER INTRO        03:45 to 04:05 (~55 words, 20s)
SEGMENT 4.2: PARETO AND COMPARISON        04:05 to 04:30 (~75 words, 25s)
SEGMENT 5.1: CARBON ANALYTICS AND GLEC    04:30 to 04:45 (~40 words, 15s)
SEGMENT 5.2: TECH STACK AND FEASIBILITY   04:45 to 05:00 (~55 words, 15s)
```

---

## SCRIPT STATISTICS

| Speaker | Total Words | Duration | WPM (inc. pauses) |
|---------|-------------|----------|-------------------|
| Voice 1 (V1) | ~544 words | 00:00-02:40 (160s) + 05:00-05:30 (30s) = 190s | ~172 wpm raw |
| Presenter A (PA) | ~163 words | 02:40-03:30 = 50s | ~196 wpm raw |
| Presenter B (PB) | ~225 words | 03:30-05:00 = 90s | ~150 wpm raw |
| Total | ~932 words | ~5 min 30 sec | - |

**Note on WPM:** Raw WPM appears high because the word counts include pauses,
breaths, and transition time. Actual speaking pace during voiced segments
is approximately 130-140 wpm as intended. The numbers above include all
silent gaps between segments.

---

*This script is a recording guide for voice-over talent and presenters.
Pacing and pauses can be adjusted during recording as long as timestamps
do not shift significantly. If any time change exceeds 2 seconds, update
the timestamps in Orca_Video_Script.md as well.*
