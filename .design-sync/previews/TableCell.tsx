// TableCell is a bare <td> with no visible content of its own — it only
// renders meaningfully composed inside a full Table (same composition as
// Table's own preview; see .design-sync/previews/Table.tsx).
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table'

export function Default() {
  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-card)',
        overflow: 'hidden',
        width: 480,
      }}
    >
      <Table>
        <TableCaption>Recent payments for this trip.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Traveler</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Jamie Doe</TableCell>
            <TableCell>$450.00</TableCell>
            <TableCell>Paid</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Alex Chen</TableCell>
            <TableCell>$450.00</TableCell>
            <TableCell>Pending</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
