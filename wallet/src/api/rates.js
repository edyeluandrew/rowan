import client from './client'

export function getCurrentRates() {
  return client.get('/api/v1/rates/current')
}

export function getAllRates() {
  return client.get('/api/v1/rates/all')
}
