"use client"

import L from "leaflet"
import { useState } from "react"
import {
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from "react-leaflet"
import { cn } from "@/lib/utils"

function LocationPickerEvents({ onLocationPicked }: { onLocationPicked: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click(e) {
      onLocationPicked(e.latlng.lat, e.latlng.lng)
      map.flyTo(e.latlng, map.getZoom())
    }
  })
  return null
}

export function LocationPickerMap({
  defaultLocation = [-6.1754, 106.8272], // Default Jakarta
  onLocationSelected,
  className,
}: {
  defaultLocation?: [number, number]
  onLocationSelected: (lat: number, lng: number) => void
  className?: string
}) {
  const [position, setPosition] = useState<[number, number]>(defaultLocation)

  const handleLocationPicked = (lat: number, lng: number) => {
    setPosition([lat, lng])
    onLocationSelected(lat, lng)
  }

  const icon = L.divIcon({
    className: "",
    html: `<div style="display:grid;place-items:center;width:24px;height:24px;border-radius:9999px;border:2px solid #fecaca;background:#dc2626;color:#fff;font-size:12px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.18);cursor:grab">+</div>`,
    iconAnchor: [12, 12],
    iconSize: [24, 24],
  })

  return (
    <div className={cn("flex flex-col overflow-hidden bg-card text-card-foreground border rounded-md shadow-sm", className)}>
      <div className="relative flex-1 min-h-[300px]">
        <MapContainer
          center={position}
          zoom={13}
          scrollWheelZoom
          className="absolute inset-0 h-full w-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationPickerEvents onLocationPicked={handleLocationPicked} />
          <Marker 
            position={position} 
            icon={icon} 
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target
                const position = marker.getLatLng()
                handleLocationPicked(position.lat, position.lng)
              }
            }}
          />
        </MapContainer>
      </div>
      <div className="p-3 text-xs text-slate-500 bg-slate-50 border-t">
        Click anywhere on the map or drag the pin to select a location.
      </div>
    </div>
  )
}
