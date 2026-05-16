import { RefreshCw, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDevicesQuery } from '@/hooks/useDevices'
import { formatLastSeen, type DashboardDeviceStatus } from '@/lib/dashboard'
import { useDashboardStore } from '@/stores/dashboardStore'

export function DashboardHeader() {
  const search = useDashboardStore((state) => state.search)
  const statusFilter = useDashboardStore((state) => state.statusFilter)
  const setSearch = useDashboardStore((state) => state.setSearch)
  const setStatusFilter = useDashboardStore((state) => state.setStatusFilter)
  const devicesQuery = useDevicesQuery({ pageSize: 50_000 })

  return (
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
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
