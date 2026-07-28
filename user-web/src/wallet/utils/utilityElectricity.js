/** Client-side prepaid electricity unit estimates (mirrors backend). */
const UNIT_RATES = {
  UG: { perUnit: 800, label: 'units' },
  KE: { perUnit: 25, label: 'kWh' },
  TZ: { perUnit: 300, label: 'units' },
}

export function isPrepaidElectricityBiller(biller) {
  if (!biller) return false
  return (
    String(biller.type || '').toUpperCase() === 'ELECTRICITY_BILL_PAYMENT'
    && String(biller.serviceType || '').toUpperCase() === 'PREPAID'
  )
}

export function estimatePrepaidUnits({ countryCode, fiatAmount, biller }) {
  if (!isPrepaidElectricityBiller(biller)) return null
  const code = String(countryCode || biller.countryCode || 'UG').toUpperCase()
  const rate = UNIT_RATES[code]
  const amount = Number(fiatAmount)
  if (!rate || !Number.isFinite(amount) || amount <= 0) return null
  const units = Math.round((amount / rate.perUnit) * 10) / 10
  return {
    units,
    unitLabel: rate.label,
    summary: `~${units.toLocaleString('en-US')} ${rate.label}`,
    isEstimate: true,
  }
}
