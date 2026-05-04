      const { token } = await apiClient<{ token: string }>('/api/profile/event-shares', {
        method: 'POST',
        body: JSON.stringify({ event_id: eventId, share_method: method }),
      })