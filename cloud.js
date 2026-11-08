/* Cloud sync for Class Pulse (Supabase).
   - The app keeps working from `db` in memory + localStorage (app.js).
   - After the teacher signs in, data is loaded from Supabase and every change
     made through save() is pushed to the cloud as a small diff.
   - The publishable key below is meant to be public; access is protected by
     Row Level Security (only the signed-in owner account can read or write). */
(function(){
'use strict';
const SB_URL='https://wupaknfphtvowaskdban.supabase.co',SB_KEY='sb_publishable_mwm6ymTJzys6szgp93iKRw_5KjHFFSH',LINK=key+':cloud-linked';
let sb=null,snap=null,timer=null,chain=Promise.resolve(),entering=false;
const BAD=['__proto__','constructor','prototype'];
const ser=v=>JSON.stringify(v.row);
const chunks=(a,n=200)=>Array.from({length:Math.ceil(a.length/n)},(_,i)=>a.slice(i*n,i*n+n));
const ok=async q=>{const r=await q;if(r.error)throw r.error;return r};

/* ---------- UI ---------- */
const status=document.createElement('span');status.className='save';status.id='cloudStatus';status.style.marginInlineStart='10px';
const tools=document.createElement('span');tools.style.display='none';
tools.innerHTML='<button type="button" id="cloudRefresh" style="padding:6px 10px;font-size:12px">↻ Refresh</button> <button type="button" id="cloudOut" style="padding:6px 10px;font-size:12px">Sign out</button>';
$('saveStatus').after(status,tools);
const setStatus=t=>{status.textContent=t};
const gate=document.createElement('div');
gate.style.cssText='position:fixed;inset:0;background:var(--bg);z-index:50;display:grid;place-items:center;padding:16px';
gate.innerHTML='<form id="cloudForm" class="card" style="max-width:380px;width:100%;margin:0"><h2>Class Pulse · Sign in</h2><p class="small" id="cloudMsg">Sign in to load your classes from the cloud.</p><label for="cloudEmail">Email</label><input id="cloudEmail" type="email" autocomplete="username" required style="width:100%;margin-bottom:12px"><label for="cloudPass">Password</label><input id="cloudPass" type="password" autocomplete="current-password" minlength="8" required style="width:100%;margin-bottom:14px"><div class="actions"><button class="primary" id="cloudIn" type="submit">Sign in</button><button type="button" id="cloudUp">Create account</button></div></form>';
document.body.appendChild(gate);
const msg=t=>{$('cloudMsg').textContent=t};
const showGate=m=>{gate.style.display='grid';tools.style.display='none';if(m)msg(m)};
const hideGate=()=>{gate.style.display='none';tools.style.display=''};

/* ---------- state <-> rows ---------- */
function stateOf(d){
 const m=new Map(),ids=new Set();
 for(const [c,list] of Object.entries(d.classes)){
  m.set('c|'+c,{t:'c',row:{name:c}});
  list.forEach((s,i)=>{ids.add(s.id);m.set('s|'+s.id,{t:'s',row:{id:s.id,class_name:c,name:s.name,sort_order:i}})});
 }
 for(const [k,r] of Object.entries(d.records)){
  let p;try{p=JSON.parse(k)}catch{continue}
  if(!ids.has(p[2]))continue;
  m.set('r|'+k,{t:'r',row:{class_name:p[0],day:p[1],student_id:p[2],scores:r.scores,note:r.note||''}});
 }
 for(const v of m.values())v.s=ser(v);
 return m;
}
function fromCloud(cl,st,rc){
 const d={version:1,classes:{},records:{}};
 for(const c of cl)if(!BAD.includes(c.name))d.classes[c.name]=[];
 for(const s of [...st].sort((a,b)=>a.sort_order-b.sort_order)){if(d.classes[s.class_name])d.classes[s.class_name].push({id:s.id,name:s.name})}
 for(const r of rc)if(d.classes[r.class_name])d.records[JSON.stringify([r.class_name,r.day,r.student_id])]={scores:r.scores,note:r.note||''};
 return d;
}
function union(base,loc){
 for(const [c,list] of Object.entries(loc.classes)){
  const b=base.classes[c]||(base.classes[c]=[]);
  for(const s of list)if(!b.some(x=>x.id===s.id))b.push(s);
 }
 for(const [k,r] of Object.entries(loc.records))if(!(k in base.records))base.records[k]=r;
 return base;
}

/* ---------- push (diff) ---------- */
async function doPush(){
 if(!sb||!snap)return;
 const cur=stateOf(db),up={c:[],s:[],r:[]},dr=new Map(),ds=[],dc=[];
 for(const [k,v] of cur){const o=snap.get(k);if(!o||o.s!==v.s)up[v.t].push(v.row)}
 for(const [k,o] of snap){
  if(cur.has(k))continue;
  if(o.t==='r'){const g=o.row.class_name+'\u0000'+o.row.day;if(!dr.has(g))dr.set(g,{c:o.row.class_name,d:o.row.day,ids:[]});dr.get(g).ids.push(o.row.student_id)}
  else if(o.t==='s')ds.push(o.row.id);else dc.push(o.row.name);
 }
 if(!up.c.length&&!up.s.length&&!up.r.length&&!dr.size&&!ds.length&&!dc.length){setStatus('☁ Synced to cloud');return}
 try{
  const now=new Date().toISOString();
  for(const p of chunks(up.c))await ok(sb.from('classes').upsert(p,{onConflict:'name'}));
  for(const p of chunks(up.s))await ok(sb.from('students').upsert(p,{onConflict:'id'}));
  for(const p of chunks(up.r))await ok(sb.from('records').upsert(p.map(x=>({...x,updated_at:now})),{onConflict:'class_name,day,student_id'}));
  for(const g of dr.values())for(const p of chunks(g.ids))await ok(sb.from('records').delete().eq('class_name',g.c).eq('day',g.d).in('student_id',p));
  for(const p of chunks(ds))await ok(sb.from('students').delete().in('id',p));
  for(const p of chunks(dc))await ok(sb.from('classes').delete().in('name',p));
  snap=cur;
  try{localStorage.setItem(LINK,'1')}catch{}
  setStatus('☁ Synced to cloud · '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}));
 }catch(e){
  console.error('Cloud sync failed',e);
  setStatus('☁ Cloud sync failed — retrying');
  setTimeout(push,20000);
 }
}
function push(){chain=chain.then(doPush,doPush);return chain}
function schedule(){if(!snap)return;setStatus('☁ Syncing…');clearTimeout(timer);timer=setTimeout(push,700)}

/* hook into the app's save() without editing app.js */
const baseSave=save;
save=function(){const r=baseSave.apply(this,arguments);schedule();return r};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&snap){clearTimeout(timer);push()}});
window.addEventListener('online',()=>{if(snap)push()});

/* ---------- load from cloud ---------- */
async function paged(make){
 const out=[];
 for(let from=0;;from+=1000){const {data}=await ok(make().range(from,from+999));out.push(...data);if(data.length<1000)break}
 return out;
}
async function fetchCloud(){
 const [cl,st,rc]=await Promise.all([
  paged(()=>sb.from('classes').select('*').order('name')),
  paged(()=>sb.from('students').select('*').order('id')),
  paged(()=>sb.from('records').select('*').order('class_name').order('day').order('student_id'))
 ]);
 return {cl,st,rc};
}
function apply(next){
 db=next;expandScores(db);mergeSchoolRosters(db);
 if(!db.classes[cls])cls=Object.keys(db.classes)[0];
 init();save();
}
async function enter(){
 if(entering)return;entering=true;
 try{
  setStatus('☁ Loading…');
  const {data:owner,error}=await sb.rpc('claim_owner');
  if(error||owner!==true){await sb.auth.signOut();showGate('This tracker belongs to a different account. Sign in with the teacher account.');return}
  const {cl,st,rc}=await fetchCloud();
  let linked=false;try{linked=localStorage.getItem(LINK)==='1'}catch{}
  if(!cl.length&&!st.length){snap=new Map();apply(db)}          /* first time: upload this device's data */
  else{
   const cloudDb=fromCloud(cl,st,rc);snap=stateOf(cloudDb);
   apply(linked?cloudDb:union(JSON.parse(JSON.stringify(cloudDb)),db)); /* first link: keep local-only data too */
  }
  hideGate();
  await push();
 }catch(e){
  console.error(e);
  showGate('Could not reach the cloud. Check your connection and try again.');
 }finally{entering=false}
}
async function refresh(){
 try{
  clearTimeout(timer);await push();
  const {cl,st,rc}=await fetchCloud();
  const cloudDb=fromCloud(cl,st,rc);snap=stateOf(cloudDb);apply(cloudDb);
  notify('Refreshed from cloud');
 }catch(e){console.error(e);notify('Could not refresh from the cloud.')}
}

/* ---------- auth ---------- */
async function auth(mode){
 const form=$('cloudForm');if(!form.reportValidity())return;
 const email=$('cloudEmail').value.trim(),password=$('cloudPass').value;
 msg('Please wait…');
 const r=mode==='in'?await sb.auth.signInWithPassword({email,password}):await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
 if(r.error)return msg(r.error.message);
 if(!r.data.session)return msg('Check your email to confirm the account, then sign in.');
 $('cloudPass').value='';
 await enter();
}
function loadLib(){
 return new Promise((res,rej)=>{
  if(window.supabase)return res();
  const s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  s.onload=res;s.onerror=()=>rej(new Error('Could not load the cloud library'));
  document.head.appendChild(s);
 });
}
$('cloudForm').onsubmit=e=>{e.preventDefault();auth('in')};
$('cloudUp').onclick=()=>auth('up');
$('cloudRefresh').onclick=refresh;
$('cloudOut').onclick=async()=>{clearTimeout(timer);await push();await sb.auth.signOut();snap=null;location.reload()};

(async()=>{
 try{
  await loadLib();
  sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
  sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT'){snap=null;showGate('Signed out. Sign in again to continue.')}});
  const {data}=await sb.auth.getSession();
  if(data.session)await enter();else showGate();
 }catch(e){
  console.error(e);
  gate.style.display='none';
  setStatus('☁ Offline mode — cloud unavailable, data saved on this device only');
 }
})();
})();
