import client from './client'

/**
 * Non-committing Express match preview.
 * Buy: { side: 'buy', network, fiatAmount }
 * Sell: { side: 'sell', network, usdcAmount }
 */
export function previewExpress(body) {
  return client.post('/api/v1/express/preview', body).then((res) => res.data)
}
