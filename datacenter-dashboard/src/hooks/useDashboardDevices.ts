import { useMemo } from 'react'

import { useDevicesQuery } from '@/hooks/useDevices'
import { compareDevices, DEVICES_PER_PAGE, toDashboardStatus } from '@/lib/dashboard'
import { useDashboardStore } from '@/stores/dashboardStore'

export function useDashboardDevices() {
  const search = useDashboardStore((state) => state.search)
  const statusFilter = useDashboardStore((state) => state.statusFilter)
  const sort = useDashboardStore((state) => state.sort)
  const page = useDashboardStore((state) => state.page)
  const query = search.trim().toLowerCase()
  const devicesQuery = useDevicesQuery({ pageSize: 50_000 })
  const devicesResponse = devicesQuery.data
  const devices = devicesResponse?.items ?? []

  const filteredDevices = useMemo(() => {
    return devices
      .filter((device) => {
        const matchesSearch = !query || device.id.toLowerCase().includes(query) || (device.name ?? '').toLowerCase().includes(query)
        const matchesStatus = statusFilter === 'all' || toDashboardStatus(device.status) === statusFilter
        return matchesSearch && matchesStatus
      })
      .toSorted((a, b) => (sort ? compareDevices(a, b, sort) : 0))
  }, [devices, query, statusFilter, sort])

  const totalDevices = devicesResponse?.total ?? devices.length
  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / DEVICES_PER_PAGE))
  const pageStart = (page - 1) * DEVICES_PER_PAGE
  const pagedDevices = filteredDevices.slice(pageStart, pageStart + DEVICES_PER_PAGE)

  return {
    devicesQuery,
    devicesResponse,
    devices,
    filteredDevices,
    pagedDevices,
    totalDevices,
    totalPages,
  }
}
