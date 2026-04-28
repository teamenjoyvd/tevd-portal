import { redirect } from 'next/navigation'
// /guides permanently redirected to /library via next.config.ts. Safety net stub.
export default function GuidesPage() { redirect('/library') }
