import { ClockIcon, MapPinIcon, PackageIcon, RouteIcon, TruckIcon, WeightIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import type { ShipmentDetail } from "@/lib/api"
import { formatDateTime, formatNumber } from "@/lib/utils"
import { vehicleLabel } from "./shipment-labels"

export function ShipmentProfileCard({
  shipment,
  loading,
}: {
  shipment?: ShipmentDetail
  loading: boolean
}) {
  return (
    <Card className="shadow-sm border-slate-200 rounded-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <PackageIcon className="h-4 w-4 text-slate-500" /> Shipment Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : shipment ? (
          <>
            <ProfileRow icon={RouteIcon} label="Origin Hub" value={shipment.origin_hub_id} />
            <Separator />
            <ProfileRow icon={MapPinIcon} label="Destination" value={shipment.destination_zone ?? "-"} />
            <Separator />
            <ProfileRow icon={TruckIcon} label="Vehicle" value={vehicleLabel(shipment.vehicle_type)} />
            <Separator />
            <ProfileRow
              icon={WeightIcon}
              label="Load"
              value={`${formatNumber(shipment.load_weight_kg, 1)} kg (${shipment.item_count} items)`}
            />
            <Separator />
            <ProfileRow icon={RouteIcon} label="Distance" value={`${formatNumber(shipment.distance_km, 1)} km`} />
            <Separator />
            <ProfileRow icon={ClockIcon} label="SLA Deadline" value={formatDateTime(shipment.sla_deadline)} />
            <Separator />
            <ProfileRow icon={ClockIcon} label="Dispatched" value={formatDateTime(shipment.dispatched_at)} />
          </>
        ) : (
          <p className="text-slate-400">Shipment not found</p>
        )}
      </CardContent>
    </Card>
  )
}

function ProfileRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-400 shrink-0" />
      <span className="text-slate-500">{label}</span>
      <span className="ml-auto font-medium text-slate-800">{value}</span>
    </div>
  )
}
