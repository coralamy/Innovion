import { readFileSync } from 'node:fs';
import pg from 'pg';
const raw=readFileSync('C:/Users/gamya/innovion-deploy-stage/.dburl','utf8').trim();
const b=raw.replace(/^postgres(ql)?:\/\//,''); const at=b.lastIndexOf('@');
const ui=b.slice(0,at); let hp=b.slice(at+1); const c=ui.indexOf(':');
let database='postgres'; const sl=hp.indexOf('/'); if(sl>=0){database=hp.slice(sl+1).split('?')[0]||'postgres';hp=hp.slice(0,sl);}
let port=5432; const pc=hp.lastIndexOf(':'); if(pc>=0){port=parseInt(hp.slice(pc+1),10)||5432;hp=hp.slice(0,pc);}
const cl=new pg.Client({user:ui.slice(0,c),password:ui.slice(c+1),host:hp,port,database,ssl:{rejectUnauthorized:false},statement_timeout:120000,application_name:'innovion-teamA-postdeploy'});
await cl.connect(); await cl.query('SET default_transaction_read_only = on');
const row=(await cl.query(readFileSync('./POSTDEPLOY_SECTION_10_CHECKS.sql','utf8'))).rows[0];
const expect={'10_1_applied_total':57,'10_2_company_access_remaining':0,'10_2_views_bypassing_rls':0,'10_2_secdef_unpinned':0,'10_2_tables_without_rls':0,'10_3_fk_on_delete':'CASCADE','10_4_refresh_triggers':2};
let bad=0;
console.log('RUNBOOK SECTION 10 - POST-DEPLOYMENT VERIFICATION\n');
for (const [k,v] of Object.entries(row)) {
  let tag='';
  if (k in expect){ const ok=String(expect[k])===String(v); if(!ok)bad++; tag = ok?'   PASS':`   *** FAIL expected ${expect[k]} ***`; }
  console.log(`  ${k.padEnd(32)} ${String(v).padStart(10)}${tag}`);
}
console.log(`\ngated: ${Object.keys(expect).length-bad}/${Object.keys(expect).length} pass`);
const ir=(await cl.query(`select policyname, cmd, permissive, coalesce(qual,with_check,'') e from pg_policies where schemaname='public' and tablename='issue_reports' order by policyname`)).rows;
console.log('\nissue_reports policies now (' + ir.length + '):');
ir.forEach(r=>console.log(`  ${r.policyname.padEnd(36)} ${r.cmd.padEnd(7)} ${r.permissive.padEnd(11)} ${r.e.slice(0,60)}`));
const irc=(await cl.query(`select count(*)::int a, count(company_id)::int b from public.issue_reports`)).rows[0];
console.log(`issue_reports rows: ${irc.a}, with a tenant: ${irc.b}`);
await cl.end();
if (bad) process.exitCode=1;
