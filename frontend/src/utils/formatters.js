// Utilities for parsing and formatting prices consistently
export function parsePrecio(val) {
  if (val === undefined || val === null || val === '') return 0.01;
  if (typeof val === 'number') return Math.round(val * 100) / 100;
  let s = String(val).trim();
  // Normalize common formats robustly.
  // If both comma and dot present, assume dots are thousand separators and comma is decimal: '150.000,50' -> '150000.50'
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // Only comma -> assume decimal separator: '150,50' -> '150.50'
    s = s.replace(/,/g, '.');
  } else if (s.includes('.')) {
    // Only dot present: could be decimal ('150.50') or thousands ('150.000').
    // Heuristic: if the part after the dot has exactly 3 digits, treat dot as thousands separator.
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    if (last && last.length === 3) {
      s = s.replace(/\./g, '');
    }
    // otherwise keep as decimal dot
  }
  // remove any non-digit except dot and minus
  s = s.replace(/[^0-9.-]/g, '');
  let num = parseFloat(s);
  if (isNaN(num) || num <= 0) return 0.01;
  return Math.round(num * 100) / 100;
}

import { getPriceDisplayMode } from '../config/priceConfig';

export function formatCurrency(val, locale = 'es-CO', currency = 'COP') {
  try {
    const raw = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
    const mode = getPriceDisplayMode();
    if (mode === 'decimals') {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(raw || 0);
    }
    const amount = raw || 0;
    const whole = mode === 'round' ? Math.round(amount) : Math.trunc(amount);
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(whole);
  } catch (e) {
    return String(val);
  }
}

// Format a number with thousand separators and no currency symbol (useful for inputs and short labels)
export function formatNumber(val, locale = 'es-CO') {
  try {
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
    if (isNaN(num)) return '';
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  } catch (e) {
    return String(val);
  }
}
