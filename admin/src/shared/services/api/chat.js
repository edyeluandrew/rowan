import client from '../client'

export function getChatMessages(transactionId, params = {}) {
  return client.get(`/api/v1/chat/${transactionId}/messages`, { params })
}
