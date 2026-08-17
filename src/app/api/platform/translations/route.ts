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
import { guardPlatformRequest } from '@/lib/platformApiRoute';
import { getTranslations, isValidLanguage, DEFAULT_LANGUAGE } from '@/lib/i18n';
import { addRateLimitHeaders } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  // This route previously had NO rate limiting, unlike its siblings.
  const guard = await guardPlatformRequest(req, 'translations:read');
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const langParam = searchParams.get('lang') ?? DEFAULT_LANGUAGE;
  const lang = isValidLanguage(langParam) ? langParam : DEFAULT_LANGUAGE;

  const translations = getTranslations(lang);

  return addRateLimitHeaders(NextResponse.json({ data: translations, language: lang }), guard.rate);
}
