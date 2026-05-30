"use client"

import { useState } from "react"
import Link from "next/link"
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { InfoIcon } from "lucide-react"

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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Carbon Footprint Dashboard</h1>
        <p className="text-slate-500">Real-time GLEC-compliant emissions tracking & per-route analytics.</p>
      </div>

      <div className="mt-2">
        <CarbonFootprintTab />
      </div>
    </div>
  )
}

function CarbonFootprintTab() {
  const {data = { by_day: [], by_vehicle_type: [], recent_routes: [], total_co2_kg: 0, avg_co2_per_shipment_kg: 0, vs_baseline_pct: 0, glec_version: "v3.0" }} = useSWR<CarbonAnalytics>("/analytics/carbon", apiFetch, {
    refreshInterval: 30000,
  })

  const [currentPage, setCurrentPage] = useState(1)

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
                <div className="w-40 h-40 flex-shrink-0 relative flex items-center justify-center -ml-2">
                  <PieChart width={160} height={160}>
                    <Pie
                      data={data.by_vehicle_type}
                      dataKey="shipment_count"
                      nameKey="vehicle_type"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
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
                                <tspan x={viewBox.cx} y={viewBox.cy} className="fill-slate-900 text-2xl font-bold">
                                  {formatNumber(data.by_vehicle_type.reduce((acc, curr) => acc + curr.shipment_count, 0), 0)}
                                </tspan>
                                <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 18} className="fill-slate-500 text-xs font-medium">
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
                        <div className="flex justify-between text-sm font-medium text-slate-700">
                          <span className="capitalize">{toTitleCase(item.vehicle_type)}: {percent}% — {formatNumber(item.co2_kg, 3)} kg</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
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
              <div className="text-base text-slate-900 text-center">No vehicle data available</div>
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
                <TableCell className="pr-6">{formatNumber(item.co2_kg, 3)} kg</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-200 text-xs italic text-slate-500">
          Note: CO2 is estimated from distance, load, and vehicle emission factor based on GLEC framework.
        </div>
      </Card>

      {/* Per-Route Analytics Table with Explainability */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Per-Route Analytics</h2>
        <Card className="shadow-sm border-slate-200 p-0 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-200 text-xs tracking-wider">
                <TableHead className="font-semibold text-slate-500 uppercase pl-6">Shipment ID</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Origin</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Destination</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Vehicle</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Distance</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Carbon (CO2)</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase text-center w-[100px]">Explain</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const routes = data.recent_routes || [];
                const ITEMS_PER_PAGE = 10;
                const totalPages = Math.max(1, Math.ceil(routes.length / ITEMS_PER_PAGE));
                const safePage = Math.min(currentPage, totalPages);
                const paginatedRoutes = routes.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

                if (paginatedRoutes.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                        No recent routes available.
                      </TableCell>
                    </TableRow>
                  );
                }

                return paginatedRoutes.map((route) => {
                  const emissionFactor = route.co2_kg / (route.distance_km * (route.load_weight_kg / 1000) || 1)
                  return (
                    <TableRow key={route.shipment_id} className="border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium text-slate-900 pl-6">{route.external_id || route.shipment_id.slice(0,8)}</TableCell>
                      <TableCell className="text-slate-600 capitalize">{route.origin.replace(/^hub_/, '').replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-slate-600">{route.destination}</TableCell>
                      <TableCell className="text-slate-600 capitalize">{toTitleCase(route.vehicle_type)}</TableCell>
                      <TableCell className="text-slate-600">{formatNumber(route.distance_km, 1)} km</TableCell>
                      <TableCell className="font-semibold text-slate-900">{formatNumber(route.co2_kg, 3)} kg</TableCell>
                      <TableCell className="text-center">
                        <Link
                          href={`/shipments/${route.shipment_id}`}
                          className="h-8 px-3 mx-auto text-sm inline-flex items-center justify-center rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        >
                          <InfoIcon className="h-4 w-4 mr-1" /> Detail
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                });
              })()}
            </TableBody>
          </Table>
          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-200 text-sm text-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>
              {(() => {
                const routes = data.recent_routes || [];
                const ITEMS_PER_PAGE = 10;
                const totalPages = Math.max(1, Math.ceil(routes.length / ITEMS_PER_PAGE));
                const safePage = Math.min(currentPage, totalPages);
                return `Showing ${routes.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1} to ${Math.min(safePage * ITEMS_PER_PAGE, routes.length)} of ${routes.length} entries`;
              })()}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 py-0 bg-white" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Prev</Button>
              <span className="px-2 font-medium">
                {(() => {
                  const routes = data.recent_routes || [];
                  const ITEMS_PER_PAGE = 10;
                  const totalPages = Math.max(1, Math.ceil(routes.length / ITEMS_PER_PAGE));
                  const safePage = Math.min(currentPage, totalPages);
                  return `Page ${safePage} of ${totalPages}`;
                })()}
              </span>
              <Button variant="outline" size="sm" className="h-7 px-2 py-0 bg-white" disabled={currentPage >= Math.ceil((data.recent_routes?.length || 0) / 10)} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </Card>
      </div>
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
          <div className="text-sm text-slate-800">{helper}</div>
        </CardContent>
      )}
    </Card>
  )
}
