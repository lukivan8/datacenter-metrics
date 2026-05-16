export type DeviceStatus = 'normal' | 'warning' | 'critical'
export type DeviceType = 'CRAC' | 'Network Switch' | 'UPS' | 'PDU' | null

export type Device = {
  id: string
  name: string | null
  type: DeviceType
  power: number | null
  temperature: number | null
  status: DeviceStatus
  timestamp: string | null
  lastSeenAt: string | null
}

export type DevicesSummary = {
  totalDevices: number
  onlineDevices: number
  warningDevices: number
  criticalDevices: number
  totalPower: number
  avgTemperature: number | null
}

export type DevicesParams = {
  page?: number
  pageSize?: number
  search?: string
  status?: DeviceStatus | 'all'
}

export type DevicesResponse = {
  summary: DevicesSummary
  items: Device[]
  page: number
  pageSize: number
  total: number
}

export type MetricPoint = {
  power: number | null
  temperature: number | null
  timestamp: string
  rollingAvgPower?: number | null
  rollingAvgTemperature?: number | null
}

export type DeviceMetricsResponse = {
  deviceId: string
  windowSeconds: number
  items: MetricPoint[]
}

export type DeviceLiveResponse = Device | MetricPoint

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { signal })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.json() as Promise<T>
}

function toSearchParams(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') searchParams.set(key, String(value))
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export function fetchDevices(params: DevicesParams = {}, signal?: AbortSignal) {
  const { page = 1, pageSize = 200, search, status } = params
  return getJson<DevicesResponse>(
    `/api/devices${toSearchParams({ page, pageSize, search, status: status === 'all' ? undefined : status })}`,
    signal,
  )
}

export function fetchDeviceLive(id: string, signal?: AbortSignal) {
  return getJson<DeviceLiveResponse>(`/api/devices/${encodeURIComponent(id)}/live`, signal)
}

export function fetchDeviceMetrics(id: string, windowSeconds = 60, signal?: AbortSignal) {
  return getJson<DeviceMetricsResponse>(`/api/devices/${encodeURIComponent(id)}/metrics${toSearchParams({ windowSeconds })}`, signal)
}
