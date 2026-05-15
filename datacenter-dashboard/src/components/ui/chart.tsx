import * as React from 'react'
import * as RechartsPrimitive from 'recharts'

import { cn } from '@/lib/utils'

export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string }>

type ChartContextProps = { config: ChartConfig }

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error('useChart must be used within a <ChartContainer />')
  return context
}

function ChartContainer({ id, className, children, config, ...props }: React.ComponentProps<'div'> & { config: ChartConfig; children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'] }) {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div data-chart={chartId} className={cn('flex aspect-video justify-center text-xs', className)} {...props}>
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, itemConfig]) => itemConfig.color)
  if (!colorConfig.length) return null

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: colorConfig.map(([key, itemConfig]) => `[data-chart=${id}] { --color-${key}: ${itemConfig.color}; }`).join('\n'),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

type ChartTooltipContentProps = React.ComponentProps<'div'> & {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; name?: string | number; value?: unknown; color?: string }>
  label?: React.ReactNode
}

function ChartTooltipContent({ active, payload, label, className }: ChartTooltipContentProps) {
  const { config } = useChart()

  if (!active || !payload?.length) return null

  return (
    <div className={cn('grid min-w-32 gap-1.5 rounded-lg border border-white/[0.08] bg-[#0b0c0e] px-2.5 py-2 text-xs shadow-xl', className)}>
      {label && <div className="font-medium text-zinc-300">{label}</div>}
      <div className="grid gap-1.5">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? '')
          const itemConfig = config[key]
          return (
            <div key={key} className="flex items-center gap-2 text-zinc-400">
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
              <span>{itemConfig?.label ?? item.name}</span>
              <span className="ml-auto font-mono text-zinc-200">{typeof item.value === 'number' ? item.value.toFixed(1) : String(item.value ?? '—')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
