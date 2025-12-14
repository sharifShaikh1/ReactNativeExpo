export const getNumericAmount = (raw) => {
  if (raw == null) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const parsed = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCurrency = (num, { locale = 'en-IN', currency = 'INR', maximumFractionDigits = 0 } = {}) => {
  const value = getNumericAmount(num);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits }).format(Number(value));
  } catch (e) {
    // Fallback to plain symbol + number
    return `₹${Number(value).toFixed(maximumFractionDigits)}`;
  }
};