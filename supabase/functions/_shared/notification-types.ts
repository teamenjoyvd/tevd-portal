export interface NotificationQueueItem {
  id: string;
  profile_id: string | null;
  registration_id: string | null;
  event_id: string | null;
  type: 'event_reminder_1h' | 'event_reminder_15m' | 'doc_expiry';
  channel: 'email' | 'in_app';
  status: 'pending' | 'claimed' | 'sent' | 'failed' | 'permanently_failed';
  payload: Record<string, any>;
  send_at: string;
  sent_at: string | null;
  claimed_at: string | null;
  claimed_by: string | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}
