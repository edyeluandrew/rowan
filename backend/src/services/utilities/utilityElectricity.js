/**
 * Parse Reloadly utility bill transaction payloads (units, token, customer name).
 */

export function extractBillDelivery(reloadlyPayload) {
  if (!reloadlyPayload) return null;

  const tx = reloadlyPayload.transaction || reloadlyPayload;
  const billDetails = tx.billDetails || reloadlyPayload.billDetails;
  if (!billDetails) return null;

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
  return receipt.id ?? receipt.transaction?.id ?? null;
}

export default {
  extractBillDelivery,
  extractElectricityDelivery,
  getReloadlyTransactionId,
};
