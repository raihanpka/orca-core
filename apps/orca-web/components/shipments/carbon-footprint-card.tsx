import { LeafIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ShipmentDetail } from "@/lib/api"
import { formatNumber } from "@/lib/utils"

export function CarbonFootprintCard({
  carbon,
  loading,
}: {
  carbon?: ShipmentDetail["carbon"]
  loading: boolean
}) {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <LeafIcon className="h-4 w-4 text-emerald-600" /> Carbon Footprint (GLEC v3.0)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : carbon?.co2_kg != null ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-5xl font-black text-emerald-700">{formatNumber(carbon.co2_kg, 2)}</p>
              <p className="text-sm text-emerald-600 font-medium mt-1">kg CO2e</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-slate-500 text-xs">Distance</p>
                <p className="font-semibold text-slate-800">{formatNumber(carbon.distance_km, 1)} km</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <p className="text-slate-500 text-xs">Emission Factor</p>
                <p className="font-semibold text-slate-800">{carbon.emission_factor} kg/tkm</p>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Formula: distance × load_ton × factor (GLEC Framework v{carbon.glec_version})
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm gap-2">
            <LeafIcon className="h-8 w-8 text-slate-300" />
            <p>Carbon record not yet generated</p>
            <p className="text-xs">Generated after first ML prediction run</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
