/**
 * Parse Reloadly operator fixed-amount catalogs into data bundle options.
 */

function descriptionForAmount(amount, descriptions) {
  if (!descriptions || typeof descriptions !== 'object') return null;
  const candidates = [
    String(amount),
    Number(amount).toFixed(2),
    String(Math.round(Number(amount))),
  ];
  for (const key of candidates) {
    if (descriptions[key]) return String(descriptions[key]).trim();
  }
  return null;
}

export function extractBundlesFromOperator(operator, fallbackCurrency = 'UGX') {
  const operatorId = String(operator?.operatorId ?? operator?.id ?? '');
  const operatorName = operator?.name || null;
  const denominationType = operator?.denominationType || null;

  const useLocal = Array.isArray(operator?.localFixedAmounts)
    && operator.localFixedAmounts.length > 0;

  const amounts = useLocal
    ? operator.localFixedAmounts
    : (operator?.fixedAmounts || []);

  const descriptions = useLocal
    ? (operator.localFixedAmountsDescriptions || {})
    : (operator.fixedAmountsDescriptions || {});

  const fiatCurrency = useLocal
    ? (operator.destinationCurrencyCode || operator.fx?.currencyCode || fallbackCurrency)
    : (operator.senderCurrencyCode || fallbackCurrency);

  const bundles = amounts
    .map((raw) => {
      const fiatAmount = Number(raw);
      if (!Number.isFinite(fiatAmount) || fiatAmount <= 0) return null;
      const description = descriptionForAmount(fiatAmount, descriptions);
      return {
        fiatAmount,
        fiatCurrency,
        description: description || `${fiatAmount.toLocaleString()} ${fiatCurrency} data bundle`,
        operatorId,
        operatorName,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.fiatAmount - b.fiatAmount);

  return {
    operatorId,
    operatorName,
    denominationType,
    fiatCurrency,
    bundles,
  };
}

export default { extractBundlesFromOperator };
