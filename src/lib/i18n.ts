import enAU from '@/locales/en-AU.json';
import enUS from '@/locales/en-US.json';
import enGB from '@/locales/en-GB.json';

export type Language = 'en-AU' | 'en-US' | 'en-GB';

export const SUPPORTED_LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en-AU', label: 'English (Australia)', flag: '🇦🇺' },
  { code: 'en-US', label: 'English (United States)', flag: '🇺🇸' },
  { code: 'en-GB', label: 'English (United Kingdom)', flag: '🇬🇧' },
];

export const DEFAULT_LANGUAGE: Language = 'en-AU';

const localeMap: Record<Language, typeof enAU> = {
  'en-AU': enAU,
  'en-US': enUS,
  'en-GB': enGB,
};

export function getTranslations(language: Language = DEFAULT_LANGUAGE): typeof enAU {
  return localeMap[language] ?? localeMap[DEFAULT_LANGUAGE];
}

export function getLanguageLabel(code: Language): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export function isValidLanguage(code: string): code is Language {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}
