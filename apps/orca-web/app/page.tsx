"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { CartesianGrid, Bar, BarChart, XAxis, YAxis, PieChart, Pie, Cell, Label as RechartsLabel } from "recharts"
import { AlertTriangleIcon, XIcon, SearchIcon, Loader2Icon, CloudIcon, TruckIcon } from "lucide-react"

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
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiFetch, type ActiveShipmentsResponse, type RecentAlert, type CarbonAnalytics } from "@/lib/api"
import { formatDateTime, formatNumber } from "@/lib/utils"

function toTitleCase(str: string) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

const dailyChartConfig = {
  co2_kg: {
    label: "CO2 kg",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export default function CarbonDashboardPage() {
  const pollInterval = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? 15000)
  
  const { data: shipmentsData } = useSWR<ActiveShipmentsResponse>("/shipments/active", apiFetch, {
    refreshInterval: pollInterval,
    fallbackData: { shipments: [], total_at_risk: 0 },
  })
  
  const { data: alertsData } = useSWR<{ alerts: RecentAlert[] }>("/alerts/recent", apiFetch, {
    refreshInterval: pollInterval,
    fallbackData: { alerts: [] },
  })

  const { data: carbonData = { by_day: [], by_vehicle_type: [], total_co2_kg: 0, avg_co2_per_shipment_kg: 0, vs_baseline_pct: 0, glec_version: "v3.0" } } = useSWR<CarbonAnalytics>("/analytics/carbon", apiFetch, {
    refreshInterval: 30000,
  })

  const [dismissedAlertId, setDismissedAlertId] = useState<string | null>(null)

  const rows = shipmentsData?.shipments ?? []
  const latestAlert = alertsData?.alerts?.[0]
  const showAlert = latestAlert && latestAlert.id !== dismissedAlertId

  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = rows.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Carbon Footprint Dashboard</h1>
        <p className="text-sm text-slate-500">Real-time GLEC-compliant emissions tracking & per-route analytics.</p>
      </div>

      {showAlert && (
        <div className="bg-red-50 border border-red-200 shadow-sm rounded-md p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangleIcon className="h-5 w-5 text-red-600" />
            <div>
              <span className="text-sm font-medium text-red-900">High Risk SLA Warning: Shipment #{latestAlert.external_id ?? latestAlert.shipment_id.slice(0, 8)}</span>
              <p className="text-xs text-red-700 mt-0.5">Risk score is {latestAlert.sla_risk_score.toFixed(1)}%. <Link href="/alerts" className="underline font-medium hover:text-red-900">View Alert Details</Link></p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-900 hover:bg-red-100" onClick={() => setDismissedAlertId(latestAlert.id)}>
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Carbon Metrics Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm border-slate-200 rounded-sm">
          <CardHeader className="pb-1 pt-4 px-5">
            <CardDescription className="text-xs font-bold text-slate-500 tracking-wider uppercase">Total CO2 Emitted</CardDescription>
            <div className="flex items-center justify-between">
              <CardTitle className="text-3xl font-bold pt-2">{formatNumber(carbonData.total_co2_kg, 1)} kg</CardTitle>
              <CloudIcon className="h-5 w-5 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent className="pb-4 px-5 pt-0">
            <div className="text-xs text-slate-400 mt-2">GLEC {carbonData.glec_version} Compliant</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 rounded-sm border-l-4 border-l-black">
          <CardHeader className="pb-1 pt-4 px-5">
            <CardDescription className="text-xs font-bold text-slate-500 tracking-wider uppercase">Avg CO2 / Shipment</CardDescription>
            <div className="flex items-center justify-between">
              <CardTitle className="text-3xl font-bold pt-2">{formatNumber(carbonData.avg_co2_per_shipment_kg, 1)} kg</CardTitle>
              <TruckIcon className="h-5 w-5 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent className="pb-4 px-5 pt-0">
            <div className="text-xs text-slate-400 mt-2">Estimated from distance, load & vehicle</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 rounded-sm">
          <CardHeader className="pb-1 pt-4 px-5">
            <CardDescription className="text-xs font-bold text-slate-500 tracking-wider uppercase">Active Shipments</CardDescription>
            <CardTitle className="text-3xl font-bold pt-2">{formatNumber(rows.length, 0)}</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-5 pt-0">
            <div className="text-xs text-slate-400 mt-2">Currently monitored routes</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-sm border-slate-200 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Daily CO2 Trend</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center min-h-[300px]">
            <ChartContainer config={dailyChartConfig} className="h-[250px] w-full">
              <BarChart data={carbonData.by_day}>
                <CartesianGrid vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} stroke="#94A3B8" />
                <YAxis fontSize={12} stroke="#94A3B8" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Bar dataKey="co2_kg" fill="#334155" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Vehicle Emission Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center min-h-[300px]">
            {carbonData.by_vehicle_type.length > 0 ? (
              <div className="flex items-center justify-center gap-8">
                <div className="w-32 h-32 flex-shrink-0 relative flex items-center justify-center">
                  <PieChart width={128} height={128}>
                    <Pie
                      data={carbonData.by_vehicle_type}
                      dataKey="co2_kg"
                      nameKey="vehicle_type"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={60}
                      stroke="none"
                    >
                      {carbonData.by_vehicle_type.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#475569', '#1e293b', '#94a3b8', '#cbd5e1'][index % 4]} />
                      ))}
                      <RechartsLabel
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                            return (
                              <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                <tspan x={viewBox.cx} y={viewBox.cy} className="fill-slate-900 text-sm font-bold">
                                  {formatNumber(carbonData.total_co2_kg, 0)} kg
                                </tspan>
                              </text>
                            )
                          }
                        }}
                      />
                    </Pie>
                  </PieChart>
                </div>
                <div className="flex-1 space-y-4">
                  {carbonData.by_vehicle_type.map((item, i) => {
                    const totalCo2 = carbonData.total_co2_kg || 1
                    const percent = Math.round((item.co2_kg / totalCo2) * 100)
                    return (
                      <div key={item.vehicle_type} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium text-slate-700">
                          <span className="capitalize">{toTitleCase(item.vehicle_type)}: {percent}% — {formatNumber(item.co2_kg, 1)} kg</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full" 
                            style={{
                              width: `${percent}%`,
                              backgroundColor: i === 0 ? '#475569' : i === 1 ? '#1e293b' : '#94a3b8'
                            }} 
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500 text-center">No vehicle data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Per-Route Analytics</h2>
          <div className="relative w-[280px]">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search Destination or ID..." className="pl-9 h-9 bg-white" />
          </div>
        </div>

        <Card className="shadow-sm border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-200 text-xs tracking-wider">
                <TableHead className="font-semibold text-slate-500 uppercase pl-6">Shipment ID</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Origin</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Destination</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Vehicle</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Dist & Load</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Risk Level</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase pr-6">Total CO2</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((shipment) => {
                const isHighRisk = (shipment.sla_risk_score ?? 0) > 70;
                // Attempt to parse destination as float if it's erroneously just numbers, 
                // but display it cleanly. In most cases it should be a string.
                const destDisplay = isNaN(Number(shipment.destination_zone)) 
                  ? toTitleCase(shipment.destination_zone || "Unknown") 
                  : `Zone ${shipment.destination_zone}`;

                return (
                  <TableRow key={shipment.id} className="border-slate-200 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="pl-6">
                      <span className="font-medium text-slate-900">
                        {shipment.external_id ?? shipment.id.slice(0, 8)}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">{toTitleCase(shipment.origin_hub_id)}</TableCell>
                    <TableCell className="text-slate-600">{destDisplay}</TableCell>
                    <TableCell className="text-slate-600">{toTitleCase(shipment.vehicle_type)}</TableCell>
                    <TableCell className="text-slate-600 text-xs">
                      <div>{shipment.distance_km ? `${formatNumber(shipment.distance_km, 1)} km` : '-'}</div>
                      <div className="text-slate-400">{shipment.load_weight_kg ? `${formatNumber(shipment.load_weight_kg, 1)} kg` : '-'}</div>
                    </TableCell>
                    <TableCell>
                      {shipment.sla_risk_score !== null && shipment.sla_risk_score !== undefined ? (
                        <span className={`px-2 py-0.5 rounded-sm text-xs font-medium border ${isHighRisk ? 'bg-slate-200 border-slate-400 text-slate-700' : 'bg-transparent border-dashed border-slate-300 text-slate-400'}`}>
                          {isHighRisk ? 'High' : 'Low'}
                        </span>
                      ) : (
                        <div className="flex items-center text-slate-400 text-xs gap-1.5"><Loader2Icon className="h-3 w-3 animate-spin" /> Scoring...</div>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-900 font-medium pr-6">
                      {shipment.co2_kg !== null && shipment.co2_kg !== undefined 
                        ? `${formatNumber(shipment.co2_kg, 2)} kg` 
                        : "Calculating..."}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-block p-2 -mr-2 text-slate-300 cursor-not-allowed" title="Detail page is under construction">
                        ›
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    No active shipments found. Add one to see carbon footprint details.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>
              Showing {rows.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(safePage * ITEMS_PER_PAGE, rows.length)} of {rows.length} entries
              <span className="ml-2 italic text-slate-400">— Per-route CO2 uses distance, load weight, and GLEC factors.</span>
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 py-0 bg-white" disabled={safePage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Prev</Button>
              <span className="px-2 font-medium">Page {safePage} of {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2 py-0 bg-white" disabled={safePage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
