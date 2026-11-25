// _pd_probe2.cjs — Precision Door: find the PNG logo rows + sample brand colors from real banners.
const { Pool } = require('pg');
const cc = require('./services/campaignCreator.cjs');
const { chromium } = require('playwright');
const _fetch = global.fetch || require('node-fetch');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = (t,p)=>pool.query(t,p);
const B='Precision Garage Door Service';
async function fetchBuf(url){ const r=await _fetch(url); if(!r.ok) throw new Error(String(r.status)); return Buffer.from(await r.arrayBuffer()); }
function magic(buf){ const h=buf.slice(0,8).toString('hex').toUpperCase();
  if(h.startsWith('89504E47'))return'PNG'; if(h.startsWith('FFD8'))return'JPEG'; if(h.startsWith('25504446'))return'PDF';
  if(h.startsWith('252150')||h.startsWith('C5D0D3C6'))return'EPS'; if(h.startsWith('3C3F786D')||h.startsWith('3C737667'))return'SVG';
  if(h.startsWith('49492A00')||h.startsWith('4D4D002A'))return'TIFF'; return'other('+h.slice(0,8)+')'; }
async function sampleColors(page, dataUri){
  return await page.evaluate(async (src)=>{
    const img=new Image(); await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=src;});
    const w=Math.min(500,img.naturalWidth||500), h=Math.round((img.naturalHeight||300)*(w/(img.naturalWidth||500)));
    const c=document.createElement('canvas'); c.width=w;c.height=h; const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,w,h);
    let d; try{ d=ctx.getImageData(0,0,w,h).data; }catch(e){ return ['ERR:'+e.message]; }
    function sl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);const l=(mx+mn)/2;if(mx===mn)return[0,l];const dd=mx-mn;return[l>.5?dd/(2-mx-mn):dd/(mx+mn),l];}
    const map={};
    for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3]; if(a<200)continue; const [s,l]=sl(r,g,b); if(s<0.3||l<0.12||l>0.9)continue; const key=Math.round(r/20)*20+','+Math.round(g/20)*20+','+Math.round(b/20)*20; if(!map[key])map[key]={n:0,r:0,g:0,b:0}; map[key].n++;map[key].r+=r;map[key].g+=g;map[key].b+=b;}
    const hex=o=>'#'+[o.r,o.g,o.b].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
    return Object.values(map).map(o=>({n:o.n,r:Math.round(o.r/o.n),g:Math.round(o.g/o.n),b:Math.round(o.b/o.n)})).sort((a,b)=>b.n-a.n).slice(0,8).map(o=>hex(o)+' x'+o.n);
  }, dataUri);
}
async function alphaInfo(page, dataUri){
  return await page.evaluate(async (src)=>{
    const img=new Image(); await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=src;});
    const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
    let d; try{ d=ctx.getImageData(0,0,c.width,c.height).data; }catch(e){ return 'ERR:'+e.message; }
    let tr=0,op=0,dark=0,light=0;
    for(let i=0;i<d.length;i+=4){ if(d[i+3]<40)tr++; else {op++; const lum=(d[i]+d[i+1]+d[i+2])/3; if(lum<70)dark++; if(lum>185)light++;} }
    return c.width+'x'+c.height+' transparent='+Math.round(100*tr/(tr+op))+'% darkOfOpaque='+Math.round(100*dark/Math.max(1,op))+'% lightOfOpaque='+Math.round(100*light/Math.max(1,op))+'%';
  }, dataUri);
}
async function resolveRow(row){ let u=null; try{ if(row.bf_asset_id) u=await cc.resolveBrandAssetUrl(row.bf_asset_id); }catch(e){} return u||row.image_url||null; }
(async()=>{
  // every logo row with format + fetchability
  const logos=await q("SELECT name, extension, bf_asset_id, image_url FROM brand_assets WHERE brand=$1 AND name ILIKE '%logo%' ORDER BY name, extension",[B]);
  const browser=await chromium.launch({ executablePath:'/usr/bin/google-chrome-stable', args:['--no-sandbox'] });
  const page=await browser.newPage();
  console.log('=== logo rows (name | ext | fetch) ===');
  const fetched={};
  for(const row of logos.rows){
    const url=await resolveRow(row); if(!url){ console.log(row.name+' | '+row.extension+' | NO URL'); continue; }
    try{ const buf=await fetchBuf(url); const m=magic(buf); console.log(row.name+' | '+row.extension+' | ok '+buf.length+'b '+m);
      if(m==='PNG' && !fetched[row.name]) fetched[row.name]={buf}; }
    catch(e){ console.log(row.name+' | '+row.extension+' | FAIL '+e.message); }
  }
  // alpha + colors on the reversed and primary PNGs we got
  for(const key of Object.keys(fetched)){
    if(/reversed|primary|secondary/i.test(key)){
      const du='data:image/png;base64,'+fetched[key].buf.toString('base64');
      console.log('\n'+key+' ALPHA: '+await alphaInfo(page,du));
      if(/primary|secondary/i.test(key)) console.log('  COLORS:\n   '+(await sampleColors(page,du)).join('\n   '));
    }
  }
  // brand colors from real marketing banners (US)
  const banners=[
    'Precision Garage Door Service Static Display Banner Ad From Uh Oh to Oh Wow Same Day Service Quality Craftsmanship Fixed Fast US 970x250',
    'Precision Garage Door Service Static Display Banner Ad Hero Service Brand Get a Garage Door You Are Proud to Call Your Own US 728x90',
  ];
  for(const bn of banners){
    const r=(await q("SELECT bf_asset_id, image_url FROM brand_assets WHERE brand=$1 AND name=$2 LIMIT 1",[B,bn])).rows[0];
    if(!r){ console.log('\nBANNER missing: '+bn); continue; }
    const url=await resolveRow(r); if(!url){ console.log('\nBANNER no url: '+bn); continue; }
    try{ const buf=await fetchBuf(url); const m=magic(buf); if(m==='PNG'||m==='JPEG'){ const du='data:'+(m==='PNG'?'image/png':'image/jpeg')+';base64,'+buf.toString('base64'); console.log('\nBANNER COLORS ['+bn.slice(-18)+'] ('+m+'):\n   '+(await sampleColors(page,du)).join('\n   ')); } else console.log('\nBANNER '+bn.slice(-18)+' not raster: '+m); }
    catch(e){ console.log('\nBANNER fail '+bn.slice(-18)+': '+e.message); }
  }
  await browser.close(); await pool.end();
  console.log('\nPD_PROBE2_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
