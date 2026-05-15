import type { DevicesParams } from '@/lib/api'

export const devicesKeys = {
  all: ['devices'] as const,
  lists: () => [...devicesKeys.all, 'list'] as const,
  list: (params: DevicesParams = {}) => [...devicesKeys.lists(), params] as const,
  live: (id: string) => [...devicesKeys.all, 'live', id] as const,
  metrics: (id: string, windowSeconds = 60) => [...devicesKeys.all, 'metrics', id, windowSeconds] as const,
}
