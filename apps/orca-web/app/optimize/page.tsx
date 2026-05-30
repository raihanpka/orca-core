"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, Cell } from "recharts"
import useSWR from "swr"

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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2Icon } from "lucide-react"
import { apiFetch, type RouteOptimizationResponse } from "@/lib/api"
import { formatNumber } from "@/lib/utils"

function toTitleCase(str: string) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

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
  const { data: vehicleResponse } = useSWR<{vehicles: string[]}>("/optimize/vehicles", apiFetch)
  const { data: hubsResponse } = useSWR<{hubs: Array<{id: string, name: string, lat: number, lng: number}>}>("/hubs/", apiFetch)
  const { data: shipmentsData } = useSWR<{ shipments: any[] }>("/shipments/active?limit=50", apiFetch)

  const availableVehicles = vehicleResponse?.vehicles ?? ["van_diesel", "truck_lt35t", "truck_gt75t", "scooter_electric"];
  const availableHubs = hubsResponse?.hubs ?? [
    { id: "hub_cakung", name: "Hub Cakung (East Jakarta)", lat: -6.1824, lng: 106.9213 },
    { id: "hub_kebon_jeruk", name: "Hub Kebon Jeruk (West Jakarta)", lat: -6.1950, lng: 106.7645 },
    { id: "hub_pasar_minggu", name: "Hub Pasar Minggu (South Jakarta)", lat: -6.2844, lng: 106.8441 },
  ];

  const [vehicleType, setVehicleType] = useState("van_diesel")
  const [routingEngine, setRoutingEngine] = useState("stadia")
  const [originHubId, setOriginHubId] = useState("hub_pasar_minggu")
  const [focusPoint, setFocusPoint] = useState<[number, number] | null>(null)
  const [waypoints, setWaypoints] = useState<Array<{id: string, lat: number, lng: number, weight: number}>>([])
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>("")
  
  const atRiskShipments = useMemo(() => {
    return (shipmentsData?.shipments || []).filter(s => s.sla_risk_score >= 70)
  }, [shipmentsData])

  const [result, setResult] = useState<RouteOptimizationResponse | null>(null)
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [optimizationGoal, setOptimizationGoal] = useState("lowest_cost")
  const [error, setError] = useState<string | null>(null)

  const handleAddWaypoint = () => {
    setWaypoints([...waypoints, {
      id: crypto.randomUUID(),
      lat: -6.200, lng: 106.816, weight: 5
    }])
  }

  const handleUpdateWaypoint = (id: string, field: "lat"|"lng"|"weight"|"hub", value: number|string) => {
    setResult(null) // Clear old route when editing points
    setWaypoints(waypoints.map(w => {
      if (w.id === id) {
        if (field === "hub") {
           const hub = availableHubs.find(h => h.id === value);
           if (hub) {
             setFocusPoint([hub.lng, hub.lat])
             return { ...w, lat: hub.lat, lng: hub.lng };
           }
        }
        return { ...w, [field]: value }
      }
      return w
    }))
  }

  const handleRemoveWaypoint = (id: string) => {
    setWaypoints(waypoints.filter(w => w.id !== id))
  }
  
  const selectedGeometryPoints = useMemo<Point[]>(() => {
    const origin = availableHubs.find(h => h.id === originHubId);
    const points: Point[] = [];
    if (origin) {
      points.push({ label: `Origin (${origin.name})`, coordinates: [origin.lng, origin.lat], tone: "default" })
    }
    waypoints.forEach((wp, i) => {
      points.push({ label: `Stop ${i+1}`, coordinates: [wp.lng, wp.lat], tone: i === 0 ? "high" : i === 1 ? "medium" : "low" })
    })
    return points
  }, [originHubId, waypoints])

  const routeLine = useMemo(() => {
    return result?.pareto_solutions?.[selectedRouteIndex]?.route_geometry?.coordinates
  }, [result, selectedRouteIndex])
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

  const submitRoute = async () => {
    setIsSubmitting(true)
    setError(null)
    
    try {
      const vehicleId = `B-ORCA-${Math.floor(10 + Math.random() * 90)}`
      const payload = {
        vehicle_id: vehicleId,
        vehicle_type: vehicleType,
        load_weight_kg: waypoints.reduce((sum, w) => sum + w.weight, 0),
        origin_hub_id: originHubId,
        current_traffic_level: "normal",
        delivery_stops: waypoints.map((wp, i) => ({
          shipment_id: wp.id,
          destination_lat: wp.lat,
          destination_lng: wp.lng,
          sla_deadline: new Date(Date.now() + 1000 * 60 * (180 + i * 40)).toISOString(),
          weight_kg: wp.weight,
        })),
        routing_engine: routingEngine,
      }
      setResult(await apiFetch<RouteOptimizationResponse>("/optimize/route", {method: "POST", body: JSON.stringify(payload)}))
      setSelectedRouteIndex(0)
      setFocusPoint(null)
    } catch (err) {
      setResult(null)
      const msg = err instanceof Error ? err.message : "Unknown error"
      setError(msg.includes("aborted") || msg.includes("abort") ? "Request timed out (>120s). Pastikan backend berjalan." : `Gagal: ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }



  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Route Optimizer</h1>
          <p className="text-base text-slate-900 mt-1">
            Configure parameters to generate optimal global delivery routes.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Top: Full Width Map */}
        <Card className="w-full shadow-sm border-slate-200 flex flex-col h-[600px] overflow-hidden rounded-xl p-0 !py-0">
          <CardContent className="p-0 !p-0 flex-1 relative h-full">
            <RouteMap 
              points={selectedGeometryPoints} 
              routeLine={routeLine}
              className="absolute inset-0 w-full h-full border-0 rounded-xl" 
            />
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-12 items-stretch h-full">
          {/* Bottom Left Column: Route Configuration */}
          <Card className="col-span-1 xl:col-span-4 shadow-sm border-slate-200 h-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Route Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {atRiskShipments.length > 0 && (
              <div className="flex flex-col gap-1.5 p-3 bg-red-50/50 border border-red-100 rounded-md">
                <Label className="text-xs font-semibold text-red-900">Load At-Risk Shipment</Label>
                <Select value={selectedShipmentId} onValueChange={(val: string | null) => {
                  setSelectedShipmentId(val || "")
                  const shipment = atRiskShipments.find(s => s.id === val)
                  if (shipment) {
                    setOriginHubId(shipment.origin_hub_id)
                    setVehicleType(shipment.vehicle_type)
                    setWaypoints([{
                      id: crypto.randomUUID(),
                      lat: -6.200, // Dummy fallback, ideally geocoded
                      lng: 106.816,
                      weight: shipment.load_weight_kg || 10
                    }])
                    setResult(null)
                  }
                }}>
                  <SelectTrigger className="h-9 text-sm bg-white border-red-200">
                    <SelectValue placeholder="Select At-Risk Shipment to optimize..." />
                  </SelectTrigger>
                  <SelectContent>
                    {atRiskShipments.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.external_id ?? s.id.slice(0, 8)} - Risk: {s.sla_risk_score.toFixed(0)}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Timeline Input */}
            <div className="relative ml-2 space-y-6 before:absolute before:inset-0 before:ml-[7px] before:w-0.5 before:-translate-x-px before:bg-slate-200">
              <div className="relative flex items-start gap-4">
                <div className="h-4 w-4 mt-2.5 rounded-full bg-[#005A8C] border-[3px] border-white shadow-sm ring-1 ring-slate-200 z-10" />
                <div className="flex-1 space-y-1">
                  <Label className="text-sm text-slate-900">Origin</Label>
                  <Select value={originHubId} onValueChange={(val) => {
                    setResult(null)
                    setOriginHubId(val || "hub_jakarta_selatan")
                    const hub = availableHubs.find(h => h.id === val)
                    if (hub) setFocusPoint([hub.lng, hub.lat])
                  }}>
                  <SelectTrigger className="text-sm h-10 bg-white">
                    <SelectValue placeholder="Select Origin">
                      {toTitleCase(availableHubs.find((h) => h.id === originHubId)?.name.replace(/^Hub /i, '') || originHubId.replace(/^hub_/, ''))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableHubs.map((h) => (
                      <SelectItem key={h.id} value={h.id}>{toTitleCase(h.name.replace(/^Hub /i, ''))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>
              </div>
              
              {waypoints.map((wp, index) => {
                const matchedHub = availableHubs.find(h => Math.abs(h.lat - wp.lat) < 0.0001 && Math.abs(h.lng - wp.lng) < 0.0001);
                return (
                <div key={wp.id} className="relative flex items-start gap-4">
                  <div className="h-4 w-4 mt-2.5 rounded-full bg-white border-2 border-slate-300 shadow-sm z-10" />
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-semibold text-slate-800">
                        Stop {index + 1} {matchedHub ? <span className="font-medium text-slate-500 ml-1">{toTitleCase(matchedHub.name.replace(/^Hub /i, ''))}</span> : null}
                      </Label>
                      {waypoints.length > 1 && (
                        <button onClick={() => handleRemoveWaypoint(wp.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 w-full mt-2">
                      <Select value={matchedHub?.id || ""} onValueChange={(val: string | null) => {
                        if (!val) return
                        handleUpdateWaypoint(wp.id, "hub", val)
                        const hub = availableHubs.find(h => h.id === val)
                        if (hub) setFocusPoint([hub.lng, hub.lat])
                      }}>
                        <SelectTrigger className="h-10 text-sm bg-white w-full">
                          <SelectValue placeholder="Quick Pick Hub...">
                            {matchedHub ? toTitleCase(matchedHub.name.replace(/^Hub /i, '')) : "Quick Pick Hub..."}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="w-[--radix-select-trigger-width]">
                          {availableHubs.map(h => <SelectItem key={h.id} value={h.id}>{toTitleCase(h.name.replace(/^Hub /i, ''))}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="grid grid-cols-[1fr_1fr_5rem] sm:grid-cols-[1fr_1fr_7rem] gap-2">
                        <Input type="number" step="0.001" value={wp.lat} onChange={e => {
                          const v = parseFloat(e.target.value) || 0
                          handleUpdateWaypoint(wp.id, 'lat', v)
                          setFocusPoint([wp.lng, v])
                        }} className="h-8 bg-white text-xs w-full px-2" placeholder="Lat" />
                        <Input type="number" step="0.001" value={wp.lng} onChange={e => {
                          const v = parseFloat(e.target.value) || 0
                          handleUpdateWaypoint(wp.id, 'lng', v)
                          setFocusPoint([v, wp.lat])
                        }} className="h-8 bg-white text-xs w-full px-2" placeholder="Lng" />
                        <div className="relative w-full">
                          <Input 
                            type="number" 
                            value={wp.weight === 0 ? "" : wp.weight} 
                            onChange={e => {
                              const val = e.target.value;
                              // Allow empty string to show placeholder, otherwise parse
                              handleUpdateWaypoint(wp.id, 'weight', val === "" ? 0 : parseFloat(val))
                            }} 
                            onFocus={e => e.target.select()}
                            className="h-8 bg-white text-xs text-left pr-6 w-full" 
                            placeholder="0" 
                          />
                          <span className="absolute right-2 top-2 text-[10px] text-slate-400 pointer-events-none">kg</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )})}

              <div className="relative flex items-center gap-4">
                <div className="h-4 w-4 rounded-full bg-white border-2 border-[#005A8C] flex items-center justify-center z-10">
                  <div className="h-1.5 w-1.5 bg-[#005A8C] rounded-full" />
                </div>
                <div className="flex-1">
                  <span onClick={handleAddWaypoint} className="text-sm text-[#005A8C] font-medium cursor-pointer hover:underline">⊕ Add Waypoint</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-3">
                  <Label>Vehicle Type</Label>
                  <Select value={vehicleType} onValueChange={(val) => setVehicleType(val || "van_diesel")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Vehicle">
                        {toTitleCase(vehicleType)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {availableVehicles.map(v => (
                        <SelectItem key={v} value={v}>{toTitleCase(v)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>
              <div className="space-y-3">
                  <Label>Routing Engine</Label>
                  <Select value={routingEngine} onValueChange={(val) => setRoutingEngine(val || "osmnx")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Engine">
                        {routingEngine === "stadia" ? "Stadia Maps API" : "Local (OSMnx)"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="osmnx">Local (OSMnx)</SelectItem>
                      <SelectItem value="stadia">Stadia Maps API</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
            </div>
            
            <div className="pt-6 border-t border-slate-200">
              <Button onClick={() => submitRoute()} disabled={isSubmitting} className="w-full bg-[#005A8C] hover:bg-[#004870] shadow-sm flex items-center justify-center gap-2 py-6 text-base font-semibold">
                {isSubmitting && (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {isSubmitting ? "Generating Optimal Routes..." : "Optimize Route"}
              </Button>
              {error && <p className="text-xs text-red-500 mt-2 text-center">{error}</p>}
            </div>

          </CardContent>
        </Card>

        {/* Bottom Right side: Route Alternatives */}
        <div className="col-span-1 xl:col-span-8 flex flex-col gap-6 h-full"> 
          {/* Top Card: Tradeoff Analysis */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-lg">Tradeoff Analysis (Pareto)</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {result ? (
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="co2" name="CO2 Emissions (kg)" tickLine={false} axisLine={false} tickMargin={10} tick={{fill: '#64748b', fontSize: 12}} domain={['auto', 'auto']} label={{ value: 'CO2 Emissions (kg)', position: 'insideBottom', offset: -15, fill: '#64748b', fontSize: 12 }} />
                    <YAxis type="number" dataKey="eta" name="ETA (mins)" tickLine={false} axisLine={false} tickMargin={10} tick={{fill: '#64748b', fontSize: 12}} domain={['auto', 'auto']} label={{ value: 'ETA (mins)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }} />
                    <ChartTooltip cursor={{ strokeDasharray: '3 3' }} content={<ChartTooltipContent indicator="line" labelFormatter={(label, payload) => payload?.[0]?.payload?.label} />} />
                    <Scatter data={chartData} fill="#005A8C" line={{ stroke: '#94a3b8', strokeWidth: 1 }}>
                      {chartData.map((entry, index) => {
                        const isFastest = entry.label === "fastest";
                        const isLowest = entry.label === "lowest_emission";
                        const color = isFastest ? "#d97706" : isLowest ? "#059669" : "#005A8C";
                        return <Cell key={`cell-${index}`} fill={color} r={isFastest || isLowest ? 14 : 10} stroke="white" strokeWidth={2} />
                      })}
                    </Scatter>
                  </ScatterChart>
                </ChartContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-slate-800 text-base">Run optimization to view tradeoffs.</div>
              )}
            </CardContent>
          </Card>

          {/* Bottom Card: Route Alternatives */}
          <Card className="shadow-sm border-slate-200 flex-1">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Route Alternatives</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {result ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow className="border-b border-slate-100">
                        <TableHead className="w-[200px] text-xs font-semibold text-slate-500 uppercase tracking-wider pl-6">Route Label</TableHead>
                        <TableHead className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">ETA (Mins)</TableHead>
                        <TableHead className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Distance (km)</TableHead>
                        <TableHead className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Est. Cost</TableHead>
                        <TableHead className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Est. CO2 (kg)</TableHead>
                        <TableHead className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">SLA Risk</TableHead>
                        <TableHead className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider pr-6"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.pareto_solutions.map((sol, index) => {
                        const isFastest = sol.label === "fastest";
                        const isLowest = sol.label === "lowest_emission";
                        
                        return (
                          <TableRow 
                            key={index} 
                            className={`hover:bg-slate-50/50 cursor-pointer ${selectedRouteIndex === index ? 'bg-blue-50/40 border-l-2 border-l-[#005A8C]' : ''}`}
                            onClick={() => setSelectedRouteIndex(index)}
                          >
                            <TableCell className="pl-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                                  {isFastest || isLowest ? <span className="text-[#005A8C]">★</span> : null}
                                  Option {String.fromCharCode(65 + index)}
                                </span>
                                <span className="text-sm text-slate-900 font-medium">
                                  ({isFastest ? "Fastest" : isLowest ? "Lowest Emission" : "Balanced"})
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm font-medium text-slate-700">{sol.travel_time_min}</TableCell>
                            <TableCell className="text-center text-sm font-medium text-slate-700">{(sol.travel_time_min * 35 / 60 / 1.25).toFixed(1)}</TableCell>
                            <TableCell className="text-center text-sm font-medium text-slate-700">Rp {formatNumber(sol.fuel_cost_idr, 0)}</TableCell>
                            <TableCell className="text-center text-sm font-medium text-slate-700">{sol.co2_kg.toFixed(1)}</TableCell>
                            <TableCell className="text-center">
                              <span className={`inline-flex items-center justify-center px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider ${sol.sla_risk_score >= 70 ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-[#e2e8f0] text-[#475569]'}`}>
                                {sol.sla_risk_score >= 70 ? 'High' : 'Low'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                              <Dialog>
                                <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 shadow-sm h-8 rounded-md px-3 bg-white hover:bg-slate-100 text-slate-700">
                                    Explain
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>AI Calculation Details</DialogTitle>
                                    <DialogDescription>
                                      How this route option was evaluated by the Multi-Objective Optimizer (NSGA-II).
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="flex flex-col gap-1 text-sm border-b border-slate-100 pb-3">
                                      <span className="font-semibold text-slate-900">1. Route Permutation</span>
                                      <span className="text-slate-600">The Traveling Salesperson sequence was brute-forced/mutated. This option covers {sol.stops_order?.length ?? waypoints.length} stops traversing {(sol.travel_time_min * 35 / 60 / 1.25).toFixed(1)} km.</span>
                                    </div>
                                    <div className="flex flex-col gap-1 text-sm border-b border-slate-100 pb-3">
                                      <span className="font-semibold text-slate-900">2. ETA & Delay Risk (AI)</span>
                                      <span className="text-slate-600">LightGBM predicted the delivery delay taking traffic multiplier and hub dwell times into account. Resulting SLA Risk: {sol.sla_risk_score}%.</span>
                                    </div>
                                    <div className="flex flex-col gap-1 text-sm pb-3">
                                      <span className="font-semibold text-slate-900">3. Carbon Emissions (GLEC)</span>
                                      <span className="text-slate-600">Formula: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">Distance × (1.0 + Load(Ton)) × Emission_Factor</code>. Resulting in {sol.co2_kg.toFixed(2)} kg.</span>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="min-h-[200px] flex items-center justify-center p-8 text-center">
                  <div className="max-w-[280px]">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-slate-400 text-xl">⚡</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">No Routes Generated</h3>
                    <p className="text-sm text-slate-900">Run optimization to see Pareto front route alternatives.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>
  )
}
