import { ShieldAlertIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { interventionColor, interventionLabel } from "./shipment-labels"

export function InterventionActions({ options }: { options?: string[] }) {
  if (!options?.length) return null

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldAlertIcon className="h-4 w-4 text-slate-500" /> Recommended Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {options.map((opt) => (
          <div
            key={opt}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${interventionColor(opt)}`}
          >
            <ShieldAlertIcon className="h-4 w-4 mt-0.5 shrink-0" />
            {interventionLabel(opt)}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
