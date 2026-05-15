import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { MetricList, TelemetryChart } from '@/components/dashboard/TelemetryChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDeviceLiveQuery, useDeviceLiveStream, useDeviceMetricsQuery } from '@/hooks/useDevices'
import type { Device } from '@/lib/api'
import { formatLastSeen, formatPower, formatTemperature, toDashboardStatus } from '@/lib/dashboard'

export function DeviceDetail({ device, open }: { device: Device; open: boolean }) {
  const [copiedId, setCopiedId] = useState(false)
  const metricsQuery = useDeviceMetricsQuery(device.id, 60, open)
  const liveQuery = useDeviceLiveQuery(device.id, open)
  useDeviceLiveStream(device.id, open)
  const metrics = metricsQuery.data ?? { deviceId: device.id, windowSeconds: 60, items: [] }
  const live = liveQuery.data && 'timestamp' in liveQuery.data ? liveQuery.data : device
  const liveStatus = 'status' in live && live.status ? live.status : device.status

  async function copyDeviceId() {
    await navigator.clipboard.writeText(device.id)
    setCopiedId(true)
    window.setTimeout(() => setCopiedId(false), 1200)
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-zinc-100">{device.name ?? 'Unnamed device'}</SheetTitle>
        <SheetDescription asChild>
          <div className="mt-1 flex items-center gap-2 text-zinc-500">
            <code className="min-w-0 flex-1 truncate rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-zinc-400">{device.id}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyDeviceId}
              className="h-7 w-7 shrink-0 border-white/[0.08] bg-[#0f1113] p-0 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
              aria-label="Copy device UUID"
              title="Copy UUID"
            >
              {copiedId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </SheetDescription>
      </SheetHeader>
      <div className="mt-5 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <DetailCard label="Power" value={formatPower(live.power)} />
          <DetailCard label="Temperature" value={formatTemperature(live.temperature)} />
          <DetailCard label="Timestamp" value={formatLastSeen(live.timestamp)} />
          <DetailCard label="Metric Points" value={String(metrics.items.length)} />
        </div>
        <Card className="border-0 bg-[#0f1113] shadow-none">
          <CardHeader className="p-3"><CardTitle className="text-xs font-medium text-zinc-400">Status</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3 pt-0"><StatusBadge status={toDashboardStatus(liveStatus)} /></CardContent>
        </Card>
        <Card className="border-0 bg-[#0f1113] shadow-none">
          <CardHeader className="p-3"><CardTitle className="text-xs font-medium text-zinc-400">Live telemetry · Last {metrics.windowSeconds} seconds {metricsQuery.isFetching ? '· loading' : ''}</CardTitle></CardHeader>
          <CardContent className="space-y-4 px-3 pb-3 pt-0">
            <TelemetryChart points={metrics.items} />
            <MetricList points={metrics.items} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-0 bg-[#0f1113] shadow-none">
      <CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</CardTitle></CardHeader>
      <CardContent className="px-3 pb-3 pt-0"><p className="text-sm font-semibold tabular-nums text-zinc-200">{value}</p></CardContent>
    </Card>
  )
}
