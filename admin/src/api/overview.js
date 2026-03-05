import client from './client'

export function getOverview() {
  return client.get('/api/v1/admin/overview')
}
