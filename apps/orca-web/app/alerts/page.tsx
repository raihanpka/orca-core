"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"

import { RiskBadge } from "@/components/dashboard/risk-badge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiFetch, type RecentAlert } from "@/lib/api"
import { demoAlerts } from "@/lib/mock-data"
import { formatDateTime, formatNumber } from "@/lib/utils"

export default function AlertsPage() {
  const [riskFilter, setRiskFilter] = useState("all")
  const {data = {alerts: demoAlerts}} = useSWR<{alerts: RecentAlert[]}>("/alerts/recent", apiFetch, {
    fallbackData: {alerts: demoAlerts},
    refreshInterval: 15000,
  })

  const alerts = useMemo(() => {
    if (riskFilter === "high") return data.alerts.filter((alert) => alert.sla_risk_score >= 70)
    if (riskFilter === "medium") return data.alerts.filter((alert) => alert.sla_risk_score >= 40 && alert.sla_risk_score < 70)
    return data.alerts
  }, [data.alerts, riskFilter])

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Review SLA risk escalations and intervention history from the engine dispatch flow.
          </p>
        </div>
        <div className="w-full md:w-48">
          <Select value={riskFilter} onValueChange={(val) => setRiskFilter(val || "")}>
            <SelectTrigger>
              <SelectValue placeholder="Risk filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All alerts</SelectItem>
              <SelectItem value="high">High risk</SelectItem>
              <SelectItem value="medium">Medium risk</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Total Alerts" value={alerts.length.toString()} helper="Current filtered view" />
        <Metric label="High Risk" value={alerts.filter((alert) => alert.sla_risk_score >= 70).length.toString()} helper="Requires immediate triage" />
        <Metric label="Latest Risk" value={formatNumber(alerts[0]?.sla_risk_score, 0)} helper={alerts[0]?.external_id ?? "No recent alert"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alert History</CardTitle>
          <CardDescription>Latest operational alerts, sorted by created time from the API.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Intervention</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell className="font-medium">{alert.external_id ?? alert.shipment_id}</TableCell>
                  <TableCell>{alert.alert_type}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <RiskBadge score={alert.sla_risk_score} />
                      <span className="text-sm text-muted-foreground">{formatNumber(alert.sla_risk_score, 0)}</span>
                    </div>
                  </TableCell>
                  <TableCell>{alert.intervention}</TableCell>
                  <TableCell suppressHydrationWarning>{formatDateTime(alert.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Recorded</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({label, value, helper}: {label: string; value: string; helper: string}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground">{helper}</div>
      </CardContent>
    </Card>
  )
}
