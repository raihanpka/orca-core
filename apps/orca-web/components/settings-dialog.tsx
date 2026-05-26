"use client"

import { useOrcaWebSocket } from "@/hooks/use-orca-websocket"
import { API_BASE, API_TOKEN, WS_BASE } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import React from "react"

export function SettingsDialog({ children }: { children: React.ReactNode }) {
  const ws = useOrcaWebSocket()
  const pollInterval = process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? "15000"
  const hasToken = Boolean(API_TOKEN && API_TOKEN !== "orca-public-dev-token")

  return (
    <Dialog>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Environment Settings</DialogTitle>
          <DialogDescription>
            Runtime configuration visibility for the MVP dashboard. Secret values are never displayed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          <StatusCard label="API Token" status={hasToken ? "Configured" : "Development fallback"} tone={hasToken ? "default" : "outline"} />
          <StatusCard label="WebSocket" status={ws.status} tone={ws.status === "open" ? "default" : "outline"} />
          <StatusCard label="Polling" status={`${Number(pollInterval) / 1000}s`} tone="outline" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Environment Contract</CardTitle>
            <CardDescription>Values consumed by the frontend runtime.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variable</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Purpose</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <ConfigRow name="NEXT_PUBLIC_API_BASE" value={API_BASE} purpose="FastAPI public REST endpoint" />
                <ConfigRow name="NEXT_PUBLIC_WS_BASE" value={WS_BASE} purpose="Go engine WebSocket endpoint" />
                <ConfigRow name="NEXT_PUBLIC_API_TOKEN" value={hasToken ? "Configured" : "Development fallback"} purpose="Public API auth header" />
                <ConfigRow name="NEXT_PUBLIC_POLL_INTERVAL_MS" value={pollInterval} purpose="SWR polling fallback interval" />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}

function StatusCard({label, status, tone}: {label: string; status: string; tone: "default" | "outline"}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl capitalize">{status}</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge variant={tone}>{status}</Badge>
      </CardContent>
    </Card>
  )
}

function ConfigRow({name, value, purpose}: {name: string; value: string; purpose: string}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell className="font-mono text-xs">{value}</TableCell>
      <TableCell className="text-muted-foreground">{purpose}</TableCell>
    </TableRow>
  )
}
