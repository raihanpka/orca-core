import {Badge} from "@/components/ui/badge";
import {riskLevel} from "@/lib/utils";

export function RiskBadge({score}: {score: number | null | undefined}) {
  const level = riskLevel(score);
  if (level === "high") return <Badge variant="destructive">High Risk</Badge>;
  if (level === "medium") return <Badge className="border-amber-200 bg-amber-50 text-amber-800">Medium Risk</Badge>;
  if (level === "low") return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Low Risk</Badge>;
  return <Badge variant="outline">Unknown</Badge>;
}
