# Innovion Platform — Production Deployment Runbook
**Version:** 1.0  
**Date:** 2026-07-31  
**Target Environment:** GoDaddy VPS (Linux) + Supabase Cloud  
**Application URL:** https://team-a-innovion-zp0qc84.public.builtwithrocket.new (staging) → custom domain (production)  
**Classification:** Internal — Engineering — CONFIDENTIAL

---

## Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Infrastructure Requirements](#2-infrastructure-requirements)
3. [Supabase Configuration](#3-supabase-configuration)
4. [Environment Variables](#4-environment-variables)
5. [Database Migrations](#5-database-migrations)
6. [GoDaddy VPS Deployment](#6-godaddy-vps-deployment)
7. [Domain & SSL Configuration](#7-domain--ssl-configuration)
8. [Rollback Procedure](#8-rollback-procedure)
9. [Backup & Recovery](#9-backup--recovery)
10. [Monitoring & Alerting](#10-monitoring--alerting)
11. [Incident Recovery](#11-incident-recovery)
12. [Post-Deployment Verification](#12-post-deployment-verification)

---

## 1. Pre-Deployment Checklist

Complete ALL items before initiating deployment:

### Code & Build
- [ ] All production readiness reports reviewed and critical/high issues resolved
- [ ] RLS hardening migration (`20260731000000_rls_hardening.sql`) applied and tested
- [ ] Mock/dummy data removed from production database
- [ ] `npm run build` completes without errors locally
- [ ] `npm audit --audit-level=high` returns no high/critical vulnerabilities
- [ ] All environment variables confirmed and documented
- [ ] `.env` file NOT committed to version control (verify `.gitignore`)
- [ ] Feature freeze confirmed — no uncommitted feature changes

### Database
- [ ] All migrations tested in staging environment
- [ ] Production database backup taken before migration
- [ ] Mock data cleanup script executed and verified
- [ ] Subscription plan prices updated with real values
- [ ] Stripe Price IDs configured

### External Services
- [ ] Supabase project on paid plan (not free tier) for production SLA
- [ ] Stripe account in live mode (not test mode)
- [ ] Resend API key configured for transactional email
- [ ] Custom domain DNS configured and propagated
- [ ] SSL certificate provisioned

### Security
- [ ] All Critical and High security findings resolved
- [ ] Supabase RLS hardening migration applied
- [ ] Storage bucket company-folder isolation implemented
- [ ] Rate limiting middleware deployed on API routes
- [ ] Filename sanitisation added to document upload

---

## 2. Infrastructure Requirements

### GoDaddy VPS Specifications (Minimum)

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Storage | 50 GB SSD | 100 GB SSD |
| Bandwidth | 1 TB/month | Unmetered |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Required Software

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 (process manager)
sudo npm install -g pm2

# Nginx (reverse proxy)
sudo apt-get install -y nginx

# Certbot (SSL)
sudo apt-get install -y certbot python3-certbot-nginx

# Git
sudo apt-get install -y git
```

---

## 3. Supabase Configuration

### 3.1 Project Settings

1. **Authentication → URL Configuration**
   - Site URL: `https://yourdomain.com`
   - Redirect URLs: `https://yourdomain.com/auth/callback`
   - Remove staging URL after production launch

2. **Authentication → Email Templates**
   - Confirm signup email: Update with Innovion branding
   - Password reset email: Update with Innovion branding
   - Magic link email: Update with Innovion branding

3. **Authentication → Providers**
   - Email: ✅ Enabled
   - Confirm email: ✅ Enabled (recommended for production)
   - Minimum password length: 8 characters

4. **Database → Connection Pooling**
   - Enable PgBouncer in Transaction mode for production
   - Pool size: 15 (adjust based on VPS RAM)

5. **Storage → Buckets**
   - `documents` bucket: Confirm `public: false`
   - File size limit: 52428800 (50MB)
   - Implement company folder isolation (see RLS Audit H-02)

6. **Edge Functions**
   - Deploy `compliance-alerts` function
   - Deploy `send-email` function
   - Set `SUPABASE_ENV=production` in edge function secrets

### 3.2 Supabase Secrets (Edge Functions)

Set the following secrets in Supabase Dashboard → Edge Functions → Secrets:

```
RESEND_API_KEY=<your-resend-api-key>
SUPABASE_ENV=production
```

### 3.3 Realtime Configuration

Ensure `notifications` table is added to the realtime publication:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

---

## 4. Environment Variables

### 4.1 Production `.env` File

Create `/var/www/innovion/.env.production.local` on the VPS:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Application
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_<your-key>
STRIPE_SECRET_KEY=sk_live_<your-key>

# Email (Resend)
RESEND_API_KEY=re_<your-key>

# Analytics (optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-<your-id>

# AI APIs (only if features are active)
# OPENAI_API_KEY=sk-<your-key>
# GEMINI_API_KEY=<your-key>
# ANTHROPIC_API_KEY=sk-ant-<your-key>
```

### 4.2 Environment Variable Security

```bash
# Set correct permissions on .env file
chmod 600 /var/www/innovion/.env.production.local
chown www-data:www-data /var/www/innovion/.env.production.local
```

---

## 5. Database Migrations

### 5.1 Migration Execution Order

Migrations must be applied in timestamp order. The Supabase CLI handles this automatically.

```
20260726055014_innovion_core.sql
20260726090000_innovion_extended.sql
20260727010000_add_company_id.sql
20260727020000_scheduled_jobs_activity_rbac.sql
20260727030000_documents_storage_bucket.sql
20260727040000_rls_notifications_invites.sql
20260728000000_timesheet_invoices_stripe_templates.sql
20260728010000_seed_onboarding.sql
20260728020000_i18n_localisation_partners.sql
20260728030000_platform_api_layer.sql
20260731000000_rls_hardening.sql          ← NEW: RLS hardening
20260731010000_production_data_cleanup.sql ← NEW: Remove mock data
```

### 5.2 Applying Migrations via Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to production project
supabase link --project-ref <your-project-ref>

# Push all pending migrations
supabase db push

# Verify migration status
supabase migration list
```

### 5.3 Manual Migration (if CLI unavailable)

1. Open Supabase Dashboard → SQL Editor
2. Execute each migration file in order
3. Verify no errors in the output
4. Check `supabase_migrations` table for applied migrations

### 5.4 Pre-Migration Backup

```bash
# Take a backup before applying migrations
supabase db dump --file backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Or via pg_dump (requires database password)
pg_dump "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
  --file backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql
```

### 5.5 Post-Migration Verification

```sql
-- Verify all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Verify no mock data remains
SELECT COUNT(*) FROM public.contractors WHERE company_id IS NULL;
SELECT COUNT(*) FROM public.jobs WHERE company_id IS NULL;
SELECT COUNT(*) FROM public.time_entries WHERE company_id IS NULL;
-- All should return 0
```

---

## 6. GoDaddy VPS Deployment

### 6.1 Initial Server Setup

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Create application user
sudo useradd -m -s /bin/bash innovion
sudo usermod -aG sudo innovion

# Create application directory
sudo mkdir -p /var/www/innovion
sudo chown innovion:innovion /var/www/innovion
```

### 6.2 Application Deployment

```bash
# Switch to application user
su - innovion

# Clone repository
cd /var/www/innovion
git clone <your-repository-url> .

# Install dependencies
npm ci --production=false

# Copy environment file
cp /path/to/.env.production.local .env.production.local

# Build application
npm run build

# Verify build succeeded
ls -la .next/
```

### 6.3 PM2 Process Configuration

Create `/var/www/innovion/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'innovion',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/innovion',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '1G',
      error_file: '/var/log/innovion/error.log',
      out_file: '/var/log/innovion/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};
```

```bash
# Create log directory
sudo mkdir -p /var/log/innovion
sudo chown innovion:innovion /var/log/innovion

# Start application with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration (auto-restart on reboot)
pm2 save
pm2 startup
# Follow the output instructions to enable startup

# Verify application is running
pm2 status
pm2 logs innovion --lines 50
```

### 6.4 Nginx Configuration

Create `/etc/nginx/sites-available/innovion`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # Static assets caching
    location /_next/static/ {
        alias /var/www/innovion/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /assets/ {
        alias /var/www/innovion/public/assets/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # Proxy to Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/innovion /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Domain & SSL Configuration

### 7.1 GoDaddy DNS Configuration

In GoDaddy DNS Management:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | @ | `<VPS IP address>` | 600 |
| A | www | `<VPS IP address>` | 600 |
| CNAME | api | `<VPS IP address>` | 600 |

Allow 15–60 minutes for DNS propagation.

### 7.2 SSL Certificate (Let's Encrypt)

```bash
# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run

# Add cron job for auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### 7.3 Update Supabase Redirect URLs

After domain is live:
1. Supabase Dashboard → Authentication → URL Configuration
2. Update Site URL to `https://yourdomain.com`
3. Add `https://yourdomain.com/auth/callback` to Redirect URLs
4. Remove staging URL

---

## 8. Rollback Procedure

### 8.1 Application Rollback

```bash
# Method 1: Revert to previous Git commit
cd /var/www/innovion
git log --oneline -10  # Find the previous stable commit hash
git checkout <previous-commit-hash>
npm ci --production=false
npm run build
pm2 restart innovion

# Method 2: Deploy previous build from backup
# (Requires build artifacts to be archived — see backup procedure)
tar -xzf /backups/innovion_build_<timestamp>.tar.gz -C /var/www/innovion
pm2 restart innovion
```

### 8.2 Database Rollback

> ⚠️ **WARNING:** Database rollbacks are destructive. Only perform if absolutely necessary.

```bash
# Restore from pre-migration backup
psql "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
  < backup_pre_migration_<timestamp>.sql
```

**Preferred approach:** Write a compensating migration rather than restoring from backup.

### 8.3 Rollback Decision Criteria

Initiate rollback if:
- Error rate exceeds 5% for more than 5 minutes
- Critical authentication failure affecting all users
- Data corruption detected
- Security breach confirmed

---

## 9. Backup & Recovery

### 9.1 Automated Database Backups

Supabase Pro plan includes automated daily backups with 7-day retention. For additional protection:

```bash
# Create backup script: /usr/local/bin/backup-innovion-db.sh
#!/bin/bash
BACKUP_DIR="/backups/database"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/innovion_db_$TIMESTAMP.sql.gz"

mkdir -p $BACKUP_DIR

pg_dump "postgresql://postgres:$DB_PASSWORD@db.$SUPABASE_PROJECT_REF.supabase.co:5432/postgres" \
  | gzip > $BACKUP_FILE

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

```bash
# Make executable
chmod +x /usr/local/bin/backup-innovion-db.sh

# Schedule daily backup at 2 AM
echo "0 2 * * * /usr/local/bin/backup-innovion-db.sh" | crontab -
```

### 9.2 Application Build Backup

```bash
# Archive build artifacts before each deployment
tar -czf /backups/builds/innovion_build_$(date +%Y%m%d_%H%M%S).tar.gz \
  /var/www/innovion/.next \
  /var/www/innovion/package.json \
  /var/www/innovion/package-lock.json

# Keep last 5 builds
ls -t /backups/builds/ | tail -n +6 | xargs -I {} rm /backups/builds/{}
```

### 9.3 Supabase Storage Backup

Supabase Storage is backed up as part of the Supabase Pro plan. For additional protection, implement periodic sync to an external storage provider (e.g., AWS S3, Backblaze B2).

### 9.4 Recovery Time Objectives

| Scenario | RTO | RPO |
|---|---|---|
| Application crash (PM2 restart) | < 30 seconds | 0 (no data loss) |
| VPS failure (rebuild from backup) | < 2 hours | < 24 hours |
| Database corruption (restore from backup) | < 1 hour | < 24 hours |
| Full disaster recovery | < 4 hours | < 24 hours |

---

## 10. Monitoring & Alerting

### 10.1 PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs innovion --lines 100

# View error logs
tail -f /var/log/innovion/error.log
```

### 10.2 Nginx Access Logs

```bash
# Monitor access logs
tail -f /var/log/nginx/access.log

# Monitor error logs
tail -f /var/log/nginx/error.log

# Check for 5xx errors
grep " 5[0-9][0-9] " /var/log/nginx/access.log | tail -50
```

### 10.3 System Monitoring

```bash
# Install htop for resource monitoring
sudo apt-get install -y htop

# Check disk usage
df -h

# Check memory usage
free -h

# Check CPU usage
top
```

### 10.4 Uptime Monitoring

Configure an external uptime monitor (e.g., UptimeRobot, Better Uptime) to:
- Check `https://yourdomain.com` every 1 minute
- Alert via email/SMS if downtime exceeds 2 minutes
- Monitor `/api/platform/configuration` endpoint for API health

### 10.5 Supabase Monitoring

In Supabase Dashboard:
- **Reports → Database** — Monitor query performance and slow queries
- **Reports → API** — Monitor API request volume and error rates
- **Reports → Auth** — Monitor authentication events and failures
- **Logs → Edge Functions** — Monitor edge function execution

### 10.6 Alert Thresholds

| Metric | Warning | Critical | Action |
|---|---|---|---|
| CPU usage | > 70% | > 90% | Scale VPS or optimise |
| Memory usage | > 75% | > 90% | Restart PM2 or scale |
| Disk usage | > 70% | > 85% | Clean logs or expand storage |
| Error rate (5xx) | > 0.5% | > 2% | Investigate immediately |
| Response time P95 | > 2s | > 5s | Investigate query performance |
| Uptime | < 99.9% | < 99% | Escalate to incident |

---

## 11. Incident Recovery

### 11.1 Incident Severity Levels

| Level | Description | Response Time | Escalation |
|---|---|---|---|
| P1 — Critical | Platform down, data breach, auth failure | Immediate | All hands |
| P2 — High | Major feature broken, > 20% users affected | < 30 min | Engineering lead |
| P3 — Medium | Feature degraded, < 20% users affected | < 2 hours | On-call engineer |
| P4 — Low | Minor issue, workaround available | < 24 hours | Next business day |

### 11.2 P1 Incident Response Procedure

```
1. DETECT: Alert received via monitoring or user report
2. ACKNOWLEDGE: Confirm incident within 5 minutes
3. ASSESS: Determine scope and impact
4. COMMUNICATE: Notify stakeholders
5. MITIGATE: Apply immediate fix or rollback
6. RESOLVE: Confirm resolution
7. POST-MORTEM: Document root cause and prevention
```

### 11.3 Common Incident Scenarios

#### Application Not Responding
```bash
# Check PM2 status
pm2 status

# Restart application
pm2 restart innovion

# Check logs for errors
pm2 logs innovion --lines 50

# If PM2 is down, restart it
pm2 resurrect
```

#### Database Connection Failure
```bash
# Check Supabase status at status.supabase.com
# Verify environment variables are correct
cat /var/www/innovion/.env.production.local | grep SUPABASE

# Test database connection
curl "https://<project-ref>.supabase.co/rest/v1/" \
  -H "apikey: <anon-key>"
```

#### SSL Certificate Expired
```bash
# Renew certificate
sudo certbot renew
sudo systemctl reload nginx
```

#### Disk Full
```bash
# Check disk usage
df -h

# Clean old logs
sudo journalctl --vacuum-time=7d
find /var/log/innovion -name "*.log" -mtime +7 -delete

# Clean old backups
find /backups -name "*.sql.gz" -mtime +14 -delete
```

#### High Memory Usage
```bash
# Check memory
free -h
pm2 list

# Restart application to free memory
pm2 restart innovion

# If persistent, check for memory leaks in logs
pm2 logs innovion --lines 200 | grep -i "memory\|heap"
```

---

## 12. Post-Deployment Verification

### 12.1 Smoke Tests

Execute these tests immediately after deployment:

```bash
# 1. Verify application is running
curl -I https://yourdomain.com
# Expected: HTTP/2 200

# 2. Verify API is responding
curl https://yourdomain.com/api/platform/configuration \
  -H "Authorization: Bearer <test-token>"
# Expected: JSON response with configuration

# 3. Verify static assets load
curl -I https://yourdomain.com/_next/static/chunks/main.js
# Expected: HTTP/2 200 with Cache-Control header

# 4. Verify SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com < /dev/null 2>&1 | grep "Verify return code"
# Expected: Verify return code: 0 (ok)
```

### 12.2 Functional Verification Checklist

- [ ] Marketing homepage loads correctly
- [ ] User can register a new account
- [ ] Email verification works (check Resend dashboard)
- [ ] User can log in
- [ ] Onboarding flow completes successfully
- [ ] Dashboard loads with correct data
- [ ] Can create a new job
- [ ] Can create a new contractor
- [ ] Notifications appear in real-time
- [ ] Billing page shows correct subscription status
- [ ] Stripe checkout redirects correctly (test with test card)
- [ ] Settings can be saved
- [ ] Logout works correctly

### 12.3 Performance Verification

```bash
# Test response time
curl -o /dev/null -s -w "%{time_total}\n" https://yourdomain.com
# Expected: < 2.0 seconds

# Test API response time
curl -o /dev/null -s -w "%{time_total}\n" https://yourdomain.com/api/platform/configuration \
  -H "Authorization: Bearer <token>"
# Expected: < 1.0 seconds
```

---

## 13. Deployment Log Template

Record every deployment in the deployment log:

```
Deployment Date: _______________
Deployed By: _______________
Version/Commit: _______________
Migrations Applied: _______________
Environment Variables Changed: _______________
Pre-Deployment Backup: _______________
Deployment Duration: _______________
Smoke Tests: PASS / FAIL
Issues Encountered: _______________
Rollback Required: YES / NO
Sign-off: _______________
```

---

*Runbook version 1.0 | Generated: 2026-07-31 | Classification: Internal — Engineering — CONFIDENTIAL*
