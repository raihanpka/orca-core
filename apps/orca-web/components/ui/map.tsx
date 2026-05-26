"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Marker as LeafletMarker, MapContainer, TileLayer, Polyline, ZoomControl, useMap as useLeafletMap } from "react-leaflet";
import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// Provide a mock context for compatibility
const MapContext = createContext<null>(null);
export function useMap() {
  return null;
}

type MapProps = {
  center: [number, number]; // [lng, lat] to match maplibre
  zoom: number;
  theme?: "light" | "dark";
  className?: string;
  children?: ReactNode;
};

const defaultStyles = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};

export function Map({ center, zoom, theme = "light", className, children }: MapProps) {
  const url = defaultStyles[theme] || defaultStyles.light;
  return (
    <div className={cn("relative z-0", className)}>
      <MapContainer 
        center={[center[1], center[0]]} 
        zoom={zoom} 
        style={{ height: "100%", width: "100%", position: "absolute", inset: 0 }} 
        zoomControl={false}
      >
        <TileLayer 
          url={url} 
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>' 
        />
        {children}
      </MapContainer>
    </div>
  );
}

const MarkerContext = createContext<{ marker: L.Marker } | null>(null);

export function useMarkerContext() {
  const ctx = useContext(MarkerContext);
  if (!ctx) throw new Error("useMarkerContext must be inside MapMarker");
  return ctx;
}

export function MapMarker({ 
  longitude, 
  latitude, 
  children 
}: { 
  longitude: number; 
  latitude: number; 
  children: ReactNode 
}) {
  const [markerRef, setMarkerRef] = useState<L.Marker | null>(null);
  
  // Create an invisible divIcon that we will portal into
  const icon = useMemo(() => {
    return L.divIcon({
      className: "custom-leaflet-marker",
      html: "<div style='position: relative;'></div>",
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
  }, []);

  return (
    <>
      <LeafletMarker position={[latitude, longitude]} icon={icon} ref={setMarkerRef} />
      {markerRef && (
        <MarkerContext.Provider value={{ marker: markerRef }}>
          {children}
        </MarkerContext.Provider>
      )}
    </>
  );
}

export function MarkerContent({ children, className }: { children?: ReactNode; className?: string }) {
  const { marker } = useMarkerContext();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = marker.getElement();
    if (el && el.firstChild) {
      setContainer(el.firstChild as HTMLElement);
    }
  }, [marker]);

  if (!container) return null;

  // We add -translate-x-1/2 -translate-y-1/2 to center the portal content around the marker anchor point
  return createPortal(
    <div className={cn("relative cursor-pointer -translate-x-1/2 -translate-y-1/2", className)}>
      {children || <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />}
    </div>,
    container
  );
}

export function MarkerLabel({ 
  children, 
  className, 
  position = "top" 
}: { 
  children: ReactNode; 
  className?: string; 
  position?: "top" | "bottom" 
}) {
  const positionClasses = {
    top: "bottom-full mb-1",
    bottom: "top-full mt-1",
  };
  return (
    <div className={cn("absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-foreground text-[10px] font-medium", positionClasses[position], className)}>
      {children}
    </div>
  );
}

export function MapRoute({ 
  coordinates, 
  color = "#171717", 
  width = 4, 
  opacity = 0.9 
}: { 
  coordinates: number[][]; 
  color?: string; 
  width?: number; 
  opacity?: number;
}) {
  // maplibre coordinates: [[lng, lat], [lng, lat]]
  // leaflet coordinates: [[lat, lng], [lat, lng]]
  const latLngs = useMemo(() => coordinates.map(c => [c[1], c[0]] as [number, number]), [coordinates]);
  
  return <Polyline positions={latLngs} pathOptions={{ color, weight: width, opacity }} />;
}

export function MapControls({ position = "top-right", showZoom = true }: { position?: string, showZoom?: boolean, showCompass?: boolean }) {
  if (!showZoom) return null;
  // map position string to leaflet position format
  const leafletPosition = position.replace("-", "") as any;
  return <ZoomControl position={leafletPosition || "topright"} />;
}

// Mock unused components for compatibility so we don't break imports
export function MarkerPopup() { return null; }
export function MarkerTooltip() { return null; }
export function MapPopup() { return null; }
export function MapArc() { return null; }
export function MapClusterLayer() { return null; }
