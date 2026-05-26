"use client";

import type {ReactNode} from "react";
import useSWR from "swr";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {PageHeader} from "@/components/dashboard/page-header";
import {RiskBadge} from "@/components/dashboard/risk-badge";
import {jakartaRoutePoints} from "@/lib/mock-data";
import dynamic from "next/dynamic";
const RouteMap = dynamic(() => import("@/components/maps/route-map").then(mod => mod.RouteMap), { ssr: false, loading: () => <div className="h-full min-h-[420px] w-full bg-muted animate-pulse rounded-lg" /> });
import {apiFetch, type ActiveShipmentsResponse, type PredictionDetail, type ShipmentEvent} from "@/lib/api";
import {demoPrediction, demoShipmentEvents, demoShipments} from "@/lib/mock-data";
import {formatDateTime, formatNumber} from "@/lib/utils";

export default function ShipmentDetailPage({params}: {params: {id: string}}) {
  const prediction = useSWR<PredictionDetail>(`/shipments/${params.id}/prediction`, apiFetch, {
    fallbackData: {...demoPrediction, shipment_id: params.id}
  });
  const shipments = useSWR<ActiveShipmentsResponse>("/shipments/active", apiFetch, {
    fallbackData: demoShipments
  });
  const events = useSWR<{events: ShipmentEvent[]}>(`/shipments/${params.id}/events`, apiFetch, {
    fallbackData: {events: demoShipmentEvents}
  });
  const shipment = shipments.data?.shipments.find((item) => item.id === params.id) ?? demoShipments.shipments[0];
  const detail = prediction.data ?? demoPrediction;
  const timeline = events.data?.events ?? demoShipmentEvents;

  return (
    <div>
      <PageHeader
        title={`Shipment ${shipment.external_id ?? params.id.slice(0, 8)}`}
        description="Shipment-level SLA risk, risk drivers, suggested intervention, event timeline, and spatial context."
      />

      <div className="mb-5 grid gap-5 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Risk Panel</CardTitle>
            <CardDescription>Latest prediction detail from the token-protected API.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <Metric label="SLA Risk" value={formatNumber(detail.sla_risk_score, 0)} helper={<RiskBadge score={detail.sla_risk_score} />} />
              <Metric label="Delay Probability" value={`${formatNumber(detail.delay_probability * 100, 0)}%`} helper="Predicted delay risk" />
              <Metric label="Predicted Delay" value={`${formatNumber(detail.predicted_delay_hours, 1)} h`} helper="Estimated impact" />
              <Metric label="Model" value={detail.model_version} helper="Current inference source" />
            </div>
          </CardContent>
        </Card>

        <RouteMap title="Origin to Destination" points={jakartaRoutePoints.slice(0, 2)} className="min-h-[300px]" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Risk Drivers</CardTitle>
            <CardDescription>Top model or fallback contributions for explainability.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Contribution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.shap_contributions.map((item) => (
                  <TableRow key={item.feature}>
                    <TableCell className="font-medium">{item.feature}</TableCell>
                    <TableCell>{formatNumber(item.value, 2)}</TableCell>
                    <TableCell>{formatNumber(item.contribution, 3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suggested Action</CardTitle>
            <CardDescription>Operational intervention options based on current risk.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {detail.intervention_options.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <div className="text-sm font-medium text-slate-900">Current shipment</div>
              <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Origin</dt>
                  <dd className="font-medium">{shipment.origin_hub_id}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Destination</dt>
                  <dd className="font-medium">{shipment.destination_zone}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Deadline</dt>
                  <dd className="font-medium" suppressHydrationWarning>{formatDateTime(shipment.sla_deadline)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">CO2</dt>
                  <dd className="font-medium">{formatNumber(shipment.co2_kg, 1)} kg</dd>
                </div>
              </dl>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Event Timeline</CardTitle>
          <CardDescription>Persisted engine events, latest first. Falls back to demo events when the API is empty.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {timeline.map((event) => (
              <TimelineItem
                key={event.id}
                label={event.event_type}
                value={<span suppressHydrationWarning>{formatDateTime(event.created_at)}</span>}
                detail={JSON.stringify(event.event_payload)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({label, value, helper}: {label: string; value: string; helper: ReactNode}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 truncate text-2xl font-semibold">{value}</div>
      <div className="mt-2 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function TimelineItem({label, value, detail}: {label: string; value: React.ReactNode; detail: string}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-900">{value}</div>
      <div className="mt-2 line-clamp-2 break-all text-xs text-slate-500">{detail}</div>
    </div>
  );
}
