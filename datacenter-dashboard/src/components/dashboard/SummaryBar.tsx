import { useDashboardDevices } from '@/hooks/useDashboardDevices'
import { formatTemperature } from '@/lib/dashboard'

export function SummaryBar() {
  const { devicesQuery, devicesResponse, filteredDevices, pagedDevices, totalDevices } = useDashboardDevices()

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.07] bg-[#0f1113] px-3 py-1.5 text-[11px] text-zinc-500 sm:px-4">
      <SummaryItem label="Total" value={devicesResponse?.summary.totalDevices ?? '—'} />
      <SummaryItem label="Online" value={devicesResponse?.summary.onlineDevices ?? '—'} />
      <SummaryItem label="Warning" value={devicesResponse?.summary.warningDevices ?? '—'} />
      <SummaryItem label="Critical" value={devicesResponse?.summary.criticalDevices ?? '—'} />
      <SummaryItem label="Power" value={devicesResponse ? `${Math.round(devicesResponse.summary.totalPower)} kW` : '—'} />
      <SummaryItem label="Avg Temp" value={formatTemperature(devicesResponse?.summary.avgTemperature ?? null)} />
      <span className="ml-auto text-zinc-600">Showing {pagedDevices.length} / {filteredDevices.length} filtered · {totalDevices} total</span>
      {devicesQuery.isFetching && <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-500">Loading</span>}
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string | number }) {
  return <span><span className="text-zinc-600">{label}</span> <span className="font-medium tabular-nums text-zinc-400">{value}</span></span>
}
