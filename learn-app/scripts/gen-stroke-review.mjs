// Generates a native-speaker review package from the real content files:
//   review/stroke-review.html          — every letter animated over its glyph
//   review/native-speaker-review.md    — all text to read + a stroke checklist
// Run: node scripts/gen-stroke-review.mjs
// Uses the SAME stroke data and rendering geometry as the app, so anything the
// reviewer flags here is exactly what a learner would see.

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
const concepts = JSON.parse(readFileSync(join(root, 'src/content/concepts.json'), 'utf8'));
const conceptById = new Map(concepts.map((c) => [c.id, c]));

// Pair each glyph with its romanization / name from script-data, in app order.
const letters = [...VOWELS, ...CONSONANTS]
  .filter((l) => LETTER_STROKES[l.telugu])
  .map((l) => ({ ...l, ...LETTER_STROKES[l.telugu], group: VOWELS.includes(l) ? 'Vowel' : 'Consonant' }));

// ── plain-language stroke description (a text proxy for the visual) ──
const zoneX = (x) => (x < 38 ? 'left' : x > 62 ? 'right' : 'centre');
const zoneY = (y) => (y < 38 ? 'top' : y > 62 ? 'bottom' : 'middle');
const zone = ([x, y]) => `${zoneY(y)}-${zoneX(x)}`;
function direction(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (Math.hypot(dx, dy) < 12) return 'loops back near the start';
  const dirs = ['→ right', '↘ down-right', '↓ down', '↙ down-left', '← left', '↖ up-left', '↑ up', '↗ up-right'];
  const idx = Math.round((Math.atan2(dy, dx) / (Math.PI / 4) + 8)) % 8;
  return dirs[idx];
}
const describe = (s) => `starts ${zone(s[0])}, ${direction(s[0], s[s.length - 1])}, ends ${zone(s[s.length - 1])}`;

// ── HTML review page ──
const cards = letters.map((l, i) => `
  <figure class="card" data-i="${i}">
    <svg viewBox="0 0 100 100" aria-label="Stroke order for ${l.telugu}"></svg>
    <figcaption>
      <b lang="te">${l.telugu}</b> <span class="rom">${l.roman}</span>
      ${l.name ? `<span class="nm">${l.name}</span>` : ''}
      <span class="cnt">${l.strokes.length} stroke${l.strokes.length > 1 ? 's' : ''}</span>
    </figcaption>
    <div class="row">
      <button class="replay" type="button">▶ Replay</button>
      <label class="ok"><input type="checkbox" data-k="ok-${i}"> looks right</label>
      <label class="flag"><input type="checkbox" data-k="flag-${i}"> ⚑ wrong</label>
    </div>
    <textarea class="note" data-k="note-${i}" placeholder="What's wrong? (stroke order, direction, shape…)"></textarea>
  </figure>`).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Telugu Bata — stroke-order review</title>
<style>
  :root { --ink:#251208; --muted:#6B4630; --saffron:#D95F0A; --teal:#006E6D; --cream:#FDF6EB; --card:#fff; --border:rgba(217,95,10,.2); }
  * { box-sizing:border-box; }
  body { margin:0; font-family:'DM Sans',system-ui,sans-serif; background:var(--cream); color:var(--ink); line-height:1.5; }
  header { padding:1.25rem 1rem; max-width:1100px; margin:0 auto; }
  h1 { margin:.2rem 0; }
  .lead { color:var(--muted); max-width:60ch; }
  .lead b { color:var(--ink); }
  .toolbar { position:sticky; top:0; z-index:5; background:var(--cream); border-bottom:1px solid var(--border); padding:.6rem 1rem; display:flex; gap:.75rem; align-items:center; flex-wrap:wrap; max-width:1100px; margin:0 auto; }
  .toolbar button { border:1.5px solid var(--teal); color:var(--teal); background:none; border-radius:10px; padding:.45rem .9rem; font:inherit; cursor:pointer; }
  .count { color:var(--muted); font-size:.9rem; }
  h2 { max-width:1100px; margin:1.5rem auto .5rem; padding:0 1rem; }
  .grid { max-width:1100px; margin:0 auto; padding:0 1rem 3rem; display:grid; gap:1rem; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); }
  .card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:.75rem; }
  .card.flagged { border-color:var(--saffron); box-shadow:0 0 0 2px rgba(217,95,10,.15); }
  .card.done { opacity:.6; }
  svg { width:100%; aspect-ratio:1; background:var(--cream); border-radius:10px; display:block; }
  .glyph { font-size:72px; font-family:'Noto Sans Telugu','Nirmala UI','Gautami',sans-serif; fill:var(--ink); opacity:.14; }
  .sp { fill:none; stroke:var(--teal); stroke-width:3; stroke-linecap:round; stroke-linejoin:round; }
  .sp.draw { stroke:var(--saffron); }
  .arrow { fill:none; stroke:var(--saffron); stroke-width:1.6; stroke-linecap:round; }
  .num { font-size:7px; font-weight:700; fill:var(--saffron); }
  .dot { fill:var(--saffron); }
  figcaption { margin:.5rem 0 .35rem; }
  figcaption b { font-size:1.4rem; font-family:'Noto Sans Telugu','Nirmala UI',sans-serif; }
  .rom { color:var(--saffron); font-weight:700; margin-left:.35rem; }
  .nm { color:var(--muted); font-size:.85rem; margin-left:.35rem; }
  .cnt { display:block; color:var(--muted); font-size:.78rem; }
  .row { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; font-size:.85rem; }
  .replay { border:1px solid var(--border); background:none; border-radius:8px; padding:.3rem .6rem; font:inherit; cursor:pointer; }
  .flag { color:var(--saffron); }
  .note { width:100%; margin-top:.5rem; min-height:2.2rem; border:1px solid var(--border); border-radius:8px; padding:.4rem; font:inherit; resize:vertical; display:none; }
  .card.flagged .note { display:block; }
</style></head>
<body>
<header>
  <h1>Telugu Bata — stroke-order review</h1>
  <p class="lead">Each letter animates in the <b>stroke order the app teaches</b>, drawn over the real font glyph (faded). Numbered arrows show where each stroke starts and which way it goes. Please check, for every letter: <b>(1)</b> the number of strokes, <b>(2)</b> the order, <b>(3)</b> the direction of each stroke, and <b>(4)</b> whether the strokes roughly match the real letter shape. Tick <b>looks right</b> or <b>⚑ wrong</b> + a note. Your ticks/notes are saved in this browser; use <b>Export notes</b> to send them back.</p>
</header>
<div class="toolbar">
  <button id="replayAll" type="button">▶ Replay all</button>
  <button id="export" type="button">⬇ Export notes</button>
  <span class="count" id="progress"></span>
</div>
<h2>అచ్చులు · Vowels</h2>
<div class="grid" id="vowels">${cards}</div>
<script>
const LETTERS = ${JSON.stringify(letters.map((l) => ({ telugu: l.telugu, roman: l.roman, name: l.name ?? '', strokes: l.strokes, group: l.group })))};
const SVGNS = 'http://www.w3.org/2000/svg';
function smoothPath(pts){ if(pts.length<2) return 'M '+pts[0][0]+' '+pts[0][1]; let d='M '+pts[0][0]+' '+pts[0][1]; for(let i=1;i<pts.length-1;i++){const mx=(pts[i][0]+pts[i+1][0])/2,my=(pts[i][1]+pts[i+1][1])/2; d+=' Q '+pts[i][0]+' '+pts[i][1]+' '+mx+' '+my;} const L=pts[pts.length-1]; return d+' L '+L[0]+' '+L[1]; }
function startAngle(s){ const a=s[0], b=s[Math.min(2,s.length-1)]; return Math.atan2(b[1]-a[1], b[0]-a[0])*180/Math.PI; }
function el(tag,attrs){ const e=document.createElementNS(SVGNS,tag); for(const k in attrs) e.setAttribute(k,attrs[k]); return e; }

// split into two grids by group
const grid = document.getElementById('vowels');
const consHeading = document.createElement('h2'); consHeading.textContent='హల్లులు · Consonants';
const consGrid = document.createElement('div'); consGrid.className='grid'; consGrid.id='cons';
let placedCons=false;

document.querySelectorAll('.card').forEach((card,i)=>{
  const L=LETTERS[i];
  if(L.group==='Consonant' && !placedCons){ grid.after(consHeading); consHeading.after(consGrid); placedCons=true; }
  if(L.group==='Consonant') consGrid.appendChild(card);
  const svg=card.querySelector('svg');
  const text=el('text',{x:50,y:79,'text-anchor':'middle',class:'glyph',lang:'te'}); text.textContent=L.telugu; svg.appendChild(text);
  const paths=[];
  L.strokes.forEach((s,si)=>{
    const p=el('path',{d:smoothPath(s),class:'sp'}); svg.appendChild(p); paths.push(p);
    const g=el('g',{transform:'translate('+s[0][0]+' '+s[0][1]+')',class:'arrow-g'});
    const a=el('g',{transform:'rotate('+startAngle(s)+')'});
    a.appendChild(el('path',{d:'M -2 0 L 7 0 M 4 -3 L 7 0 L 4 3',class:'arrow'})); g.appendChild(a);
    if(L.strokes.length>1){ const n=el('text',{x:-4,y:-3,class:'num'}); n.textContent=si+1; g.appendChild(n); }
    svg.appendChild(g);
  });
  const dot=el('circle',{r:3,class:'dot',opacity:0}); svg.appendChild(dot);
  card.animate=()=>{
    let si=0; const start=performance.now();
    paths.forEach(p=>{const len=p.getTotalLength(); p.style.strokeDasharray=len; p.style.strokeDashoffset=len; p.classList.add('draw');});
    function frame(now){
      if(si>=paths.length){ dot.setAttribute('opacity',0); paths.forEach(p=>{p.style.strokeDashoffset=0;p.classList.remove('draw');}); return; }
      const p=paths[si], len=p.getTotalLength(), t=Math.min(1,(now-start-si*950)/850);
      if(t<0){ requestAnimationFrame(frame); return; }
      p.style.strokeDashoffset=len*(1-t);
      const pt=p.getPointAtLength(len*t); dot.setAttribute('cx',pt.x); dot.setAttribute('cy',pt.y); dot.setAttribute('opacity',1);
      if(t>=1) si++;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };
  card.querySelector('.replay').onclick=card.animate;
  setTimeout(card.animate, 150 + i*40);
});

// persistence
const KEY='telugu-stroke-review';
const state=JSON.parse(localStorage.getItem(KEY)||'{}');
function refresh(){
  let done=0, flagged=0;
  document.querySelectorAll('.card').forEach((card,i)=>{
    const ok=state['ok-'+i], fl=state['flag-'+i];
    card.classList.toggle('flagged',!!fl); card.classList.toggle('done',!!ok&&!fl);
    if(ok||fl) done++; if(fl) flagged++;
  });
  document.getElementById('progress').textContent=done+' / '+LETTERS.length+' reviewed · '+flagged+' flagged';
}
document.querySelectorAll('[data-k]').forEach(inp=>{
  const k=inp.dataset.k;
  if(inp.type==='checkbox'){ inp.checked=!!state[k]; inp.onchange=()=>{state[k]=inp.checked; localStorage.setItem(KEY,JSON.stringify(state)); refresh();}; }
  else { inp.value=state[k]||''; inp.oninput=()=>{state[k]=inp.value; localStorage.setItem(KEY,JSON.stringify(state));}; }
});
refresh();
document.getElementById('replayAll').onclick=()=>document.querySelectorAll('.card').forEach((c,i)=>setTimeout(c.animate,i*40));
document.getElementById('export').onclick=()=>{
  const lines=['# Stroke review notes',''];
  LETTERS.forEach((L,i)=>{
    const ok=state['ok-'+i], fl=state['flag-'+i], note=(state['note-'+i]||'').trim();
    if(!ok&&!fl&&!note) return;
    lines.push('- '+L.telugu+' ('+L.roman+'): '+(fl?'⚑ WRONG':'ok')+(note?' — '+note:''));
  });
  const blob=new Blob([lines.join('\\n')],{type:'text/markdown'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='stroke-review-notes.md'; a.click();
};
</script>
</body></html>`;

writeFileSync(join(outDir, 'stroke-review.html'), html);

// ── Markdown review doc ──
const md = [];
md.push('# Telugu Bata — native-speaker review');
md.push('');
md.push('_Auto-generated from the app content. Two things need a native Telugu speaker before real learners use the site: **(A) the letter stroke order/geometry** and **(B) the example sentences**. The stroke ORDER is easiest to check visually — open `stroke-review.html` in a browser and watch each letter draw. This file lists the same letters as text plus every sentence to read._');
md.push('');
md.push('---');
md.push('');
md.push('## A. Letter stroke checklist');
md.push('');
md.push('For each letter, `stroke-review.html` animates the strokes in this order. Confirm the **count, order, and direction** are how the letter is actually handwritten. The "described as" column is a text summary of what the app does — flag anything wrong.');
md.push('');
for (const group of ['Vowel', 'Consonant']) {
  md.push(`### ${group === 'Vowel' ? 'అచ్చులు · Vowels' : 'హల్లులు · Consonants'}`);
  md.push('');
  md.push('| Letter | Sound | Strokes | Described as (in app order) | ✔ / ⚑ + notes |');
  md.push('|---|---|---|---|---|');
  for (const l of letters.filter((x) => x.group === group)) {
    const steps = l.strokes.map((s, i) => `${i + 1}) ${describe(s)}`).join('; ');
    md.push(`| ${l.telugu} | ${l.roman}${l.name ? ` (${l.name})` : ''} | ${l.strokes.length} | ${steps} | |`);
  }
  md.push('');
}
md.push('---');
md.push('');
md.push('## B. Example sentences');
md.push('');
md.push(`These ${concepts.filter((c) => c.example).length} sentences appear on the word cards. Check each is **natural, correct, and simple** (everyday register, no idioms), the **romanization matches**, and the **English gloss is right**. The "for the word" column is the vocab item the sentence is meant to illustrate.`);
md.push('');
md.push('| For the word | Telugu sentence | Romanization | English | ✔ / ✎ notes |');
md.push('|---|---|---|---|---|');
for (const c of concepts) {
  if (!c.example) continue;
  const word = `${c.telugu} — ${c.english}`;
  md.push(`| ${word} | ${c.example.telugu} | ${c.example.transliteration} | ${c.example.english} | |`);
}
md.push('');
md.push('---');
md.push('');
md.push('## C. Letter names / romanizations (quick read)');
md.push('');
md.push('Confirm each transliteration is the standard one you would teach.');
md.push('');
md.push('| Letter | Romanization | Name/note in app |');
md.push('|---|---|---|');
for (const l of letters) md.push(`| ${l.telugu} | ${l.roman} | ${l.name ?? ''} |`);
md.push('');

writeFileSync(join(outDir, 'native-speaker-review.md'), md.join('\n'));

console.log(`Wrote:
  review/stroke-review.html        (${letters.length} letters, animated)
  review/native-speaker-review.md  (${letters.length} letters + ${concepts.filter((c) => c.example).length} sentences)`);
