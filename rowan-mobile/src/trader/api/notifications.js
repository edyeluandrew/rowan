import client from './client';

/** GET /api/v1/trader/notifications */
export async function getNotifications(page = 1, limit = 50) {
  const { data } = await client.get('/api/v1/trader/notifications', {
    params: { page, limit },
  });
  return data;
}

/** GET /api/v1/trader/notifications/unread */
export async function getUnreadNotificationCount() {
  const { data } = await client.get('/api/v1/trader/notifications/unread');
  return data?.count ?? 0;
}

/** POST /api/v1/trader/notifications/mark-read */
export async function markNotificationsRead(notificationIds) {
  const { data } = await client.post('/api/v1/trader/notifications/mark-read', {
    notificationIds,
  });
  return data;
}

/** PATCH /api/v1/trader/notifications/:id/read */
export async function markNotificationRead(id) {
  const { data } = await client.patch(`/api/v1/trader/notifications/${id}/read`);
  return data;
}

/** POST /api/v1/trader/notifications/mark-all-read */
export async function markAllNotificationsRead() {
  const { data } = await client.post('/api/v1/trader/notifications/mark-all-read');
  return data;
}
