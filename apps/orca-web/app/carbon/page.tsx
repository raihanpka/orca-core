"use client"

import useSWR from "swr"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiFetch, type CarbonAnalytics } from "@/lib/api"
import { demoCarbon } from "@/lib/mock-data"
import { formatNumber } from "@/lib/utils"

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

export default function CarbonPage() {
  const {data = demoCarbon} = useSWR<CarbonAnalytics>("/analytics/carbon", apiFetch, {
    fallbackData: demoCarbon,
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
    <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Carbon Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Track GLEC-aligned shipment carbon visibility by day and vehicle type.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Total CO2" value={`${formatNumber(data.total_co2_kg, 1)} kg`} helper={`GLEC ${data.glec_version}`} />
        <Metric title="Average CO2" value={`${formatNumber(data.avg_co2_per_shipment_kg, 1)} kg`} helper="Per shipment" />
        <Metric title="Vs Baseline" value={`${formatNumber(data.vs_baseline_pct, 1)}%`} helper="Current estimated improvement" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily CO2 Trend</CardTitle>
            <CardDescription>Total shipment CO2 by calculation date.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dailyChartConfig} className="h-80 w-full">
              <LineChart data={data.by_day}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Line type="monotone" dataKey="co2_kg" stroke="var(--color-co2_kg)" strokeWidth={2} dot={{r: 3}} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle Breakdown</CardTitle>
            <CardDescription>Compare shipment count and CO2 contribution.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={vehicleChartConfig} className="h-80 w-full">
              <BarChart data={data.by_vehicle_type}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="vehicle_type" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="co2_kg" fill="var(--color-co2_kg)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehicle Type Table</CardTitle>
          <CardDescription>Detailed values for ESG review and dashboard mockup.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Shipment Count</TableHead>
                <TableHead>CO2</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.by_vehicle_type.map((item) => (
                <TableRow key={item.vehicle_type}>
                  <TableCell className="font-medium">{item.vehicle_type}</TableCell>
                  <TableCell>{item.shipment_count}</TableCell>
                  <TableCell>{formatNumber(item.co2_kg, 1)} kg</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({title, value, helper}: {title: string; value: string; helper: string}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-slate-500">{helper}</div>
      </CardContent>
    </Card>
  )
}
