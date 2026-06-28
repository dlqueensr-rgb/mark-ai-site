#!/usr/bin/env node
"use strict";
const https = require('https');
const { getPool } = require('./services/db.cjs');
const FRANCHISE_ID = '3f74befb-3db6-41b7-8348-63b7f932e7f1';
const COMMIT = process.argv.includes('--commit');
const EMAIL_URL = 'https://raw.githubusercontent.com/dlqueensr-rgb/mark-ai-site/main/assets/promo_presidents_email.html';
const CAMPAIGN_NAME = 'Mark AI — Presidents Day Sale (Residential)';
const TERMS = 'Minimum 2 hours labor. Offer ends Mon Feb 22, 2027. Labor only. Cannot be combined with other offers or membership pricing.';
const SMS_BODY = "Hi {firstName}, happy Presidents Day! We're celebrating with {offerAmount} off labor this weekend only — minimum 2 hrs, book by Mon Feb 22. Call {campaignPhone} to schedule. — {companyName}";
const CONFIG = {
  send_window: { tz:'America/Los_Angeles', days:[1,2,3,4,5,6,7], start_hour:9, end_hour:19 },
  tracking_phone: '(916) 234-0885',
  st_campaign_name: 'Mark AI — Presidents Day Sale',
  offer: { type:'percent', amount:'20', expires_days:10, terms:TERMS }
};
const PROMO_START='2027-02-12'; const PROMO_END='2027-02-16';
function fetchUrl(url){return new Promise((res,rej)=>{https.get(url,r=>{if(r.statusCode!==200)return rej(new Error('HTTP '+r.statusCode));let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);});}
async function main(){
  const emailBody=await fetchUrl(EMAIL_URL);
  if(!emailBody||emailBody.length<1000)throw new Error('email body looks wrong');
  if(!emailBody.includes('{offerTerms}'))throw new Error('missing {offerTerms}');
  const p=getPool();const client=await p.connect();
  try{
    const dup=await client.query("SELECT id FROM drip_campaigns WHERE franchise_id=$1 AND name ILIKE '%Presidents Day Sale%'",[FRANCHISE_ID]);
    if(dup.rows.length){console.log('ABORT: exists id='+dup.rows[0].id);process.exit(0);}
    console.log(COMMIT?'=== COMMIT ===':'=== DRY RUN ===');
    console.log('Email:',emailBody.length,'bytes');
    if(!COMMIT){
      console.log('  campaign:',CAMPAIGN_NAME);
      console.log('  offer: PERCENT 20% off labor, expires 10 days, min 2hrs');
      console.log('  window:',PROMO_START,'..',PROMO_END,'/ blast 9999/day');
      console.log('\nRe-run with --commit');process.exit(0);
    }
    await client.query('BEGIN');
    const smsT=await client.query("INSERT INTO drip_templates(franchise_id,name,channel,subject,body)VALUES($1,$2,'sms',NULL,$3)RETURNING id",[FRANCHISE_ID,'Presidents Day Sale SMS — Residential',SMS_BODY]);
    const emT=await client.query("INSERT INTO drip_templates(franchise_id,name,channel,subject,body)VALUES($1,$2,'email',$3,$4)RETURNING id",[FRANCHISE_ID,'Presidents Day Sale Email — Residential','Presidents Day Sale — {offerAmount} off labor this weekend, {firstName}',emailBody]);
    const camp=await client.query("INSERT INTO drip_campaigns(franchise_id,name,goal,channels,approval_status,created_by,config,status)VALUES($1,$2,'promo',$3,'draft',$4,$5,'paused')RETURNING id",[FRANCHISE_ID,CAMPAIGN_NAME,['sms','email'],'David Queen <dlqueensr@gmail.com>',JSON.stringify(CONFIG)]);
    const cid=camp.rows[0].id;
    await client.query("INSERT INTO drip_steps(campaign_id,step_index,channel,delay_hours,template_id)VALUES($1,0,'sms',0,$2)",[cid,smsT.rows[0].id]);
    await client.query("INSERT INTO drip_steps(campaign_id,step_index,channel,delay_hours,template_id)VALUES($1,1,'email',24,$2)",[cid,emT.rows[0].id]);
    await client.query("INSERT INTO drip_autoenroll_map(franchise_id,segment,campaign_id,months,channel_need,project_label,daily_limit,enabled,notes,customer_type,promo_start_date,promo_end_date)VALUES($1,'all_dialable',$2,NULL,'sms','your home',9999,false,'Presidents Day Sale — promo Feb12-16 2027','residential',$3,$4)",[FRANCHISE_ID,cid,PROMO_START,PROMO_END]);
    await client.query('COMMIT');
    console.log('=== BUILT === campaign id:',cid,'sms:',smsT.rows[0].id,'email:',emT.rows[0].id);
    console.log('GO-LIVE:\n  UPDATE drip_campaigns SET approval_status=\'approved\',status=\'active\' WHERE id='+cid+';\n  UPDATE drip_autoenroll_map SET enabled=true WHERE campaign_id='+cid+';');
    process.exit(0);
  }catch(e){try{await client.query('ROLLBACK');}catch(_){}console.log('ERR',e.message);process.exit(1);}
  finally{client.release();}
}
main().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
