// _as_probe.cjs — Aire Serv: detect logo formats + sample real brand colors before building.
// Run: cd ~/mark && curl ... -o _as_probe.cjs && doppler run -- node _as_probe.cjs
const { Pool } = require('pg');
const cc = require('./services/campaignCreator.cjs');
const { chromium } = require('playwright');
const _fetch = global.fetch || require('node-fetch');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = (t,p)=>pool.query(t,p);
const B='Aire Serv';
async function resolveByName(name){
  const r = await q("SELECT bf_asset_id, image_url, extension FROM brand_assets WHERE brand=$1 AND name=$2 LIMIT 1",[B,name]);
  if(!r.rows[0]) return { ext:null, url:null };
  const row=r.rows[0]; let u=null; try{ if(row.bf_asset_id) u=await cc.resolveBrandAssetUrl(row.bf_asset_id); }catch(e){}
  return { ext:row.extension, url:u||row.image_url||null };
}
async function fetchBuf(url){ const r=await _fetch(url); if(!r.ok) throw new Error('fetch '+r.status); return Buffer.from(await r.arrayBuffer()); }
function magic(buf){
  const h=buf.slice(0,8).toString('hex').toUpperCase();
  if(h.startsWith('89504E47')) return 'PNG';
  if(h.startsWith('FFD8')) return 'JPEG';
  if(h.startsWith('25504446')) return 'PDF';
  if(h.startsWith('252150')||h.startsWith('C5D0D3C6')) return 'EPS';
  if(h.startsWith('49492A00')||h.startsWith('4D4D002A')) return 'TIFF';
  if(h.startsWith('52494646')) return 'WEBP/RIFF';
  return 'other('+h+')';
}
async function sampleColors(page, dataUri){
  return await page.evaluate(async (src)=>{
    const img=new Image(); await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=src;});
    const w=Math.min(500,img.naturalWidth||500), h=Math.round((img.naturalHeight||300)*(w/(img.naturalWidth||500)));
    const c=document.createElement('canvas'); c.width=w;c.height=h; const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,w,h);
    let d; try{ d=ctx.getImageData(0,0,w,h).data; }catch(e){ return ['ERR:'+e.message]; }
    function sat(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);const l=(mx+mn)/2;if(mx===mn)return[0,l];const dd=mx-mn;return[l>.5?dd/(2-mx-mn):dd/(mx+mn),l];}
    const map={};
    for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3]; if(a<200)continue; const [s,l]=sat(r,g,b); if(s<0.22||l<0.1||l>0.92)continue; const key=Math.round(r/20)*20+','+Math.round(g/20)*20+','+Math.round(b/20)*20; if(!map[key])map[key]={n:0,r:0,g:0,b:0}; map[key].n++;map[key].r+=r;map[key].g+=g;map[key].b+=b;}
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
(async()=>{
  const targets = {
    'Reversed US CMYK':'Aire Serv Logo Reversed US CMYK',
    'Black US RGB':'Aire Serv Logo Black US RGB',
    'Full Color US RGB':'Aire Serv Logo Full Color US RGB',
    'Banner Cooling':'Aire Serv Static Display Banner Ad Set Here to Serv Cooling US',
    'Banner Heating':'Aire Serv Static Display Banner Ad Set Here to Serv Heating US',
  };
  const got = {};
  for(const [k,name] of Object.entries(targets)){
    const r = await resolveByName(name);
    if(!r.url){ console.log(k+': NO URL (ext='+r.ext+')'); continue; }
    try{ const buf=await fetchBuf(r.url); got[k]={buf,ext:r.ext}; console.log(k+': ext='+r.ext+' bytes='+buf.length+' format='+magic(buf)); }
    catch(e){ console.log(k+': FETCH_FAIL '+e.message); }
  }
  const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome-stable', args:['--no-sandbox'] });
  const page = await browser.newPage();
  for(const k of ['Black US RGB','Reversed US CMYK']){
    if(got[k] && magic(got[k].buf)==='PNG'){ const du='data:image/png;base64,'+got[k].buf.toString('base64'); console.log('\nALPHA '+k+': '+await alphaInfo(page,du)); }
  }
  for(const k of ['Full Color US RGB','Banner Cooling','Banner Heating']){
    if(got[k]){ const m=magic(got[k].buf); if(m==='PNG'||m==='JPEG'){ const du='data:'+(m==='PNG'?'image/png':'image/jpeg')+';base64,'+got[k].buf.toString('base64'); console.log('\nCOLORS '+k+' ('+m+'):\n  '+(await sampleColors(page,du)).join('\n  ')); } else console.log('\nCOLORS '+k+': not raster ('+m+')'); }
  }
  await browser.close(); await pool.end();
  console.log('\nAS_PROBE_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
