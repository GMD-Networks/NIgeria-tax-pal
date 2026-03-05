/**
 * Multi-currency support with exchange rates
 */

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
];

// Approximate exchange rates (NGN base). In production, use a live API.
const EXCHANGE_RATES: Record<string, number> = {
  NGN: 1,
  USD: 0.000625,    // 1 NGN ≈ 0.000625 USD (1 USD ≈ 1600 NGN)
  GBP: 0.000500,    // 1 NGN ≈ 0.0005 GBP
  EUR: 0.000580,    // 1 NGN ≈ 0.00058 EUR
};

const TO_NGN_RATES: Record<string, number> = {
  NGN: 1,
  USD: 1600,
  GBP: 2000,
  EUR: 1720,
};

export const convertCurrency = (amount: number, from: string, to: string): number => {
  if (from === to) return amount;
  // Convert to NGN first, then to target
  const inNGN = amount * (TO_NGN_RATES[from] || 1);
  const result = inNGN * (EXCHANGE_RATES[to] || 1);
  return Math.round(result * 100) / 100;
};

export const formatCurrencyAmount = (amount: number, currencyCode: string): string => {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  const symbol = currency?.symbol || currencyCode;
  return `${symbol}${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const getExchangeRate = (from: string, to: string): number => {
  if (from === to) return 1;
  const fromToNGN = TO_NGN_RATES[from] || 1;
  const toFromNGN = EXCHANGE_RATES[to] || 1;
  return Math.round(fromToNGN * toFromNGN * 10000) / 10000;
};
