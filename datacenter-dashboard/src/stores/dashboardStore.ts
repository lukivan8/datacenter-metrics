import { create } from 'zustand'

import type { Device } from '@/lib/api'
import type { DashboardDeviceStatus, SortKey, SortState } from '@/lib/dashboard'

type PageUpdate = number | ((current: number) => number)

type DashboardState = {
  search: string
  statusFilter: DashboardDeviceStatus | 'all'
  sort: SortState
  page: number
  selectedDeviceId: string | null
  detailOpen: boolean
  setSearch: (search: string) => void
  setStatusFilter: (statusFilter: DashboardDeviceStatus | 'all') => void
  toggleSort: (key: SortKey) => void
  setPage: (page: PageUpdate) => void
  clampPage: (totalPages: number) => void
  openDevice: (device: Device) => void
  setDetailOpen: (open: boolean) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  search: '',
  statusFilter: 'all',
  sort: null,
  page: 1,
  selectedDeviceId: null,
  detailOpen: false,
  setSearch: (search) => set({ search, page: 1 }),
  setStatusFilter: (statusFilter) => set({ statusFilter, page: 1 }),
  toggleSort: (key) => set((state) => {
    if (state.sort?.key !== key) return { sort: { key, direction: 'desc' } }
    if (state.sort.direction === 'desc') return { sort: { key, direction: 'asc' } }
    return { sort: null }
  }),
  setPage: (page) => set((state) => ({ page: typeof page === 'function' ? page(state.page) : page })),
  clampPage: (totalPages) => set((state) => (state.page > totalPages ? { page: totalPages } : {})),
  openDevice: (device) => set({ selectedDeviceId: device.id, detailOpen: true }),
  setDetailOpen: (detailOpen) => set({ detailOpen }),
}))
