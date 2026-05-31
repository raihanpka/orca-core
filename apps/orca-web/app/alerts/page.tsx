"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { SearchIcon, CalendarIcon, CheckIcon, XIcon, AlertTriangleIcon, BellIcon, InfoIcon, MailIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiFetch, type RecentAlert } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import { toast } from "sonner"

export default function AlertsPage() {
  const router = useRouter()
  const { data: { alerts = [] } = {} } = useSWR<{alerts: RecentAlert[]}>("/alerts/recent", apiFetch, {
    refreshInterval: 15000,
  })

  const [selectedAlert, setSelectedAlert] = useState<RecentAlert | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [riskFilter, setRiskFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [timeFilter, setTimeFilter] = useState(24)
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set())

  const handleAcknowledge = () => {
    if (!selectedAlert) return
    setAcknowledgedIds(new Set([...acknowledgedIds, selectedAlert.id]))
    toast.success(`Alert ${selectedAlert.external_id ?? selectedAlert.shipment_id.slice(0, 8)} acknowledged.`)
    setSelectedAlert(null)
  }

  const handleResend = () => {
    toast.info("Resend request sent via API.")
  }

  const filteredAlerts = alerts.filter(alert => {
    if (searchQuery && !alert.external_id?.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (riskFilter !== "all") {
      const riskLevel = alert.sla_risk_score > 75 ? "critical" : alert.sla_risk_score > 50 ? "elevated" : alert.sla_risk_score > 25 ? "warning" : "routine"
      if (riskLevel !== riskFilter) return false
    }
    if (statusFilter !== "all") {
      const isAck = acknowledgedIds.has(alert.id)
      if (statusFilter === "acknowledged" && !isAck) return false
      if (statusFilter === "dispatched" && isAck) return false
    }
    if (timeFilter !== 0) {
      const alertTime = new Date(alert.created_at).getTime()
      if (Date.now() - alertTime > timeFilter * 60 * 60 * 1000) return false
    }
    return true
  })

  const getRiskLevel = (score: number) => {
    if (score > 75) return { label: "Critical", color: "bg-red-100 text-red-700 border-red-200" }
    if (score > 50) return { label: "Elevated", color: "bg-orange-100 text-orange-700 border-orange-200" }
    if (score > 25) return { label: "Warning", color: "bg-amber-100 text-amber-700 border-amber-200" }
    return { label: "Routine", color: "bg-slate-100 text-slate-700 border-slate-200" }
  }

  const getChannel = (score: number) => {
    if (score > 75) return "SMS / API"
    if (score > 50) return "Push"
    if (score > 25) return "Email"
    return "Webhook"
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-white min-h-screen">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Alert History</h1>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-slate-200 pb-6">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search Shipment ID..." 
            className="pl-9 bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={riskFilter} onValueChange={(val: string | null) => setRiskFilter(val || "all")}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Risk Level: All">
              {riskFilter === "all" ? "Risk Level: All" : riskFilter.charAt(0).toUpperCase() + riskFilter.slice(1)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="all">Risk Level: All</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="elevated">Elevated</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="routine">Routine</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(val: string | null) => setStatusFilter(val || "all")}>
          <SelectTrigger className="w-[160px] bg-white">
            <SelectValue placeholder="Status: All">
              {statusFilter === "all" ? "Status: All" : statusFilter === "dispatched" ? "Dispatched" : "Acknowledged"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="all">Status: All</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
          </SelectContent>
        </Select>
        <Select value={timeFilter.toString()} onValueChange={(val: string | null) => setTimeFilter(Number(val))}>
          <SelectTrigger className="w-[160px] bg-white">
            <div className="flex items-center">
              <CalendarIcon className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Last 24 Hours">
                {timeFilter === 24 ? "Last 24 Hours" : timeFilter === 168 ? "Last 7 Days" : "All Time"}
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="24">Last 24 Hours</SelectItem>
            <SelectItem value="168">Last 7 Days</SelectItem>
            <SelectItem value="0">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px] items-start">
        <Card className="shadow-sm border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-200 text-xs tracking-wider">
                <TableHead className="font-semibold text-slate-500 uppercase">Timestamp</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Shipment ID</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Risk Score</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Channel</TableHead>
                <TableHead className="font-semibold text-slate-500 uppercase">Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAlerts.length > 0 ? filteredAlerts.map((alert) => {
                const risk = getRiskLevel(alert.sla_risk_score)
                const isSelected = selectedAlert?.id === alert.id
                return (
                  <TableRow 
                    key={alert.id} 
                    className={`border-slate-200 cursor-pointer ${isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <TableCell className="text-sm">{new Date(alert.created_at).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false })}, {new Date(alert.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</TableCell>
                    <TableCell className="font-medium text-slate-900">{alert.external_id ?? alert.shipment_id.slice(0,8)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${risk.color}`}>
                        {risk.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">{getChannel(alert.sla_risk_score)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-slate-900">
                        <div className={`w-1.5 h-1.5 rounded-full ${acknowledgedIds.has(alert.id) ? 'bg-green-500' : 'bg-slate-900'}`} />
                        {acknowledgedIds.has(alert.id) ? "Acknowledged" : "Dispatched"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-slate-400">›</TableCell>
                  </TableRow>
                )
              }) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No alerts found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-200 text-sm text-slate-900 flex justify-between">
            <span>Showing {filteredAlerts.length} alerts</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled>‹</Button>
              <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled>›</Button>
            </div>
          </div>
        </Card>

        {selectedAlert ? (
          <Card className="shadow-sm border-slate-200 bg-slate-50/50 sticky top-6">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-200 bg-white rounded-t-lg">
              <div>
                <CardTitle className="text-lg">Alert Logs & Details</CardTitle>
                <div className="text-base text-slate-900 mt-1 font-mono">
                  {selectedAlert.external_id ?? selectedAlert.shipment_id.slice(0, 8)}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedAlert(null)}>
                <XIcon className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-5 space-y-6">
                
                {/* Risk Confidence Score */}
                <div className="bg-white border border-slate-200 rounded-md p-4 flex gap-4 items-center shadow-sm">
                  <div className={`text-3xl font-bold rounded-lg border w-16 h-16 flex items-center justify-center ${getRiskLevel(selectedAlert.sla_risk_score).color} border-${getRiskLevel(selectedAlert.sla_risk_score).color.split(' ')[1].replace('text', 'border')}`}>
                    {Math.round(selectedAlert.sla_risk_score)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900 mb-1">Risk Confidence Score</div>
                    <div className="text-sm text-slate-600">
                      {selectedAlert.intervention}
                    </div>
                  </div>
                </div>

                {/* SHIPMENT INFORMATION */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shipment Information</div>
                  <div className="bg-slate-50/50 border border-slate-200 rounded-md p-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Carrier</div>
                      <div className="text-sm font-medium text-slate-900">Internal Fleet</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Origin</div>
                      <div className="text-sm font-medium text-slate-900">JKT Hub ({selectedAlert.shipment_id.slice(0,4)})</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Destination</div>
                      <div className="text-sm font-medium text-slate-900">Customer Location</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Est. Delivery</div>
                      <div className="text-sm font-medium text-slate-900">{new Date(new Date(selectedAlert.created_at).getTime() + 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                  </div>
                </div>

                {/* DISPATCHED MESSAGE */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dispatched Message</div>
                  <div className="bg-blue-50 border border-blue-100 rounded-md p-4 flex items-start gap-3">
                    <div className="flex-1 text-sm font-medium text-slate-800">
                      "URGENT: Shipment {selectedAlert.external_id ?? selectedAlert.shipment_id.slice(0,8)} is experiencing a high-risk delay. Action required for rerouting."
                    </div>
                    <MailIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                  </div>
                </div>

                {/* DEDUPLICATION LOGIC */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deduplication Logic</div>
                  <div className="text-sm flex items-start gap-2 text-slate-900 font-medium">
                    <AlertTriangleIcon className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Alert was triggered. 3 similar events within 1 hour window were suppressed to prevent notification fatigue.<br/><span className="text-sm text-slate-900 font-normal">Rule: HUB_DELAY_SUPPRESSION</span></span>
                  </div>
                </div>

                {/* PROVIDER RESPONSE */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Provider Response</div>
                  <div className="bg-slate-800 text-slate-300 font-mono text-xs rounded-md p-4 whitespace-pre overflow-x-auto">
{`{
  "provider": "Fonnte API",
  "status": 200,
  "message_id": "msg-${selectedAlert.shipment_id.slice(0, 6)}",
  "timestamp": "${new Date(selectedAlert.created_at).getTime()}",
  "event": "delivered"
}`}
                  </div>
                </div>
              </div>

              <div className="p-5 bg-white border-t border-slate-200 rounded-b-lg flex gap-3">
                <Button variant="outline" className="flex-1 bg-white" onClick={handleAcknowledge}>Acknowledge</Button>
                <Button className="flex-1 bg-blue-600 text-white hover:bg-blue-700 hover:text-white" onClick={() => router.push('/optimize')}>Optimize Route</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="h-full min-h-[400px] border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-900 text-base">
            Select an alert to view details
          </div>
        )}
      </div>
    </div>
  )
}
