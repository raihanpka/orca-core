import { BrainCircuitIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import type { ShapContribution } from "@/lib/api"
import { formatNumber } from "@/lib/utils"
import { featureLabel } from "./shipment-labels"

function ShapBar({
  feature,
  value,
  contribution,
  maxAbs,
}: {
  feature: string
  value: number | string
  contribution: number
  maxAbs: number
}) {
  const pct = maxAbs > 0 ? Math.abs(contribution) / maxAbs : 0
  const isPositive = contribution >= 0

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-40 shrink-0 text-sm text-slate-700 font-medium truncate">
        {featureLabel(feature)}
      </div>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 rounded-sm bg-slate-100 relative overflow-hidden">
          <div
            className={`absolute top-0 h-full rounded-sm transition-all ${
              isPositive ? "bg-rose-500 left-0" : "bg-indigo-400 right-0"
            }`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <span className={`text-xs font-mono w-14 text-right ${isPositive ? "text-rose-600" : "text-indigo-600"}`}>
          {contribution >= 0 ? "+" : ""}
          {contribution.toFixed(3)}
        </span>
      </div>
      <div className="w-20 shrink-0 text-sm text-slate-800 text-right">
        val: {typeof value === "number" ? formatNumber(value, 2) : value}
      </div>
    </div>
  )
}

export function ShapContributionsCard({
  contributions,
  modelVersion,
  loading,
}: {
  contributions?: ShapContribution[]
  modelVersion?: string
  loading: boolean
}) {
  const maxAbs = contributions?.length
    ? Math.max(...contributions.map((c) => Math.abs(c.contribution)))
    : 1

  return (
    <Card className="shadow-sm border-slate-200 rounded-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BrainCircuitIcon className="h-4 w-4 text-purple-600" /> Why is this shipment at
          risk? - SHAP Feature Contributions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : contributions?.length ? (
          <div>
            <div className="flex text-sm text-slate-800 mb-2 gap-3">
              <span className="w-40 shrink-0">Feature</span>
              <span className="flex-1">
                <span className="text-rose-500">Red Color = Increases Risk</span>
                {" / "}
                <span className="text-indigo-400">Blue Color = Reduces Risk</span>
              </span>
              <span className="w-14 text-right">SHAP</span>
              <span className="w-20 text-right">Value</span>
            </div>
            <Separator className="mb-2" />
            {contributions.map((c) => (
              <ShapBar
                key={c.feature}
                feature={c.feature}
                value={c.value}
                contribution={c.contribution}
                maxAbs={maxAbs}
              />
            ))}
            <Separator className="mt-2" />
            <p className="text-sm text-slate-800 mt-3">
              SHAP (SHapley Additive exPlanations) values show how each feature pushes the delay
              probability above or below the baseline. Model: {modelVersion}.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-slate-800 text-base gap-2">
            <BrainCircuitIcon className="h-8 w-8 text-slate-300" />
            <p>SHAP explanations will appear once a prediction is stored for this shipment</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
