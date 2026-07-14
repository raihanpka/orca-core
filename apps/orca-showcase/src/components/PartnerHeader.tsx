import React from "react";
import { Img, staticFile } from "remotion";

export const PartnerHeader: React.FC = () => {
  return (
    <div
      className="absolute top-0 left-0 right-0 h-14 flex items-center px-6 z-45"
      style={{
        background: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      {/* Left: Team name */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "#94a3b8",
          letterSpacing: "0.02em",
        }}
      >
        Manusia yang tak pakai AI akan kalah
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Center/Right: All logos in a row */}
      <div className="flex items-center" style={{ gap: 20 }}>
        <Img
          src={staticFile("logo.png")}
          style={{ height: 26, width: "auto" }}
          alt="ORCA"
        />
        <div
          style={{
            width: 1,
            height: 18,
            background: "rgba(255, 255, 255, 0.12)",
          }}
        />
        <Img
          src={staticFile("blibli_logo.png")}
          style={{ height: 26, width: "auto", opacity: 0.95 }}
          alt="Blibli"
        />
        <Img
          src={staticFile("fablab_logo.png")}
          style={{ height: 20, width: "auto", opacity: 0.9 }}
          alt="FabLab Jababeka"
        />
        <Img
          src={staticFile("kemenko_logo.png")}
          style={{ height: 20, width: "auto", opacity: 0.9 }}
          alt="Kemenko Perekonomian"
        />
      </div>
    </div>
  );
};
