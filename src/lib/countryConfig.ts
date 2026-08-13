/**
 * Country Configuration Layer
 *
 * All country-specific behaviour is driven by this configuration.
 * To add a new country: add a new entry to COUNTRY_CONFIGS.
 * Never use `if (country === 'AU')` patterns in application code.
 */

export type MeasurementSystem = 'metric' | 'imperial';
export type TimeFormat = '12h' | '24h';
export type FirstDayOfWeek = 0 | 1 | 6; // 0=Sunday, 1=Monday, 6=Saturday

export interface BusinessIdentifier {
  code: string;
  label: string;
  placeholder: string;
  validationPattern?: RegExp;
  helpText?: string;
}

export interface TaxRule {
  code: string;
  label: string;
  defaultRate: number; // percentage e.g. 10 for 10%
  rateLabel: string;
  isInclusive: boolean;
  invoiceLabel: string;
}

export interface AddressFormat {
  fields: Array<'line1' | 'line2' | 'city' | 'stateProvince' | 'postalCode' | 'country'>;
  stateProvinceLabel: string;
  postalCodeLabel: string;
  cityLabel: string;
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  decimalPrecision: number;
  thousandsSeparator: string;
  decimalSeparator: string;
  symbolPosition: 'before' | 'after';
}

export interface CountryConfig {
  countryCode: string; // ISO 3166-1 alpha-2
  countryName: string;
  defaultLanguage: string;
  defaultCurrency: CurrencyConfig;
  defaultTimezone: string;
  defaultDateFormat: string; // e.g. 'DD/MM/YYYY'
  defaultTimeFormat: TimeFormat;
  defaultFirstDayOfWeek: FirstDayOfWeek;
  measurementSystem: MeasurementSystem;
  phoneDialCode: string;
  businessIdentifiers: BusinessIdentifier[];
  taxRules: TaxRule[];
  addressFormat: AddressFormat;
  complianceNotes?: string;
}

// ─── Country Configurations ───────────────────────────────────────────────────

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  AU: {
    countryCode: 'AU',
    countryName: 'Australia',
    defaultLanguage: 'en-AU',
    defaultCurrency: {
      code: 'AUD',
      symbol: '$',
      decimalPrecision: 2,
      thousandsSeparator: ',',
      decimalSeparator: '.',
      symbolPosition: 'before',
    },
    defaultTimezone: 'Australia/Sydney',
    defaultDateFormat: 'DD/MM/YYYY',
    defaultTimeFormat: '12h',
    defaultFirstDayOfWeek: 1,
    measurementSystem: 'metric',
    phoneDialCode: '+61',
    businessIdentifiers: [
      {
        code: 'ABN',
        label: 'ABN',
        placeholder: '12 345 678 901',
        validationPattern: /^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$/,
        helpText: 'Australian Business Number (11 digits)',
      },
      {
        code: 'ACN',
        label: 'ACN',
        placeholder: '123 456 789',
        validationPattern: /^\d{3}\s?\d{3}\s?\d{3}$/,
        helpText: 'Australian Company Number (9 digits)',
      },
    ],
    taxRules: [
      {
        code: 'GST',
        label: 'GST',
        defaultRate: 10,
        rateLabel: '10%',
        isInclusive: false,
        invoiceLabel: 'GST (10%)',
      },
    ],
    addressFormat: {
      fields: ['line1', 'line2', 'city', 'stateProvince', 'postalCode', 'country'],
      stateProvinceLabel: 'State',
      postalCodeLabel: 'Postcode',
      cityLabel: 'Suburb / City',
    },
  },

  NZ: {
    countryCode: 'NZ',
    countryName: 'New Zealand',
    defaultLanguage: 'en-AU',
    defaultCurrency: {
      code: 'NZD',
      symbol: '$',
      decimalPrecision: 2,
      thousandsSeparator: ',',
      decimalSeparator: '.',
      symbolPosition: 'before',
    },
    defaultTimezone: 'Pacific/Auckland',
    defaultDateFormat: 'DD/MM/YYYY',
    defaultTimeFormat: '12h',
    defaultFirstDayOfWeek: 1,
    measurementSystem: 'metric',
    phoneDialCode: '+64',
    businessIdentifiers: [
      {
        code: 'NZBN',
        label: 'NZBN',
        placeholder: '9429000000000',
        validationPattern: /^\d{13}$/,
        helpText: 'New Zealand Business Number (13 digits)',
      },
    ],
    taxRules: [
      {
        code: 'GST',
        label: 'GST',
        defaultRate: 15,
        rateLabel: '15%',
        isInclusive: false,
        invoiceLabel: 'GST (15%)',
      },
    ],
    addressFormat: {
      fields: ['line1', 'line2', 'city', 'stateProvince', 'postalCode', 'country'],
      stateProvinceLabel: 'Region',
      postalCodeLabel: 'Postcode',
      cityLabel: 'City / Town',
    },
  },

  US: {
    countryCode: 'US',
    countryName: 'United States',
    defaultLanguage: 'en-US',
    defaultCurrency: {
      code: 'USD',
      symbol: '$',
      decimalPrecision: 2,
      thousandsSeparator: ',',
      decimalSeparator: '.',
      symbolPosition: 'before',
    },
    defaultTimezone: 'America/New_York',
    defaultDateFormat: 'MM/DD/YYYY',
    defaultTimeFormat: '12h',
    defaultFirstDayOfWeek: 0,
    measurementSystem: 'imperial',
    phoneDialCode: '+1',
    businessIdentifiers: [
      {
        code: 'EIN',
        label: 'EIN',
        placeholder: '12-3456789',
        validationPattern: /^\d{2}-\d{7}$/,
        helpText: 'Employer Identification Number',
      },
    ],
    taxRules: [
      {
        code: 'SALES_TAX',
        label: 'Sales Tax',
        defaultRate: 0,
        rateLabel: 'Varies by state',
        isInclusive: false,
        invoiceLabel: 'Sales Tax',
      },
    ],
    addressFormat: {
      fields: ['line1', 'line2', 'city', 'stateProvince', 'postalCode', 'country'],
      stateProvinceLabel: 'State',
      postalCodeLabel: 'ZIP Code',
      cityLabel: 'City',
    },
  },

  GB: {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    defaultLanguage: 'en-GB',
    defaultCurrency: {
      code: 'GBP',
      symbol: '£',
      decimalPrecision: 2,
      thousandsSeparator: ',',
      decimalSeparator: '.',
      symbolPosition: 'before',
    },
    defaultTimezone: 'Europe/London',
    defaultDateFormat: 'DD/MM/YYYY',
    defaultTimeFormat: '24h',
    defaultFirstDayOfWeek: 1,
    measurementSystem: 'imperial',
    phoneDialCode: '+44',
    businessIdentifiers: [
      {
        code: 'COMPANY_NUMBER',
        label: 'Company Number',
        placeholder: '12345678',
        validationPattern: /^\d{8}$|^[A-Z]{2}\d{6}$/,
        helpText: 'Companies House registration number',
      },
      {
        code: 'VAT_NUMBER',
        label: 'VAT Number',
        placeholder: 'GB123456789',
        validationPattern: /^GB\d{9}$/,
        helpText: 'VAT registration number',
      },
    ],
    taxRules: [
      {
        code: 'VAT',
        label: 'VAT',
        defaultRate: 20,
        rateLabel: '20%',
        isInclusive: false,
        invoiceLabel: 'VAT (20%)',
      },
    ],
    addressFormat: {
      fields: ['line1', 'line2', 'city', 'stateProvince', 'postalCode', 'country'],
      stateProvinceLabel: 'County / Region',
      postalCodeLabel: 'Postcode',
      cityLabel: 'City / Town',
    },
  },

  SG: {
    countryCode: 'SG',
    countryName: 'Singapore',
    defaultLanguage: 'en-AU',
    defaultCurrency: {
      code: 'SGD',
      symbol: 'S$',
      decimalPrecision: 2,
      thousandsSeparator: ',',
      decimalSeparator: '.',
      symbolPosition: 'before',
    },
    defaultTimezone: 'Asia/Singapore',
    defaultDateFormat: 'DD/MM/YYYY',
    defaultTimeFormat: '12h',
    defaultFirstDayOfWeek: 1,
    measurementSystem: 'metric',
    phoneDialCode: '+65',
    businessIdentifiers: [
      {
        code: 'UEN',
        label: 'UEN',
        placeholder: '201234567A',
        helpText: 'Unique Entity Number',
      },
      {
        code: 'GST_REG',
        label: 'GST Reg No.',
        placeholder: 'M90123456A',
        helpText: 'GST Registration Number',
      },
    ],
    taxRules: [
      {
        code: 'GST',
        label: 'GST',
        defaultRate: 9,
        rateLabel: '9%',
        isInclusive: false,
        invoiceLabel: 'GST (9%)',
      },
    ],
    addressFormat: {
      fields: ['line1', 'line2', 'city', 'postalCode', 'country'],
      stateProvinceLabel: 'Region',
      postalCodeLabel: 'Postal Code',
      cityLabel: 'City',
    },
  },

  CA: {
    countryCode: 'CA',
    countryName: 'Canada',
    defaultLanguage: 'en-AU',
    defaultCurrency: {
      code: 'CAD',
      symbol: '$',
      decimalPrecision: 2,
      thousandsSeparator: ',',
      decimalSeparator: '.',
      symbolPosition: 'before',
    },
    defaultTimezone: 'America/Toronto',
    defaultDateFormat: 'DD/MM/YYYY',
    defaultTimeFormat: '12h',
    defaultFirstDayOfWeek: 0,
    measurementSystem: 'metric',
    phoneDialCode: '+1',
    businessIdentifiers: [
      {
        code: 'BN',
        label: 'Business Number',
        placeholder: '123456789',
        validationPattern: /^\d{9}$/,
        helpText: 'CRA Business Number (9 digits)',
      },
      {
        code: 'HST_NUMBER',
        label: 'HST/GST Number',
        placeholder: '123456789 RT 0001',
        helpText: 'HST/GST Registration Number',
      },
    ],
    taxRules: [
      {
        code: 'GST',
        label: 'GST',
        defaultRate: 5,
        rateLabel: '5%',
        isInclusive: false,
        invoiceLabel: 'GST (5%)',
      },
      {
        code: 'HST',
        label: 'HST',
        defaultRate: 13,
        rateLabel: '13%',
        isInclusive: false,
        invoiceLabel: 'HST (13%)',
      },
    ],
    addressFormat: {
      fields: ['line1', 'line2', 'city', 'stateProvince', 'postalCode', 'country'],
      stateProvinceLabel: 'Province',
      postalCodeLabel: 'Postal Code',
      cityLabel: 'City',
    },
  },

  EU: {
    countryCode: 'EU',
    countryName: 'European Union',
    defaultLanguage: 'en-GB',
    defaultCurrency: {
      code: 'EUR',
      symbol: '€',
      decimalPrecision: 2,
      thousandsSeparator: '.',
      decimalSeparator: ',',
      symbolPosition: 'after',
    },
    defaultTimezone: 'Europe/Berlin',
    defaultDateFormat: 'DD.MM.YYYY',
    defaultTimeFormat: '24h',
    defaultFirstDayOfWeek: 1,
    measurementSystem: 'metric',
    phoneDialCode: '+49',
    businessIdentifiers: [
      {
        code: 'VAT_NUMBER',
        label: 'VAT Number',
        placeholder: 'DE123456789',
        helpText: 'EU VAT Registration Number',
      },
    ],
    taxRules: [
      {
        code: 'VAT',
        label: 'VAT',
        defaultRate: 19,
        rateLabel: 'Varies by country',
        isInclusive: false,
        invoiceLabel: 'VAT',
      },
    ],
    addressFormat: {
      fields: ['line1', 'line2', 'postalCode', 'city', 'country'],
      stateProvinceLabel: 'Region',
      postalCodeLabel: 'Postal Code',
      cityLabel: 'City',
    },
  },
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function getCountryConfig(countryCode: string): CountryConfig {
  return COUNTRY_CONFIGS[countryCode.toUpperCase()] ?? COUNTRY_CONFIGS['AU'];
}

export function getSupportedCountries(): Array<{ code: string; name: string }> {
  return Object.values(COUNTRY_CONFIGS).map((c) => ({
    code: c.countryCode,
    name: c.countryName,
  }));
}

export function getBusinessIdentifiers(countryCode: string): BusinessIdentifier[] {
  return getCountryConfig(countryCode).businessIdentifiers;
}

export function getPrimaryTaxRule(countryCode: string): TaxRule | null {
  const config = getCountryConfig(countryCode);
  return config.taxRules[0] ?? null;
}

export function getTaxRules(countryCode: string): TaxRule[] {
  return getCountryConfig(countryCode).taxRules;
}

export function getAddressFormat(countryCode: string): AddressFormat {
  return getCountryConfig(countryCode).addressFormat;
}

export function getDefaultCurrency(countryCode: string): CurrencyConfig {
  return getCountryConfig(countryCode).defaultCurrency;
}

export function getSupportedCountryCodes(): string[] {
  return Object.keys(COUNTRY_CONFIGS);
}
