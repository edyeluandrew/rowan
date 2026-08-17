/** Rowan Yaka/bill fee: 1% of token, min 200 UGX, max 2,000 UGX. */

export function rowanBillFeeFiat(amount, config = {}) {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return 0
  const percent = Number(config.billFeePercent ?? 1)
  const minFiat = Number(config.billFeeMinFiat ?? 200)
  const maxFiat = Number(config.billFeeMaxFiat ?? 2000)
  return Math.min(maxFiat, Math.max(minFiat, Math.round(n * (percent / 100))))
}

/** MarzPay bill fee + Rowan cut — one service fee shown to the customer. */
export function billServiceFeeFiat(amount, config = {}) {
  const marz = Number(config.marzPayBillFeeFiat ?? 1200)
  return marz + rowanBillFeeFiat(amount, config)
}

export function maxBillAmountForWallet(walletFiat, config = {}) {
  const marz = Number(config.marzPayBillFeeFiat ?? 1200)
  const budget = Number(walletFiat) - marz
  if (!Number.isFinite(budget) || budget <= 0) return 0
  let token = Math.floor(budget)
  for (let i = 0; i < 3; i += 1) {
    const fee = rowanBillFeeFiat(token, config)
    token = Math.max(0, Math.floor(budget - fee))
  }
  return token
}
