import client from './client';

/** GET /api/v1/trader/notifications */
export async function getNotifications(page = 1, limit = 50, unreadOnly = false) {
  const { data } = await client.get('/api/v1/trader/notifications', {
    params: { page, limit, unreadOnly },
  });
  return data;
}

/** POST /api/v1/trader/notifications/mark-read */
export async function markNotificationsRead(notificationIds) {
  const { data } = await client.post('/api/v1/trader/notifications/mark-read', {
    notificationIds,
  });
  return data;
}

/** POST /api/v1/trader/notifications/mark-all-read */
export async function markAllNotificationsRead() {
  const { data } = await client.post('/api/v1/trader/notifications/mark-all-read');
  return data;
}
