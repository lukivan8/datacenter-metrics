import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowDownUp, ArrowUp, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { makeMockMetrics, mockDevicesResponse, toDashboardStatus, type DashboardDeviceStatus, type Device, type DeviceMetricsResponse, type DevicesResponse } from '@/data/devices'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

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
  const [devicesResponse, setDevicesResponse] = useState<DevicesResponse>(mockDevicesResponse)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(mockDevicesResponse.items[0])
  const [detailOpen, setDetailOpen] = useState(false)
  const [usingMockData, setUsingMockData] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/api/devices?pageSize=200`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(response.statusText))))
      .then((data: DevicesResponse) => {
        setDevicesResponse(data)
        setSelectedDevice((current) => data.items.find((item) => item.id === current?.id) ?? data.items[0] ?? null)
        setUsingMockData(false)
      })
      .catch(() => setUsingMockData(true))
    return () => controller.abort()
  }, [])

  const devices = devicesResponse.items
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
    setSelectedDevice(device)
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
          <SummaryItem label="Total" value={devicesResponse.summary.totalDevices} />
          <SummaryItem label="Online" value={devicesResponse.summary.onlineDevices} />
          <SummaryItem label="Warning" value={devicesResponse.summary.warningDevices} />
          <SummaryItem label="Critical" value={devicesResponse.summary.criticalDevices} />
          <SummaryItem label="Power" value={`${devicesResponse.summary.totalPower.toFixed(1)} kW`} />
          <SummaryItem label="Avg Temp" value={formatTemperature(devicesResponse.summary.avgTemperature)} />
          <span className="ml-auto text-zinc-600">Showing {filteredDevices.length} / {devicesResponse.total}</span>
          {usingMockData && <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-500">Mock</span>}
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
              {filteredDevices.map((device) => (
                <TableRow key={device.id} onClick={() => openDevice(device)} className="h-8 cursor-pointer border-white/[0.055] text-[11px] hover:bg-white/[0.025] data-[state=selected]:bg-white/[0.04]">
                  <TableCell className="px-3 py-1.5 font-medium text-zinc-300 sm:px-4">
                    <div className="flex items-baseline gap-2">
                      <span>{device.name ?? device.id}</span>
                      {device.name && <span className="truncate text-[9px] font-normal text-zinc-700">{device.id}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-1.5 tabular-nums text-zinc-400 sm:px-4">{formatPower(device.power)}</TableCell>
                  <TableCell className="px-3 py-1.5 tabular-nums text-zinc-400 sm:px-4">{formatTemperature(device.temperature)}</TableCell>
                  <TableCell className="px-3 py-1.5 sm:px-4"><StatusBadge status={toDashboardStatus(device.status)} /></TableCell>
                  <TableCell className="px-3 py-1.5 tabular-nums text-zinc-500 sm:px-4">{formatLastSeen(device.timestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="border-white/[0.08] bg-[#0b0c0e] text-zinc-100">
          {selectedDevice && <DeviceDetail device={selectedDevice} useMockMetrics={usingMockData} />}
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

function DeviceDetail({ device, useMockMetrics }: { device: Device; useMockMetrics: boolean }) {
  const [metrics, setMetrics] = useState<DeviceMetricsResponse>(() => makeMockMetrics(device.id))

  useEffect(() => {
    if (useMockMetrics) {
      setMetrics(makeMockMetrics(device.id))
      return
    }
    fetch(`${API_BASE_URL}/api/devices/${encodeURIComponent(device.id)}/metrics?windowSeconds=60`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(response.statusText))))
      .then((data: DeviceMetricsResponse) => setMetrics(data))
      .catch(() => setMetrics(makeMockMetrics(device.id)))
  }, [device.id, useMockMetrics])

  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-zinc-100">{device.name ?? device.id}</SheetTitle>
        <SheetDescription className="text-zinc-500">{device.id}</SheetDescription>
      </SheetHeader>
      <div className="mt-5 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <DetailCard label="Power" value={formatPower(device.power)} />
          <DetailCard label="Temperature" value={formatTemperature(device.temperature)} />
          <DetailCard label="Timestamp" value={formatLastSeen(device.timestamp)} />
          <DetailCard label="Metric Points" value={String(metrics.items.length)} />
        </div>
        <Card className="border-white/[0.08] bg-[#0f1113] shadow-none">
          <CardHeader className="p-3"><CardTitle className="text-xs font-medium text-zinc-400">Status</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3 pt-0"><StatusBadge status={toDashboardStatus(device.status)} /></CardContent>
        </Card>
        <Card className="border-white/[0.08] bg-[#0f1113] shadow-none">
          <CardHeader className="p-3"><CardTitle className="text-xs font-medium text-zinc-400">Last {metrics.windowSeconds} seconds</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="space-y-1.5">
              {metrics.items.slice(-6).map((point) => (
                <div key={point.id} className="grid grid-cols-3 gap-2 text-xs">
                  <span className="text-zinc-500">{formatLastSeen(point.timestamp)}</span>
                  <span className="text-zinc-300">{formatPower(point.power)}</span>
                  <span className="text-zinc-300">{formatTemperature(point.temperature)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
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

function formatPower(value: number | null) { return value === null ? '—' : `${value.toFixed(1)} kW` }
function formatTemperature(value: number | null) { return value === null ? '—' : `${value.toFixed(1)}°C` }
function formatLastSeen(value: string | null) { return value === null ? '—' : new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) }

export default App
