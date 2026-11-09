/* ترتيب — weekly seating plan for class 5A only.
   - Desks seat two students. "Neighbours" = the two students sharing a desk.
   - A pair may sit together at most MAX_MONTH times in the same calendar month
     (month of the week's Sunday). New plans respect this as a hard rule and
     also avoid repeating last week's pairs / the same lone student.
   - Plans are stored per week in localStorage and in Supabase (seating_plans)
     once the teacher is signed in. Nothing here touches ratings or reports. */
(function(){
'use strict';
const CLASS='5A',PER_ROW=3,MAX_MONTH=2,TRIES=400,SKEY=key+':seating-'+CLASS;
let plans={},week=null,undo=null;

/* ---------- helpers ---------- */
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const startOf=s=>addDays(s,-new Date(s+'T12:00:00Z').getUTCDay());
const pk=(a,b)=>a<b?a+'|'+b:b+'|'+a;
const roster=()=>db.classes[CLASS]||[];
const nameOf=id=>(roster().find(s=>s.id===id)||{}).name||'—';
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
week=startOf(today);

/* ---------- storage ---------- */
function loadLocal(){try{const d=JSON.parse(localStorage.getItem(SKEY)||'null');if(d&&d.plans&&typeof d.plans==='object')plans=d.plans}catch{}}
function saveLocal(){try{localStorage.setItem(SKEY,JSON.stringify({version:1,plans}))}catch{}}
const cloud=()=>window.AjyalCloud&&window.AjyalCloud.ready()?window.AjyalCloud.sb():null;
async function pushPlan(w){
 const sb=cloud();if(!sb||!plans[w])return;
 try{const p=plans[w],{error}=await sb.from('seating_plans').upsert({class_name:CLASS,week_start:w,desks:p.desks,updated_at:p.updated},{onConflict:'class_name,week_start'});if(error)throw error}
 catch(e){console.error(e);notify('تعذّر حفظ الترتيب في السحابة، وهو محفوظ على هذا الجهاز.')}
}
async function dropPlan(w){
 const sb=cloud();if(!sb)return;
 try{const {error}=await sb.from('seating_plans').delete().eq('class_name',CLASS).eq('week_start',w);if(error)throw error}catch(e){console.error(e)}
}
async function pullCloud(){
 const sb=cloud();if(!sb)return;
 try{
  const {data,error}=await sb.from('seating_plans').select('*').eq('class_name',CLASS);if(error)throw error;
  const seen=new Set();let changed=false;
  for(const r of data){
   seen.add(r.week_start);const l=plans[r.week_start];
   if(!l||new Date(r.updated_at)>new Date(l.updated)){plans[r.week_start]={desks:r.desks,updated:r.updated_at};changed=true}
   else if(new Date(l.updated)>new Date(r.updated_at))pushPlan(r.week_start);
  }
  for(const w of Object.keys(plans))if(!seen.has(w))pushPlan(w);
  if(changed){saveLocal();render()}
 }catch(e){console.error(e)}
}

/* ---------- history + generator ---------- */
function monthCounts(mk){
 const c={};
 for(const [w,p] of Object.entries(plans)){
  if(w.slice(0,7)!==mk)continue;
  for(const d of p.desks)if(d[0]&&d[1]){const k=pk(d[0],d[1]);c[k]=(c[k]||0)+1}
 }
 return c;
}
function stats(excl){
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
const sec=document.createElement('section');sec.id='seating';sec.className='hidden';sec.setAttribute('dir','rtl');sec.setAttribute('lang','ar');
document.querySelector('main.shell').appendChild(sec);
const style=document.createElement('style');
style.textContent='#seating .board{background:#283047;color:#fff;text-align:center;border-radius:10px;padding:10px;margin:16px 0;font-weight:bold;letter-spacing:1px}#seating .room{direction:ltr;display:flex;flex-direction:column;gap:14px;align-items:center}#seating .srow{display:flex;gap:18px;justify-content:center;flex-wrap:nowrap;width:100%}#seating .deskwrap{flex:1;max-width:300px;min-width:0}#seating .desk{display:flex;gap:6px;background:#fff;border:2px solid #e6cfdb;border-bottom-width:5px;border-radius:12px;padding:8px}#seating .seat{flex:1;min-width:0;min-height:58px;display:grid;place-items:center;text-align:center;background:#faf6f9;border-radius:8px;padding:6px 4px;font-size:12px;line-height:1.5;font-weight:bold;word-break:break-word;unicode-bidi:plaintext}#seating .seat.empty{background:none;border:1px dashed #d8d2dc;color:var(--muted);font-weight:normal}#seating .tag{text-align:center;font-size:11px;color:var(--muted);margin-top:4px}#seating .tag.max{color:var(--pink);font-weight:bold}#seating .rowlabel{font-size:11px;color:var(--muted);align-self:flex-start}#seating .warn{background:#fcf5e8;color:#8f6b30;border-radius:10px;padding:12px;line-height:1.8;font-size:13px;margin:12px 0}#seating .controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:14px 0}#seating .weeklabel{font-weight:bold;padding:0 6px}@media(max-width:800px){#seating .srow{gap:8px}#seating .seat{font-size:11px;min-height:64px}#seating .desk{padding:5px;gap:4px}}@media print{#seating .no-print{display:none!important}#seating .board{print-color-adjust:exact}}';
document.head.appendChild(style);

function render(){
 const p=plans[week],mk=week.slice(0,7),mc=monthCounts(mk),ids=new Set(roster().map(s=>s.id));
 let html='<div class="card"><div class="row"><div><h2>ترتيب جلسة الطلاب · الصف 5A</h2><p class="small" style="margin:0">لكل أسبوع ترتيب مستقل. لا يجلس طالب بجوار زميله أكثر من مرتين في الشهر.</p></div></div>';
 html+=`<div class="controls no-print"><button data-act="prev">الأسبوع السابق</button><span class="weeklabel">${week} ← ${addDays(week,4)}</span><button data-act="next">الأسبوع التالي</button>${week!==startOf(today)?'<button data-act="now">هذا الأسبوع</button>':''}<button class="primary" data-act="shuffle">${p?'🔀 ترتيب جديد':'🔀 إنشاء ترتيب هذا الأسبوع'}</button>${undo&&undo.week===week?'<button data-act="undo">تراجع</button>':''}${p?'<button data-act="print">طباعة</button>':''}</div>`;
 if(!roster().length)html+='<div class="empty">لا يوجد طلاب في الصف 5A.</div>';
 else if(!p)html+='<div class="empty">لم يُنشأ ترتيب لهذا الأسبوع بعد. اضغط «إنشاء ترتيب هذا الأسبوع».</div>';
 else{
  html+='<div class="board">السبورة</div><div class="room">';
  const rows=[];p.desks.forEach((d,i)=>{const r=Math.floor(i/PER_ROW);(rows[r]=rows[r]||[]).push(d)});
  rows.forEach((ds,r)=>{
   html+=`<div class="srow">`+ds.map(d=>{
    const a=d[0]&&ids.has(d[0])?d[0]:null,b=d[1]&&ids.has(d[1])?d[1]:null,n=d[0]&&d[1]?mc[pk(d[0],d[1])]||0:0;
    const seat=x=>x?`<div class="seat">${esc(nameOf(x))}</div>`:'<div class="seat empty">—</div>';
    return `<div class="deskwrap"><div class="desk">${seat(a)}${seat(b)}</div>${d[0]&&d[1]?`<div class="tag ${n>=MAX_MONTH?'max':''}">جلسا معاً ${n} من ${MAX_MONTH} هذا الشهر</div>`:'<div class="tag">يجلس بمفرده</div>'}</div>`;
   }).join('')+'</div>';
  });
  html+='</div>';
  const placed=new Set(p.desks.flat().filter(Boolean)),missing=roster().filter(s=>!placed.has(s.id));
  if(missing.length)html+=`<div class="warn">طلاب غير موزعين في هذا الترتيب: ${missing.map(s=>esc(s.name)).join('، ')}. اضغط «ترتيب جديد» لإدخالهم.</div>`;
  const over=Object.entries(mc).filter(([,n])=>n>MAX_MONTH).length;
  if(over)html+=`<div class="warn">تنبيه: ${over} من الأزواج تجاوز ${MAX_MONTH} مرات هذا الشهر (تعذّر تجنب ذلك مع عدد الطلاب الحالي).</div>`;
 }
 const maxed=Object.entries(mc).filter(([,n])=>n>=MAX_MONTH);
 html+=`<div class="no-print" style="margin-top:18px"><h3>أزواج وصلت للحد الأقصى هذا الشهر (${mk})</h3>${maxed.length?'<p class="small">'+maxed.map(([k]) => k.split('|').map(id=>esc(nameOf(id))).join(' + ')).join('<br>')+'</p>':'<p class="small">لا يوجد حتى الآن.</p>'}</div></div>`;
 sec.innerHTML=html;
}
function shuffleWeek(){
 const ids=roster().map(s=>s.id);
 if(ids.length<2)return notify('عدد الطلاب غير كافٍ للترتيب');
 undo={week,plan:plans[week]||null};
 const r=generate(ids,stats(week));
 plans[week]={desks:r.desks,updated:new Date().toISOString()};
 saveLocal();pushPlan(week);render();
 notify(r.viol?'تم الترتيب، لكن تعذّر تجنب تكرار بعض الأزواج':'تم ترتيب الجلسة لهذا الأسبوع');
}
function undoWeek(){
 if(!undo||undo.week!==week)return;
 if(undo.plan){plans[week]={...undo.plan,updated:new Date().toISOString()};pushPlan(week)}
 else{delete plans[week];dropPlan(week)}
 undo=null;saveLocal();render();
}
sec.onclick=e=>{
 const b=e.target.closest('[data-act]');if(!b)return;
 const a=b.dataset.act;
 if(a==='prev'){week=addDays(week,-7);render()}
 else if(a==='next'){week=addDays(week,7);render()}
 else if(a==='now'){week=startOf(today);render()}
 else if(a==='shuffle')shuffleWeek();
 else if(a==='undo')undoWeek();
 else if(a==='print')window.print();
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
