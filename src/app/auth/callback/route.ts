import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const type = searchParams.get('type');

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        if (type === 'recovery') {
          return NextResponse.redirect(`${origin}/reset-password`);
        }
        if (type === 'signup' || type === 'email_change') {
          return NextResponse.redirect(`${origin}/verify-email?verified=true&type=${type}`);
        }
        // Validate next param to prevent open redirect
        const safeNext = next.startsWith('/') ? next : '/dashboard';
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
      // Auth exchange failed — redirect to login with error
      return NextResponse.redirect(`${origin}/sign-up-login?error=auth_failed`);
    } catch {
      return NextResponse.redirect(`${origin}/sign-up-login?error=server_error`);
    }
  }

  const errorCode = searchParams.get('error_code');
  if (errorCode === 'otp_expired') {
    return NextResponse.redirect(`${origin}/verify-email?error=expired`);
  }

  return NextResponse.redirect(`${origin}/sign-up-login`);
}
