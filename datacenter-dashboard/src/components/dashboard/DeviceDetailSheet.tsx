import { DeviceDetail } from '@/components/dashboard/DeviceDetail'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useDashboardDevices } from '@/hooks/useDashboardDevices'
import { useDashboardStore } from '@/stores/dashboardStore'

export function DeviceDetailSheet() {
  const detailOpen = useDashboardStore((state) => state.detailOpen)
  const selectedDeviceId = useDashboardStore((state) => state.selectedDeviceId)
  const setDetailOpen = useDashboardStore((state) => state.setDetailOpen)
  const { devices } = useDashboardDevices()
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? null

  return (
    <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
      <SheetContent className="overflow-y-auto border-white/[0.08] bg-[#0b0c0e] text-zinc-100">
        {selectedDevice && <DeviceDetail device={selectedDevice} open={detailOpen} />}
      </SheetContent>
    </Sheet>
  )
}
