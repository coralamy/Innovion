'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_LOCALISATION,
  type LocalisationSettings,
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
  formatNumber,
  toE164,
  formatPhone,
  formatArea,
  formatDistance,
  formatWeight,
  calculateTax,
  type TaxCalculation,
} from '@/lib/localisation';
import { getCountryConfig, getPrimaryTaxRule } from '@/lib/countryConfig';
import {
  getTranslations,
  DEFAULT_LANGUAGE,
  type Language,
} from '@/lib/i18n';

// ─── Context Types ────────────────────────────────────────────────────────────

interface LocalisationContextValue {
  settings: LocalisationSettings;
  t: ReturnType<typeof getTranslations>;
  language: Language;
  setLanguage: (lang: Language) => void;
  updateSettings: (partial: Partial<LocalisationSettings>) => Promise<void>;
  // Formatting helpers bound to current settings
  formatCurrency: (amount: number) => string;
  formatDate: (date: string | Date | null | undefined) => string;
  formatTime: (date: string | Date | null | undefined) => string;
  formatDateTime: (date: string | Date | null | undefined) => string;
  formatNumber: (value: number, decimals?: number) => string;
  toE164: (phone: string) => string;
  formatPhone: (e164: string) => string;
  formatArea: (sqm: number) => string;
  formatDistance: (metres: number) => string;
  formatWeight: (kg: number) => string;
  calculateTax: (subtotal: number) => TaxCalculation;
  primaryTaxLabel: string;
  primaryTaxRate: number;
  currencyCode: string;
  currencySymbol: string;
  isLoading: boolean;
}

const LocalisationContext = createContext<LocalisationContextValue | null>(null);

export function useLocalisation(): LocalisationContextValue {
  const ctx = useContext(LocalisationContext);
  if (!ctx) throw new Error('useLocalisation must be used within LocalisationProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LocalisationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = createClient();
  const [settings, setSettings] = useState<LocalisationSettings>(DEFAULT_LOCALISATION);
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [isLoading, setIsLoading] = useState(true);

  // Load company localisation settings from DB
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        // Get the user's company_id from user_roles
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!roleData?.company_id) {
          setIsLoading(false);
          return;
        }

        const { data: locData } = await supabase
          .from('company_localisation')
          .select('*')
          .eq('company_id', roleData.company_id)
          .maybeSingle();

        if (locData) {
          const loaded: LocalisationSettings = {
            country: locData.country ?? DEFAULT_LOCALISATION.country,
            language: locData.language ?? DEFAULT_LOCALISATION.language,
            currencyCode: locData.currency_code ?? DEFAULT_LOCALISATION.currencyCode,
            currencySymbol: locData.currency_symbol ?? DEFAULT_LOCALISATION.currencySymbol,
            currencyDecimalPrecision: locData.currency_decimal_precision ?? DEFAULT_LOCALISATION.currencyDecimalPrecision,
            thousandsSeparator: locData.thousands_separator ?? DEFAULT_LOCALISATION.thousandsSeparator,
            decimalSeparator: locData.decimal_separator ?? DEFAULT_LOCALISATION.decimalSeparator,
            currencySymbolPosition: locData.currency_symbol_position ?? DEFAULT_LOCALISATION.currencySymbolPosition,
            timezone: locData.timezone ?? DEFAULT_LOCALISATION.timezone,
            dateFormat: locData.date_format ?? DEFAULT_LOCALISATION.dateFormat,
            timeFormat: locData.time_format ?? DEFAULT_LOCALISATION.timeFormat,
            firstDayOfWeek: locData.first_day_of_week ?? DEFAULT_LOCALISATION.firstDayOfWeek,
            measurementSystem: locData.measurement_system ?? DEFAULT_LOCALISATION.measurementSystem,
          };
          setSettings(loaded);
          if (loaded.language) setLanguageState(loaded.language as Language);
        } else {
          // Auto-populate from country config if no localisation record exists
          const countryConfig = getCountryConfig(DEFAULT_LOCALISATION.country);
          const autoSettings: LocalisationSettings = {
            country: countryConfig.countryCode,
            language: countryConfig.defaultLanguage as Language,
            currencyCode: countryConfig.defaultCurrency.code,
            currencySymbol: countryConfig.defaultCurrency.symbol,
            currencyDecimalPrecision: countryConfig.defaultCurrency.decimalPrecision,
            thousandsSeparator: countryConfig.defaultCurrency.thousandsSeparator,
            decimalSeparator: countryConfig.defaultCurrency.decimalSeparator,
            currencySymbolPosition: countryConfig.defaultCurrency.symbolPosition,
            timezone: countryConfig.defaultTimezone,
            dateFormat: countryConfig.defaultDateFormat,
            timeFormat: countryConfig.defaultTimeFormat,
            firstDayOfWeek: countryConfig.defaultFirstDayOfWeek,
            measurementSystem: countryConfig.measurementSystem,
          };
          setSettings(autoSettings);
        }
      } catch {
        // Fall back to defaults silently
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    setSettings((prev) => ({ ...prev, language: lang }));
  }, []);

  const updateSettings = useCallback(
    async (partial: Partial<LocalisationSettings>) => {
      const next = { ...settings, ...partial };
      setSettings(next);

      if (!user) return;
      try {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!roleData?.company_id) return;

        await supabase.from('company_localisation').upsert(
          {
            company_id: roleData.company_id,
            country: next.country,
            language: next.language,
            currency_code: next.currencyCode,
            currency_symbol: next.currencySymbol,
            currency_decimal_precision: next.currencyDecimalPrecision,
            thousands_separator: next.thousandsSeparator,
            decimal_separator: next.decimalSeparator,
            currency_symbol_position: next.currencySymbolPosition,
            timezone: next.timezone,
            date_format: next.dateFormat,
            time_format: next.timeFormat,
            first_day_of_week: next.firstDayOfWeek,
            measurement_system: next.measurementSystem,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'company_id' }
        );
      } catch {
        // Persist failure is non-fatal; UI already updated
      }
    },
    [settings, user]
  );

  // Derive tax info from country config
  const primaryTax = getPrimaryTaxRule(settings.country);
  const primaryTaxLabel = primaryTax?.invoiceLabel ?? 'Tax';
  const primaryTaxRate = primaryTax?.defaultRate ?? 0;
  const dialCode = getCountryConfig(settings.country).phoneDialCode;

  const t = getTranslations(language);

  const value: LocalisationContextValue = {
    settings,
    t,
    language,
    setLanguage,
    updateSettings,
    formatCurrency: (amount) => formatCurrency(amount, settings),
    formatDate: (date) => formatDate(date, settings),
    formatTime: (date) => formatTime(date, settings),
    formatDateTime: (date) => formatDateTime(date, settings),
    formatNumber: (value, decimals) => formatNumber(value, decimals, settings),
    toE164: (phone) => toE164(phone, dialCode),
    formatPhone,
    formatArea: (sqm) => formatArea(sqm, settings.measurementSystem),
    formatDistance: (m) => formatDistance(m, settings.measurementSystem),
    formatWeight: (kg) => formatWeight(kg, settings.measurementSystem),
    calculateTax: (subtotal) =>
      calculateTax(
        subtotal,
        primaryTaxRate,
        primaryTax?.code ?? 'TAX',
        primaryTax?.label ?? 'Tax',
        primaryTax?.isInclusive ?? false
      ),
    primaryTaxLabel,
    primaryTaxRate,
    currencyCode: settings.currencyCode,
    currencySymbol: settings.currencySymbol,
    isLoading,
  };

  return (
    <LocalisationContext.Provider value={value}>
      {children}
    </LocalisationContext.Provider>
  );
}
