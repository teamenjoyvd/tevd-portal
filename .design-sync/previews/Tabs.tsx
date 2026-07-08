'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export function Default() {
  return (
    <Tabs defaultValue="overview" style={{ width: 360 }}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="guests">Guests</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Trip summary and key dates.
        </p>
      </TabsContent>
      <TabsContent value="guests">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Guest list and RSVP status.
        </p>
      </TabsContent>
      <TabsContent value="payments">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Payment history for this trip.
        </p>
      </TabsContent>
    </Tabs>
  )
}
