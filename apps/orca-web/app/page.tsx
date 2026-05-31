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
import { InfoIcon, Loader2Icon } from "lucide-react"

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
  const [currentPage, setCurrentPage] = useState(1)
  const [trendFilter, setTrendFilter] = useState(3)

  const dateFrom = new Date(Date.now() - trendFilter * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const {data = { by_day: [], by_vehicle_type: [], recent_routes: [], total_co2_kg: 0, avg_co2_per_shipment_kg: 0, vs_baseline_pct: 0, glec_version: "v3.0" }} = useSWR<CarbonAnalytics>(`/analytics/carbon?date_from=${dateFrom}`, apiFetch, {
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
        <Metric 
          title="Total CO2" 
          value={`${formatNumber(data.total_co2_kg, 1)} kg`} 
          helper={`GLEC ${data.glec_version}`} 
          filterNode={<TrendFilterGroup value={trendFilter} onChange={setTrendFilter} />}
        />
        <Metric 
          title="Average CO2 per Shipment" 
          value={`${formatNumber(data.avg_co2_per_shipment_kg, 1)} kg`} 
          helper="Estimated from distance, load, and vehicle emission factor based on GLEC framework." 
          filterNode={<TrendFilterGroup value={trendFilter} onChange={setTrendFilter} />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-sm border-slate-200 flex flex-col">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Daily CO2 Trend</CardTitle>
            <TrendFilterGroup value={trendFilter} onChange={setTrendFilter} />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center min-h-[300px]">
            {(() => {
              const filteredTrendData = data.by_day;
              const maxVal = Math.max(...filteredTrendData.map(d => d.co2_kg), 1);
              return (
                <ChartContainer config={dailyChartConfig} className="h-[250px] w-full">
                  <BarChart data={filteredTrendData}>
                    <CartesianGrid vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} stroke="#94A3B8" />
                    <YAxis fontSize={12} stroke="#94A3B8" tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <Bar dataKey="co2_kg" radius={[4, 4, 0, 0]}>
                      {filteredTrendData.map((entry, index) => {
                        const intensity = entry.co2_kg / maxVal;
                        const lightness = 85 - (intensity * 60);
                        return <Cell key={`cell-${index}`} fill={`hsl(215, 25%, ${lightness}%)`} />
                      })}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )
            })()}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 flex flex-col">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Vehicle Breakdown</CardTitle>
            <TrendFilterGroup value={trendFilter} onChange={setTrendFilter} />
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
                        <Cell key={`cell-${index}`} fill={['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][index % 5]} />
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
                              backgroundColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][i % 5]
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
                <TableCell className="pr-6">{formatNumber(item.co2_kg, 2)} kg</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-200 text-xs text-slate-500">
          Note: CO2 is estimated from distance, load, and vehicle emission factor based on{' '}
          <Dialog>
            <DialogTrigger className="text-blue-600 hover:underline cursor-pointer font-medium underline-offset-2">GLEC framework</DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>GLEC Framework Emission Factors</DialogTitle>
                <DialogDescription>Standardized emission factors utilized for route CO2 estimation calculations.</DialogDescription>
              </DialogHeader>
              <div className="rounded-md border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-600">Vehicle Type</TableHead>
                      <TableHead className="font-semibold text-slate-600">Factor (kg CO2e / t-km)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow><TableCell className="capitalize font-medium text-slate-700">Scooter Electric</TableCell><TableCell>0.000</TableCell></TableRow>
                    <TableRow><TableCell className="capitalize font-medium text-slate-700">Van Diesel</TableCell><TableCell>0.200</TableCell></TableRow>
                    <TableRow><TableCell className="capitalize font-medium text-slate-700">Truck &lt; 3.5t</TableCell><TableCell>0.150</TableCell></TableRow>
                    <TableRow><TableCell className="capitalize font-medium text-slate-700">Truck 3.5 - 7.5t</TableCell><TableCell>0.110</TableCell></TableRow>
                    <TableRow><TableCell className="capitalize font-medium text-slate-700">Truck &gt; 7.5t</TableCell><TableCell>0.080</TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>.
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
                <TableHead className="font-semibold text-slate-500 uppercase">Dist & Load</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Risk Level</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase pr-6">Total CO2</TableHead>
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
                      <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                        No recent routes available.
                      </TableCell>
                    </TableRow>
                  );
                }

                return paginatedRoutes.map((route) => {
                  const isHighRisk = (route.sla_risk_score ?? 0) > 70;
                  const destDisplay = isNaN(Number(route.destination)) 
                    ? toTitleCase(route.destination || "Unknown") 
                    : `Zone ${route.destination}`;

                  return (
                    <TableRow key={route.shipment_id} className="border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="pl-6">
                        <span className="font-medium text-slate-900">
                          {route.external_id ?? route.shipment_id.slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600 capitalize">{route.origin.replace(/^hub_/, '').replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-slate-600">{destDisplay}</TableCell>
                      <TableCell className="text-slate-600 capitalize">{toTitleCase(route.vehicle_type)}</TableCell>
                      <TableCell className="text-slate-600 text-xs">
                        <div>{route.distance_km ? `${formatNumber(route.distance_km, 1)} km` : '-'}</div>
                        <div className="text-slate-400">{route.load_weight_kg ? `${formatNumber(route.load_weight_kg, 1)} kg` : '-'}</div>
                      </TableCell>
                      <TableCell>
                        {route.sla_risk_score !== null && route.sla_risk_score !== undefined ? (
                          <span className={`px-2 py-0.5 rounded-sm text-xs font-medium border ${isHighRisk ? 'bg-slate-200 border-slate-400 text-slate-700' : 'bg-transparent border-dashed border-slate-300 text-slate-400'}`}>
                            {isHighRisk ? 'High' : 'Low'}
                          </span>
                        ) : (
                          <div className="flex items-center text-slate-800 text-sm gap-1.5"><Loader2Icon className="h-3 w-3 animate-spin" /> Scoring...</div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 pr-6">
                        {route.co2_kg ? `${formatNumber(route.co2_kg, 2)} kg` : '-'}
                      </TableCell>
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


function Metric({title, value, helper, filterNode}: {title: string; value: string; helper?: string, filterNode?: React.ReactNode}) {
  return (
    <Card className="shadow-sm border-slate-200 rounded-sm">
      <CardHeader className="pb-1 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
        <CardDescription className="text-xs font-bold text-slate-500 tracking-wider uppercase">{title}</CardDescription>
        {filterNode && <div>{filterNode}</div>}
      </CardHeader>
      <div className="px-5">
        <CardTitle className="text-3xl font-bold pt-2">{value}</CardTitle>
      </div>
      {helper && (
        <CardContent className="pb-4 px-5 pt-0 mt-4">
          <div className="text-sm text-slate-800">{helper}</div>
        </CardContent>
      )}
    </Card>
  )
}

function TrendFilterGroup({value, onChange}: {value: number, onChange: (v: number) => void}) {
  return (
    <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-md">
      <button onClick={() => onChange(3)} className={`px-2 py-1 text-xs font-medium rounded-sm transition-colors ${value === 3 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>3D</button>
      <button onClick={() => onChange(7)} className={`px-2 py-1 text-xs font-medium rounded-sm transition-colors ${value === 7 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>7D</button>
      <button onClick={() => onChange(30)} className={`px-2 py-1 text-xs font-medium rounded-sm transition-colors ${value === 30 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>1M</button>
    </div>
  )
}
