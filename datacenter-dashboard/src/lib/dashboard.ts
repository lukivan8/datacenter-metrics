import type { ChartConfig } from '@/components/ui/chart'
import type { Device, DeviceStatus, MetricPoint } from '@/lib/api'

export type DashboardDeviceStatus = DeviceStatus

export function toDashboardStatus(status: Device['status']): DashboardDeviceStatus {
  return status
}

export const statusVariant: Record<DashboardDeviceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  normal: 'secondary',
  warning: 'outline',
  critical: 'destructive',
}

export const statusClasses: Record<DashboardDeviceStatus, string> = {
  normal: 'border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:bg-white/[0.035]',
  warning: 'border-amber-400/15 bg-amber-500/[0.08] text-amber-400 hover:bg-amber-500/[0.08]',
  critical: 'border-red-400/15 bg-red-500/[0.09] text-red-400 hover:bg-red-500/[0.09]',
}

export const telemetryChartConfig = {
  power: { label: 'Power kW', color: '#60a5fa' },
  temperature: { label: 'Temp °C', color: '#f97316' },
  rollingAvgPower: { label: 'Power avg', color: '#93c5fd' },
  rollingAvgTemperature: { label: 'Temp avg', color: '#fdba74' },
} satisfies ChartConfig

export const DEVICES_PER_PAGE = 25
export const VIRTUAL_ROW_HEIGHT = 32
export const VIRTUAL_OVERSCAN = 5
export const VIRTUAL_LIST_MIN_HEIGHT = 450

export type SortKey = 'power' | 'temperature' | 'timestamp'
export type SortDirection = 'asc' | 'desc'

export type ActiveSort = {
  key: SortKey
  direction: SortDirection
}

export type SortState = ActiveSort | null

export function compareDevices(a: Device, b: Device, sort: ActiveSort) {
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

export type TelemetryChartData = ReturnType<typeof buildTelemetryChartData>[number]
export type TelemetryMetricKey = 'power' | 'temperature'
export type TelemetryAverageKey = 'rollingAvgPower' | 'rollingAvgTemperature'

export function buildTelemetryChartData(points: MetricPoint[]) {
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

export function getMetricDomain(data: TelemetryChartData[], valueKey: TelemetryMetricKey, averageKey: TelemetryAverageKey, padding: number): [number, number] {
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

function averageMetric(points: MetricPoint[], key: 'power' | 'temperature') {
  const values = points.map((point) => point[key]).filter((value): value is number => value !== null)
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function formatPower(value: number | null) { return value === null ? '—' : `${Math.round(value)} kW` }
export function formatTemperature(value: number | null) { return value === null ? '—' : `${value.toFixed(1)}°C` }
export function formatLastSeen(value: string | null) { return value === null ? '—' : new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) }
