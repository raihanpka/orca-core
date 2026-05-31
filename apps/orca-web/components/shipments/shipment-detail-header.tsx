import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { ShipmentDetail } from "@/lib/api"

export function ShipmentDetailHeader({
  id,
  shipment,
  loading,
}: {
  id: string
  shipment?: ShipmentDetail
  loading: boolean
}) {
  return (
    <div>
      <Link
        href="/operations"
        className="inline-flex items-center text-sm text-[#005A8C] hover:underline mb-4 font-medium"
      >
        <ArrowLeftIcon className="mr-1.5 h-4 w-4" /> Back to Operations
      </Link>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Shipment Detail</h1>
        {loading ? (
          <Skeleton className="h-6 w-36" />
        ) : (
          <Badge variant="outline" className="font-mono text-xs">
            {shipment?.external_id ?? id.slice(0, 8).toUpperCase()}
          </Badge>
        )}
        {shipment?.status && (
          <Badge
            className={
              shipment.status === "in_transit"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-slate-100 text-slate-600"
            }
          >
            {shipment.status.replace("_", " ")}
          </Badge>
        )}
      </div>
      <p className="text-base text-slate-900 mt-1 font-mono">{id}</p>
    </div>
  )
}
