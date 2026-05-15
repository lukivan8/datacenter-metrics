import { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowDownUp, ArrowUp, RefreshCw, Search } from 'lucide-react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDeviceLiveQuery, useDeviceLiveStream, useDeviceMetricsQuery, useDevicesQuery, usePrefetchDeviceDetails } from '@/hooks/useDevices'
import type { Device, DeviceStatus, MetricPoint } from '@/lib/api'

type DashboardDeviceStatus = DeviceStatus

function toDashboardStatus(status: Device['status']): DashboardDeviceStatus {
  return status
}

const statusVariant: Record<DashboardDeviceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  normal: 'secondary',
  warning: 'outline',
  critical: 'destructive',
  offline: 'outline',
}

const statusClasses: Record<DashboardDeviceStatus, string> = {
  normal: 'border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:bg-white/[0.035]',
  warning: 'border-amber-400/15 bg-amber-500/[0.08] text-amber-400 hover:bg-amber-500/[0.08]',
  critical: 'border-red-400/15 bg-red-500/[0.09] text-red-400 hover:bg-red-500/[0.09]',
  offline: 'border-white/[0.07] bg-black/20 text-zinc-600 hover:bg-black/20',
}

const telemetryChartConfig = {
  power: { label: 'Power kW', color: '#60a5fa' },
  temperature: { label: 'Temp °C', color: '#f97316' },
  rollingAvgPower: { label: 'Power avg', color: '#93c5fd' },
  rollingAvgTemperature: { label: 'Temp avg', color: '#fdba74' },
} satisfies ChartConfig

type SortKey = 'power' | 'temperature' | 'timestamp'
type SortDirection = 'asc' | 'desc'

type ActiveSort = {
  key: SortKey
  direction: SortDirection
}

type SortState = ActiveSort | null

function App() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DashboardDeviceStatus | 'all'>('all')
  const [sort, setSort] = useState<SortState>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const devicesQuery = useDevicesQuery({ pageSize: 200 })
  const devicesResponse = devicesQuery.data
  const prefetchDeviceDetails = usePrefetchDeviceDetails()

  const devices = devicesResponse?.items ?? []
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? null
  // TODO: move search/status/sort into devicesKeys.list(params) when the API guarantees support.
  // For now these existing controls remain client-side over the bounded pageSize=200 fleet read.
  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase()
    return devices
      .filter((device) => {
        const matchesSearch = !query || device.id.toLowerCase().includes(query) || (device.name ?? '').toLowerCase().includes(query)
        const matchesStatus = statusFilter === 'all' || toDashboardStatus(device.status) === statusFilter
        return matchesSearch && matchesStatus
      })
      .toSorted((a, b) => (sort ? compareDevices(a, b, sort) : 0))
  }, [devices, search, statusFilter, sort])

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: 'desc' }
      if (current.direction === 'desc') return { key, direction: 'asc' }
      return null
    })
  }

  function openDevice(device: Device) {
    setSelectedDeviceId(device.id)
    setDetailOpen(true)
  }

  return (
    <main className="min-h-screen bg-[#050506] p-2 text-zinc-100 sm:p-4">
      <section className="mx-auto max-w-[1500px] overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0b0c0e] shadow-2xl shadow-black/40">
        <div className="flex flex-col gap-2 border-b border-white/[0.07] px-3 py-2.5 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[9px] font-medium uppercase tracking-[0.26em] text-zinc-600">Aravolta Operations</p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-200">Live Device Telemetry</h1>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void devicesQuery.refetch()}
                disabled={devicesQuery.isFetching}
                className="h-7 border-white/[0.08] bg-[#0f1113] px-2 text-[11px] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                title="Refresh fleet telemetry"
              >
                <RefreshCw className={`h-3 w-3 ${devicesQuery.isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <span className="whitespace-nowrap text-[10px] tabular-nums text-zinc-600">
                {devicesQuery.dataUpdatedAt ? `Last ${formatLastSeen(new Date(devicesQuery.dataUpdatedAt).toISOString())}` : 'Not refreshed'}
              </span>
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-600" />
              <Input
                aria-label="Search devices"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="h-7 rounded-md border-white/[0.08] bg-[#0f1113] pl-7 text-[11px] text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-700"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DashboardDeviceStatus | 'all')}>
              <SelectTrigger className="h-7 w-28 rounded-md border-white/[0.08] bg-[#0f1113] px-2 text-[11px] text-zinc-400 focus:ring-1 focus:ring-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/[0.08] bg-[#111416] text-zinc-300">
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.07] bg-[#0f1113] px-3 py-1.5 text-[11px] text-zinc-500 sm:px-4">
          <SummaryItem label="Total" value={devicesResponse?.summary.totalDevices ?? '—'} />
          <SummaryItem label="Online" value={devicesResponse?.summary.onlineDevices ?? '—'} />
          <SummaryItem label="Warning" value={devicesResponse?.summary.warningDevices ?? '—'} />
          <SummaryItem label="Critical" value={devicesResponse?.summary.criticalDevices ?? '—'} />
          <SummaryItem label="Power" value={devicesResponse ? `${Math.round(devicesResponse.summary.totalPower)} kW` : '—'} />
          <SummaryItem label="Avg Temp" value={formatTemperature(devicesResponse?.summary.avgTemperature ?? null)} />
          <span className="ml-auto text-zinc-600">Showing {filteredDevices.length} / {devicesResponse?.total ?? 0}</span>
          {devicesQuery.isFetching && <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-500">Loading</span>}
        </div>

        <div className="bg-[#0d0f11]">
          <Table>
            <TableHeader className="bg-[#17181b]">
              <TableRow className="border-white/[0.07] hover:bg-transparent">
                <TableHead className="h-7 px-3 text-[9px] font-medium uppercase tracking-[0.18em] text-zinc-600 sm:px-4">Device</TableHead>
                <SortableHead label="Power" sortKey="power" sort={sort} onSort={toggleSort} />
                <SortableHead label="Temperature" sortKey="temperature" sort={sort} onSort={toggleSort} />
                <TableHead className="h-7 px-3 text-[9px] font-medium uppercase tracking-[0.18em] text-zinc-600 sm:px-4">Status</TableHead>
                <SortableHead label="Last Seen" sortKey="timestamp" sort={sort} onSort={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {devicesQuery.isError && <TableMessage message="Unable to load devices" />}
              {devicesQuery.isLoading && <TableMessage message="Loading device telemetry…" />}
              {!devicesQuery.isLoading && !devicesQuery.isError && filteredDevices.length === 0 && <TableMessage message="No devices match the current filters" />}
              {filteredDevices.map((device) => (
                <DeviceRow key={device.id} device={device} onOpen={openDevice} onPrefetch={prefetchDeviceDetails} />
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="overflow-y-auto border-white/[0.08] bg-[#0b0c0e] text-zinc-100">
          {selectedDevice && <DeviceDetail device={selectedDevice} open={detailOpen} />}
        </SheetContent>
      </Sheet>
    </main>
  )
}

function SortableHead({ label, sortKey, sort, onSort }: { label: string; sortKey: SortKey; sort: SortState; onSort: (key: SortKey) => void }) {
  const isActive = sort?.key === sortKey
  const Icon = isActive ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowDownUp

  return (
    <TableHead className="h-7 px-3 text-[9px] font-medium uppercase tracking-[0.18em] text-zinc-600 sm:px-4">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 uppercase tracking-[0.18em] transition-colors hover:text-zinc-300"
        aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        <Icon className={`h-3 w-3 ${isActive ? 'text-zinc-400' : 'text-zinc-700'}`} />
      </button>
    </TableHead>
  )
}

function compareDevices(a: Device, b: Device, sort: ActiveSort) {
  const aValue = getSortValue(a, sort.key)
  const bValue = getSortValue(b, sort.key)

  if (aValue === null && bValue === null) return 0
  if (aValue === null) return 1
  if (bValue === null) return -1

  const result = aValue - bValue
  return sort.direction === 'asc' ? result : -result
}

function getSortValue(device: Device, key: SortKey) {
  if (key === 'timestamp') return device.timestamp === null ? null : new Date(device.timestamp).getTime()
  return device[key]
}

function SummaryItem({ label, value }: { label: string; value: string | number }) {
  return <span><span className="text-zinc-600">{label}</span> <span className="font-medium tabular-nums text-zinc-400">{value}</span></span>
}

function TableMessage({ message }: { message: string }) {
  return (
    <TableRow className="border-white/[0.055] hover:bg-transparent">
      <TableCell colSpan={5} className="px-4 py-8 text-center text-xs text-zinc-500">{message}</TableCell>
    </TableRow>
  )
}

function DeviceRow({ device, onOpen, onPrefetch }: { device: Device; onOpen: (device: Device) => void; onPrefetch: (id: string) => void }) {
  const hoverTimer = useRef<number | undefined>(undefined)

  function clearHoverTimer() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
  }

  return (
    <TableRow
      onClick={() => onOpen(device)}
      onMouseEnter={() => { hoverTimer.current = window.setTimeout(() => onPrefetch(device.id), 200) }}
      onMouseLeave={clearHoverTimer}
      className="h-8 cursor-pointer border-white/[0.055] text-[11px] hover:bg-white/[0.025] data-[state=selected]:bg-white/[0.04]"
    >
      <TableCell className="px-3 py-1.5 font-medium text-zinc-300 sm:px-4">
        <div className="flex items-baseline gap-2">
          <span>{device.name ?? device.id}</span>
          {device.name && <span className="truncate text-[9px] font-normal text-zinc-700">{device.id}</span>}
        </div>
      </TableCell>
      <TableCell className="px-3 py-1.5 tabular-nums text-zinc-400 sm:px-4">{formatPower(device.power)}</TableCell>
      <TableCell className="px-3 py-1.5 tabular-nums text-zinc-400 sm:px-4">{formatTemperature(device.temperature)}</TableCell>
      <TableCell className="px-3 py-1.5 sm:px-4"><StatusBadge status={toDashboardStatus(device.status)} /></TableCell>
      <TableCell className="px-3 py-1.5 tabular-nums text-zinc-500 sm:px-4">{formatLastSeen(device.timestamp ?? device.lastSeenAt)}</TableCell>
    </TableRow>
  )
}

function DeviceDetail({ device, open }: { device: Device; open: boolean }) {
  const metricsQuery = useDeviceMetricsQuery(device.id, 60, open)
  const liveQuery = useDeviceLiveQuery(device.id, open)
  useDeviceLiveStream(device.id, open)
  const metrics = metricsQuery.data ?? { deviceId: device.id, windowSeconds: 60, items: [] }
  const live = liveQuery.data && 'timestamp' in liveQuery.data ? liveQuery.data : device

  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-zinc-100">{device.name ?? device.id}</SheetTitle>
        <SheetDescription className="text-zinc-500">{device.id}</SheetDescription>
      </SheetHeader>
      <div className="mt-5 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <DetailCard label="Power" value={formatPower(live.power)} />
          <DetailCard label="Temperature" value={formatTemperature(live.temperature)} />
          <DetailCard label="Timestamp" value={formatLastSeen(live.timestamp)} />
          <DetailCard label="Metric Points" value={String(metrics.items.length)} />
        </div>
        <Card className="border-white/[0.08] bg-[#0f1113] shadow-none">
          <CardHeader className="p-3"><CardTitle className="text-xs font-medium text-zinc-400">Status</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3 pt-0"><StatusBadge status={toDashboardStatus(device.status)} /></CardContent>
        </Card>
        <Card className="border-white/[0.08] bg-[#0f1113] shadow-none">
          <CardHeader className="p-3"><CardTitle className="text-xs font-medium text-zinc-400">Live telemetry · Last {metrics.windowSeconds} seconds {metricsQuery.isFetching ? '· loading' : ''}</CardTitle></CardHeader>
          <CardContent className="space-y-4 px-3 pb-3 pt-0">
            <TelemetryChart points={metrics.items} />
            <MetricList points={metrics.items} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function TelemetryChart({ points }: { points: MetricPoint[] }) {
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

type TelemetryChartData = ReturnType<typeof buildTelemetryChartData>[number]
type TelemetryMetricKey = 'power' | 'temperature'
type TelemetryAverageKey = 'rollingAvgPower' | 'rollingAvgTemperature'

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

function getMetricDomain(data: TelemetryChartData[], valueKey: TelemetryMetricKey, averageKey: TelemetryAverageKey, padding: number): [number, number] {
  const values = data
    .flatMap((point) => [point[valueKey], point[averageKey]])
    .filter((value): value is number => value !== null)

  if (values.length === 0) return [0, 1]

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return [min - padding, max + padding]

  const dynamicPadding = Math.max((max - min) * 0.15, padding)
  return [Math.floor(min - dynamicPadding), Math.ceil(max + dynamicPadding)]
}

function MetricList({ points }: { points: MetricPoint[] }) {
  const recentPoints = points.slice(-8).toReversed()

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

function buildTelemetryChartData(points: MetricPoint[]) {
  const cutoff = Date.now() - 60_000
  return points
    .filter((point) => new Date(point.timestamp).getTime() >= cutoff)
    .map((point, _index, windowPoints) => {
      const timestamp = new Date(point.timestamp).getTime()
      const rollingWindow = windowPoints.filter((candidate) => {
        const candidateTime = new Date(candidate.timestamp).getTime()
        return candidateTime >= timestamp - 10_000 && candidateTime <= timestamp
      })
      return {
        time: formatLastSeen(point.timestamp),
        power: point.power,
        temperature: point.temperature,
        rollingAvgPower: point.rollingAvgPower ?? averageMetric(rollingWindow, 'power'),
        rollingAvgTemperature: point.rollingAvgTemperature ?? averageMetric(rollingWindow, 'temperature'),
      }
    })
}

function averageMetric(points: MetricPoint[], key: 'power' | 'temperature') {
  const values = points.map((point) => point[key]).filter((value): value is number => value !== null)
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-white/[0.08] bg-[#0f1113] shadow-none">
      <CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</CardTitle></CardHeader>
      <CardContent className="px-3 pb-3 pt-0"><p className="text-sm font-semibold tabular-nums text-zinc-200">{value}</p></CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: DashboardDeviceStatus }) {
  return <Badge variant={statusVariant[status]} className={`h-4 rounded px-1.5 text-[9px] font-medium uppercase tracking-wide ${statusClasses[status]}`}>{status}</Badge>
}

function formatPower(value: number | null) { return value === null ? '—' : `${Math.round(value)} kW` }
function formatTemperature(value: number | null) { return value === null ? '—' : `${value.toFixed(1)}°C` }
function formatLastSeen(value: string | null) { return value === null ? '—' : new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) }

export default App
