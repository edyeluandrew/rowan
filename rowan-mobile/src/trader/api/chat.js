import client from './client'

export function getChatMessages(transactionId, params = {}) {
  return client.get(`/api/v1/chat/${transactionId}/messages`, { params }).then((res) => res.data?.data || [])
}

export function sendChatMessage(transactionId, message) {
  return client.post(`/api/v1/chat/${transactionId}/messages`, { message }).then((res) => res.data?.data)
}

export function sendChatImage(transactionId, file) {
  const form = new FormData()
  form.append('file', file)
  return client.post(`/api/v1/chat/${transactionId}/messages/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((res) => res.data?.data)
}
