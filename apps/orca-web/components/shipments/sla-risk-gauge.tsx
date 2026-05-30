import { ShieldAlertIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { RiskBadge } from "@/components/dashboard/risk-badge"
import { formatNumber, riskLevel } from "@/lib/utils"

function RiskGauge({ score }: { score: number }) {
  const level = riskLevel(score)
  const color =
    level === "high" ? "text-rose-600" : level === "medium" ? "text-amber-600" : "text-emerald-600"
  const bg =
    level === "high"
      ? "bg-rose-50 border-rose-200"
      : level === "medium"
        ? "bg-amber-50 border-amber-200"
        : "bg-emerald-50 border-emerald-200"

  return (
    <div className={`flex flex-col items-center justify-center rounded-sm border p-5 h-full ${bg}`}>
      <p className={`text-5xl font-black ${color}`}>{formatNumber(score, 0)}</p>
      <p className="text-sm text-slate-900 mt-1">out of 100</p>
      <RiskBadge score={score} />
    </div>
  )
}

export function SlaRiskGauge({
  score,
  loading,
  error,
}: {
  score?: number
  loading: boolean
  error?: Error
}) {
  return (
    <Card className="md:col-span-1 shadow-sm border-slate-200 rounded-sm flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldAlertIcon className="h-4 w-4 text-slate-500" /> SLA Risk Score
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : error ? (
          <p className="text-red-500 text-sm">Failed to load prediction: {error.message}</p>
        ) : score != null ? (
          <RiskGauge score={score} />
        ) : (
          <p className="text-slate-800 text-base">No prediction available</p>
        )}
      </CardContent>
    </Card>
  )
}
