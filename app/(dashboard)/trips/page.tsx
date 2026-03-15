import Link from 'next/link'

export default function TripsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-serif text-deep mb-1">Trips</h1>
      <p className="text-sm text-stone mb-8">Available trips and your registrations.</p>
      <div className="text-center py-16 text-stone">
        <p className="font-medium">No trips available yet</p>
        <p className="text-sm mt-1">Check back soon.</p>
      </div>
    </div>
  )
}