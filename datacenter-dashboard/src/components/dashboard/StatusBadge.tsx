import { Badge } from '@/components/ui/badge'
import { statusClasses, statusVariant, type DashboardDeviceStatus } from '@/lib/dashboard'

export function StatusBadge({ status }: { status: DashboardDeviceStatus }) {
  return <Badge variant={statusVariant[status]} className={`h-4 rounded px-1.5 text-[9px] font-medium uppercase tracking-wide ${statusClasses[status]}`}>{status}</Badge>
}
