// _pd_probe.cjs — Precision Garage Door: discovery + logo format + real brand color sampling.
// Run: cd ~/mark && curl ... -o _pd_probe.cjs && doppler run -- node _pd_probe.cjs
const { Pool } = require('pg');
const cc = require('./services/campaignCreator.cjs');
const { chromium } = require('playwright');
const _fetch = global.fetch || require('node-fetch');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = (t,p)=>pool.query(t,p);
async function fetchBuf(url){ const r=await _fetch(url); if(!r.ok) throw new Error('fetch '+r.status); return Buffer.from(await r.arrayBuffer()); }
function magic(buf){ const h=buf.slice(0,8).toString('hex').toUpperCase();
  if(h.startsWith('89504E47'))return'PNG'; if(h.startsWith('FFD8'))return'JPEG'; if(h.startsWith('25504446'))return'PDF';
  if(h.startsWith('252150')||h.startsWith('C5D0D3C6'))return'EPS'; if(h.startsWith('49492A00')||h.startsWith('4D4D002A'))return'TIFF';
  return 'other('+h+')'; }
async function sampleColors(page, dataUri){
  return await page.evaluate(async (src)=>{
    const img=new Image(); await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=src;});
    const w=Math.min(500,img.naturalWidth||500), h=Math.round((img.naturalHeight||300)*(w/(img.naturalWidth||500)));
    const c=document.createElement('canvas'); c.width=w;c.height=h; const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,w,h);
    let d; try{ d=ctx.getImageData(0,0,w,h).data; }catch(e){ return ['ERR:'+e.message]; }
    function sl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);const l=(mx+mn)/2;if(mx===mn)return[0,l];const dd=mx-mn;return[l>.5?dd/(2-mx-mn):dd/(mx+mn),l];}
    const map={};
    for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3]; if(a<200)continue; const [s,l]=sl(r,g,b); if(s<0.22||l<0.1||l>0.92)continue; const key=Math.round(r/20)*20+','+Math.round(g/20)*20+','+Math.round(b/20)*20; if(!map[key])map[key]={n:0,r:0,g:0,b:0}; map[key].n++;map[key].r+=r;map[key].g+=g;map[key].b+=b;}
    const hex=o=>'#'+[o.r,o.g,o.b].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
    return Object.values(map).map(o=>({n:o.n,r:Math.round(o.r/o.n),g:Math.round(o.g/o.n),b:Math.round(o.b/o.n)})).sort((a,b)=>b.n-a.n).slice(0,8).map(o=>hex(o)+' x'+o.n);
  }, dataUri);
}
async function alphaInfo(page, dataUri){
  return await page.evaluate(async (src)=>{
    const img=new Image(); await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=src;});
    const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
    let d; try{ d=ctx.getImageData(0,0,c.width,c.height).data; }catch(e){ return 'ERR:'+e.message; }
    let tr=0,op=0,dark=0;
    for(let i=0;i<d.length;i+=4){ if(d[i+3]<40)tr++; else {op++; if(d[i]<70&&d[i+1]<70&&d[i+2]<70)dark++;} }
    return c.width+'x'+c.height+' transparent='+Math.round(100*tr/(tr+op))+'% darkOfOpaque='+Math.round(100*dark/Math.max(1,op))+'%';
  }, dataUri);
}
async function resolveByName(B,name){
  const r=await q("SELECT bf_asset_id, image_url, extension FROM brand_assets WHERE brand=$1 AND name=$2 LIMIT 1",[B,name]);
  if(!r.rows[0]) return {ext:null,url:null};
  const row=r.rows[0]; let u=null; try{ if(row.bf_asset_id) u=await cc.resolveBrandAssetUrl(row.bf_asset_id); }catch(e){}
  return {ext:row.extension, url:u||row.image_url||null};
}
(async()=>{
  const brands=await q("SELECT DISTINCT brand FROM brand_assets");
  const B=(brands.rows.find(r=>/precision/i.test(r.brand))||{}).brand || 'Precision Garage Door Service';
  console.log('=== brand string: "'+B+'" ===');
  const exists=await q("SELECT id,slug,dba_name,brand FROM franchises WHERE slug ILIKE '%precision%' OR brand ILIKE '%precision%'");
  console.log('existing Precision franchises: '+JSON.stringify(exists.rows));
  const hdrs=await q("SELECT name FROM brand_assets WHERE brand=$1 AND (name ILIKE '%header%' OR name ILIKE '%email%' OR name ILIKE '%banner%' OR name ILIKE '%display ad%') ORDER BY name",[B]);
  console.log('\n=== header/banner/email assets ('+hdrs.rows.length+') ===\n'+hdrs.rows.map(r=>r.name).join('\n'));
  const logos=await q("SELECT name FROM brand_assets WHERE brand=$1 AND name ILIKE '%logo%' ORDER BY name",[B]);
  console.log('\n=== logo assets ('+logos.rows.length+') ===\n'+logos.rows.map(r=>r.name).join('\n'));
  // probe candidate logos
  const browser=await chromium.launch({ executablePath:'/usr/bin/google-chrome-stable', args:['--no-sandbox'] });
  const page=await browser.newPage();
  const want=['white','reversed','knockout','rev'];
  const whiteName=(logos.rows.find(r=>want.some(w=>new RegExp(w,'i').test(r.name)))||{}).name;
  const fullName=(logos.rows.find(r=>/full color|fullcolor|rgb/i.test(r.name)&&!/black/i.test(r.name))||logos.rows[0]||{}).name;
  for(const [label,name] of [['WHITE/REVERSED',whiteName],['FULL-COLOR',fullName]]){
    if(!name){ console.log('\n'+label+': none found'); continue; }
    const r=await resolveByName(B,name); if(!r.url){ console.log('\n'+label+' "'+name+'": NO URL (ext='+r.ext+')'); continue; }
    try{ const buf=await fetchBuf(r.url); const m=magic(buf); console.log('\n'+label+' "'+name+'": ext='+r.ext+' bytes='+buf.length+' format='+m);
      if(m==='PNG'){ const du='data:image/png;base64,'+buf.toString('base64'); console.log('  ALPHA: '+await alphaInfo(page,du)); if(label==='FULL-COLOR'){ console.log('  COLORS:\n   '+(await sampleColors(page,du)).join('\n   ')); } }
    }catch(e){ console.log('\n'+label+' "'+name+'": FETCH_FAIL '+e.message); }
  }
  // sample colors from a banner too
  const ban=hdrs.rows[0];
  if(ban){ const r=await resolveByName(B,ban.name); if(r.url){ try{ const buf=await fetchBuf(r.url); const m=magic(buf); if(m==='PNG'||m==='JPEG'){ const du='data:'+(m==='PNG'?'image/png':'image/jpeg')+';base64,'+buf.toString('base64'); console.log('\nBANNER COLORS "'+ban.name+'" ('+m+'):\n   '+(await sampleColors(page,du)).join('\n   ')); } }catch(e){} } }
  await browser.close();
  const photos=await q("SELECT name FROM brand_assets WHERE brand=$1 AND name ILIKE '%Photo%' ORDER BY name",[B]);
  console.log('\n=== photo assets ('+photos.rows.length+') ===\n'+photos.rows.map(r=>r.name).join('\n'));
  await pool.end();
  console.log('\nPD_PROBE_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
