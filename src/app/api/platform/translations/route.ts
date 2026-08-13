/**
 * GET /api/platform/translations
 *
 * Returns the full translation resource for a given language.
 * Scope required: translations:read
 *
 * Query params:
 *   ?lang=en-AU  (defaults to en-AU)
 *
 * Response: { data: { [key: string]: string } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey, hasScope, unauthorizedResponse, forbiddenResponse } from '@/lib/platformApiAuth';
import { getTranslations, isValidLanguage, DEFAULT_LANGUAGE } from '@/lib/i18n';

export async function GET(req: NextRequest) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return unauthorizedResponse();
  if (!hasScope(ctx, 'translations:read')) return forbiddenResponse();

  const { searchParams } = new URL(req.url);
  const langParam = searchParams.get('lang') ?? DEFAULT_LANGUAGE;
  const lang = isValidLanguage(langParam) ? langParam : DEFAULT_LANGUAGE;

  const translations = getTranslations(lang);

  return NextResponse.json({ data: translations, language: lang });
}
