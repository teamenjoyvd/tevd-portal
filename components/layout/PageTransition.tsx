// SEQ283: PageTransition gutted — was calling startViewTransition(() => {}) in a
// useEffect after navigation completed, causing full-page flicker on every route change.
// The View Transition API requires the DOM mutation to happen *inside* the callback.
// A useEffect-on-pathname pattern fires after Next.js has already committed the new page,
// so the browser was snapshotting stale content and fighting React's repaint.
// The trips image morph is handled at the call site (navigateWithTransition in TripsClient
// and TripDetailClient). No global page transition wrapper is used.

export default function PageTransition({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
