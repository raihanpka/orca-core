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
import { demoRoute } from "@/lib/mock-data"
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
  const [result, setResult] = useState<RouteOptimizationResponse>(demoRoute)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const selectedGeometryPoints = useMemo<Point[]>(() => {
    const coordinates = result.pareto_solutions[0]?.route_geometry?.coordinates
    if (!coordinates?.length) return jakartaRoutePoints
    return coordinates.map((coordinates, index) => ({
      label: index === 0 ? "Origin" : `Stop ${index}`,
      coordinates,
      tone: index === 0 ? "default" : index === 1 ? "high" : index === 2 ? "medium" : "low",
    }))
  }, [result])
  const chartData = useMemo(
    () =>
      result.pareto_solutions.map((item) => ({
        label: item.label,
        eta: item.travel_time_min,
        co2: item.co2_kg,
        risk: item.sla_risk_score,
      })),
    [result]
  )

  async function submitRoute() {
    setIsSubmitting(true)
    try {
      const payload = {
        vehicle_id: "B-ORCA-21",
        vehicle_type: vehicleType,
        load_weight_kg: 24,
        origin_hub_id: "hub_jakarta_selatan",
        current_traffic_level: "normal",
        delivery_stops: [
          {
            shipment_id: "7f2a4ef2-5c5a-45a7-9e4a-58ad3a60b101",
            destination_lat: -6.2383,
            destination_lng: 106.9756,
            sla_deadline: new Date(Date.now() + 1000 * 60 * 180).toISOString(),
            weight_kg: 8,
          },
          {
            shipment_id: "77bb1147-f19f-4f44-8ca6-b7d53723b102",
            destination_lat: -6.4025,
            destination_lng: 106.7942,
            sla_deadline: new Date(Date.now() + 1000 * 60 * 220).toISOString(),
            weight_kg: 6,
          },
        ],
      }
      setResult(await apiFetch<RouteOptimizationResponse>("/optimize/route", {method: "POST", body: JSON.stringify(payload)}))
    } catch {
      setResult(demoRoute)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Route Optimizer</h1>
        <p className="text-sm text-muted-foreground">
          Compare ETA, CO2, fuel cost, and SLA risk with a map-first route planning view.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Stop Input</CardTitle>
            <CardDescription>MVP form uses seeded Jakarta stops while preserving the API contract.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Vehicle ID</Label>
              <Input defaultValue="B-ORCA-21" />
            </div>
            <div className="space-y-2">
              <Label>Vehicle Type</Label>
              <Select value={vehicleType} onValueChange={(val) => setVehicleType(val || "truck")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="motorcycle">Motorcycle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Stops</Label>
                <Input readOnly value="3" />
              </div>
              <div className="space-y-2">
                <Label>Load</Label>
                <Input readOnly value="24 kg" />
              </div>
            </div>
            <Button className="w-full" onClick={submitRoute} disabled={isSubmitting}>
              {isSubmitting ? "Optimizing" : "Optimize Route"}
            </Button>
          </CardContent>
        </Card>

        <RouteMap title="Route Geometry" points={selectedGeometryPoints} className="min-h-[420px]" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ETA vs CO2 Pareto Chart</CardTitle>
            <CardDescription>Lower left is usually the strongest tradeoff zone.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-80 w-full">
              <ScatterChart margin={{top: 10, right: 20, bottom: 20, left: 0}}>
                <CartesianGrid vertical={false} />
                <XAxis type="number" dataKey="eta" name="ETA" unit=" min" />
                <YAxis type="number" dataKey="co2" name="CO2" unit=" kg" />
                <ChartTooltip cursor={{strokeDasharray: "3 3"}} content={<ChartTooltipContent indicator="dot" />} />
                <Scatter data={chartData} fill="var(--color-eta)" />
              </ScatterChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Route Alternatives</CardTitle>
            <CardDescription>Each option includes ETA, CO2, cost, and SLA risk.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>CO2</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.pareto_solutions.map((item) => (
                  <TableRow key={item.index}>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell>{item.travel_time_min} min</TableCell>
                    <TableCell>{formatNumber(item.co2_kg, 1)} kg</TableCell>
                    <TableCell>Rp {formatNumber(item.fuel_cost_idr, 0)}</TableCell>
                    <TableCell>{formatNumber(item.sla_risk_score, 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
