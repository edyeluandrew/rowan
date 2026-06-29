import client from './client'

export async function getCurrentRates(currency = 'UGX') {
  const { data } = await client.get('/api/v1/rates/current', {
    params: { currency },
  })
  return data
}

export async function getAllRates() {
  const { data } = await client.get('/api/v1/rates/all')
  return data
}
