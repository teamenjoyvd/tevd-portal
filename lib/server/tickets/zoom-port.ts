/**
 * The only way ticket code reaches Zoom. Implemented in #774.
 * `register` must be idempotent per (event, email); see ADR-017.
 */
export type ZoomRegistration = { ref: string; joinLink: string }

export interface ZoomPort {
  register(input: { eventId: string; admissionId: string; name: string; email: string }): Promise<ZoomRegistration>
  cancel(input: { eventId: string; ref: string }): Promise<void>
}
