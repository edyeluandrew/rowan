/**
 * Prepaid electricity estimates and Reloadly receipt parsing.
 */

/** Approximate local-currency cost per kWh/unit (indicative — actual tariff varies). */
const UNIT_RATES = {
  UG: { currency: 'UGX', perUnit: 800, label: 'units' },
  KE: { currency: 'KES', perUnit: 25, label: 'kWh' },
  TZ: { currency: 'TZS', perUnit: 300, label: 'units' },
};

export function isPrepaidElectricity(biller) {
  if (!biller) return false;
  const type = String(biller.type || '').toUpperCase();
  const service = String(biller.serviceType || '').toUpperCase();
  return type === 'ELECTRICITY_BILL_PAYMENT' && service === 'PREPAID';
}

export function estimatePrepaidElectricity({ countryCode, fiatAmount, serviceType, billerType }) {
  const service = String(serviceType || '').toUpperCase();
  const type = String(billerType || 'ELECTRICITY_BILL_PAYMENT').toUpperCase();
  if (service !== 'PREPAID' || type !== 'ELECTRICITY_BILL_PAYMENT') {
    return null;
  }

  const code = String(countryCode || 'UG').trim().toUpperCase();
  const rate = UNIT_RATES[code];
  const amount = Number(fiatAmount);
  if (!rate || !Number.isFinite(amount) || amount <= 0) return null;

  const units = amount / rate.perUnit;
  return {
    units: Math.round(units * 10) / 10,
    unitLabel: rate.label,
    currency: rate.currency,
    ratePerUnit: rate.perUnit,
    isEstimate: true,
    summary: `~${(Math.round(units * 10) / 10).toLocaleString('en-US')} ${rate.label} (est.)`,
  };
}

export function extractElectricityDelivery(reloadlyPayload) {
  if (!reloadlyPayload) return null;

  const tx = reloadlyPayload.transaction || reloadlyPayload;
  const billDetails = tx.billDetails || reloadlyPayload.billDetails;
  const pinDetails = billDetails?.pinDetails;
  if (!pinDetails) return null;

  const info1 = pinDetails.info1 || pinDetails.info2 || null;
  let units = null;
  let unitLabel = 'units';
  if (info1) {
    const match = String(info1).match(/([\d.]+)\s*(kWh|units?)/i);
    if (match) {
      units = parseFloat(match[1]);
      unitLabel = match[2].toLowerCase().startsWith('kwh') ? 'kWh' : 'units';
    }
  }

  return {
    token: pinDetails.token || null,
    units,
    unitLabel,
    unitsDisplay: info1 || (units != null ? `${units} ${unitLabel}` : null),
    billerReferenceId: billDetails?.billerReferenceId || null,
    source: 'reloadly',
  };
}

export function getReloadlyTransactionId(receipt) {
  if (!receipt) return null;
  return receipt.id ?? receipt.transaction?.id ?? null;
}

export default {
  isPrepaidElectricity,
  estimatePrepaidElectricity,
  extractElectricityDelivery,
};
