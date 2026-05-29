"use client"

import useSWR from "swr"
import { CartesianGrid, Bar, BarChart, XAxis, YAxis, PieChart, Pie, Cell, Label } from "recharts"

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

function toTitleCase(str: string) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-sm border-slate-200 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Daily CO2 Trend</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center min-h-[300px]">
            <ChartContainer config={dailyChartConfig} className="h-[250px] w-full">
              <BarChart data={data.by_day}>
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
            <CardTitle className="text-lg">Vehicle Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center min-h-[300px]">
            {data.by_vehicle_type.length > 0 ? (
              <div className="flex items-center justify-center gap-8">
                <div className="w-32 h-32 flex-shrink-0 relative flex items-center justify-center">
                  <PieChart width={128} height={128}>
                    <Pie
                      data={data.by_vehicle_type}
                      dataKey="shipment_count"
                      nameKey="vehicle_type"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={60}
                      stroke="none"
                    >
                      {data.by_vehicle_type.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#475569', '#1e293b', '#94a3b8', '#cbd5e1'][index % 4]} />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                            return (
                              <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                <tspan x={viewBox.cx} y={viewBox.cy} className="fill-slate-900 text-lg font-bold">
                                  {formatNumber(data.by_vehicle_type.reduce((acc, curr) => acc + curr.shipment_count, 0), 0)}
                                </tspan>
                                <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 16} className="fill-slate-500 text-[10px] font-medium">
                                  Total
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
                  {data.by_vehicle_type.map((item, i) => {
                    const totalShipments = data.by_vehicle_type.reduce((acc, curr) => acc + curr.shipment_count, 0) || 1
                    const percent = Math.round((item.shipment_count / totalShipments) * 100)
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

      <Card className="shadow-sm border-slate-200">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="border-slate-200 text-xs tracking-wider">
              <TableHead className="font-semibold text-slate-500 uppercase pl-6">Vehicle Type</TableHead>
              <TableHead className="font-semibold text-slate-500 uppercase">Shipment Count</TableHead>
              <TableHead className="font-semibold text-slate-500 uppercase pr-6">Total CO2</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.by_vehicle_type.map((item) => (
              <TableRow key={item.vehicle_type} className="border-slate-200">
                <TableCell className="font-medium text-slate-900 pl-6">{toTitleCase(item.vehicle_type)}</TableCell>
                <TableCell>{formatNumber(item.shipment_count, 0)}</TableCell>
                <TableCell className="pr-6">{formatNumber(item.co2_kg, 1)} kg</TableCell>
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
  const {data: hubsResponse = {hubs: []}} = useSWR<{hubs: HubMetric[]}>("/analytics/hubs", apiFetch, {
    refreshInterval: 15000,
  })
  const hubs = hubsResponse?.hubs ?? [];
  const totalHubs = hubs.length;
  const highCongestion = hubs.filter(h => h.congestion_level === 'high').length;
  const avgDwell = hubs.length ? (hubs.reduce((acc, curr) => acc + curr.avg_dwell_time_min, 0) / hubs.length / 60).toFixed(1) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Metric title="Total Active Hubs" value={totalHubs.toString()} helper="" />
        <Metric title="High Congestion Hubs" value={highCongestion.toString()} helper="" />
        <Metric title="Network Avg Dwell Time" value={`${avgDwell} hrs`} helper="" />
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
              <TableHead className="font-semibold text-slate-500 uppercase">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hubs.map((hub) => (
                <TableRow key={hub.hub_id} className="border-slate-200">
                  <TableCell className="font-medium text-slate-600">{toTitleCase(hub.hub_id)}</TableCell>
                  <TableCell className="text-slate-900">{hub.hub_name}</TableCell>
                  <TableCell className="text-right">{hub.current_inbound_volume}</TableCell>
                  <TableCell className="text-right">{(hub.avg_dwell_time_min / 60).toFixed(1)} hrs</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${hub.congestion_level === 'high' ? 'bg-slate-200 border-slate-400 text-slate-700' : hub.congestion_level === 'medium' ? 'bg-slate-50 border-slate-300 text-slate-600' : 'bg-transparent border-dashed border-slate-300 text-slate-400'}`}>
                      {hub.congestion_level.toUpperCase()}
                    </span>
                  </TableCell>
                </TableRow>
            ))}
            {hubs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  No active hubs found.
                </TableCell>
              </TableRow>
            )}
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
