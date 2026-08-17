/**
 * Parse MarzPay bill payloads (Yaka token, units, customer name).
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

export function extractBillDelivery(payload) {
  if (!payload) return null;
  return extractMarzPayDelivery(payload);
}

/** @deprecated use extractBillDelivery */
export function extractElectricityDelivery(payload) {
  return extractBillDelivery(payload);
}

export default {
  extractBillDelivery,
  extractElectricityDelivery,
};
