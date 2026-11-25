// _pd_art.cjs — Create precision-door-demo brand master + verify photos + generate 16 headers + body photos.
// Precision green #044F3B / cream #E7D3AE. Header: green panel + logo + green headline + cream CTA + swoosh.
// Logo: prefers a local pd-logo.png (full-color oval, if present); else the white reversed PNG from Brandfolder.
// Run detached: cd ~/mark && curl ... -o _pd_art.cjs && nohup doppler run -- node _pd_art.cjs > _pd_art.log 2>&1 &
const cc = require('./services/campaignCreator.cjs');
const fs = require('fs');
const { Pool } = require('pg');
const { chromium } = require('playwright');
const _fetch = global.fetch || require('node-fetch');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = (t,p)=>pool.query(t,p);
const B='Precision Garage Door Service';
const GREEN='#044F3B', CREAM='#E7D3AE', BASE='brand-masters/precision-door';
const PUB='https://auabkpiibobnznasyebl.supabase.co/storage/v1/object/public/franchise-flyers/';
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function buildHeader({ photoUrl, logoUrl, headline, panel=GREEN, headlineColor=GREEN, cta=CREAM, ctaText=GREEN, swoosh=GREEN, edge=CREAM, width=1200, height=310 }){
  return '<!doctype html><html><head><meta charset="utf-8"><style>'
   +'*{margin:0;padding:0;box-sizing:border-box}html,body{width:'+width+'px;height:'+height+'px;overflow:hidden}'
   +'.stage{position:relative;width:'+width+'px;height:'+height+'px;background:#fff;font-family:Arial,Helvetica,sans-serif}'
   +'.panel{position:absolute;left:0;top:0;bottom:0;width:30%;background:'+panel+';display:flex;align-items:center;justify-content:center;padding:28px}'
   +'.edge{position:absolute;left:calc(30% - 10px);top:0;bottom:0;width:18px;background:'+edge+';transform:skewX(-7deg);}'
   +'.logo{max-width:86%;max-height:70%;object-fit:contain}'
   +'.photo{position:absolute;right:0;top:0;bottom:0;width:38%;object-fit:cover;object-position:center}'
   +'.swoosh{position:absolute;top:0;bottom:0;right:33%;width:170px;height:100%}'
   +'.mid{position:absolute;left:30%;top:0;bottom:0;width:38%;padding:36px 34px;display:flex;flex-direction:column;justify-content:center}'
   +'.hl{color:'+headlineColor+';font-size:43px;line-height:1.04;font-weight:900;letter-spacing:-1px}'
   +'.cta{display:inline-block;margin-top:20px;background:'+cta+';color:'+ctaText+';font-size:19px;font-weight:bold;padding:11px 24px;border-radius:8px;align-self:flex-start}'
   +'.fr{margin-top:13px;color:#777;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em}'
   +'</style></head><body><div class="stage">'
   +'<div class="panel"><img class="logo" src="'+logoUrl+'"></div>'
   +'<div class="edge"></div>'
   +'<img class="photo" src="'+esc(photoUrl)+'">'
   +'<svg class="swoosh" viewBox="0 0 170 310" preserveAspectRatio="none"><path d="M170,-10 Q-30,155 170,320 Z" fill="'+swoosh+'"/></svg>'
   +'<div class="mid"><div class="hl">'+esc(headline)+'</div><div class="cta">Schedule Today</div><div class="fr">Independently Owned and Operated Franchise</div></div>'
   +'</div></body></html>';
}
async function fetchBuf(url){ const r=await _fetch(url); if(!r.ok) throw new Error('fetch '+r.status); return Buffer.from(await r.arrayBuffer()); }
async function allRows(name){ return (await q("SELECT bf_asset_id, image_url FROM brand_assets WHERE brand=$1 AND name=$2",[B,name])).rows; }
async function resolveRow(row){ let u=null; try{ if(row.bf_asset_id) u=await cc.resolveBrandAssetUrl(row.bf_asset_id); }catch(e){} return u||row.image_url||null; }
// robust: try every row for a name until one fetches
async function fetchByName(name){
  const rows=await allRows(name); if(!rows.length) throw new Error('NO_ASSET: '+name);
  let lastErr='no rows';
  for(const row of rows){ const u=await resolveRow(row); if(!u){ lastErr='no url'; continue; } try{ return await fetchBuf(u); }catch(e){ lastErr=e.message; } }
  throw new Error('ALL_403: '+name+' ('+lastErr+')');
}
async function getWhiteLogo(){
  // local full-color oval logo wins if David dropped one
  if(fs.existsSync('pd-logo.png')) return { buf: fs.readFileSync('pd-logo.png'), src:'local pd-logo.png' };
  const rows=(await q("SELECT bf_asset_id, image_url, name FROM brand_assets WHERE brand=$1 AND name ILIKE '%Reversed%' ORDER BY (name ILIKE '%US%') DESC",[B])).rows;
  for(const row of rows){ const u=await resolveRow(row); if(!u) continue; try{ const buf=await fetchBuf(u); if(buf.slice(0,4).toString('hex')==='89504e47') return { buf, src:row.name }; }catch(e){} }
  return null;
}
async function downscale(page, buf, maxW){
  const src='data:image/jpeg;base64,'+buf.toString('base64');
  return await page.evaluate(async (args)=>{
    const {src, maxW} = args;
    const img=new Image(); await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=src;});
    const scale=Math.min(1, maxW/img.naturalWidth);
    const w=Math.round(img.naturalWidth*scale), h=Math.round(img.naturalHeight*scale);
    const c=document.createElement('canvas'); c.width=w;c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
    return { w, h, data: c.toDataURL('image/jpeg', 0.82) };
  }, {src, maxW});
}
async function photo(page, name, maxW){
  const buf=await fetchByName(name); const ds=await downscale(page, buf, maxW);
  return { data: ds.data, buf: Buffer.from(ds.data.split(',')[1],'base64'), w: ds.w, h: ds.h };
}
async function ensureFranchise(){
  const ex=await q("SELECT id FROM franchises WHERE slug='precision-door-demo'");
  if(ex.rows[0]) return { id: ex.rows[0].id, created:false };
  const pitch="Precision Garage Door Service is a professional garage door company and part of the Neighborly family of home-service brands. Our work is done by background-checked, uniformed technicians who drive marked vans. You get a clear, up-front price before any work begins, our workmanship is backed by the Neighborly Done Right Promise, and we offer same-day service when the schedule allows. From broken springs and openers to cables, rollers, off-track doors, and brand-new garage door installation, we fix it fast and we fix it right.";
  const listen=['garage door','garage door opener','opener','spring','torsion spring','extension spring','broken spring','cable','roller','track','off track','off-track','panel','garage door repair','new garage door','door won\'t open','door won\'t close','remote','keypad','safety sensor','sensor','LiftMaster','Chamberlain','Genie','weather seal','bottom seal','hinge','drum','bearing plate','opener install'];
  const ins=await q(`INSERT INTO franchises
    (slug,dba_name,owner_name,owner_email,phone,website,city,state,zip,timezone,
     labor_rate_hourly,service_fee_flat,credit_card_fee_pct,van_stock_fee_pct,
     work_start_hour,work_end_hour,work_days,is_active,saas_tier,
     primary_color,accent_color,cartesia_voice_id,agent_name,personality,
     primary_lat,primary_lng,phone_estimates_enabled,territory_label,booking_test_mode,
     business_pitch,brand,listen_words,crm,booking_days_ahead,estimate_fee,
     campaigns_enabled,daily_sms_cap,mark_sells_memberships,mentor_enabled,ridealong_enabled,
     created_at,updated_at)
    VALUES
    ('precision-door-demo','Precision Garage Door Service (Demo)','David Queen','dlqueensr@gmail.com','+15302914435','https://precisiondoor.net','Folsom','CA','95630','America/Los_Angeles',
     149.00,79.00,0.0300,0.0609,
     8,17,'{1,2,3,4,5}',true,'tier3',
     $1,$2,'86e30c1d-714b-4074-a1f2-1cb6b552fb49','Mark','folksy',
     38.678,-121.1761,true,'Serving',true,
     $3,'Precision Garage Door Service',$4,'servicetitan',45,'0',
     false,200,false,true,true,
     now(),now())
    RETURNING id`,[GREEN, CREAM, pitch, listen]);
  const id=ins.rows[0].id;
  await q("UPDATE franchises SET master_pricebook_franchise_id=$1 WHERE id=$1",[id]);
  return { id, created:true };
}
const P='Precision Garage Door Service Photo ';
const D=[
 { n:'01', hl:"We haven't seen you in a while.", hdr:P+'Technician Greeting Customer at Front Door US 1',                 body:P+'Technician Reviewing Tablet with Customer in Garage US 1' },
 { n:'02', hl:"Still need a garage door pro?",    hdr:P+'Technician Standing Beside Branded Service Van US 1',             body:P+'Commercial Overhead Doors at Warehouse US' },
 { n:'03', hl:"Welcome to Precision.",            hdr:P+'Representative Greeting Customer at Front Door US 1',             body:P+'Technician Explaining Garage Door Hardware to Customer US 1' },
 { n:'04', hl:"Welcome aboard.",                  hdr:P+'Representative Reviewing Garage Door Options with Customer US 1', body:P+'Representative Showing Garage Door Options on Tablet US 1' },
 { n:'05', hl:"Thank You!",                       hdr:P+'Technician Shaking Hands with Customer at Front Door US 1',       body:P+'Couple Admiring White Garage Door US 1' },
 { n:'06', hl:"We appreciate your business.",     hdr:P+'Technician Reviewing Phone with Customer Outside Garage US 1',    body:P+'Technician Working on Garage Door Opener US 1' },
 { n:'07', hl:"Spring garage door tune-up.",      hdr:P+'Technician Inspecting Garage Door Cable and Track US 1',          body:P+'Technician Adjusting Garage Door Safety Sensor US' },
 { n:'08', hl:"Keep it running all summer.",      hdr:P+'Technician Working on Garage Door Roller Track US 1',             body:P+'Father and Daughter Playing Basketball by Garage US 1' },
 { n:'09', hl:"Get ahead of winter.",             hdr:P+'Technician Working on Garage Door Opener from Ladder US 1',       body:P+'Technician Working on Garage Door Spring US 1' },
 { n:'10', hl:"Don't get stuck this winter.",     hdr:P+'Technician Standing Beside Branded Service Van US 2',             body:P+'Technician Inspecting Raised Garage Door US 1' },
 { n:'11', hl:"Happy New Year.",                  hdr:P+'Couple Admiring White Garage Door US 2',                         body:P+'Representative Showing Garage Door Panel Sample to Customer US 1' },
 { n:'12', hl:"Presidents Day Savings.",          hdr:P+'Representative Discussing Garage Door Options Outside Home US 1',  body:P+'Technician Holding Replacement Garage Door Spring US 1' },
 { n:'13', hl:"Memorial Day Savings.",            hdr:P+'Representative Standing Outside Green Garage Door US 1',           body:P+'Technician Working on Garage Door Opener US 2' },
 { n:'14', hl:"July 4th Savings.",                hdr:P+'Technician Standing Beside Branded Service Van US 3',             body:P+'Family Leaving Home with School and Work Bags US 1' },
 { n:'15', hl:"Labor Day Savings.",               hdr:P+'Technician Standing with Arms Crossed Beside Branded Van US',     body:P+'Technician Repairing Garage Door Panel Hardware US 1' },
 { n:'16', hl:"Black Friday Savings.",            hdr:P+'Couple with Dog Outside White Garage Door US',                   body:P+'Representative Showing Garage Door Sample to Customer US 1' },
];
(async()=>{
  const fr=await ensureFranchise();
  console.log('FRANCHISE '+(fr.created?'CREATED':'EXISTS')+' id='+fr.id+' slug=precision-door-demo');
  const logo=await getWhiteLogo();
  if(!logo){ console.log('ERR no usable logo'); process.exit(1); }
  console.log('LOGO source='+logo.src+' bytes='+logo.buf.length);
  const logoDataUri='data:image/png;base64,'+logo.buf.toString('base64');
  const lu=await cc.uploadImageToStorage(logo.buf, BASE+'/logo-header.png', 'image/png');
  console.log('LOGO '+(lu.ok?'hosted':('FAIL:'+lu.error)));
  // SANITY: verify a photo fetches before the full run (Precision logos were 403)
  try{ const t=await fetchByName(D[0].hdr); console.log('PHOTO_CHECK ok '+t.length+'b — photos are reachable'); }
  catch(e){ console.log('PHOTO_CHECK FAILED: '+e.message+'\\nABORT — garage-door photos are locked like the logos. Will need another path.'); await pool.end(); process.exit(1); }
  const browser=await chromium.launch({ executablePath:'/usr/bin/google-chrome-stable', args:['--no-sandbox'] });
  const dpage=await browser.newPage();
  const rpage=await browser.newPage({ viewport:{width:1200,height:310}, deviceScaleFactor:1 });
  for(const d of D){
    try{
      const hp=await photo(dpage, d.hdr, 1100);
      const html=buildHeader({ photoUrl: hp.data, logoUrl: logoDataUri, headline: d.hl });
      await rpage.setContent(html, { waitUntil:'load' });
      const png=await rpage.screenshot({ type:'png', clip:{x:0,y:0,width:1200,height:310} });
      const hu=await cc.uploadPngToStorage(png, BASE+'/headers/'+d.n+'.png');
      const bp=await photo(dpage, d.body, 1200);
      const bu=await cc.uploadImageToStorage(bp.buf, BASE+'/photos/body-'+d.n+'.jpg', 'image/jpeg');
      console.log(d.n+'  hdr '+(hu.ok?'ok '+hp.w+'x'+hp.h:('FAIL:'+hu.error))+'  | body '+(bu.ok?'ok '+bp.buf.length+'b':('FAIL:'+bu.error))+'  | '+d.hl);
    }catch(e){ console.log(d.n+'  ERROR '+e.message); }
  }
  await browser.close(); await pool.end();
  console.log('\nHeaders:  '+PUB+BASE+'/headers/01.png .. 16.png  (logo: '+logo.src+')');
  console.log('PD_ART_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
