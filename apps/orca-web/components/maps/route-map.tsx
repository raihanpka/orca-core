"use client"

import L from "leaflet"
import { useEffect } from "react"
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet"

import { cn } from "@/lib/utils"

export type Point = {
  label: string
  coordinates: [number, number]
  tone?: "default" | "high" | "medium" | "low"
}

type RouteMapProps = {
  title?: string
  points: Point[]
  className?: string
}

function markerClassName(tone?: Point["tone"]) {
  if (tone === "high") return {background: "#dc2626", border: "#fecaca", color: "#fff"}
  if (tone === "medium") return {background: "#f59e0b", border: "#fde68a", color: "#fff"}
  if (tone === "low") return {background: "#059669", border: "#bbf7d0", color: "#fff"}
  return {background: "#171717", border: "#e5e5e5", color: "#fff"}
}

export function RouteMap({title = "Map Preview", points, className}: RouteMapProps) {
  const center = points[0]?.coordinates ?? ([106.8272, -6.1754] as [number, number])
  const routeCoordinates = points.map((point) => [point.coordinates[1], point.coordinates[0]] as [number, number])

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">React Leaflet OSM</div>
      </div>
      <div className="relative flex-1 min-h-0">
        <MapContainer
          center={[center[1], center[0]]}
          zoom={9}
          zoomControl
          scrollWheelZoom
          className="absolute inset-0 h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitRouteBounds coordinates={routeCoordinates} />
          {routeCoordinates.length > 1 ? (
            <Polyline positions={routeCoordinates} pathOptions={{color: "#171717", weight: 4, opacity: 0.9}} />
          ) : null}
          {points.map((point, index) => (
            <Marker
              key={`${point.label}-${index}`}
              position={[point.coordinates[1], point.coordinates[0]]}
              icon={createMarkerIcon(index + 1, point.tone)}
            >
              <Tooltip direction="top" offset={[0, -12]} opacity={1} permanent>
                {point.label}
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}

function FitRouteBounds({coordinates}: {coordinates: [number, number][]}) {
  const map = useMap()
  useEffect(() => {
    if (coordinates.length < 2) return
    map.fitBounds(L.latLngBounds(coordinates), {padding: [28, 28], maxZoom: 12})
  }, [coordinates, map])
  return null
}

function createMarkerIcon(index: number, tone?: Point["tone"]) {
  const styles = markerClassName(tone)
  return L.divIcon({
    className: "",
    html: [
      "<div",
      ` style="display:grid;place-items:center;width:24px;height:24px;border-radius:9999px;border:2px solid ${styles.border};background:${styles.background};color:${styles.color};font-size:12px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.18)"`,
      `>${index}</div>`,
    ].join(""),
    iconAnchor: [12, 12],
    iconSize: [24, 24],
  })
}
