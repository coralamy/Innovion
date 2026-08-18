# Production Deployment Log — A/B/D Migration Chain

Chronological record of the actual deployment. Entries are appended as steps
complete. Times are UTC.

---

## Gate results

| Gate | Verdict | Evidence |
| --- | --- | --- |
| A1 ledger absent | CLEAR | `2_1_ledger_exists = 0` |
| A2 baseline unchanged | CLEAR | company_access 13 · views 4/4 · secdef 21/18 — all six match |
| A3 FK unchanged | CLEAR | `NO ACTION` |
| A4 orphan role grants | CLEAR | 0 |
| A5 ledger creation proven | CLEAR | CLI 2.115.0 rehearsal, runbook §8 |
| A6 backup freshness | **WAIVED** | see below |
| A7 Team B/D hash drift | CLEAR | no drift, 18/18 files match `VERIFIED_AGAINST` |
| A8 staged file count | CLEAR | 56/56, 56 distinct versions, 0 differ from source |
| A9 `--include-all` | enforced by `deploy.ps1` at §4 | |

---

## A6 WAIVER — recorded 2026-08-18

**Waived by:** Founder, explicitly, on the record.

**Stated grounds:** "Production holds no material business data."

**Restore point of record:** scheduled backup completed **2026-08-18 16:01:21 UTC**.

**Corroborating measurement.** §2 against production returned
`ref_companies_total = 1`, `ref_role_grants = 0`, `ref_jobs = 0`. The §5 restore
verification independently returned `companies 1`, `jobs 0`. A6 exists so that a
rollback loses little data between the restore point and the deployment; with no
role grants and no jobs there is nothing material to lose and no write traffic to
create a gap.

**Why the waiver was needed rather than a fresh backup.** Three backups aged past
the 60-minute window in succession while an unrelated connectivity fault was
diagnosed — the direct-connection hostname
`db.hdncgxmanqsixhkxdlml.supabase.co` publishes an AAAA record only and the
deploying machine has no routable IPv6 address. Each new backup aged out during
that diagnosis. The waiver ends the cycle; it does not paper over an unknown.

**What the waiver does NOT cover.** The 16:01:21 backup remains the only restore
point. Rollback under runbook §9 restores to that instant. Any production write
after 16:01:21 UTC is outside coverage. Nothing else in §2 or §5 is affected, and
no other abort condition is relaxed.

**Residual risk accepted:** loss of any data written after 16:01:21 UTC in the
event of a §9 restore. Assessed as negligible on measured volumes.

---

## Runbook §3.0 — deployment directory assembled

**Completed** before §3.

    C:\Users\gamya\innovion-deploy-stage\supabase\migrations\

| Check | Result |
| --- | --- |
| Team A / B / D files | 38 + 14 + 4 = **56** |
| A8 file count | 56/56 — CLEAR |
| Distinct version prefixes | 56 — no duplicates |
| Byte-for-byte vs source | 0 files differ |
| A7 hash drift | none — 18/18 match |
| Integration suites | security 121 · schema ok · app 72 · controls ok · workforce 123 · integration 141 · replay 47 — 0 failures |

`config.toml` written with a placeholder `project_id`; the deployment uses
`--db-url` and does not rely on it.

---

## Connectivity fault and correction

The runbook §3 instruction to use the **direct connection** on port 5432 cannot be
followed from this machine.

| Finding | |
| --- | --- |
| `db.hdncgxmanqsixhkxdlml.supabase.co` | AAAA only — `2406:da14:25a:5800:…`; no A record |
| Deploying machine | no routable IPv6 on any interface |
| Project health | alive — REST host answers HTTP 401 |
| `aws-0-ap-southeast-2.pooler.supabase.com` | A records present; TCP 5432 reachable |

**Correction:** use the **session pooler** on port 5432 (`postgres.<ref>` username
form). Session mode supports the transactions, advisory locks and DDL migrations
require. Port 6543 is transaction mode and cannot run migrations — `deploy.ps1`
rejects it.

The runbook is to be amended to record this.

---

## §3 — ledger baseline

Not yet executed. Awaiting a working connection string.

---

## §4 — push

Not yet executed.

---

## §10 — post-deployment verification

Not yet executed.
