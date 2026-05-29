"use client"

import Link from "next/link"
import { useCallback } from "react"
import useSWR from "swr"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { SectionCards } from "@/components/section-cards"
import { RiskBadge } from "@/components/dashboard/risk-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { apiFetch, type ActiveShipmentsResponse, type RecentAlert } from "@/lib/api"
import { useOrcaWebSocket } from "@/hooks/use-orca-websocket"
import { demoAlerts, demoCarbon, demoShipments } from "@/lib/mock-data"
import { formatDateTime, formatNumber } from "@/lib/utils"

export default function DashboardPage() {
  const pollInterval = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? 15000)
  const shipments = useSWR<ActiveShipmentsResponse>("/shipments/active", apiFetch, {
    refreshInterval: pollInterval,
    fallbackData: demoShipments,
  })
  const alerts = useSWR<{alerts: RecentAlert[]}>("/alerts/recent", apiFetch, {
    refreshInterval: pollInterval,
    fallbackData: {alerts: demoAlerts},
  })
  const handleWsMessage = useCallback((message: {type: string; shipment_id: string; sla_risk_score?: number; delay_probability?: number; intervention?: string}) => {
    if (message.type === "prediction_update") {
      shipments.mutate((current) => {
        if (!current) return current
        return {
          ...current,
          shipments: current.shipments.map((shipment) =>
            shipment.id === message.shipment_id
              ? {
                  ...shipment,
                  sla_risk_score: message.sla_risk_score ?? shipment.sla_risk_score,
                  delay_probability: message.delay_probability ?? shipment.delay_probability,
                }
              : shipment
          ),
        }
      }, false)
    }
    if (message.type === "alert") {
      alerts.mutate()
    }
  }, [alerts, shipments])
  const ws = useOrcaWebSocket({onMessage: handleWsMessage})

  const rows = shipments.data?.shipments ?? []
  const highRisk = rows.filter((row) => (row.sla_risk_score ?? 0) >= 70).length
  const avgRisk = rows.length
    ? rows.reduce((sum, row) => sum + (row.sla_risk_score ?? 0), 0) / rows.length
    : 0
  const totalCo2 = rows.reduce((sum, row) => sum + (row.co2_kg ?? 0), 0)
  const latestAlert = alerts.data?.alerts?.[0]
  const trend = demoCarbon.by_day.map((item, index) => ({
    date: item.date,
    risk: [36, 44, 39, 58, 49, 61, 54][index] ?? avgRisk,
    carbon: item.co2_kg,
  }))

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Operations Dashboard</h1>
              <Badge variant="outline">MVP</Badge>
              <Badge variant="outline">WS {ws.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Monitor active shipment risk, SLA alerts, and carbon visibility from the ORCA command center.
            </p>
          </div>
        </div>

        {latestAlert ? (
          <div className="px-4 lg:px-6">
            <Card className="bg-linear-to-t from-destructive/10 to-card shadow-xs border-destructive/20">
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-destructive">High-risk alert</div>
                  <div className="text-sm text-muted-foreground">
                    Shipment {latestAlert.external_id ?? latestAlert.shipment_id} requires {latestAlert.intervention}.
                  </div>
                </div>
                <Badge variant="destructive" className="w-fit">
                  Risk {formatNumber(latestAlert.sla_risk_score, 0)}
                </Badge>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <SectionCards
          activeShipments={rows.length}
          highRiskShipments={highRisk}
          averageRisk={avgRisk}
          totalCo2Kg={totalCo2}
        />

        <div className="px-4 lg:px-6">
          <ChartAreaInteractive data={trend} />
        </div>

        <div className="px-4 lg:px-6">
          <Card className="shadow-xs">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Risk Queue</CardTitle>
                <CardDescription>
                  Highest-risk shipments for dispatcher triage. Calls use `NEXT_PUBLIC_API_TOKEN`.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => shipments.mutate()}>
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>CO2</TableHead>
                    <TableHead>Intervention</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell>
                        <Link href={`/shipments/${shipment.id}`} className="font-medium hover:underline">
                          {shipment.external_id ?? shipment.id.slice(0, 8)}
                        </Link>
                        <div className="text-xs text-muted-foreground">{shipment.status}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{shipment.origin_hub_id}</div>
                        <div className="text-xs text-muted-foreground">{shipment.destination_zone}</div>
                      </TableCell>
                      <TableCell suppressHydrationWarning>{formatDateTime(shipment.sla_deadline)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <RiskBadge score={shipment.sla_risk_score} />
                          <span className="text-sm text-muted-foreground">{formatNumber(shipment.sla_risk_score, 0)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatNumber(shipment.co2_kg, 1)} kg</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {shipment.intervention_recommended ?? "monitor"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
