/** SQLSTATEs raised by the ticketing functions (migration 20261124000000). */
const TICKET_ERRORS = {
  TK001: 'void',
  TK002: 'not_ticketed',
  TK003: 'cancelled',
  TK004: 'not_covered',
  TK005: 'expired',
  TK006: 'outside_window',
  TK007: 'no_entries',
  TK008: 'full',
  TK009: 'duplicate_email',
  TK010: 'invalid_input',
  TK011: 'not_found',
} as const

export type TicketErrorCode = (typeof TICKET_ERRORS)[keyof typeof TICKET_ERRORS]

export function ticketErrorCode(error: { code?: string } | null | undefined): TicketErrorCode | null {
  const code = error?.code
  return code !== undefined && Object.hasOwn(TICKET_ERRORS, code)
    ? TICKET_ERRORS[code as keyof typeof TICKET_ERRORS]
    : null
}
