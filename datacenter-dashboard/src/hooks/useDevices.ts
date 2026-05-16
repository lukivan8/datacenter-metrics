import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { calculateTelemetryStatus } from '@lukivan8-datacenter/shared'

import { API_BASE_URL, fetchDeviceLive, fetchDeviceMetrics, fetchDevices, type Device, type DeviceLiveResponse, type DeviceMetricsResponse, type DevicesParams, type DevicesResponse, type DeviceStatus, type MetricPoint } from '@/lib/api'
import { devicesKeys } from '@/lib/queries'

export function useDevicesQuery(params: DevicesParams = {}) {
  return useQuery({
    queryKey: devicesKeys.list(params),
    queryFn: ({ signal }) => fetchDevices(params, signal),
    staleTime: 5_000,
  })
}

export function useDeviceMetricsQuery(id: string | undefined, windowSeconds = 60, enabled = true) {
  return useQuery({
    queryKey: devicesKeys.metrics(id ?? '', windowSeconds),
    queryFn: ({ signal }) => {
      if (!id) throw new Error('Device id is required')
      return fetchDeviceMetrics(id, windowSeconds, signal)
    },
    enabled: Boolean(id) && enabled,
    staleTime: 5_000,
    refetchInterval: enabled ? 15_000 : false,
  })
}

export function useDeviceLiveQuery(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: devicesKeys.live(id ?? ''),
    queryFn: ({ signal }) => {
      if (!id) throw new Error('Device id is required')
      return fetchDeviceLive(id, signal)
    },
    enabled: Boolean(id) && enabled,
    staleTime: 5_000,
    refetchInterval: enabled ? 15_000 : false,
  })
}

export function usePrefetchDeviceDetails() {
  const queryClient = useQueryClient()

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: devicesKeys.metrics(id, 60),
      queryFn: ({ signal }) => fetchDeviceMetrics(id, 60, signal),
      staleTime: 5_000,
    })
    queryClient.prefetchQuery({
      queryKey: devicesKeys.live(id),
      queryFn: ({ signal }) => fetchDeviceLive(id, signal),
      staleTime: 5_000,
    })
  }
}

export function useDeviceLiveStream(deviceId: string | undefined, enabled: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!deviceId || !enabled) return

    const source = new EventSource(`${API_BASE_URL}/api/devices/${encodeURIComponent(deviceId)}/live/stream`)

    source.onmessage = (event) => {
      const metric = normalizeMetric(JSON.parse(event.data))
      if (!metric) return

      const status = calculateDeviceStatus(metric.power, metric.temperature)

      queryClient.setQueryData(devicesKeys.live(deviceId), (current: DeviceLiveResponse | undefined) => ({ ...current, ...metric, status }))

      queryClient.setQueriesData({ queryKey: devicesKeys.lists() }, (current: DevicesResponse | undefined) => {
        if (!current) return current
        return {
          ...current,
          items: current.items.map((device) =>
            device.id === deviceId
              ? { ...device, power: metric.power, temperature: metric.temperature, status, timestamp: metric.timestamp, lastSeenAt: metric.timestamp }
              : device,
          ),
        }
      })

      queryClient.setQueryData(devicesKeys.metrics(deviceId, 60), (current: DeviceMetricsResponse | undefined) => {
        const cutoff = Date.now() - 60_000
        const existing = current ?? { deviceId, windowSeconds: 60, items: [] }
        return {
          ...existing,
          items: [...existing.items, metric].filter((point) => new Date(point.timestamp).getTime() >= cutoff),
        }
      })
    }

    source.onerror = () => source.close()
    return () => source.close()
  }, [deviceId, enabled, queryClient])
}

function calculateDeviceStatus(power: number | null, temperature: number | null): DeviceStatus {
  return calculateTelemetryStatus({ power: power ?? Number.NEGATIVE_INFINITY, temperature: temperature ?? Number.NEGATIVE_INFINITY })
}

function normalizeMetric(value: unknown): MetricPoint | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Partial<MetricPoint> & Partial<Device> & { rolling_avg_power?: number | null; rolling_avg_temperature?: number | null }
  if (!data.timestamp) return null
  return {
    power: data.power ?? null,
    temperature: data.temperature ?? null,
    timestamp: data.timestamp,
    rollingAvgPower: data.rollingAvgPower ?? data.rolling_avg_power ?? null,
    rollingAvgTemperature: data.rollingAvgTemperature ?? data.rolling_avg_temperature ?? null,
  }
}
