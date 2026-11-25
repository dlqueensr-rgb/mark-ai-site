// _as_art.cjs — Create aire-serv-demo brand master + generate 16 HVAC headers + 16 body photos.
// Header: navy logo panel (inline white reversed logo) + navy headline + red CTA + red swoosh + photo
// (aspect-preserving downscale, inline). Body photos: aspect-preserving downscale, hosted on Supabase.
// Run: cd ~/mark && curl ... -o _as_art.cjs && doppler run -- node _as_art.cjs
const cc = require('./services/campaignCreator.cjs');
const { Pool } = require('pg');
const { chromium } = require('playwright');
const _fetch = global.fetch || require('node-fetch');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = (t,p)=>pool.query(t,p);
const B='Aire Serv';
const NAVY='#0033A0', RED='#D8262F', BASE='brand-masters/aire-serv';
const PUB='https://auabkpiibobnznasyebl.supabase.co/storage/v1/object/public/franchise-flyers/';
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function buildHeader({ photoUrl, logoUrl, headline, panel=NAVY, headlineColor=NAVY, cta=RED, swoosh=RED, width=1200, height=310 }){
  return '<!doctype html><html><head><meta charset="utf-8"><style>'
   +'*{margin:0;padding:0;box-sizing:border-box}html,body{width:'+width+'px;height:'+height+'px;overflow:hidden}'
   +'.stage{position:relative;width:'+width+'px;height:'+height+'px;background:#fff;font-family:Arial,Helvetica,sans-serif}'
   +'.panel{position:absolute;left:0;top:0;bottom:0;width:30%;background:'+panel+';display:flex;align-items:center;justify-content:center;padding:30px}'
   +'.logo{max-width:84%;max-height:62%;object-fit:contain}'
   +'.photo{position:absolute;right:0;top:0;bottom:0;width:38%;object-fit:cover;object-position:center}'
   +'.swoosh{position:absolute;top:0;bottom:0;right:33%;width:170px;height:100%}'
   +'.mid{position:absolute;left:30%;top:0;bottom:0;width:38%;padding:36px 30px;display:flex;flex-direction:column;justify-content:center}'
   +'.hl{color:'+headlineColor+';font-size:44px;line-height:1.03;font-weight:900;letter-spacing:-1px}'
   +'.cta{display:inline-block;margin-top:20px;background:'+cta+';color:#fff;font-size:19px;font-weight:bold;padding:11px 24px;border-radius:8px;align-self:flex-start}'
   +'.fr{margin-top:13px;color:#666;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em}'
   +'</style></head><body><div class="stage">'
   +'<div class="panel"><img class="logo" src="'+logoUrl+'"></div>'
   +'<img class="photo" src="'+esc(photoUrl)+'">'
   +'<svg class="swoosh" viewBox="0 0 170 310" preserveAspectRatio="none"><path d="M170,-10 Q-30,155 170,320 Z" fill="'+swoosh+'"/></svg>'
   +'<div class="mid"><div class="hl">'+esc(headline)+'</div><div class="cta">Schedule Today</div><div class="fr">Independently Owned and Operated Franchise</div></div>'
   +'</div></body></html>';
}
async function resolveByName(name){
  const r = await q("SELECT bf_asset_id, image_url FROM brand_assets WHERE brand=$1 AND name=$2 LIMIT 1",[B,name]);
  if(!r.rows[0]) return null;
  const row=r.rows[0]; let u=null; try{ if(row.bf_asset_id) u=await cc.resolveBrandAssetUrl(row.bf_asset_id); }catch(e){}
  return u||row.image_url||null;
}
async function fetchBuf(url){ const r=await _fetch(url); if(!r.ok) throw new Error('fetch '+r.status); return Buffer.from(await r.arrayBuffer()); }
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
  const u=await resolveByName(name); if(!u) throw new Error('NO_ASSET: '+name);
  const orig=await fetchBuf(u); const ds=await downscale(page, orig, maxW);
  return { data: ds.data, buf: Buffer.from(ds.data.split(',')[1],'base64'), w: ds.w, h: ds.h };
}
async function ensureFranchise(){
  const ex=await q("SELECT id FROM franchises WHERE slug='aire-serv-demo'");
  if(ex.rows[0]) return { id: ex.rows[0].id, created:false };
  const pitch="Aire Serv is a professional heating and air conditioning company and part of the Neighborly family of home-service brands. Our work is done by licensed, background-checked HVAC technicians who wear uniforms and drive marked vans. You get a clear, up-front price before any work begins, our workmanship is backed by the Neighborly Done Right Promise, and we clean up when we're done. From AC and furnace repair to tune-ups, thermostats, air quality, and system replacement, we keep your home comfortable, and we offer same-day service when the schedule allows.";
  const listen=['AC','air conditioner','air conditioning','furnace','heat pump','thermostat','smart thermostat','tune-up','HVAC','condenser','compressor','refrigerant','ductwork','ducts','vents','air filter','air handler','heating','cooling','AC repair','furnace repair','mini split','ductless','indoor air quality','no cool','no heat','capacitor','blower motor','evaporator coil','SEER','condensate'];
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
    ('aire-serv-demo','Aire Serv (Demo)','David Queen','dlqueensr@gmail.com','+15302914435','https://aireserv.com','Folsom','CA','95630','America/Los_Angeles',
     165.00,89.00,0.0300,0.0609,
     8,17,'{1,2,3,4,5}',true,'tier3',
     $1,$2,'86e30c1d-714b-4074-a1f2-1cb6b552fb49','Mark','folksy',
     38.678,-121.1761,true,'Serving',true,
     $3,'Aire Serv',$4,'servicetitan',45,'0',
     false,200,false,true,true,
     now(),now())
    RETURNING id`,[NAVY, RED, pitch, listen]);
  const id=ins.rows[0].id;
  await q("UPDATE franchises SET master_pricebook_franchise_id=$1 WHERE id=$1",[id]);
  return { id, created:true };
}
const P='Aire Serv Photo ';
const D=[
 { n:'01', hl:"We haven't seen you in a while.", hdr:P+'Technician Greeting Customer at Front Door',                      body:P+'Technician and Customer Reviewing Tablet in Kitchen 1' },
 { n:'02', hl:"Still need HVAC you can trust?",    hdr:P+'Technician Standing beside Branded Service Van US 1',              body:P+'Technician with Arms Crossed beside Rear of Branded Van US' },
 { n:'03', hl:"Welcome to Aire Serv.",            hdr:P+'Technician Greeting Family at Front Door 1',                       body:P+'Technician Explaining Smart Thermostat to Customer 1' },
 { n:'04', hl:"Welcome aboard.",                  hdr:P+'Technician and Customer Reviewing Tablet at Dining Table 1',       body:P+'Technician Servicing Outdoor Air Conditioner with Manifold Gauges CAN 1' },
 { n:'05', hl:"Thank You!",                       hdr:P+'Technician Shaking Hands with Customer Outdoors',                  body:P+'Technician Explaining Outdoor Air Conditioner to Couple 1' },
 { n:'06', hl:"We appreciate your business.",     hdr:P+'Technician and Customer Reviewing Tablet beside Outdoor Air Conditioner 1', body:P+'Technician Reviewing Tablet with Customer beside Outdoor Air Conditioner' },
 { n:'07', hl:"Get ready for cooling season.",    hdr:P+'Technician Servicing Outdoor Air Conditioner with Manifold Gauges', body:P+'Technician Holding Air Filter Close Up' },
 { n:'08', hl:"Beat the summer heat.",            hdr:P+'Technician Discussing Outdoor Air Conditioner with Customer 1',     body:P+'Technician Explaining Outdoor Air Conditioner to Customer 1' },
 { n:'09', hl:"Get ahead of heating season.",     hdr:P+'Technician Explaining Furnace to Woman 1',                         body:P+'Technician Explaining Furnace to Man 1' },
 { n:'10', hl:"Keep your home warm this winter.", hdr:P+'Technician Holding Tool Bag beside Branded Van outside Snow Covered Home US', body:P+'Technician Explaining Furnace to Man 2' },
 { n:'11', hl:"Happy New Year.",                  hdr:P+'Technician Holding Tool Bag beside Branded Van US 1',              body:P+'Technician Adjusting Round Smart Thermostat Close Up 1' },
 { n:'12', hl:"Presidents Day Savings.",          hdr:P+'Technician Explaining Smart Thermostat to Customer 2',             body:P+'Technician Standing beside Outdoor Air Conditioner' },
 { n:'13', hl:"Memorial Day Savings.",            hdr:P+'Technician Explaining Outdoor Air Conditioner to Couple 2',        body:P+'Family Relaxing Together on Sofa 1' },
 { n:'14', hl:"July 4th Savings.",                hdr:P+'Technician Holding Tool Bag beside Branded Van US 2',              body:P+'Technician Servicing Outdoor Air Conditioner with Manifold Gauges CAN 2' },
 { n:'15', hl:"Labor Day Savings.",               hdr:P+'Technician with Arms Crossed beside Branded Van US',               body:P+'Technician Discussing Outdoor Air Conditioner with Customer 2' },
 { n:'16', hl:"Black Friday Savings.",            hdr:P+'Technician Standing beside Branded Service Van US 2',              body:P+'Technician and Couple Reviewing Tablet in Kitchen' },
];
(async()=>{
  const fr=await ensureFranchise();
  console.log('FRANCHISE '+(fr.created?'CREATED':'EXISTS')+' id='+fr.id+' slug=aire-serv-demo');
  // white reversed logo straight from Brandfolder
  const logoUrl=await resolveByName('Aire Serv Logo Reversed US CMYK');
  if(!logoUrl){ console.log('ERR could not resolve reversed logo'); process.exit(1); }
  const logoBuf=await fetchBuf(logoUrl);
  const logoDataUri='data:image/png;base64,'+logoBuf.toString('base64');
  const lu=await cc.uploadImageToStorage(logoBuf, BASE+'/logo-header.png', 'image/png');
  console.log('LOGO '+(lu.ok?('hosted '+logoBuf.length+'b'):('FAIL:'+lu.error)));
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
  console.log('\nHeaders:  '+PUB+BASE+'/headers/01.png .. 16.png');
  console.log('Body pics: '+PUB+BASE+'/photos/body-01.jpg .. body-16.jpg');
  console.log('AS_ART_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
