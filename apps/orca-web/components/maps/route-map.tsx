"use client"

import { Map, MapControls, MapMarker, MapRoute, MarkerContent, MarkerLabel } from "@/components/ui/map"
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
  if (tone === "high") return "border-red-200 bg-red-600 text-white"
  if (tone === "medium") return "border-amber-200 bg-amber-500 text-white"
  if (tone === "low") return "border-emerald-200 bg-emerald-600 text-white"
  return "border-border bg-primary text-primary-foreground"
}

export function RouteMap({title = "Map Preview", points, className}: RouteMapProps) {
  const center = points[0]?.coordinates ?? ([106.8272, -6.1754] as [number, number])
  const routeCoordinates = points.map((point) => point.coordinates)

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">MapCN MapLibre</div>
      </div>
      <div className="relative flex-1 min-h-0">
        <Map
          center={center}
          zoom={9}
          theme="light"
          className="absolute inset-0 h-full w-full"
        >
        <MapControls position="top-right" showZoom showCompass />
        {routeCoordinates.length > 1 ? (
          <MapRoute coordinates={routeCoordinates} color="#171717" width={4} opacity={0.9} />
        ) : null}
        {points.map((point, index) => (
          <MapMarker
            key={`${point.label}-${index}`}
            longitude={point.coordinates[0]}
            latitude={point.coordinates[1]}
          >
            <MarkerContent>
              <div className={cn("grid size-6 place-items-center rounded-full border text-xs font-semibold shadow-sm", markerClassName(point.tone))}>
                {index + 1}
              </div>
            </MarkerContent>
            <MarkerLabel>{point.label}</MarkerLabel>
          </MapMarker>
        ))}
      </Map>
      </div>
    </div>
  )
}

