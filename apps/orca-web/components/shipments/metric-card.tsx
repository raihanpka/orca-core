import type { LucideIcon } from "lucide-react"

export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  accent?: string
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className={`rounded-lg p-2.5 ${accent ?? "bg-slate-100"}`}>
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  )
}
