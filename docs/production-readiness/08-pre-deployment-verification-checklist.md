# Innovion Platform — Final Pre-Deployment Verification Checklist
**Version:** 1.0  
**Date:** 2026-07-31  
**Status:** PENDING COMPLETION  
**Target Environment:** GoDaddy VPS (Linux) + Supabase Cloud  
**Classification:** Internal — Engineering — CONFIDENTIAL

---

## How to Use This Document

Work through each section in order. Mark each item `[x]` when confirmed complete.  
Do **not** proceed to the next section until all items in the current section are marked.  
The **Approver** column records who verified each item and when.

A deployment may only proceed when **all items in Sections 1–6 are marked complete** and the Section 7 sign-off has been obtained.

---

## Section 1 — Supabase Storage Bucket Policies

> **Context:** The application layer enforces `{company_id}/{filename}` path scoping on every upload via `buildStoragePath()`. The Supabase Storage bucket-level RLS policies must also be applied to enforce isolation at the database layer, preventing any client from reading or writing another tenant's files even if the application layer is bypassed.

### 1.1 Apply Storage Bucket Policies

Navigate to: **Supabase Dashboard → Storage → Policies → `documents` bucket**

Apply the following two policies:

**SELECT policy** (tenants can only read their own files):
```sql
CREATE POLICY "Tenant isolation - SELECT"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = public.get_my_company_id()::text
);
```

**INSERT policy** (tenants can only upload to their own folder):
```sql
CREATE POLICY "Tenant isolation - INSERT"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = public.get_my_company_id()::text
);
```

**UPDATE policy** (tenants can only update their own files):
```sql
CREATE POLICY "Tenant isolation - UPDATE"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = public.get_my_company_id()::text
);
```

**DELETE policy** (tenants can only delete their own files):
```sql
CREATE POLICY "Tenant isolation - DELETE"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = public.get_my_company_id()::text
);
```

### 1.2 Verification Steps

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 1.2.1 | SELECT policy applied to `documents` bucket | [ ] | | |
| 1.2.2 | INSERT policy applied to `documents` bucket | [ ] | | |
| 1.2.3 | UPDATE policy applied to `documents` bucket | [ ] | | |
| 1.2.4 | DELETE policy applied to `documents` bucket | [ ] | | |
| 1.2.5 | Verified: authenticated user can upload to own `{company_id}/` folder | [ ] | | |
| 1.2.6 | Verified: authenticated user **cannot** read files from a different `{company_id}/` folder | [ ] | | |
| 1.2.7 | Verified: unauthenticated request returns 401/403 on all storage operations | [ ] | | |

**Section 1 Complete:** [ ] &nbsp;&nbsp; **Signed off by:** _________________ &nbsp;&nbsp; **Date:** _________________

---

## Section 2 — Production Account Audit

> **Context:** The production database must contain no test, demonstration, or development accounts. Any such accounts represent a security risk and may contaminate production analytics and billing.

### 2.1 Supabase Auth Users Audit

Navigate to: **Supabase Dashboard → Authentication → Users**

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 2.1.1 | Review all entries in `auth.users` — no test email addresses present (e.g. `test@`, `demo@`, `admin@test.`, `user@example.`) | [ ] | | |
| 2.1.2 | Review all entries in `auth.users` — no `@innovion.com` internal development accounts present | [ ] | | |
| 2.1.3 | Review all entries in `auth.users` — no accounts with placeholder names (Test User, Demo Account, Lorem Ipsum) | [ ] | | |
| 2.1.4 | Any test accounts identified have been permanently deleted via Supabase Dashboard → Authentication → Users → Delete | [ ] | | |

### 2.2 Companies Table Audit

Run the following query in **Supabase Dashboard → SQL Editor**:

```sql
-- Identify potential test companies
SELECT id, name, created_at
FROM public.companies
WHERE
  name ILIKE '%test%'
  OR name ILIKE '%demo%'
  OR name ILIKE '%example%'
  OR name ILIKE '%placeholder%'
  OR name ILIKE '%lorem%'
  OR name ILIKE '%acme%'
  OR name ILIKE '%foo%'
  OR name ILIKE '%bar%'
ORDER BY created_at DESC;
```

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 2.2.1 | Query executed — results reviewed | [ ] | | |
| 2.2.2 | All identified test companies deleted (or confirmed as legitimate) | [ ] | | |
| 2.2.3 | Confirmed: no `company_id IS NULL` records remain in any operational table | [ ] | | |

### 2.3 Subscription Plans Audit

```sql
-- Verify real pricing is in place
SELECT name, price_monthly, price_annual, stripe_price_id_monthly, stripe_price_id_annual
FROM public.subscription_plans
ORDER BY price_monthly;
```

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 2.3.1 | Starter plan: $49/month, $39/month (annual) | [ ] | | |
| 2.3.2 | Professional plan: $99/month, $79/month (annual) | [ ] | | |
| 2.3.3 | Enterprise plan: custom pricing | [ ] | | |
| 2.3.4 | Stripe Price IDs populated with live-mode Price IDs (not test-mode `price_test_*`) | [ ] | | |

**Section 2 Complete:** [ ] &nbsp;&nbsp; **Signed off by:** _________________ &nbsp;&nbsp; **Date:** _________________

---

## Section 3 — Production Secrets & External Service Credentials

> **Context:** All placeholder environment variable values must be replaced with real production credentials before deployment. Run `npx ts-node scripts/validate-env.ts` to automate this check.

### 3.1 Run Automated Validator

```bash
# From the project root on the production server:
npx ts-node scripts/validate-env.ts
```

Expected output: `✔  All environment variables are correctly configured.`

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 3.1.1 | `validate-env.ts` exits with code 0 (no blocking issues) | [ ] | | |
| 3.1.2 | No placeholder values reported | [ ] | | |
| 3.1.3 | No missing required variables reported | [ ] | | |

### 3.2 Manual Credential Verification

| Variable | Required | Status | Notes |
|----------|----------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Critical | [ ] Verified | Must be production project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Critical | [ ] Verified | Must be production anon key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ Critical | [ ] Verified | Must start with `pk_live_` |
| `STRIPE_SECRET_KEY` | ✅ Critical | [ ] Verified | Must start with `sk_live_` |
| `RESEND_API_KEY` | ✅ Critical | [ ] Verified | Must start with `re_` |
| `NEXT_PUBLIC_SITE_URL` | ✅ Critical | [ ] Verified | Must be production HTTPS domain |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ⚠ Recommended | [ ] Verified | Must start with `G-` |
| `OPENAI_API_KEY` | ℹ Optional | [ ] Verified / N/A | If AI features enabled |
| `GEMINI_API_KEY` | ℹ Optional | [ ] Verified / N/A | If AI features enabled |
| `ANTHROPIC_API_KEY` | ℹ Optional | [ ] Verified / N/A | If AI features enabled |
| `PERPLEXITY_API_KEY` | ℹ Optional | [ ] Verified / N/A | If AI features enabled |

### 3.3 Stripe Live Mode Verification

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 3.3.1 | Stripe account switched to **Live mode** (not Test mode) | [ ] | | |
| 3.3.2 | Stripe webhook endpoint configured for production domain | [ ] | | |
| 3.3.3 | Stripe webhook secret (`STRIPE_WEBHOOK_SECRET`) configured if applicable | [ ] | | |
| 3.3.4 | Stripe live-mode Price IDs match values in `subscription_plans` table | [ ] | | |

### 3.4 Resend Email Verification

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 3.4.1 | Resend API key is a production key (not a test key) | [ ] | | |
| 3.4.2 | Sending domain verified in Resend dashboard | [ ] | | |
| 3.4.3 | Test transactional email sent and received successfully | [ ] | | |
| 3.4.4 | Email templates render correctly (invite, password reset, notifications) | [ ] | | |

### 3.5 Supabase Production Configuration

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 3.5.1 | Supabase project is on a **paid plan** (not free tier) | [ ] | | |
| 3.5.2 | Supabase Auth → Site URL set to production domain | [ ] | | |
| 3.5.3 | Supabase Auth → Redirect URLs include production domain | [ ] | | |
| 3.5.4 | Supabase Auth → Email templates customised with Innovion branding | [ ] | | |
| 3.5.5 | Supabase Auth → SMTP configured (or Supabase default email confirmed) | [ ] | | |
| 3.5.6 | Supabase project region appropriate for target customer geography | [ ] | | |
| 3.5.7 | Point-in-time recovery (PITR) enabled on Supabase project | [ ] | | |

**Section 3 Complete:** [ ] &nbsp;&nbsp; **Signed off by:** _________________ &nbsp;&nbsp; **Date:** _________________

---

## Section 4 — Database Migration Verification

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 4.1 | All migrations applied in correct order (verify via Supabase Dashboard → Database → Migrations) | [ ] | | |
| 4.2 | `20260731070000_production_hardening.sql` status = APPLIED | [ ] | | |
| 4.3 | Production database backup taken **before** any migration | [ ] | | |
| 4.4 | No migration errors in Supabase migration history | [ ] | | |
| 4.5 | RLS policies active on all 28 tables (verify via Supabase Dashboard → Database → Tables → RLS) | [ ] | | |
| 4.6 | `get_my_company_id()` function exists and returns correct value for test user | [ ] | | |
| 4.7 | `is_company_admin()` function exists and correctly identifies admin users | [ ] | | |
| 4.8 | All 14 composite indexes created (verify via Database → Indexes) | [ ] | | |

**Section 4 Complete:** [ ] &nbsp;&nbsp; **Signed off by:** _________________ &nbsp;&nbsp; **Date:** _________________

---

## Section 5 — GoDaddy VPS Infrastructure

### 5.1 Server Setup

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 5.1.1 | Node.js 20 LTS installed (`node --version` returns `v20.x.x`) | [ ] | | |
| 5.1.2 | PM2 installed globally (`pm2 --version`) | [ ] | | |
| 5.1.3 | Nginx installed and running (`nginx -v`) | [ ] | | |
| 5.1.4 | SSL certificate provisioned (Let's Encrypt or GoDaddy SSL) | [ ] | | |
| 5.1.5 | HTTPS redirect configured in Nginx (HTTP → HTTPS) | [ ] | | |
| 5.1.6 | Firewall configured — only ports 80, 443, 22 open | [ ] | | |
| 5.1.7 | SSH key-based authentication enabled; password auth disabled | [ ] | | |

### 5.2 Application Deployment

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 5.2.1 | Repository cloned / code deployed to `/var/www/innovion` (or equivalent) | [ ] | | |
| 5.2.2 | `.env` file created on server with all production values | [ ] | | |
| 5.2.3 | `.env` file permissions set to `600` (owner read/write only) | [ ] | | |
| 5.2.4 | `npm ci --production` completed without errors | [ ] | | |
| 5.2.5 | `npm run build` completed without errors | [ ] | | |
| 5.2.6 | PM2 process started: `pm2 start npm --name innovion -- start` | [ ] | | |
| 5.2.7 | PM2 startup configured: `pm2 startup` + `pm2 save` | [ ] | | |
| 5.2.8 | Application accessible at production domain over HTTPS | [ ] | | |

### 5.3 Domain & DNS

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 5.3.1 | DNS A record pointing to GoDaddy VPS IP address | [ ] | | |
| 5.3.2 | DNS propagation confirmed (check via `dig` or online DNS checker) | [ ] | | |
| 5.3.3 | `www` subdomain redirects to apex domain (or vice versa) | [ ] | | |
| 5.3.4 | SSL certificate covers both apex and `www` subdomain | [ ] | | |

**Section 5 Complete:** [ ] &nbsp;&nbsp; **Signed off by:** _________________ &nbsp;&nbsp; **Date:** _________________

---

## Section 6 — Production Smoke Test

> **Context:** Run the automated smoke test against the live production URL after deployment. All tests must pass before the deployment is considered successful.

### 6.1 Execute Smoke Test

```bash
# Run from the production server or CI/CD pipeline:
BASE_URL=https://your-production-domain.com npx ts-node scripts/smoke-test.ts
```

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 6.1.1 | Smoke test exits with code 0 (all tests passed) | [ ] | | |
| 6.1.2 | All public marketing pages return HTTP 200 | [ ] | | |
| 6.1.3 | Dashboard summary API returns valid JSON with `queryCount: 6` | [ ] | | |
| 6.1.4 | Rate limit headers present on API responses | [ ] | | |
| 6.1.5 | Platform API endpoints return 401 for unauthenticated requests | [ ] | | |
| 6.1.6 | Auth callback route exists (not 404) | [ ] | | |
| 6.1.7 | SQL injection probe returns non-500 response | [ ] | | |
| 6.1.8 | Marketing home page loads within 3,000ms | [ ] | | |
| 6.1.9 | Dashboard summary API responds within 1,200ms | [ ] | | |

### 6.2 Manual End-to-End Verification

| # | Check | Result | Approver | Date |
|---|-------|--------|----------|------|
| 6.2.1 | New user can register (sign-up flow completes, verification email received) | [ ] | | |
| 6.2.2 | Registered user can log in | [ ] | | |
| 6.2.3 | Dashboard loads with correct metrics (no errors in browser console) | [ ] | | |
| 6.2.4 | User can create a new job | [ ] | | |
| 6.2.5 | User can upload a document (file stored in correct `{company_id}/` folder) | [ ] | | |
| 6.2.6 | User can log out | [ ] | | |
| 6.2.7 | Password reset email received and reset flow completes | [ ] | | |
| 6.2.8 | Billing page loads with correct subscription plan pricing | [ ] | | |
| 6.2.9 | No JavaScript errors in browser console on any tested page | [ ] | | |
| 6.2.10 | Mobile view renders correctly on 375px viewport (iPhone SE) | [ ] | | |

**Section 6 Complete:** [ ] &nbsp;&nbsp; **Signed off by:** _________________ &nbsp;&nbsp; **Date:** _________________

---

## Section 7 — Final Deployment Approval

### Pre-Approval Summary

| Section | Description | Status |
|---------|-------------|--------|
| 1 | Supabase Storage bucket policies applied | [ ] Complete |
| 2 | Production account audit — no test data | [ ] Complete |
| 3 | Production secrets & credentials configured | [ ] Complete |
| 4 | Database migrations verified | [ ] Complete |
| 5 | GoDaddy VPS infrastructure ready | [ ] Complete |
| 6 | Production smoke test passed | [ ] Complete |

### Engineering Sign-Off

> I confirm that all items in Sections 1–6 have been completed and verified. The Innovion platform is ready for production deployment.

**Engineering Lead:** _________________________________ &nbsp;&nbsp; **Date:** _________________

**Signature:** _________________________________

---

### Commercial Deployment Approval

> Based on the completed verification checklist and the engineering sign-off above, I approve the Innovion platform for production deployment.

**Approving Authority:** _________________________________ &nbsp;&nbsp; **Date:** _________________

**Signature:** _________________________________

---

## Appendix A — Rollback Procedure

If a critical issue is discovered post-deployment:

```bash
# 1. Immediately switch PM2 to previous build
pm2 stop innovion
cd /var/www/innovion
git stash          # or git checkout <previous-tag>
npm ci --production
npm run build
pm2 start innovion

# 2. If database migration caused issues — restore from backup
# (See Section 9 of 06-deployment-runbook.md for full backup/restore procedure)

# 3. Notify stakeholders immediately
# 4. Document the incident in the incident log
```

**Maximum acceptable rollback time:** 15 minutes  
**Rollback decision authority:** Engineering Lead

---

## Appendix B — Post-Deployment Monitoring (First 24 Hours)

Monitor the following after deployment:

| Metric | Tool | Threshold | Action |
|--------|------|-----------|--------|
| Error rate | PM2 logs / Supabase logs | > 1% of requests | Investigate immediately |
| Response time (p95) | Server logs | > 3,000ms | Performance investigation |
| Auth failures | Supabase Auth logs | Spike > baseline | Security investigation |
| Storage errors | Supabase Storage logs | Any 5xx | Verify bucket policies |
| Email delivery | Resend dashboard | Bounce rate > 5% | Check email configuration |

```bash
# Monitor PM2 logs in real-time
pm2 logs innovion --lines 100

# Monitor error rate
pm2 monit
```

---

*Document version: 1.0 | Last updated: 2026-07-31 | Owner: Platform Engineering*
