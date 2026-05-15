import type { DeviceMetricsResponse, DevicesResponse, DeviceStatus, MetricPoint } from '@lukivan8-datacenter/shared'

export type { DeviceMetricsResponse, DevicesResponse, DeviceStatus, MetricPoint }
export type DashboardDeviceStatus = DeviceStatus | 'offline'
export type Device = DevicesResponse['items'][number]

const now = Date.now()
const iso = (offsetSeconds: number) => new Date(now - offsetSeconds * 1000).toISOString()

export const mockDevicesResponse: DevicesResponse = {
  summary: {
    totalDevices: 8,
    onlineDevices: 7,
    warningDevices: 2,
    criticalDevices: 1,
    avgPower: 13.63,
    avgTemperature: 27.21,
    totalPower: 95.4,
  },
  items: [
    { id: 'rack-a1-pdu', name: 'Rack A1 PDU', power: 7.4, temperature: 25.8, timestamp: iso(3), status: 'normal' },
    { id: 'rack-a2-pdu', name: 'Rack A2 PDU', power: 8.1, temperature: 26.2, timestamp: iso(8), status: 'normal' },
    { id: 'crac-a', name: 'CRAC A', power: 18.4, temperature: 21.8, timestamp: iso(12), status: 'normal' },
    { id: 'crac-b', name: 'CRAC B', power: 19.1, temperature: 22.6, timestamp: iso(42), status: 'warning' },
    { id: 'ups-a', name: 'UPS A', power: 42.8, temperature: 27.4, timestamp: iso(16), status: 'normal' },
    { id: 'ups-b', name: 'UPS B', power: 46.6, temperature: 28.6, timestamp: iso(36), status: 'critical' },
    { id: 'switch-a', name: 'Switch A', power: 1.2, temperature: 31.5, timestamp: iso(4), status: 'warning' },
    { id: 'switch-b', name: 'Switch B', power: null, temperature: null, timestamp: null, status: null },
  ],
  page: 1,
  pageSize: 50,
  total: 8,
}

export function makeMockMetrics(deviceId: string, windowSeconds = 60): DeviceMetricsResponse {
  const device = mockDevicesResponse.items.find((item) => item.id === deviceId)
  const power = device?.power ?? 0
  const temperature = device?.temperature ?? 0
  const count = 12
  const items: MetricPoint[] = Array.from({ length: count }, (_, index) => {
    const secondsAgo = windowSeconds - index * (windowSeconds / count)
    const wave = Math.sin(index / 1.7)
    return {
      id: `${deviceId}-${index}`,
      device_id: deviceId,
      power: device?.power == null ? null : Number((power + wave * 0.6).toFixed(2)),
      temperature: device?.temperature == null ? null : Number((temperature + wave * 0.35).toFixed(2)),
      timestamp: iso(secondsAgo),
      received_at: iso(Math.max(0, secondsAgo - 1)),
      rolling_avg_power: device?.power == null ? null : Number((power + wave * 0.25).toFixed(2)),
      rolling_avg_temperature: device?.temperature == null ? null : Number((temperature + wave * 0.15).toFixed(2)),
    }
  })
  return { deviceId, windowSeconds, items }
}

export function toDashboardStatus(status: Device['status']): DashboardDeviceStatus {
  return status ?? 'offline'
}
