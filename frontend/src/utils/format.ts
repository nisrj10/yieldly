export function formatCurrency(amount: number, currency: string = 'GBP') {
  // Use correct locale for each currency's number formatting
  const localeMap: Record<string, string> = {
    'GBP': 'en-GB',
    'INR': 'en-IN',  // Indian numbering: 16,50,000 (lakhs/crores)
    'USD': 'en-US',
    'EUR': 'de-DE',
  };
  const locale = localeMap[currency] || 'en-GB';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
