import React from "react";
import { useCurrentFrame, Audio, staticFile, interpolate } from "remotion";
import { Video } from "@remotion/media";
import { Captions } from "./components/Captions";
import { SceneRenderer } from "./scenes/SceneRenderer";

const ProgressIndicator: React.FC = () => {
  const frame = useCurrentFrame();
  const TOTAL = 8580;
  const pct = interpolate(frame, [0, TOTAL], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        background: "rgba(0,0,0,0.04)",
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: "rgba(5,150,105,0.5)",
          borderRadius: "0 1px 1px 0",
        }}
      />
    </div>
  );
};

export const MainShowcase: React.FC = () => {
  const frame = useCurrentFrame();

  // Timeline (30fps):
  // 0-4800:    SceneRenderer (Opening → Arch) + bg music
  // 4800-8104: demo-only-app.mp4 recording (110.1s / 3304 frames)
  // 8104-8130: Transition / pause
  // 8130-8580: SceneRenderer (Impact + Closing) + bg music

  const isMp4Active = frame >= 4800 && frame < 8104;
  // Pre-mount MP4 100 frames early so browser has time to decode first frame
  // (known Remotion issue: Video doesn't reliably draw first frame when mounted mid-stream)
  const mp4Mounted = frame >= 4700;
  const mp4Visible = isMp4Active;
  const isNonApp = frame < 4800 || frame >= 8130;

  // Background music volume: lower during MP4 playback (which has its own narration)
  const audioVolume = (f: number) => {
    const fadeIn = Math.min(f / 60, 1);
    const fadeOutStart = 8580 - 60;
    const base = 0.08;
    if (f >= 4800 && f < 8104) return Math.min(fadeIn, 1) * 0.03;
    if (f > fadeOutStart) {
      const fadeOut = Math.max(0, (8580 - f) / 60);
      return Math.min(fadeIn, fadeOut) * base;
    }
    return fadeIn * base;
  };

  return (
    <div className="w-full h-full bg-stone-50 text-stone-900 font-sans relative overflow-hidden">
      {/* Background Music (lowered during MP4 section) */}
      <Audio
        src={staticFile("bg_music.mp3")}
        volume={audioVolume}
        loop
        onError={(err) => console.warn("Background music failed to load:", err)}
      />
      {/* Demo app MP4 recording (pre-mounted so browser decodes first frame before it becomes visible) */}
      {mp4Mounted && (
        <Video
          src={staticFile("demo-only-app.mp4")}
          volume={0}
          className="absolute inset-0"
          style={{
            width: 1920,
            height: 1080,
            opacity: mp4Visible ? 1 : 0,
            pointerEvents: mp4Visible ? "auto" : "none",
          }}
          objectFit="cover"
          onError={(e) => {
            console.warn("Demo MP4 playback error:", e);
            return "fallback";
          }}
          from={4849}
        />
      )}
      {/* Solid warm background for non-app scenes */}
      {isNonApp && <div className="absolute inset-0 bg-stone-50" />}
      {/* Scene-specific visual content (scenes 1-8, 16-17) */}
      <SceneRenderer />
      {/* Captions/subtitles */}
      <Captions />
      <ProgressIndicator />
    </div>
  );
};
