import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useDashboardDevices } from '@/hooks/useDashboardDevices'
import { DEVICES_PER_PAGE } from '@/lib/dashboard'
import { useDashboardStore } from '@/stores/dashboardStore'

export function Pagination() {
  const page = useDashboardStore((state) => state.page)
  const setPage = useDashboardStore((state) => state.setPage)
  const clampPage = useDashboardStore((state) => state.clampPage)
  const { devicesQuery, totalPages } = useDashboardDevices()

  useEffect(() => {
    clampPage(totalPages)
  }, [clampPage, totalPages])

  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] bg-[#0f1113] px-3 py-2 text-[11px] text-zinc-500 sm:px-4">
      <span className="tabular-nums">Page {page} of {totalPages} · {DEVICES_PER_PAGE} per page</span>
      <div className="flex items-center gap-1.5">
        <IconPageButton label="First page" onClick={() => setPage(1)} disabled={page === 1 || devicesQuery.isFetching}><ChevronsLeft className="h-3.5 w-3.5" /></IconPageButton>
        <IconPageButton label="Previous page" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1 || devicesQuery.isFetching}><ChevronLeft className="h-3.5 w-3.5" /></IconPageButton>
        <IconPageButton label="Next page" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages || devicesQuery.isFetching}><ChevronRight className="h-3.5 w-3.5" /></IconPageButton>
        <IconPageButton label="Last page" onClick={() => setPage(totalPages)} disabled={page === totalPages || devicesQuery.isFetching}><ChevronsRight className="h-3.5 w-3.5" /></IconPageButton>
      </div>
    </div>
  )
}

function IconPageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="h-7 w-7 border-white/[0.08] bg-[#0f1113] p-0 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
    >
      {children}
    </Button>
  )
}
