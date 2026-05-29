"use client"

import Link from "next/link"
import useSWR from "swr"
import { AlertTriangleIcon, XIcon, TruckIcon, ClockIcon, AlertCircleIcon, CloudIcon, CloudLightningIcon, SearchIcon } from "lucide-react"

import { RiskBadge } from "@/components/dashboard/risk-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiFetch, type ActiveShipmentsResponse, type RecentAlert, type HubMetric } from "@/lib/api"
import { formatDateTime, formatNumber } from "@/lib/utils"

export default function DashboardPage() {
  const pollInterval = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? 15000)
  const shipments = useSWR<ActiveShipmentsResponse>("/shipments/active", apiFetch, {
    refreshInterval: pollInterval,
    fallbackData: { shipments: [], total_at_risk: 0 },
  })
  const alerts = useSWR<{alerts: RecentAlert[]}>("/alerts/recent", apiFetch, {
    refreshInterval: pollInterval,
    fallbackData: { alerts: [] },
  })
  const {data: hubs = []} = useSWR<HubMetric[]>("/hubs/health", apiFetch, {
    refreshInterval: pollInterval,
    fallbackData: [
      { hub_id: "FRA-01", hub_name: "Frankfurt", current_inbound_volume: 0, avg_dwell_time_min: 144, delay_rate_7d: 0, congestion_level: "low", alert: false },
      { hub_id: "AMS-02", hub_name: "Amsterdam", current_inbound_volume: 0, avg_dwell_time_min: 306, delay_rate_7d: 0, congestion_level: "medium", alert: false },
      { hub_id: "LHR-03", hub_name: "London", current_inbound_volume: 0, avg_dwell_time_min: 180, delay_rate_7d: 0, congestion_level: "low", alert: false },
    ]
  })

  const rows = shipments.data?.shipments ?? []
  const highRisk = rows.filter((row) => (row.sla_risk_score ?? 0) >= 70).length
  const avgRisk = rows.length
    ? rows.reduce((sum, row) => sum + (row.sla_risk_score ?? 0), 0) / rows.length
    : 0
  const totalCo2 = rows.reduce((sum, row) => sum + (row.co2_kg ?? 0), 0)
  const latestAlert = alerts.data?.alerts?.[0]

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Operations Center</h1>
      </div>

      {latestAlert ? (
        <div className="bg-white border border-slate-200 shadow-sm rounded-md p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangleIcon className="h-5 w-5 text-black" />
            <span className="text-sm font-medium">High Risk detected for Shipment #{latestAlert.external_id ?? latestAlert.shipment_id.slice(0,8)}</span>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500">
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Shipments</CardDescription>
            <TruckIcon className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent className="pb-4 px-5 pt-0">
            <div className="text-3xl font-bold">{formatNumber(rows.length, 0)}</div>
            <div className="flex items-center text-xs text-slate-500 mt-1">
              <span className="text-slate-900 font-medium flex items-center">↗ +12%</span>
              <span className="ml-1">vs last week</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200 border-l-4 border-l-black">
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase tracking-wider">High-Risk Shipments</CardDescription>
            <AlertCircleIcon className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent className="pb-4 px-5 pt-0">
            <div className="text-3xl font-bold">{formatNumber(highRisk, 0)}</div>
            <div className="flex items-center text-xs text-slate-500 mt-1">
              <span className="text-slate-900 font-medium flex items-center">↘ -3</span>
              <span className="ml-1">from yesterday</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average SLA Risk</CardDescription>
            <ClockIcon className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent className="pb-4 px-5 pt-0">
            <div className="text-3xl font-bold">{formatNumber(avgRisk, 1)}%</div>
            <div className="flex items-center text-xs text-slate-500 mt-1">
              <span className="text-slate-900 font-medium flex items-center">→ Stable</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total CO2</CardDescription>
            <CloudIcon className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent className="pb-4 px-5 pt-0">
            <div className="text-3xl font-bold">{formatNumber(totalCo2, 1)} MT</div>
            <div className="flex items-center text-xs text-slate-500 mt-1">
              <span className="text-slate-900 font-medium flex items-center">↘ -5%</span>
              <span className="ml-1">vs target</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Hub Status</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {hubs.slice(0, 3).map((hub) => (
            <div key={hub.hub_id} className="bg-white border border-slate-200 shadow-sm rounded-md p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">{hub.hub_id}</div>
                <div className="text-sm text-slate-500">Dwell: {(hub.avg_dwell_time_min / 60).toFixed(1)}h</div>
              </div>
              <span className={`px-2 py-1 rounded-md text-xs font-semibold border tracking-wider uppercase ${hub.congestion_level === 'high' ? 'bg-slate-200 border-slate-400 text-slate-700' : hub.congestion_level === 'medium' ? 'bg-slate-50 border-slate-300 text-slate-600' : 'bg-transparent border-dashed border-slate-300 text-slate-400'}`}>
                {hub.congestion_level}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Risk Queue</h2>
          <div className="relative w-[280px]">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search Shipment ID..." className="pl-9 h-9 bg-white" />
          </div>
        </div>
        
        <Card className="shadow-sm border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-200 text-xs tracking-wider">
                <TableHead className="font-semibold text-slate-500 uppercase">Shipment ID</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Origin</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Destination</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">ETA</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">SLA Deadline</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Risk Level</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((shipment) => {
                const isHighRisk = (shipment.sla_risk_score ?? 0) > 70;
                return (
                  <TableRow key={shipment.id} className="border-slate-200">
                    <TableCell>
                      <Link href={`/shipments/${shipment.id}`} className="font-medium text-slate-900 hover:underline">
                        {shipment.external_id ?? shipment.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-600">{shipment.origin_hub_id}</TableCell>
                    <TableCell className="text-slate-600">{shipment.destination_zone}</TableCell>
                    <TableCell className="text-slate-600">
                      {shipment.predicted_delay_hours ? formatDateTime(new Date(new Date(shipment.sla_deadline || Date.now()).getTime() + (shipment.predicted_delay_hours * 3600000)).toISOString()) : "-"}
                    </TableCell>
                    <TableCell className="text-slate-600" suppressHydrationWarning>{formatDateTime(shipment.sla_deadline)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-sm text-xs font-medium border ${isHighRisk ? 'bg-slate-200 border-slate-400 text-slate-700' : 'bg-transparent border-dashed border-slate-300 text-slate-400'}`}>
                        {isHighRisk ? 'High' : 'Low'}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-900">{shipment.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</TableCell>
                    <TableCell className="text-right text-slate-400 font-medium">›</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
