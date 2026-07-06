export function buildInAppMessage(
  type: string,
  payload: Record<string, any>
): { title: string; message: string; action_url: string } {
  if (type === 'doc_expiry') {
    return {
      title: 'Document Expiring Soon',
      message: 'Your ' + (payload.document_name || 'Travel Document') + ' is expiring soon. Please update it in your profile.',
      action_url: '/profile',
    };
  } else {
    return {
      title: payload.title || 'Notification',
      message: payload.message || payload.body || '',
      action_url: payload.action_url || '/',
    };
  }
}
