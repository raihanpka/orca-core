"use client";

import {useMemo, useState} from "react";
import useSWR from "swr";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Badge} from "@/components/ui/badge";
import {hubMapPoints} from "@/lib/mock-data";
import dynamic from "next/dynamic";
const RouteMap = dynamic(() => import("@/components/maps/route-map").then(mod => mod.RouteMap), { ssr: false, loading: () => <div className="h-full min-h-[420px] w-full bg-muted animate-pulse rounded-lg" /> });
import {apiFetch, type HubMetric} from "@/lib/api";
import {demoHubs} from "@/lib/mock-data";
import {formatNumber} from "@/lib/utils";

export default function HubsPage() {
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);
  const {data} = useSWR<{hubs: HubMetric[]}>("/analytics/hubs", apiFetch, {
    fallbackData: {hubs: demoHubs},
    refreshInterval: 30000
  });
  const hubs = data?.hubs ?? demoHubs;
  const selectedHub = useMemo(
    () => hubs.find((hub) => hub.hub_id === selectedHubId) ?? hubs[0],
    [hubs, selectedHubId]
  );
  const high = hubs.filter((hub) => hub.congestion_level === "high").length;

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hub Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Monitor hub dwell time, inbound load, and congestion clusters with a map-first operations view.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <RouteMap title="Hub Congestion Map" points={hubMapPoints} className="min-h-[420px]" />
        <Card>
          <CardHeader>
            <CardTitle>Hub Health</CardTitle>
            <CardDescription>Current congestion summary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-3xl font-semibold">{hubs.length}</div>
              <div className="text-sm text-muted-foreground">Active hubs monitored</div>
            </div>
            <div>
              <div className="text-3xl font-semibold text-red-600">{high}</div>
              <div className="text-sm text-muted-foreground">High congestion hubs</div>
            </div>
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              Map markers use MapCN MapLibre with low, medium, and high congestion tones.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Hub Grid</CardTitle>
            <CardDescription>Click a hub row to inspect current congestion detail.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hub</TableHead>
                  <TableHead>Inbound</TableHead>
                  <TableHead>Dwell</TableHead>
                  <TableHead>Delay Rate</TableHead>
                  <TableHead>Congestion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hubs.map((hub) => (
                  <TableRow key={hub.hub_id} className="cursor-pointer" onClick={() => setSelectedHubId(hub.hub_id)}>
                    <TableCell className="font-medium">{hub.hub_name}</TableCell>
                    <TableCell>{hub.current_inbound_volume}</TableCell>
                    <TableCell>{formatNumber(hub.avg_dwell_time_min, 0)} min</TableCell>
                    <TableCell>{formatNumber(hub.delay_rate_7d * 100, 1)}%</TableCell>
                    <TableCell>
                      <CongestionBadge level={hub.congestion_level} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedHub ? (
          <Card>
            <CardHeader>
              <CardTitle>{selectedHub.hub_name}</CardTitle>
              <CardDescription>Selected hub detail panel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Detail label="Inbound Volume" value={selectedHub.current_inbound_volume.toString()} />
              <Detail label="Average Dwell" value={`${formatNumber(selectedHub.avg_dwell_time_min, 0)} min`} />
              <Detail label="Delay Rate" value={`${formatNumber(selectedHub.delay_rate_7d * 100, 1)}%`} />
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium">Affected shipments</div>
                <div className="mt-1 text-muted-foreground">
                  Pending backend endpoint for hub-specific shipment list.
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Detail({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function CongestionBadge({level}: {level: HubMetric["congestion_level"]}) {
  if (level === "high") return <Badge variant="destructive">High</Badge>;
  if (level === "medium") return <Badge className="border-amber-200 bg-amber-50 text-amber-800">Medium</Badge>;
  return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Low</Badge>;
}
