"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { AlertTriangleIcon, XIcon, SearchIcon, Loader2Icon, InfoIcon, ArrowUpDownIcon } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiFetch, type ActiveShipmentsResponse, type RecentAlert } from "@/lib/api"
import { formatNumber } from "@/lib/utils"

function toTitleCase(str: string) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

type HubMetric = {
  hub_id: string;
  hub_name: string;
  congestion_level: string;
  avg_dwell_time_min: number;
  current_inbound_volume: number;
}

export default function OperationsPage() {
  const pollInterval = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? 15000)
  
  const { data: shipmentsData } = useSWR<ActiveShipmentsResponse>("/shipments/active", apiFetch, {
    refreshInterval: pollInterval,
    fallbackData: { shipments: [], total_at_risk: 0 },
  })
  
  const { data: alertsData } = useSWR<{ alerts: RecentAlert[] }>("/alerts/recent", apiFetch, {
    refreshInterval: pollInterval,
    fallbackData: { alerts: [] },
  })

  const [dismissedAlertId, setDismissedAlertId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const rows = shipmentsData?.shipments ?? []
  
  const filteredRows = rows.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const idMatch = (r.external_id || r.id).toLowerCase().includes(q);
    const destMatch = (r.destination_zone || "").toLowerCase().includes(q);
    return idMatch || destMatch;
  });

  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")
  
  const sortedRows = [...filteredRows].sort((a, b) => {
    const timeA = new Date(a.dispatched_at || 0).getTime()
    const timeB = new Date(b.dispatched_at || 0).getTime()
    return sortOrder === "desc" ? timeB - timeA : timeA - timeB
  });

  const latestAlert = alertsData?.alerts?.[0]
  const showAlert = latestAlert && latestAlert.id !== dismissedAlertId

  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = sortedRows.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Operations</h1>
        <p className="text-sm text-slate-500">Manage active shipments, routing, and hub congestion.</p>
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

      <Tabs defaultValue="shipments" className="space-y-6 mt-2">
        <TabsList className="bg-slate-200/50">
          <TabsTrigger value="shipments">Active Shipments</TabsTrigger>
          <TabsTrigger value="hubs">Hub Health & Congestion</TabsTrigger>
        </TabsList>
        
        <TabsContent value="shipments" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Per-Route Analytics</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 bg-white" onClick={() => setSortOrder(o => o === "desc" ? "asc" : "desc")}>
                <ArrowUpDownIcon className="h-4 w-4 mr-2" />
                Sort by Time ({sortOrder === "desc" ? "Newest" : "Oldest"})
              </Button>
              <div className="relative w-[280px]">
                <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search Destination or ID..." 
                  className="pl-9 h-9 bg-white" 
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          </div>

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
                {paginatedRows.map((shipment) => {
                  const isHighRisk = (shipment.sla_risk_score ?? 0) > 70;
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
                      <TableCell className="text-slate-600 capitalize">{shipment.origin_hub_id.replace(/^hub_/, '').replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-slate-600">{destDisplay}</TableCell>
                      <TableCell className="text-slate-600 capitalize">{toTitleCase(shipment.vehicle_type)}</TableCell>
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
                      <TableCell className="font-semibold text-slate-900 pr-6">
                        {shipment.co2_kg ? `${formatNumber(shipment.co2_kg, 2)} kg` : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Link
                          href={`/shipments/${shipment.id}`}
                          className="h-8 px-3 mx-auto text-sm inline-flex items-center justify-center rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        >
                          Explain
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      No active shipments found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span>
                Showing {filteredRows.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(safePage * ITEMS_PER_PAGE, filteredRows.length)} of {filteredRows.length} entries
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 px-2 py-0 bg-white" disabled={safePage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Prev</Button>
                <span className="px-2 font-medium">Page {safePage} of {totalPages}</span>
                <Button variant="outline" size="sm" className="h-7 px-2 py-0 bg-white" disabled={safePage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="hubs">
          <HubHealthTab />
        </TabsContent>
      </Tabs>
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
                  <TableCell className="font-medium text-slate-600">{toTitleCase(hub.hub_id.replace(/^hub_/, ''))}</TableCell>
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
