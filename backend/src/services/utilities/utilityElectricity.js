/**
 * Parse Reloadly utility bill transaction payloads (units, token, customer name).
 */

function extractMarzPayDelivery(payload) {
  const data = payload.data || payload;
  const bill = data.bill_payment || data.transaction?.bill_payment || null;
  const tx = data.transaction || {};
  if (!bill && !tx.uuid && payload.provider !== 'marzpay') return null;

  const token = bill?.token
    || bill?.yaka_token
    || bill?.pin
    || bill?.units_token
    || data.token
    || null;
  const unitsRaw = bill?.units || bill?.units_display || null;
  const customerName = bill?.customer_name || tx.customer_name || payload.customerName || null;

  if (!token && !customerName && !bill) return null;

  return {
    customerName,
    token,
    units: unitsRaw ? parseFloat(String(unitsRaw)) || null : null,
    unitLabel: /kwh/i.test(String(unitsRaw || '')) ? 'kWh' : 'units',
    unitsDisplay: unitsRaw ? String(unitsRaw) : null,
    billerReferenceId: tx.provider_reference || tx.reference || null,
    source: 'marzpay',
  };
}

export function extractBillDelivery(reloadlyPayload) {
  if (!reloadlyPayload) return null;

  const marz = extractMarzPayDelivery(reloadlyPayload);
  if (marz && (marz.token || marz.customerName || reloadlyPayload.provider === 'marzpay')) {
    return marz;
  }

  const tx = reloadlyPayload.transaction || reloadlyPayload;
  const billDetails = tx.billDetails || reloadlyPayload.billDetails;
  if (!billDetails) return marz;

  const subscriber = billDetails.subscriberDetails || {};
  const customerName = subscriber.customerName
    || subscriber.name
    || subscriber.subscriberName
    || billDetails.customerName
    || null;

  const pinDetails = billDetails.pinDetails || null;
  const info1 = pinDetails?.info1 || pinDetails?.info2 || null;
  let units = null;
  let unitLabel = 'units';
  if (info1) {
    const match = String(info1).match(/([\d.]+)\s*(kWh|units?)/i);
    if (match) {
      units = parseFloat(match[1]);
      unitLabel = match[2].toLowerCase().startsWith('kwh') ? 'kWh' : 'units';
    }
  }

  if (!customerName && !pinDetails) return null;

  return {
    customerName,
    token: pinDetails?.token || null,
    units,
    unitLabel,
    unitsDisplay: info1 || (units != null ? `${units} ${unitLabel}` : null),
    billerReferenceId: billDetails.billerReferenceId || null,
    source: 'reloadly',
  };
}

/** @deprecated use extractBillDelivery */
export function extractElectricityDelivery(reloadlyPayload) {
  return extractBillDelivery(reloadlyPayload);
}

export function getReloadlyTransactionId(receipt) {
  if (!receipt) return null;
  return receipt.id
    ?? receipt.transaction?.id
    ?? receipt.data?.transaction?.uuid
    ?? receipt.data?.transaction?.reference
    ?? null;
}

export default {
  extractBillDelivery,
  extractElectricityDelivery,
  getReloadlyTransactionId,
};
