/* Seating (tab "ترتيب") — weekly seating plan for class 5A only.
   - Desks seat two students. "Neighbours" = the two students sharing a desk.
   - A pair may sit together at most MAX_MONTH times in the same calendar month
     (month of the week's Sunday). New plans respect this as a hard rule and
     also avoid repeating last week's pairs / the same lone student.
   - A new or edited plan is a DRAFT until the teacher presses "Save Seating Plan". Only saved
     plans count towards the neighbour history.
   - Saved plans live in localStorage and in Supabase (seating_plans) once the
     teacher is signed in. Nothing here touches ratings or reports. */
(function(){
'use strict';
const CLASS='5A',PER_ROW=3,MAX_MONTH=2,TRIES=400,SKEY=key+':seating-'+CLASS;
let plans={},draft=null,sel=null,focusNote=false;

/* ---------- helpers ---------- */
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const startOf=s=>addDays(s,-new Date(s+'T12:00:00Z').getUTCDay());
const DN=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate=s=>{const d=new Date(s+'T12:00:00Z');return DN[d.getUTCDay()]+' '+d.getUTCDate()+' '+MN[d.getUTCMonth()]+' '+d.getUTCFullYear()};
const range=w=>fmtDate(w)+' → '+fmtDate(addDays(w,4));
const pk=(a,b)=>a<b?a+'|'+b:b+'|'+a;
const roster=()=>db.classes[CLASS]||[];
const nameOf=id=>(roster().find(s=>s.id===id)||{}).name||'—';
const clone=o=>JSON.parse(JSON.stringify(o));
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
let week=startOf(today);
const isDraft=()=>!!(draft&&draft.week===week);
const shown=()=>isDraft()?draft:(plans[week]||null);
const merged=()=>{const m={...plans};if(draft)m[draft.week]=draft;return m};

/* ---------- storage ---------- */
function loadLocal(){try{const d=JSON.parse(localStorage.getItem(SKEY)||'null');if(d&&d.plans&&typeof d.plans==='object')plans=d.plans}catch{}}
function saveLocal(){try{localStorage.setItem(SKEY,JSON.stringify({version:1,plans}))}catch{}}
const cloud=()=>window.AjyalCloud&&window.AjyalCloud.ready()?window.AjyalCloud.sb():null;
async function pushPlan(w){
 const sb=cloud();if(!sb||!plans[w])return;
 try{const p=plans[w],{error}=await sb.from('seating_plans').upsert({class_name:CLASS,week_start:w,desks:p.desks,note:p.note||'',updated_at:p.updated},{onConflict:'class_name,week_start'});if(error)throw error}
 catch(e){console.error(e);notify('Could not save to the cloud. The plan is saved on this device.')}
}
async function pullCloud(){
 const sb=cloud();if(!sb)return;
 try{
  const {data,error}=await sb.from('seating_plans').select('*').eq('class_name',CLASS);if(error)throw error;
  const seen=new Set();let changed=false;
  for(const r of data){
   seen.add(r.week_start);const l=plans[r.week_start];
   if(!l||new Date(r.updated_at)>new Date(l.updated)){plans[r.week_start]={desks:r.desks,note:r.note||'',updated:r.updated_at};changed=true}
   else if(new Date(l.updated)>new Date(r.updated_at))pushPlan(r.week_start);
  }
  for(const w of Object.keys(plans))if(!seen.has(w))pushPlan(w);
  if(changed){saveLocal();render()}
 }catch(e){console.error(e)}
}

/* ---------- history + generator ---------- */
function monthCounts(mk){
 const c={};
 for(const [w,p] of Object.entries(merged())){
  if(w.slice(0,7)!==mk)continue;
  for(const d of p.desks)if(d[0]&&d[1]){const k=pk(d[0],d[1]);c[k]=(c[k]||0)+1}
 }
 return c;
}
function stats(excl){ /* saved plans only */
 const mk=excl.slice(0,7),month={},all={},single={},rowSum={},rowN={};let prev=null;
 for(const w of Object.keys(plans).sort()){
  if(w===excl)continue;
  if(w<excl)prev=w;
  plans[w].desks.forEach((d,i)=>{
   const r=Math.floor(i/PER_ROW);
   for(const id of d)if(id){rowSum[id]=(rowSum[id]||0)+r;rowN[id]=(rowN[id]||0)+1}
   if(d[0]&&d[1]){const k=pk(d[0],d[1]);all[k]=(all[k]||0)+1;if(w.slice(0,7)===mk)month[k]=(month[k]||0)+1}
   else{const id=d[0]||d[1];if(id)single[id]=(single[id]||0)+1}
  });
 }
 const last=new Set();let lastSingle=null;
 if(prev)plans[prev].desks.forEach(d=>{if(d[0]&&d[1])last.add(pk(d[0],d[1]));else lastSingle=d[0]||d[1]});
 return {month,all,single,rowSum,rowN,last,lastSingle};
}
function generate(ids,st){
 let best=null;
 for(let t=0;t<TRIES;t++){
  const pool=shuffle(ids.slice());let single=null;
  if(pool.length%2){
   let bi=0,bs=1e9;
   pool.forEach((id,i)=>{const s=(st.single[id]||0)*2+(id===st.lastSingle?3:0)+Math.random();if(s<bs){bs=s;bi=i}});
   single=pool.splice(bi,1)[0];
  }
  const left=new Set(pool),pairs=[];let viol=0,cost=0;
  while(left.size){
   const arr=[...left];let pick=null,opts=null;
   for(const a of arr){
    const o=arr.filter(b=>b!==a&&(st.month[pk(a,b)]||0)<MAX_MONTH);
    if(!pick||o.length<opts.length||(o.length===opts.length&&Math.random()<.35)){pick=a;opts=o}
   }
   let partner=null,bs=1e9;
   if(opts.length){
    for(const b of opts){const k=pk(pick,b),s=(st.all[k]||0)*3+(st.month[k]||0)*4+(st.last.has(k)?25:0)+Math.random()*3;if(s<bs){bs=s;partner=b}}
    cost+=bs;
   }else{
    viol++;
    for(const b of arr){if(b===pick)continue;const s=(st.month[pk(pick,b)]||0)+Math.random();if(s<bs){bs=s;partner=b}}
    cost+=1000;
   }
   left.delete(pick);left.delete(partner);pairs.push([pick,partner]);
  }
  if(!best||viol<best.viol||(viol===best.viol&&cost<best.cost))best={pairs,single,viol,cost};
 }
 /* place desks: students who sat furthest back on average are moved to the front */
 const avgRow=id=>st.rowN[id]?st.rowSum[id]/st.rowN[id]:2;
 const units=best.pairs.map(p=>({m:p,s:(avgRow(p[0])+avgRow(p[1]))/2+Math.random()*.8}));
 if(best.single)units.push({m:[best.single,null],s:avgRow(best.single)+Math.random()*.8});
 units.sort((a,b)=>b.s-a.s);
 const desks=units.map(u=>u.m[1]===null?[u.m[0],null]:(Math.random()<.5?[u.m[0],u.m[1]]:[u.m[1],u.m[0]]));
 return {desks,viol:best.viol};
}

/* ---------- view ---------- */
const sec=document.createElement('section');sec.id='seating';sec.className='hidden';sec.setAttribute('dir','ltr');sec.setAttribute('lang','en');
sec.innerHTML='<div class="card"><div id="seatTop"></div><div id="classroom" class="classroom hidden"></div><div id="seatBottom"></div></div>';
document.querySelector('main.shell').appendChild(sec);
const top=sec.querySelector('#seatTop'),room=sec.querySelector('#classroom'),bottom=sec.querySelector('#seatBottom');
const style=document.createElement('style');
style.textContent=[
'#seating .controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}',
'#seating .weeklabel{font-weight:bold;padding:0 6px;direction:ltr}',
'#seating .savebtn{background:var(--green);border-color:var(--green);color:#fff;font-weight:bold}','#seating .savebtn:disabled{opacity:.45;cursor:not-allowed}',
'#seating .draftbar{background:#fcf5e8;color:#8f6b30;border-radius:10px;padding:11px 14px;line-height:1.8;font-size:13px;margin:10px 0}',
'#seating .savedbar{color:var(--green);font-size:13px;margin:8px 0}',
'#seating .warn{background:#fcf5e8;color:#8f6b30;border-radius:10px;padding:12px;line-height:1.8;font-size:13px;margin:12px 0}',
/* classroom */
'#seating .classroom{position:relative;direction:ltr;margin-top:14px;padding:18px 46px 30px;border:9px solid #cdbfae;border-radius:16px;background:repeating-linear-gradient(90deg,#f7f0e6 0 54px,#f2e9dd 54px 56px)}',
'#seating .classroom:fullscreen{overflow:auto;border-radius:0;padding:28px 70px 40px;margin:0}',
'#seating .board{margin:0 auto;max-width:880px}',
'#seating .bframe{background:#b98b5a;padding:10px;border-radius:10px;box-shadow:0 6px 14px #28304733}',
'#seating .bsurf{background:#263348;color:#f4f1e8;border-radius:6px;min-height:170px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:16px 20px;text-align:center}',
'#seating .btitle{font-size:34px;font-weight:bold;letter-spacing:1px}',
'#seating .bweek{font-size:15px;opacity:.85;direction:ltr}',
'#seating .chalk{width:min(100%,560px);background:transparent;border:0;border-bottom:2px dashed #f4f1e866;border-radius:0;color:#f4f1e8;text-align:center;font-size:18px;padding:8px;margin-top:8px}',
'#seating .chalk::placeholder{color:#f4f1e877}',
'#seating .chalk:focus-visible{outline:none;border-bottom-color:#f4f1e8}',
'#seating .tray{height:9px;width:62%;margin:0 auto;background:#9c7547;border-radius:0 0 8px 8px}',
'#seating .tdesk{width:150px;margin:14px 0 0 4px;text-align:center;font-size:12px;font-weight:bold;color:#fff;background:#8b6a47;border-radius:8px;padding:9px 6px}',
'#seating .rooms{direction:ltr;display:flex;flex-direction:column;gap:16px;align-items:center;margin-top:20px}',
'#seating .srow{display:flex;gap:18px;justify-content:center;width:100%}',
'#seating .deskwrap{flex:1;max-width:290px;min-width:0}',
'#seating .desk{display:flex;gap:6px;background:#fff;border:2px solid #e2cdb6;border-bottom-width:6px;border-radius:12px;padding:8px}',
'#seating .seat{flex:1;min-width:0;min-height:58px;display:grid;place-items:center;text-align:center;background:#faf6f9;border:2px solid transparent;border-radius:8px;padding:6px 4px;font-size:12px;line-height:1.5;font-weight:bold;overflow-wrap:break-word;word-break:normal;unicode-bidi:plaintext;cursor:pointer;transition:background .15s}',
'#seating .seat:hover{background:#f3e3ec}',
'#seating .seat.empty{background:none;border:1px dashed #d8d2dc;color:var(--muted);font-weight:normal}',
'#seating .seat.sel{background:#f9e8f0;border-color:var(--pink);color:var(--pink)}',
'#seating .tag{text-align:center;font-size:11px;color:var(--muted);margin-top:4px}',
'#seating .tag.max{color:var(--pink);font-weight:bold}',
/* door + windows */
'#seating .door{position:absolute;right:-9px;top:78px;width:28px;height:104px;background:#a8754a;border:3px solid #7d5230;border-radius:5px 0 0 5px;box-shadow:inset 0 0 0 3px #b88458}',
'#seating .door::after{content:"";position:absolute;left:5px;top:50%;width:8px;height:8px;border-radius:50%;background:#f3c96b;border:1px solid #b88a2a}',
'#seating .door span{position:absolute;right:2px;top:-24px;font-size:12px;font-weight:bold;color:#7d5230;white-space:nowrap}',
'#seating .win{position:absolute;left:-9px;width:11px;height:78px;background:#cfeaf7;border:3px solid #9bbfd1;border-radius:0 4px 4px 0}',
'@media(max-width:800px){#seating .classroom{padding:12px 30px 24px;border-width:7px}#seating .door{right:-7px;width:22px;height:84px;top:64px}#seating .win{left:-7px;width:9px;height:60px}#seating .srow{gap:8px}#seating .seat{font-size:10.5px;min-height:44px;padding:4px 2px}#seating .desk{padding:5px;gap:4px;flex-direction:column}#seating .btitle{font-size:24px}#seating .bsurf{min-height:130px}#seating .tdesk{width:110px}}',
'@media print{#seating .no-print{display:none!important}#seating .classroom,#seating .bframe,#seating .bsurf,#seating .door,#seating .win,#seating .tdesk{print-color-adjust:exact;-webkit-print-color-adjust:exact}}'
].join('');
document.head.appendChild(style);

function render(){
 const p=shown(),dr=isDraft(),mk=week.slice(0,7),mc=monthCounts(mk),ids=new Set(roster().map(s=>s.id)),cur=startOf(today);
 /* top: title + controls */
 let h='<div class="row"><div><h2>Student Seating Plan · Class 5A</h2><p class="small" style="margin:0">The seating changes every week (Sunday to Thursday). No two students sit together more than twice in a month.</p></div></div>';
 h+=`<div class="controls no-print"><button data-act="prev">Previous week</button><span class="weeklabel">${range(week)}</span><button data-act="next">Next week</button>${week!==cur?'<button data-act="now">This week</button>':''}</div>`;
 h+=`<div class="controls no-print"><button class="primary" data-act="shuffle">${p?'🔀 New arrangement':'🔀 Generate this week\'s seating'}</button><button class="savebtn" data-act="save" ${dr?'':'disabled'}>💾 Save Seating Plan</button>${dr?'<button data-act="discard">Discard</button>':''}${p?'<button data-act="full">⛶ Full screen</button><button data-act="print">Print</button>':''}</div>`;
 if(dr)h+='<div class="draftbar no-print">This arrangement is <b>not saved</b>. Press “Save Seating Plan” to store it and count it toward the neighbour rule, or press “New arrangement” to try another one.</div>';
 else if(p)h+='<div class="savedbar no-print">✓ This seating plan is saved</div>';
 if(!roster().length)h+='<div class="empty">There are no students in class 5A.</div>';
 else if(!p)h+='<div class="empty">No seating plan has been created for this week yet. Press “Generate this week\'s seating”.</div>';
 top.innerHTML=h;

 /* classroom */
 if(!p||!roster().length){room.classList.add('hidden');room.innerHTML=''}
 else{
  room.classList.remove('hidden');
  const seat=(d,i,j)=>{const x=d[j]&&ids.has(d[j])?d[j]:null,on=sel&&sel.i===i&&sel.j===j;return `<div class="seat ${x?'':'empty'} ${on?'sel':''}" data-d="${i}" data-s="${j}">${x?esc(nameOf(x)):'—'}</div>`};
  const rows=[];
  p.desks.forEach((d,i)=>{
   const n=d[0]&&d[1]?mc[pk(d[0],d[1])]||0:0;
   (rows[Math.floor(i/PER_ROW)]=rows[Math.floor(i/PER_ROW)]||[]).push(`<div class="deskwrap"><div class="desk">${seat(d,i,0)}${seat(d,i,1)}</div>${d[0]&&d[1]?`<div class="tag ${n>=MAX_MONTH?'max':''}">Sat together ${n} of ${MAX_MONTH} this month</div>`:'<div class="tag">Sits alone</div>'}</div>`);
  });
  room.innerHTML=
   '<div class="win" style="top:130px"></div><div class="win" style="top:250px"></div><div class="win" style="top:370px"></div>'+
   `<div class="board"><div class="bframe"><div class="bsurf"><div class="btitle">Class 5A</div><div class="bweek">${range(week)}</div><input class="chalk" maxlength="90" placeholder="Write a note on the board…" aria-label="Board note" value="${esc(p.note||'')}"></div></div><div class="tray"></div></div>`+
   '<div class="tdesk">Teacher\'s desk</div>'+
   '<div class="rooms">'+rows.map(r=>`<div class="srow">${r.join('')}</div>`).join('')+'</div>'+
   '<div class="door"><span>Door</span></div>';
  if(focusNote){const c=room.querySelector('.chalk');if(c){c.focus();c.setSelectionRange(c.value.length,c.value.length)}focusNote=false}
 }

 /* bottom: warnings + monthly pairs */
 let b='';
 if(p){
  {const placed=new Set(p.desks.flat().filter(Boolean)),missing=roster().filter(s=>!placed.has(s.id));
   if(missing.length)b+=`<div class="warn no-print">Students not placed in this arrangement: ${missing.map(s=>esc(s.name)).join(', ')}. Press “New arrangement” to include them.</div>`}
  const over=Object.entries(mc).filter(([,n])=>n>MAX_MONTH).length;
  if(over)b+=`<div class="warn no-print">Warning: ${over} pair(s) sat together more than ${MAX_MONTH} times this month.</div>`;
  b+='<p class="small no-print" style="margin:12px 0 0">To swap two students: click one, then the other (or the empty seat), then press “Save Seating Plan”.</p>';
 }
 const maxed=Object.entries(mc).filter(([,n])=>n>=MAX_MONTH);
 b+=`<div class="no-print" style="margin-top:18px"><h3>Pairs that reached the monthly maximum (${mk})</h3>${maxed.length?'<p class="small">'+maxed.map(([k])=>k.split('|').map(id=>esc(nameOf(id))).join(' + ')).join('<br>')+'</p>':'<p class="small">None yet.</p>'}</div>`;
 bottom.innerHTML=b;
}

/* ---------- actions ---------- */
function canLeave(){
 if(!draft)return true;
 if(confirm('The current arrangement is not saved. Discard it?')){draft=null;sel=null;return true}
 return false;
}
function ensureDraft(){
 if(isDraft())return;
 const p=plans[week];
 draft={week,desks:clone(p.desks),note:p.note||''};
}
function shuffleWeek(){
 const ids=roster().map(s=>s.id);
 if(ids.length<2)return notify('Not enough students to arrange');
 const old=shown(),r=generate(ids,stats(week));
 draft={week,desks:r.desks,note:old?old.note||'':''};sel=null;render();
 notify(r.viol?'New arrangement (not saved) — some repeated pairs could not be avoided':'New arrangement — press “Save Seating Plan” to keep it');
}
function saveDraft(){
 if(!isDraft())return;
 plans[week]={desks:draft.desks,note:draft.note||'',updated:new Date().toISOString()};
 draft=null;sel=null;saveLocal();pushPlan(week);render();notify('Seating plan saved');
}
function swapSeats(i,j){
 ensureDraft();
 const D=draft.desks,a=D[sel.i],b=D[i];
 [a[sel.j],b[j]]=[b[j],a[sel.j]];
 D.forEach(d=>{if(!d[0]&&d[1]){d[0]=d[1];d[1]=null}});
 draft.desks=D.filter(d=>d[0]||d[1]);
 sel=null;
}
sec.onclick=e=>{
 const s=e.target.closest('.seat');
 if(s&&shown()){
  const i=+s.dataset.d,j=+s.dataset.s;
  if(!sel)sel={i,j};else if(sel.i===i&&sel.j===j)sel=null;else swapSeats(i,j);
  render();return;
 }
 const b=e.target.closest('[data-act]');if(!b)return;
 const a=b.dataset.act;
 if(a==='prev'){if(canLeave()){week=addDays(week,-7);render()}}
 else if(a==='next'){if(canLeave()){week=addDays(week,7);render()}}
 else if(a==='now'){if(canLeave()){week=startOf(today);render()}}
 else if(a==='shuffle')shuffleWeek();
 else if(a==='save')saveDraft();
 else if(a==='discard'){draft=null;sel=null;render()}
 else if(a==='full'){
  if(document.fullscreenElement)document.exitFullscreen();
  else if(room.requestFullscreen)room.requestFullscreen().catch(()=>notify('The browser did not allow full screen'));
  else notify('Full screen is not supported by this browser');
 }
 else if(a==='print')window.print();
};
sec.oninput=e=>{
 if(!e.target.classList.contains('chalk'))return;
 const first=!isDraft();
 ensureDraft();draft.note=e.target.value;
 if(first){focusNote=true;render()}
};
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
 const on=b.dataset.tab==='seating',f=document.querySelector('.filters');
 sec.classList.toggle('hidden',!on);if(f)f.style.display=on?'none':'';
 if(on){render();pullCloud()}
}));
window.addEventListener('ajyal-cloud-ready',pullCloud);
loadLocal();
window.Seating={generate,stats,plans:()=>plans,setPlans:p=>{plans=p}};
})();
