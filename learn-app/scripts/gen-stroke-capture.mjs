// Generates review/stroke-capture.html — an authoring tool a native Telugu
// writer uses to record the correct strokes for each of the 51 base letters.
// The reviewer writes each letter once (finger/mouse); each continuous pen
// motion is one stroke, captured in order and direction. Output is a JSON
// file that scripts/apply-captured-strokes.mjs turns into src/content/stroke-data.ts.
//
// The faded guide glyph is drawn at the SAME size/baseline the app uses
// (72px, centre x=50, baseline y=79 in a 0..100 box), so recorded coordinates
// land in the app's coordinate system and overlay the app's guide exactly.
//
// Run: node scripts/gen-stroke-capture.mjs

import { transform } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'review');
mkdirSync(outDir, { recursive: true });

async function loadTs(rel) {
  const src = readFileSync(join(root, rel), 'utf8');
  const js = (await transform(src, { loader: 'ts', format: 'esm' })).code;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}

const { LETTER_STROKES } = await loadTs('src/content/stroke-data.ts');
const { VOWELS, CONSONANTS } = await loadTs('src/content/script-data.ts');

// conceptId per glyph is already correct in LETTER_STROKES (only the coords are
// wrong); reuse it so the exported data keeps the right concept mapping.
const letters = [...VOWELS, ...CONSONANTS]
  .filter((l) => LETTER_STROKES[l.telugu])
  .map((l) => ({
    telugu: l.telugu,
    roman: l.roman,
    name: l.name ?? '',
    conceptId: LETTER_STROKES[l.telugu].conceptId,
    group: VOWELS.includes(l) ? 'Vowel' : 'Consonant',
  }));

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Telugu Bata — stroke capture</title>
<style>
  :root { --ink:#251208; --muted:#6B4630; --saffron:#D95F0A; --teal:#006E6D; --cream:#FDF6EB; --card:#fff; --border:rgba(217,95,10,.25); --green:#1A6B3F; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:'DM Sans',system-ui,sans-serif; background:var(--cream); color:var(--ink); line-height:1.5; }
  .wrap { max-width:640px; margin:0 auto; padding:1rem; }
  h1 { margin:.2rem 0; font-size:1.4rem; }
  .lead { color:var(--muted); font-size:.95rem; }
  .lead b { color:var(--ink); }
  .stage { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:1rem; margin-top:1rem; text-align:center; }
  .letterhead { display:flex; align-items:baseline; justify-content:center; gap:.6rem; }
  .letterhead .g { font-size:2rem; font-family:'Noto Sans Telugu','Nirmala UI',sans-serif; }
  .letterhead .r { color:var(--saffron); font-weight:700; font-size:1.2rem; }
  .letterhead .n { color:var(--muted); font-size:.9rem; }
  canvas { width:100%; max-width:360px; aspect-ratio:1; background:var(--cream); border:1.5px dashed var(--border); border-radius:12px; touch-action:none; cursor:crosshair; margin:.5rem auto; display:block; }
  .strokecount { color:var(--muted); font-size:.9rem; min-height:1.4em; }
  .strokecount b { color:var(--teal); }
  .btns { display:flex; gap:.5rem; flex-wrap:wrap; justify-content:center; margin-top:.5rem; }
  button { border:1.5px solid var(--border); background:var(--card); color:var(--ink); border-radius:10px; padding:.5rem .9rem; font:inherit; cursor:pointer; min-height:44px; }
  button.primary { background:var(--teal); color:#fff; border-color:var(--teal); }
  button.warn { color:var(--saffron); }
  button:disabled { opacity:.4; cursor:default; }
  .nav { display:flex; align-items:center; justify-content:space-between; gap:.5rem; margin-top:1rem; }
  .picker { display:flex; flex-wrap:wrap; gap:4px; margin-top:1rem; justify-content:center; }
  .chip { width:34px; height:34px; border-radius:8px; border:1px solid var(--border); background:var(--card); font-family:'Noto Sans Telugu','Nirmala UI',sans-serif; font-size:1rem; padding:0; }
  .chip.done { background:var(--green); color:#fff; border-color:var(--green); }
  .chip.current { outline:3px solid var(--saffron); }
  .toolbar { position:sticky; top:0; z-index:5; background:var(--cream); padding:.6rem 0; display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; border-bottom:1px solid var(--border); }
  .progress { color:var(--muted); font-size:.9rem; margin-left:auto; }
  .hint { font-size:.85rem; color:var(--muted); margin-top:.4rem; }
  .ok { color:var(--green); font-weight:700; }
</style></head>
<body><div class="wrap">
  <h1>✍️ Telugu stroke capture</h1>
  <p class="lead">Write each letter <b>the way you write it by hand</b>, on top of the faded guide. <b>Each continuous pen motion is one stroke</b> — lift between strokes. Draw the strokes <b>in the order</b> you'd naturally write them (this records the order <i>and</i> the direction). Don't worry about neatness — the shape and order are what matter. Your work saves automatically in this browser. When every letter is green, press <b>Export</b> and send the file back.</p>
  <div class="toolbar">
    <button id="export" class="primary" type="button">⬇ Export captured strokes</button>
    <button id="import" type="button">⬆ Load a saved file</button>
    <input id="importFile" type="file" accept="application/json" hidden>
    <span class="progress" id="progress"></span>
  </div>

  <div class="stage">
    <div class="letterhead"><span class="g" lang="te" id="lg"></span><span class="r" id="lr"></span><span class="n" id="ln"></span></div>
    <canvas id="cv" aria-label="Writing area"></canvas>
    <div class="strokecount" id="sc"></div>
    <div class="btns">
      <button id="undo" class="warn" type="button">↶ Undo last stroke</button>
      <button id="clear" class="warn" type="button">✕ Clear letter</button>
    </div>
    <p class="hint">Tip: numbers show where each stroke started. If the order is wrong, Undo and redraw.</p>
    <div class="nav">
      <button id="prev" type="button">← Previous</button>
      <button id="next" class="primary" type="button">Save &amp; next →</button>
    </div>
  </div>

  <div class="picker" id="picker"></div>
</div>
<script>
const LETTERS = ${JSON.stringify(letters)};
const KEY = 'telugu-stroke-capture-v1';
const store = JSON.parse(localStorage.getItem(KEY) || '{}'); // conceptId -> strokes[][ [x,y] ]
let idx = 0;

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let strokes = [];        // committed strokes for current letter
let live = [];           // in-progress stroke
let drawing = false;

function cur() { return LETTERS[idx]; }
function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#000'; }

function fit() {
  const dpr = window.devicePixelRatio || 1;
  const size = cv.clientWidth;
  if (cv.width !== size*dpr) { cv.width = size*dpr; cv.height = size*dpr; }
}
function draw() {
  fit();
  const S = cv.width / 100;
  ctx.setTransform(S,0,0,S,0,0);
  ctx.clearRect(0,0,100,100);
  ctx.lineCap='round'; ctx.lineJoin='round';
  // faded guide glyph — identical geometry to the app
  ctx.globalAlpha=0.16; ctx.fillStyle=css('--ink');
  ctx.font='72px "Noto Sans Telugu","Nirmala UI",sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillText(cur().telugu, 50, 79);
  ctx.globalAlpha=1;
  const all = live.length>1 ? strokes.concat([live]) : strokes;
  all.forEach((s,i) => {
    ctx.strokeStyle = (i===strokes.length && live.length>1) ? css('--saffron') : css('--teal');
    ctx.lineWidth=3.2;
    ctx.beginPath();
    s.forEach((p,j)=> j? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]));
    ctx.stroke();
    // start number
    ctx.fillStyle=css('--saffron'); ctx.font='bold 7px sans-serif'; ctx.textAlign='left';
    ctx.fillText(String(i+1), s[0][0]-5, s[0][1]-3);
    ctx.beginPath(); ctx.arc(s[0][0],s[0][1],2.2,0,7); ctx.fill();
  });
}
function local(e){ const r=cv.getBoundingClientRect(); return [ (e.clientX-r.left)/r.width*100, (e.clientY-r.top)/r.height*100 ]; }
function thin(pts){ // drop points closer than ~1.6 units to keep files small
  const out=[pts[0]]; for(let i=1;i<pts.length;i++){ const a=out[out.length-1],b=pts[i]; if(Math.hypot(a[0]-b[0],a[1]-b[1])>=1.6) out.push(b); }
  if(out[out.length-1]!==pts[pts.length-1]) out.push(pts[pts.length-1]); return out.map(p=>[Math.round(p[0]*10)/10,Math.round(p[1]*10)/10]); }

cv.addEventListener('pointerdown', e=>{ e.preventDefault(); cv.setPointerCapture(e.pointerId); drawing=true; live=[local(e)]; });
cv.addEventListener('pointermove', e=>{ if(!drawing) return; e.preventDefault(); live.push(local(e)); draw(); });
function endStroke(){ if(!drawing) return; drawing=false; if(live.length>=2) strokes.push(thin(live)); live=[]; persist(); draw(); updateCount(); }
cv.addEventListener('pointerup', endStroke);
cv.addEventListener('pointercancel', endStroke);

function updateCount(){
  document.getElementById('sc').innerHTML = strokes.length
    ? '<b>'+strokes.length+'</b> stroke'+(strokes.length>1?'s':'')+' captured'
    : 'Write the first stroke…';
  renderPicker(); renderProgress();
}
function persist(){ store[cur().conceptId] = strokes; localStorage.setItem(KEY, JSON.stringify(store)); }
function load(i){
  idx=(i+LETTERS.length)%LETTERS.length;
  strokes = (store[cur().conceptId] || []).map(s=>s.map(p=>[...p]));
  live=[];
  document.getElementById('lg').textContent=cur().telugu;
  document.getElementById('lr').textContent=cur().roman;
  document.getElementById('ln').textContent=cur().name?('· '+cur().name):'';
  draw(); updateCount();
}
document.getElementById('undo').onclick=()=>{ strokes.pop(); persist(); draw(); updateCount(); };
document.getElementById('clear').onclick=()=>{ strokes=[]; persist(); draw(); updateCount(); };
document.getElementById('prev').onclick=()=>load(idx-1);
document.getElementById('next').onclick=()=>load(idx+1);

function renderProgress(){
  const done = LETTERS.filter(l=>(store[l.conceptId]||[]).length>0).length;
  document.getElementById('progress').innerHTML = done===LETTERS.length
    ? '<span class="ok">All '+LETTERS.length+' done ✓ — ready to export</span>'
    : done+' / '+LETTERS.length+' letters captured';
}
function renderPicker(){
  const p=document.getElementById('picker'); p.innerHTML='';
  LETTERS.forEach((l,i)=>{
    const b=document.createElement('button');
    b.className='chip'+((store[l.conceptId]||[]).length?' done':'')+(i===idx?' current':'');
    b.lang='te'; b.textContent=l.telugu; b.title=l.roman;
    b.onclick=()=>load(i); p.appendChild(b);
  });
}
document.getElementById('export').onclick=()=>{
  const missing = LETTERS.filter(l=>!(store[l.conceptId]||[]).length);
  const payload = { format:'telugu-stroke-capture', version:1, capturedAt:new Date().toISOString(),
    letters: LETTERS.map(l=>({ telugu:l.telugu, conceptId:l.conceptId, strokes: store[l.conceptId]||[] })) };
  const blob=new Blob([JSON.stringify(payload,null,1)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='captured-strokes.json'; a.click();
  if(missing.length) alert('Exported — but '+missing.length+' letter(s) still have no strokes: '+missing.map(m=>m.telugu).join(' '));
};
document.getElementById('import').onclick=()=>document.getElementById('importFile').click();
document.getElementById('importFile').onchange=e=>{
  const f=e.target.files[0]; if(!f) return; const rd=new FileReader();
  rd.onload=()=>{ try{ const d=JSON.parse(rd.result); (d.letters||[]).forEach(l=>{ if(l.strokes&&l.strokes.length) store[l.conceptId]=l.strokes; }); localStorage.setItem(KEY,JSON.stringify(store)); load(idx); alert('Loaded.'); }catch(err){ alert('Could not read that file.'); } };
  rd.readAsText(f);
};
window.addEventListener('resize', draw);
load(0);
</script>
</body></html>`;

writeFileSync(join(outDir, 'stroke-capture.html'), html);
console.log(`Wrote review/stroke-capture.html (${letters.length} letters to capture)`);
