import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { DeviceDetailSheet } from '@/components/dashboard/DeviceDetailSheet'
import { DeviceTable } from '@/components/dashboard/DeviceTable'
import { Pagination } from '@/components/dashboard/Pagination'
import { SummaryBar } from '@/components/dashboard/SummaryBar'

function App() {
  return (
    <main className="min-h-screen bg-[#050506] p-2 text-zinc-100 sm:p-4">
      <section className="mx-auto max-w-[1500px] overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0b0c0e] shadow-2xl shadow-black/40">
        <DashboardHeader />
        <SummaryBar />
        <DeviceTable />
        <Pagination />
      </section>

      <DeviceDetailSheet />
    </main>
  )
}

export default App
