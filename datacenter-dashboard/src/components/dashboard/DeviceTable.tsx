import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowDownUp, ArrowUp } from 'lucide-react'

import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDashboardDevices } from '@/hooks/useDashboardDevices'
import { usePrefetchDeviceDetails } from '@/hooks/useDevices'
import type { Device } from '@/lib/api'
import { formatLastSeen, formatPower, formatTemperature, toDashboardStatus, VIRTUAL_LIST_MIN_HEIGHT, VIRTUAL_OVERSCAN, VIRTUAL_ROW_HEIGHT, type SortKey, type SortState } from '@/lib/dashboard'
import { useDashboardStore } from '@/stores/dashboardStore'

export function DeviceTable() {
  const listRef = useRef<HTMLDivElement | null>(null)
  const sort = useDashboardStore((state) => state.sort)
  const page = useDashboardStore((state) => state.page)
  const toggleSort = useDashboardStore((state) => state.toggleSort)
  const openDevice = useDashboardStore((state) => state.openDevice)
  const { devicesQuery, filteredDevices, pagedDevices } = useDashboardDevices()
  const prefetchDeviceDetails = usePrefetchDeviceDetails()
  const rowVirtualizer = useVirtualizer({
    count: pagedDevices.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => VIRTUAL_ROW_HEIGHT,
    overscan: VIRTUAL_OVERSCAN,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const topPadding = virtualRows[0]?.start ?? 0
  const bottomPadding = virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0) : 0

  // biome-ignore lint/correctness/useExhaustiveDependencies: page/filter changes intentionally reset the virtual scroll position.
  useEffect(() => {
    rowVirtualizer.scrollToOffset(0)
  }, [page, filteredDevices.length, rowVirtualizer])

  return (
    <div
      ref={listRef}
      className="overflow-y-auto bg-[#0d0f11]"
      style={{ minHeight: VIRTUAL_LIST_MIN_HEIGHT }}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-[#17181b]">
          <TableRow className="border-white/[0.07] hover:bg-transparent">
            <TableHead className="sticky top-0 h-7 bg-[#17181b] px-3 text-[9px] font-medium uppercase tracking-[0.18em] text-zinc-600 sm:px-4">Device</TableHead>
            <SortableHead label="Power" sortKey="power" sort={sort} onSort={toggleSort} />
            <SortableHead label="Temperature" sortKey="temperature" sort={sort} onSort={toggleSort} />
            <TableHead className="sticky top-0 h-7 bg-[#17181b] px-3 text-[9px] font-medium uppercase tracking-[0.18em] text-zinc-600 sm:px-4">Status</TableHead>
            <SortableHead label="Last Seen" sortKey="timestamp" sort={sort} onSort={toggleSort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {devicesQuery.isError && <TableMessage message="Unable to load devices" />}
          {devicesQuery.isLoading && <TableMessage message="Loading device telemetry…" />}
          {!devicesQuery.isLoading && !devicesQuery.isError && filteredDevices.length === 0 && <TableMessage message="No devices match the current filters" />}
          {topPadding > 0 && <TableSpacer height={topPadding} />}
          {virtualRows.map((virtualRow) => {
            const device = pagedDevices[virtualRow.index]
            return <DeviceRow key={device.id} device={device} onOpen={openDevice} onPrefetch={prefetchDeviceDetails} />
          })}
          {bottomPadding > 0 && <TableSpacer height={bottomPadding} />}
        </TableBody>
      </Table>
    </div>
  )
}

function SortableHead({ label, sortKey, sort, onSort }: { label: string; sortKey: SortKey; sort: SortState; onSort: (key: SortKey) => void }) {
  const isActive = sort?.key === sortKey
  const Icon = isActive ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowDownUp

  return (
    <TableHead
      className="sticky top-0 h-7 bg-[#17181b] px-3 text-[9px] font-medium uppercase tracking-[0.18em] text-zinc-600 sm:px-4"
      aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 uppercase tracking-[0.18em] transition-colors hover:text-zinc-300"
      >
        {label}
        <Icon className={`h-3 w-3 ${isActive ? 'text-zinc-400' : 'text-zinc-700'}`} />
      </button>
    </TableHead>
  )
}

function TableMessage({ message }: { message: string }) {
  return (
    <TableRow className="border-white/[0.055] hover:bg-transparent">
      <TableCell colSpan={5} className="px-4 py-8 text-center text-xs text-zinc-500">{message}</TableCell>
    </TableRow>
  )
}

function TableSpacer({ height }: { height: number }) {
  return (
    <TableRow className="border-0 hover:bg-transparent" aria-hidden="true">
      <TableCell colSpan={5} style={{ height, padding: 0 }} />
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
          <span>{device.name ?? 'Unnamed device'}</span>
        </div>
      </TableCell>
      <TableCell className="px-3 py-1.5 tabular-nums text-zinc-400 sm:px-4">{formatPower(device.power)}</TableCell>
      <TableCell className="px-3 py-1.5 tabular-nums text-zinc-400 sm:px-4">{formatTemperature(device.temperature)}</TableCell>
      <TableCell className="px-3 py-1.5 sm:px-4"><StatusBadge status={toDashboardStatus(device.status)} /></TableCell>
      <TableCell className="px-3 py-1.5 tabular-nums text-zinc-500 sm:px-4">{formatLastSeen(device.timestamp ?? device.lastSeenAt)}</TableCell>
    </TableRow>
  )
}
