import { ActivityIcon, BrainCircuitIcon, ClockIcon, InfoIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { PredictionDetail } from "@/lib/api"
import { formatNumber } from "@/lib/utils"
import { MetricCard } from "./metric-card"

export function PredictionMetrics({
  prediction,
  loading,
  error,
}: {
  prediction?: PredictionDetail
  loading: boolean
  error?: Error
}) {
  return (
    <Card className="md:col-span-2 shadow-sm border-slate-200 rounded-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BrainCircuitIcon className="h-4 w-4 text-slate-500" /> Orca AI Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {loading ? (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        ) : error ? (
          <p className="text-red-500 text-sm col-span-3">Failed to load prediction: {error.message}</p>
        ) : prediction ? (
          <>
            <MetricCard
              label="Delay Probability"
              value={`${formatNumber((prediction.delay_probability ?? 0) * 100, 1)}%`}
              sub="LightGBM output"
              icon={ActivityIcon}
              accent="bg-purple-50"
            />
            <MetricCard
              label="Predicted Delay"
              value={`${formatNumber(prediction.predicted_delay_hours, 1)}h`}
              sub="if delay occurs"
              icon={ClockIcon}
              accent="bg-amber-50"
            />
            <MetricCard
              label="Model Version"
              value={prediction.model_version ?? "-"}
              sub="ORCA Delay Predictor"
              icon={InfoIcon}
              accent="bg-slate-100"
            />
          </>
        ) : (
          <p className="text-slate-800 text-base col-span-3">Prediction not yet computed</p>
        )}
      </CardContent>
    </Card>
  )
}
