import { Skeleton } from '@/components/ui/skeleton'

export function Default() {
  return <Skeleton style={{ width: 240, height: 16 }} />
}

export function CardPlaceholder() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 240 }}>
      <Skeleton style={{ width: '100%', height: 120, borderRadius: 12 }} />
      <Skeleton style={{ width: '70%', height: 14 }} />
      <Skeleton style={{ width: '45%', height: 14 }} />
    </div>
  )
}

export function AvatarRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Skeleton style={{ width: 40, height: 40, borderRadius: 9999 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton style={{ width: 120, height: 12 }} />
        <Skeleton style={{ width: 80, height: 10 }} />
      </div>
    </div>
  )
}
