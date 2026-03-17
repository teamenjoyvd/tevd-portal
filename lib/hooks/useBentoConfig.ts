import { useQuery } from '@tanstack/react-query'

export type BentoConfigEntry = {
  tile_key: string
  max_items: number
}

export function useBentoConfig() {
  return useQuery<BentoConfigEntry[]>({
    queryKey: ['bento-config'],
    queryFn: () => fetch('/api/admin/bento-config').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })
}

export function useTileMaxItems(tileKey: string, fallback = 3): number {
  const { data } = useBentoConfig()
  return data?.find(e => e.tile_key === tileKey)?.max_items ?? fallback
}
