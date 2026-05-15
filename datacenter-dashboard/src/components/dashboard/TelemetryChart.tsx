import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { MetricPoint } from '@/lib/api'
import {
  buildTelemetryChartData,
  formatLastSeen,
  formatPower,
  formatTemperature,
  getMetricDomain,
  telemetryChartConfig,
  type TelemetryAverageKey,
  type TelemetryChartData,
  type TelemetryMetricKey,
} from '@/lib/dashboard'

export function TelemetryChart({ points }: { points: MetricPoint[] }) {
  const chartData = useMemo(() => buildTelemetryChartData(points), [points])

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-black/10 px-6 text-center">
        <div className="mb-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          No recent samples
        </div>
        <p className="text-sm font-medium text-zinc-300">No metrics in the last 60 seconds</p>
        <p className="mt-1 max-w-72 text-xs leading-5 text-zinc-600">
          Some devices report less frequently or only when values change. Keep this panel open and the chart will populate automatically when the next telemetry update arrives.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SingleMetricChart title="Power" valueKey="power" averageKey="rollingAvgPower" data={chartData} unit="kW" tickFormatter={(value) => String(Math.round(value))} domainPadding={5} />
      <SingleMetricChart title="Temperature" valueKey="temperature" averageKey="rollingAvgTemperature" data={chartData} unit="°C" tickFormatter={(value) => value.toFixed(1)} domainPadding={1} />
    </div>
  )
}

function SingleMetricChart({
  title,
  valueKey,
  averageKey,
  data,
  unit,
  tickFormatter,
  domainPadding,
}: {
  title: string
  valueKey: TelemetryMetricKey
  averageKey: TelemetryAverageKey
  data: TelemetryChartData[]
  unit: string
  tickFormatter: (value: number) => string
  domainPadding: number
}) {
  const domain = getMetricDomain(data, valueKey, averageKey, domainPadding)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="font-medium text-zinc-400">{title}</span>
        <span className="text-zinc-600">{unit} · 10s rolling avg</span>
      </div>
      <ChartContainer config={telemetryChartConfig} className="h-44 w-full">
        <LineChart accessibilityLayer data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" />
          <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} stroke="rgb(113 113 122)" fontSize={10} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} stroke="rgb(113 113 122)" fontSize={10} width={56} domain={domain} tickFormatter={tickFormatter} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line type="monotone" dataKey={valueKey} stroke={`var(--color-${valueKey})`} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
          <Line type="monotone" dataKey={averageKey} stroke={`var(--color-${averageKey})`} strokeWidth={1.5} strokeOpacity={0.45} dot={false} connectNulls />
        </LineChart>
      </ChartContainer>
    </div>
  )
}

export function MetricList({ points }: { points: MetricPoint[] }) {
  const recentPoints = points
    .toSorted((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8)

  if (recentPoints.length === 0) return null

  return (
    <div className="border-t border-white/[0.07] pt-3">
      <div className="mb-2 text-[11px] font-medium text-zinc-500">Recent metric samples</div>
      <div className="space-y-1.5">
        {recentPoints.map((point) => (
          <div key={point.timestamp} className="grid grid-cols-3 gap-2 text-xs">
            <span className="text-zinc-500">{formatLastSeen(point.timestamp)}</span>
            <span className="tabular-nums text-zinc-300">{formatPower(point.power)}</span>
            <span className="tabular-nums text-zinc-300">{formatTemperature(point.temperature)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
