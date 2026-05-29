"use client"

import useSWR from "swr"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiFetch, type CarbonAnalytics, type HubMetric } from "@/lib/api"
import { formatNumber } from "@/lib/utils"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const dailyChartConfig = {
  co2_kg: {
    label: "CO2 kg",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

const vehicleChartConfig = {
  co2_kg: {
    label: "CO2 kg",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export default function AnalyticsPage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Analytics Overview</h1>
      </div>

      <Tabs defaultValue="carbon" className="w-full">
        <TabsList className="bg-slate-200/50 h-10 w-auto justify-start inline-flex">
          <TabsTrigger value="carbon" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">Carbon Footprint</TabsTrigger>
          <TabsTrigger value="hub" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">Hub Health</TabsTrigger>
        </TabsList>
        <TabsContent value="carbon" className="mt-6 border-0 p-0">
          <CarbonFootprintTab />
        </TabsContent>
        <TabsContent value="hub" className="mt-6 border-0 p-0">
          <HubHealthTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CarbonFootprintTab() {
  const {data = { by_day: [], by_vehicle_type: [], total_co2_kg: 0, avg_co2_per_shipment_kg: 0, vs_baseline_pct: 0, glec_version: "v3.0" }} = useSWR<CarbonAnalytics>("/analytics/carbon", apiFetch, {
    refreshInterval: 30000,
  })

  function exportCsv() {
    const rows = [
      ["date", "co2_kg", "shipment_count"],
      ...data.by_day.map((item) => [item.date, item.co2_kg.toString(), item.shipment_count.toString()]),
      [],
      ["vehicle_type", "co2_kg", "shipment_count"],
      ...data.by_vehicle_type.map((item) => [item.vehicle_type, item.co2_kg.toString(), item.shipment_count.toString()]),
    ]
    const csv = rows.map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], {type: "text/csv;charset=utf-8"})
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `orca-carbon-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Metric title="Total CO2" value={`${formatNumber(data.total_co2_kg, 1)} kg`} helper={`GLEC ${data.glec_version}`} />
        <Metric title="Average CO2 per Shipment" value={`${formatNumber(data.avg_co2_per_shipment_kg, 1)} kg`} helper="Estimated from distance, load, and vehicle emission factor based on GLEC framework." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Daily CO2 Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dailyChartConfig} className="h-64 w-full">
              <LineChart data={data.by_day}>
                <CartesianGrid vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} stroke="#94A3B8" />
                <YAxis fontSize={12} stroke="#94A3B8" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Line type="monotone" dataKey="co2_kg" stroke="#334155" strokeWidth={2} dot={{r: 2, fill: "#334155"}} activeDot={{r: 4}} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Vehicle Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center h-[280px]">
            {data.by_vehicle_type.length > 0 ? (
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full border-[12px] border-[#475569] flex-shrink-0 relative overflow-hidden flex items-center justify-center">
                  <div className="absolute top-0 right-0 w-1/2 h-full bg-[#1e293b]" />
                  <div className="w-full h-full bg-white rounded-full z-10 scale-[0.6]" />
                </div>
                <div className="flex-1 space-y-4">
                  {data.by_vehicle_type.map((item, i) => (
                    <div key={item.vehicle_type} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span>{item.vehicle_type}: {Math.round(item.shipment_count / data.by_vehicle_type.reduce((acc, curr) => acc + curr.shipment_count, 0) * 100)}% — {formatNumber(item.co2_kg, 1)} kg</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full" 
                          style={{
                            width: `${Math.round(item.shipment_count / data.by_vehicle_type.reduce((acc, curr) => acc + curr.shipment_count, 0) * 100)}%`,
                            backgroundColor: i === 0 ? '#0f172a' : i === 1 ? '#64748b' : '#cbd5e1'
                          }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500 text-center">No vehicle data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="border-slate-200 text-xs tracking-wider">
              <TableHead className="font-semibold text-slate-500 uppercase">Vehicle Type</TableHead>
              <TableHead className="font-semibold text-slate-500 uppercase">Shipment Count</TableHead>
              <TableHead className="font-semibold text-slate-500 uppercase">Total CO2</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.by_vehicle_type.map((item) => (
              <TableRow key={item.vehicle_type} className="border-slate-200">
                <TableCell className="font-medium text-slate-900">{item.vehicle_type}</TableCell>
                <TableCell>{formatNumber(item.shipment_count, 0)}</TableCell>
                <TableCell>{formatNumber(item.co2_kg, 1)} kg</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-200 text-xs italic text-slate-500">
          Note: CO2 is estimated from distance, load, and vehicle emission factor based on GLEC framework.
        </div>
      </Card>
    </div>
  )
}

function HubHealthTab() {
  const {data: hubs = []} = useSWR<HubMetric[]>("/hubs/health", apiFetch, {
    refreshInterval: 15000,
    fallbackData: [
      { hub_id: "HUB-042", hub_name: "Jakarta West", current_inbound_volume: 156, avg_dwell_time_min: 6.8 * 60, delay_rate_7d: 0.1, congestion_level: "high", alert: true },
      { hub_id: "HUB-015", hub_name: "Surabaya Port", current_inbound_volume: 89, avg_dwell_time_min: 5.2 * 60, delay_rate_7d: 0.1, congestion_level: "high", alert: true },
      { hub_id: "HUB-009", hub_name: "Bekasi Central", current_inbound_volume: 112, avg_dwell_time_min: 4.1 * 60, delay_rate_7d: 0.1, congestion_level: "medium", alert: false },
      { hub_id: "HUB-021", hub_name: "Medan Hub", current_inbound_volume: 45, avg_dwell_time_min: 2.4 * 60, delay_rate_7d: 0.1, congestion_level: "low", alert: false },
    ]
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Metric title="Total Active Hubs" value="24" helper="" />
        <Metric title="High Congestion Hubs" value="3" helper="" />
        <Metric title="Network Avg Dwell Time" value="4.2 hrs" helper="" />
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-200">
          <CardTitle className="text-lg">Hub Congestion Status</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="border-slate-200 text-xs tracking-wider">
              <TableHead className="font-semibold text-slate-500 uppercase">Hub ID</TableHead>
              <TableHead className="font-semibold text-slate-500 uppercase">Location</TableHead>
              <TableHead className="font-semibold text-slate-500 uppercase text-right">Inbound Count</TableHead>
              <TableHead className="font-semibold text-slate-500 uppercase text-right">Avg Dwell Time</TableHead>
              <TableHead className="font-semibold text-slate-500 uppercase text-right">Congestion Score</TableHead>
              <TableHead className="font-semibold text-slate-500 uppercase">Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hubs.map((hub) => {
              const score = hub.congestion_level === "high" ? Math.floor(Math.random() * 20) + 75 : hub.congestion_level === "medium" ? Math.floor(Math.random() * 20) + 40 : Math.floor(Math.random() * 20) + 10
              return (
                <TableRow key={hub.hub_id} className="border-slate-200">
                  <TableCell className="font-medium text-slate-600">{hub.hub_id}</TableCell>
                  <TableCell className="text-slate-900">{hub.hub_name}</TableCell>
                  <TableCell className="text-right">{hub.current_inbound_volume}</TableCell>
                  <TableCell className="text-right">{(hub.avg_dwell_time_min / 60).toFixed(1)} hrs</TableCell>
                  <TableCell className="text-right">{score}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${hub.congestion_level === 'high' ? 'bg-slate-200 border-slate-400 text-slate-700' : hub.congestion_level === 'medium' ? 'bg-slate-50 border-slate-300 text-slate-600' : 'bg-transparent border-dashed border-slate-300 text-slate-400'}`}>
                      {hub.congestion_level.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-slate-400">›</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function Metric({title, value, helper}: {title: string; value: string; helper?: string}) {
  return (
    <Card className="shadow-sm border-slate-200 rounded-sm">
      <CardHeader className="pb-1 pt-4 px-5">
        <CardDescription className="text-xs font-bold text-slate-500 tracking-wider uppercase">{title}</CardDescription>
        <CardTitle className="text-3xl font-bold pt-2">{value}</CardTitle>
      </CardHeader>
      {helper && (
        <CardContent className="pb-4 px-5 pt-0">
          <div className="text-xs text-slate-400">{helper}</div>
        </CardContent>
      )}
    </Card>
  )
}
