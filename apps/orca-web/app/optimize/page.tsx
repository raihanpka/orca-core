"use client"

import { useMemo, useState } from "react"
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from "recharts"

import { jakartaRoutePoints, type Point } from "@/lib/mock-data"
import dynamic from "next/dynamic"
const RouteMap = dynamic(() => import("@/components/maps/route-map").then(mod => mod.RouteMap), { ssr: false, loading: () => <div className="h-full min-h-[420px] w-full bg-muted animate-pulse rounded-lg" /> })
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiFetch, type RouteOptimizationResponse } from "@/lib/api"
import { formatNumber } from "@/lib/utils"

const chartConfig = {
  eta: {
    label: "ETA",
    color: "hsl(var(--chart-1))",
  },
  co2: {
    label: "CO2",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export default function OptimizePage() {
  const [vehicleType, setVehicleType] = useState("van")
  const [result, setResult] = useState<RouteOptimizationResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const selectedGeometryPoints = useMemo<Point[]>(() => {
    const coordinates = result?.pareto_solutions?.[0]?.route_geometry?.coordinates
    if (!coordinates?.length) return jakartaRoutePoints
    return coordinates.map((coordinates, index) => ({
      label: index === 0 ? "Origin" : `Stop ${index}`,
      coordinates,
      tone: index === 0 ? "default" : index === 1 ? "high" : index === 2 ? "medium" : "low",
    }))
  }, [result])
  const chartData = useMemo(
    () =>
      result?.pareto_solutions?.map((item) => ({
        label: item.label,
        eta: item.travel_time_min,
        co2: item.co2_kg,
        risk: item.sla_risk_score,
      })) ?? [],
    [result]
  )

  async function submitRoute() {
    setIsSubmitting(true)
    try {
      const payload = {
        vehicle_id: "B-ORCA-21",
        vehicle_type: vehicleType,
        load_weight_kg: 24,
        origin_hub_id: "hub_cakung",
        current_traffic_level: "normal",
        delivery_stops: [
          {
            shipment_id: "cikarang-001",
            destination_lat: -6.326,
            destination_lng: 107.143,
            sla_deadline: new Date(Date.now() + 1000 * 60 * 180).toISOString(),
            weight_kg: 8,
          },
          {
            shipment_id: "sunter-002",
            destination_lat: -6.143,
            destination_lng: 106.877,
            sla_deadline: new Date(Date.now() + 1000 * 60 * 220).toISOString(),
            weight_kg: 6,
          },
          {
            shipment_id: "bogor-003",
            destination_lat: -6.597,
            destination_lng: 106.793,
            sla_deadline: new Date(Date.now() + 1000 * 60 * 300).toISOString(),
            weight_kg: 10,
          },
        ],
      }
      setResult(await apiFetch<RouteOptimizationResponse>("/optimize/route", {method: "POST", body: JSON.stringify(payload)}))
    } catch {
      setResult(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const [optimizationGoal, setOptimizationGoal] = useState("lowest_cost")

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Route Optimizer</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure parameters to generate optimal global delivery routes.
          </p>
        </div>
        <Button onClick={submitRoute} disabled={isSubmitting} className="bg-[#005A8C] hover:bg-[#004870] shadow-sm">
          {isSubmitting ? "Optimizing..." : "Optimize Route"}
        </Button>
      </div>

      {/* Map at the top, full width */}
      <RouteMap 
        title="Optimized Route Preview" 
        points={selectedGeometryPoints} 
        className="h-[450px] w-full shadow-sm border-slate-200" 
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr] items-start">
        {/* Left Column: Route Configuration */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Route Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Timeline Input */}
            <div className="relative ml-2 space-y-6 before:absolute before:inset-0 before:ml-[7px] before:w-0.5 before:-translate-x-px before:bg-slate-200">
              <div className="relative flex items-start gap-4">
                <div className="h-4 w-4 mt-1 rounded-full bg-[#005A8C] border-[3px] border-white shadow-sm ring-1 ring-slate-200 z-10" />
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-slate-500">Origin</Label>
                  <Input defaultValue="DC Cakung" readOnly className="h-9 bg-slate-50/50" />
                </div>
              </div>
              <div className="relative flex items-center gap-4">
                <div className="h-4 w-4 rounded-full bg-white border-2 border-[#005A8C] flex items-center justify-center z-10">
                  <div className="h-1.5 w-1.5 bg-[#005A8C] rounded-full" />
                </div>
                <div className="flex-1">
                  <span className="text-sm text-[#005A8C] font-medium cursor-pointer hover:underline">⊕ Add Waypoint</span>
                </div>
              </div>
              <div className="relative flex items-start gap-4">
                <div className="h-4 w-4 mt-1 rounded-full bg-white border-2 border-slate-300 shadow-sm z-10" />
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-slate-500">Destination</Label>
                  <Input defaultValue="Multiple Stops (3)" readOnly className="h-9 bg-slate-50/50" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Vehicle Class</Label>
                <Select value={vehicleType} onValueChange={(val) => setVehicleType(val || "truck")}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="motorcycle">Motorcycle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Departure Date</Label>
                <Input defaultValue={new Date().toLocaleDateString('en-US')} readOnly className="h-9 bg-slate-50/50" />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tujuan Optimasi</Label>
              <div className="space-y-2">
                <Button 
                  onClick={() => setOptimizationGoal("fastest_eta")}
                  variant="outline" 
                  className={`w-full justify-start ${optimizationGoal === "fastest_eta" ? "font-medium border-[#005A8C] text-[#005A8C] bg-blue-50/30" : "font-normal text-slate-600 bg-white"}`}>
                  <div className={`h-3 w-3 rounded-full mr-3 ${optimizationGoal === "fastest_eta" ? "border-[3px] border-[#005A8C]" : "border border-slate-400"}`} /> ETA Tercepat
                </Button>
                <Button 
                  onClick={() => setOptimizationGoal("lowest_cost")}
                  variant="outline" 
                  className={`w-full justify-start ${optimizationGoal === "lowest_cost" ? "font-medium border-[#005A8C] text-[#005A8C] bg-blue-50/30" : "font-normal text-slate-600 bg-white"}`}>
                  <div className={`h-3 w-3 rounded-full mr-3 ${optimizationGoal === "lowest_cost" ? "border-[3px] border-[#005A8C]" : "border border-slate-400"}`} /> Biaya Terendah
                </Button>
                <Button 
                  onClick={() => setOptimizationGoal("lowest_co2")}
                  variant="outline" 
                  className={`w-full justify-start ${optimizationGoal === "lowest_co2" ? "font-medium border-[#005A8C] text-[#005A8C] bg-blue-50/30" : "font-normal text-slate-600 bg-white"}`}>
                  <div className={`h-3 w-3 rounded-full mr-3 ${optimizationGoal === "lowest_co2" ? "border-[3px] border-[#005A8C]" : "border border-slate-400"}`} /> CO2 Terendah
                </Button>
                <Button 
                  onClick={() => setOptimizationGoal("balanced")}
                  variant="outline" 
                  className={`w-full justify-start ${optimizationGoal === "balanced" ? "font-medium border-[#005A8C] text-[#005A8C] bg-blue-50/30" : "font-normal text-slate-600 bg-white"}`}>
                  <div className={`h-3 w-3 rounded-full mr-3 ${optimizationGoal === "balanced" ? "border-[3px] border-[#005A8C]" : "border border-slate-400"}`} /> Seimbang
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Charts and Tables */}
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Tradeoff Analysis (Pareto)</CardTitle>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#005A8C]" /> Recommended</span>
                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full border border-slate-400" /> Alternative</span>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <ScatterChart margin={{top: 20, right: 20, bottom: 20, left: 10}}>
                  <CartesianGrid vertical={false} stroke="#E2E8F0" />
                  <XAxis type="number" dataKey="eta" name="ETA" unit=" min" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis type="number" dataKey="co2" name="CO2" unit=" kg" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <ChartTooltip cursor={{strokeDasharray: "3 3"}} content={<ChartTooltipContent indicator="dot" />} />
                  <Scatter data={chartData} fill="#005A8C" />
                </ScatterChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Route Alternatives</CardTitle>
              <Button variant="ghost" size="sm" className="text-[#005A8C] h-8 font-medium">
                ↓ Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-slate-200">
                    <TableHead className="font-medium text-slate-500">Route Label</TableHead>
                    <TableHead className="font-medium text-slate-500">ETA</TableHead>
                    <TableHead className="font-medium text-slate-500">CO2</TableHead>
                    <TableHead className="font-medium text-slate-500">Cost</TableHead>
                    <TableHead className="font-medium text-slate-500">Risk</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result?.pareto_solutions?.map((item) => (
                    <TableRow key={item.index} className="border-slate-200">
                      <TableCell className="font-medium text-slate-900 flex items-center gap-2">
                        {item.index === 0 && <span className="text-[#005A8C]">★</span>}
                        {item.label}
                      </TableCell>
                      <TableCell className={item.index === 0 ? "font-semibold text-[#005A8C]" : ""}>{item.travel_time_min} min</TableCell>
                      <TableCell>{formatNumber(item.co2_kg, 1)} kg</TableCell>
                      <TableCell>Rp {formatNumber(item.fuel_cost_idr, 0)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${item.sla_risk_score > 50 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                          {item.sla_risk_score > 50 ? 'High' : 'Low'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="link" className="text-[#005A8C] h-auto p-0 font-medium">Details</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!result?.pareto_solutions?.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        Click "Optimize Route" to generate alternatives.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
