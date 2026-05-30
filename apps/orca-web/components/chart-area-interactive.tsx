"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

type RiskTrendDatum = {
  date: string
  risk: number
  carbon: number
}

const fallbackData: RiskTrendDatum[] = [
  { date: "2026-05-20", risk: 36, carbon: 220 },
  { date: "2026-05-21", risk: 44, carbon: 244 },
  { date: "2026-05-22", risk: 39, carbon: 199 },
  { date: "2026-05-23", risk: 58, carbon: 310 },
  { date: "2026-05-24", risk: 49, carbon: 277 },
  { date: "2026-05-25", risk: 61, carbon: 283 },
  { date: "2026-05-26", risk: 54, carbon: 309 },
]

const chartConfig = {
  risk: {
    label: "SLA Risk",
    color: "hsl(var(--chart-1))",
  },
  carbon: {
    label: "CO2 kg",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function ChartAreaInteractive({data = fallbackData}: {data?: RiskTrendDatum[]}) {
  const [metric, setMetric] = React.useState<"risk" | "carbon">("risk")

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>Operational Trend</CardTitle>
        <CardDescription>
          SLA risk and carbon visibility for the current monitoring window.
        </CardDescription>
        <div className="absolute right-4 top-4">
          <ToggleGroup
            value={metric as any}
            onValueChange={(value: any) => value && setMetric(value as "risk" | "carbon")}
            variant="outline"
            className="hidden @lg/card:flex"
          >
            <ToggleGroupItem value="risk" className="h-8 px-2.5">
              SLA Risk
            </ToggleGroupItem>
            <ToggleGroupItem value="carbon" className="h-8 px-2.5">
              CO2
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fillMetric" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={`var(--color-${metric})`}
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor={`var(--color-${metric})`}
                  stopOpacity={0.08}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey={metric}
              type="natural"
              fill="url(#fillMetric)"
              stroke={`var(--color-${metric})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
