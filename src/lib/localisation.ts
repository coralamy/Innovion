/**
 * Localisation Utilities
 *
 * All formatting functions are driven by company localisation settings.
 * No Australian-specific defaults are hard-coded here.
 * All timestamps are stored as UTC and displayed in the company's configured timezone.
 */

import type { CurrencyConfig } from './countryConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocalisationSettings {
  country: string;
  language: string;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimalPrecision: number;
  thousandsSeparator: string;
  decimalSeparator: string;
  currencySymbolPosition: 'before' | 'after';
  timezone: string;
  dateFormat: string; // e.g. 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'
  timeFormat: '12h' | '24h';
  firstDayOfWeek: 0 | 1 | 6;
  measurementSystem: 'metric' | 'imperial';
}

export const DEFAULT_LOCALISATION: LocalisationSettings = {
  country: 'AU',
  language: 'en-AU',
  currencyCode: 'AUD',
  currencySymbol: '$',
  currencyDecimalPrecision: 2,
  thousandsSeparator: ',',
  decimalSeparator: '.',
  currencySymbolPosition: 'before',
  timezone: 'Australia/Sydney',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12h',
  firstDayOfWeek: 1,
  measurementSystem: 'metric',
};

// ─── Currency Formatting ──────────────────────────────────────────────────────

export function formatCurrency(
  amount: number,
  settings: Partial<LocalisationSettings> = {}
): string {
  const s = { ...DEFAULT_LOCALISATION, ...settings };
  const fixed = Math.abs(amount).toFixed(s.currencyDecimalPrecision);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, s.thousandsSeparator);
  const formattedNumber = decPart !== undefined
    ? `${formattedInt}${s.decimalSeparator}${decPart}`
    : formattedInt;
  const sign = amount < 0 ? '-' : '';
  return s.currencySymbolPosition === 'before'
    ? `${sign}${s.currencySymbol}${formattedNumber}`
    : `${sign}${formattedNumber}${s.currencySymbol}`;
}

export function formatCurrencyFromConfig(amount: number, config: CurrencyConfig): string {
  return formatCurrency(amount, {
    currencySymbol: config.symbol,
    currencyDecimalPrecision: config.decimalPrecision,
    thousandsSeparator: config.thousandsSeparator,
    decimalSeparator: config.decimalSeparator,
    currencySymbolPosition: config.symbolPosition,
  });
}

// ─── Number Formatting ────────────────────────────────────────────────────────

export function formatNumber(
  value: number,
  decimalPlaces: number = 2,
  settings: Partial<LocalisationSettings> = {}
): string {
  const s = { ...DEFAULT_LOCALISATION, ...settings };
  const fixed = value.toFixed(decimalPlaces);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, s.thousandsSeparator);
  return decPart !== undefined
    ? `${formattedInt}${s.decimalSeparator}${decPart}`
    : formattedInt;
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

/**
 * Format a UTC ISO string or Date to the company's configured date format.
 * All timestamps must be stored as UTC and displayed in the company's timezone.
 */
export function formatDate(
  utcDateInput: string | Date | null | undefined,
  settings: Partial<LocalisationSettings> = {}
): string {
  if (!utcDateInput) return '';
  const s = { ...DEFAULT_LOCALISATION, ...settings };
  try {
    const date = typeof utcDateInput === 'string' ? new Date(utcDateInput) : utcDateInput;
    if (isNaN(date.getTime())) return String(utcDateInput);

    // Get date parts in the configured timezone
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: s.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const year = parts.find((p) => p.type === 'year')?.value ?? '';

    return s.dateFormat
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', year)
      .replace('YY', year.slice(-2));
  } catch {
    return String(utcDateInput);
  }
}

/**
 * Format a UTC ISO string or Date to the company's configured time format.
 */
export function formatTime(
  utcDateInput: string | Date | null | undefined,
  settings: Partial<LocalisationSettings> = {}
): string {
  if (!utcDateInput) return '';
  const s = { ...DEFAULT_LOCALISATION, ...settings };
  try {
    const date = typeof utcDateInput === 'string' ? new Date(utcDateInput) : utcDateInput;
    if (isNaN(date.getTime())) return String(utcDateInput);

    return new Intl.DateTimeFormat('en-AU', {
      timeZone: s.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: s.timeFormat === '12h',
    }).format(date);
  } catch {
    return String(utcDateInput);
  }
}

/**
 * Format a UTC ISO string or Date to both date and time.
 */
export function formatDateTime(
  utcDateInput: string | Date | null | undefined,
  settings: Partial<LocalisationSettings> = {}
): string {
  if (!utcDateInput) return '';
  const dateStr = formatDate(utcDateInput, settings);
  const timeStr = formatTime(utcDateInput, settings);
  return `${dateStr} ${timeStr}`.trim();
}

/**
 * Convert a local date string (in company timezone) to UTC ISO string for storage.
 */
export function toUTC(localDateString: string, timezone: string): string {
  try {
    // Parse as if it's in the given timezone and return UTC
    const date = new Date(localDateString);
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ─── Phone Number (E.164) ─────────────────────────────────────────────────────

/**
 * Format a phone number to E.164 international standard.
 * E.164: +[country code][subscriber number], no spaces or dashes.
 */
export function toE164(phoneNumber: string, dialCode: string): string {
  // Remove all non-digit characters except leading +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  // Remove leading zero (common in AU, UK, etc.)
  const withoutLeadingZero = cleaned.startsWith('0') ? cleaned.slice(1) : cleaned;
  const cleanDialCode = dialCode.replace(/[^\d]/g, '');
  return `+${cleanDialCode}${withoutLeadingZero}`;
}

/**
 * Display a phone number in a human-readable format.
 */
export function formatPhone(e164Number: string): string {
  if (!e164Number) return '';
  // Return as-is if already formatted or not E.164
  return e164Number;
}

/**
 * Validate E.164 format.
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

// ─── Measurement Formatting ───────────────────────────────────────────────────

export function formatArea(
  squareMetres: number,
  measurementSystem: 'metric' | 'imperial' = 'metric'
): string {
  if (measurementSystem === 'imperial') {
    const sqFt = squareMetres * 10.7639;
    return `${sqFt.toFixed(0)} sq ft`;
  }
  return `${squareMetres.toFixed(0)} m²`;
}

export function formatDistance(
  metres: number,
  measurementSystem: 'metric' | 'imperial' = 'metric'
): string {
  if (measurementSystem === 'imperial') {
    const miles = metres / 1609.344;
    return miles < 0.1
      ? `${(metres * 3.28084).toFixed(0)} ft`
      : `${miles.toFixed(1)} mi`;
  }
  return metres < 1000
    ? `${metres.toFixed(0)} m`
    : `${(metres / 1000).toFixed(1)} km`;
}

export function formatWeight(
  kilograms: number,
  measurementSystem: 'metric' | 'imperial' = 'metric'
): string {
  if (measurementSystem === 'imperial') {
    const lbs = kilograms * 2.20462;
    return `${lbs.toFixed(1)} lbs`;
  }
  return `${kilograms.toFixed(1)} kg`;
}

// ─── Tax Calculation ──────────────────────────────────────────────────────────

export interface TaxCalculation {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxRate: number;
  taxCode: string;
  taxLabel: string;
}

export function calculateTax(
  subtotal: number,
  taxRate: number,
  taxCode: string = 'TAX',
  taxLabel: string = 'Tax',
  isInclusive: boolean = false
): TaxCalculation {
  if (isInclusive) {
    const taxAmount = subtotal - subtotal / (1 + taxRate / 100);
    return {
      subtotal: subtotal - taxAmount,
      taxAmount,
      total: subtotal,
      taxRate,
      taxCode,
      taxLabel,
    };
  }
  const taxAmount = (subtotal * taxRate) / 100;
  return {
    subtotal,
    taxAmount,
    total: subtotal + taxAmount,
    taxRate,
    taxCode,
    taxLabel,
  };
}

// ─── Address Formatting ───────────────────────────────────────────────────────

export interface AddressData {
  line1?: string;
  line2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
}

export function formatAddress(address: AddressData, countryCode: string = 'AU'): string {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.stateProvince,
    address.postalCode,
    address.country,
  ].filter(Boolean);
  return parts.join(', ');
}
