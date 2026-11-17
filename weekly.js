/* Weekly analysis (tab "التحليلي الأسبوعي") — read-only statistical report for a chosen date range.
   - Default range = this week, Sunday → Thursday (Asia/Riyadh). Any "from" / "to" dates can be chosen.
   - Reads ratings from the existing `db` only. It never writes or changes ratings, rosters or cloud data.
   - Percentage = mean of recorded ratings / 5. Missing ratings are never counted as zero.
   - On Thursday (end of the range) the report becomes "Final"; before that it is marked provisional. */
(function(){
'use strict';
const DN=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const startOf=s=>addDays(s,-new Date(s+'T12:00:00Z').getUTCDay());
const fmtDate=s=>{const d=new Date(s+'T12:00:00Z');return DN[d.getUTCDay()]+' '+d.getUTCDate()+' '+MN[d.getUTCMonth()]+' '+d.getUTCFullYear()};
const shortDay=s=>{const d=new Date(s+'T12:00:00Z');return DN[d.getUTCDay()].slice(0,3)+' '+d.getUTCDate()+' '+MN[d.getUTCMonth()]};
const spanDays=(f,t)=>Math.round((new Date(t+'T12:00:00Z')-new Date(f+'T12:00:00Z'))/864e5)+1;
const pct=v=>v===null||v===undefined?null:v/5*100;
const pctText=v=>v===null||v===undefined?'—':Math.round(pct(v))+'%';
const level=v=>v===null?'Not recorded':v>=4.5?'Excellent':v>=3.5?'Very good':v>=2.5?'Good':v>=1.5?'Fair':'Poor';
const levelColor=v=>v===null?'#787d8e':v>=3.5?'#248977':v>=2.5?'#8f6b30':'#a73168';
const label=()=>(typeof classLabels==='object'&&classLabels&&classLabels[cls])||cls;

let from=startOf(today),to=addDays(from,4);

/* ---------- data ---------- */
function collect(c,f,t){
 const list=db.classes[c]||[],byStudent=new Map(list.map(s=>[s.id,{id:s.id,name:s.name,days:new Set(),vals:skills.map(()=>[])}])),
  dayVals=new Map(),notes=[];
 for(const [k,r] of Object.entries(db.records)){
  let p;try{p=JSON.parse(k)}catch{continue}
  if(p[0]!==c||p[1]<f||p[1]>t||!r||!Array.isArray(r.scores))continue;
  const st=byStudent.get(p[2]);if(!st)continue;
  const scored=r.scores.some(v=>typeof v==='number');
  if(scored){
   st.days.add(p[1]);
   if(!dayVals.has(p[1]))dayVals.set(p[1],[]);
   r.scores.forEach((v,i)=>{if(typeof v==='number'&&i<skills.length){st.vals[i].push(v);dayVals.get(p[1]).push(v)}});
  }
  if(r.note&&String(r.note).trim())notes.push({day:p[1],name:st.name,note:String(r.note).trim()});
 }
 const students=list.map(s=>{
  const st=byStudent.get(s.id),skillMeans=st.vals.map(a=>avg(a)),all=st.vals.flat();
  return {id:s.id,name:s.name,days:st.days.size,skillMeans,mean:avg(all),n:all.length};
 });
 const skillMeans=skills.map((_,i)=>avg(students.flatMap(s=>byStudent.get(s.id).vals[i]))),
  allVals=students.flatMap(s=>byStudent.get(s.id).vals.flat()),
  days=[...dayVals.keys()].sort().map(d=>({day:d,mean:avg(dayVals.get(d)),n:dayVals.get(d).length}));
 notes.sort((a,b)=>a.day<b.day?-1:a.day>b.day?1:a.name.localeCompare(b.name));
 return {students,skillMeans,overall:avg(allVals),n:allVals.length,days,notes,summary:summarizeScores(allVals)};
}

/* ---------- charts ---------- */
function lineSVG(days){
 const W=600,H=300,x0=70,x1=560,y0=240,y1=30,X=i=>days.length===1?(x0+x1)/2:x0+i*(x1-x0)/(days.length-1),Y=p=>y0-(p/100)*(y0-y1);
 let b='';
 for(let n=0;n<=5;n++){const p=n*20,y=Y(p);b+=`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#e5e7ed"/><text x="${x0-10}" y="${y+5}" text-anchor="end">${p}%</text>`}
 if(!days.length)return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily trend" xmlns="http://www.w3.org/2000/svg" style="width:100%;font:13px Tahoma,Arial;fill:#283047;direction:ltr"><title>Daily trend</title>${b}<text x="300" y="140" text-anchor="middle">No assessed days in this range</text></svg>`;
 const pts=days.map((d,i)=>[X(i),Y(pct(d.mean))]);
 if(pts.length>1)b+=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#c83f7f" stroke-width="3"/>`;
 days.forEach((d,i)=>{b+=`<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="5" fill="#c83f7f"/><text x="${pts[i][0]}" y="${pts[i][1]-12}" text-anchor="middle" font-weight="bold">${pctText(d.mean)}</text><text x="${pts[i][0]}" y="268" text-anchor="middle">${shortDay(d.day)}</text>`});
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily class percentage trend" xmlns="http://www.w3.org/2000/svg" style="width:100%;font:13px Tahoma,Arial;fill:#283047;direction:ltr"><title>Daily class percentage trend</title>${b}</svg>`;
}

/* ---------- view ---------- */
const sec=document.createElement('section');sec.id='weekly';sec.className='hidden';sec.setAttribute('lang','en');sec.setAttribute('dir','ltr');
document.querySelector('main.shell').appendChild(sec);
const style=document.createElement('style');
style.textContent=[
'#weekly .wk-controls{display:flex;align-items:end;gap:14px;flex-wrap:wrap;margin:14px 0}',
'#weekly .wk-badge{display:inline-block;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:bold}',
'#weekly .wk-final{background:#e7f5ef;color:#27806c}',
'#weekly .wk-prov{background:#fcf5e8;color:#8f6b30}',
'#weekly .wk-big{font-size:46px;font-weight:bold;color:var(--pink);line-height:1.2}',
'#weekly .wk-up{color:#248977;font-weight:bold}#weekly .wk-down{color:#a73168;font-weight:bold}',
'#weekly td.nm{unicode-bidi:plaintext;white-space:normal;min-width:150px}',
'#weekly .wk-notes p{margin:6px 0;border-bottom:1px solid var(--line);padding-bottom:6px}',
'@media(max-width:800px){#weekly .wk-big{font-size:36px}#weekly .wk-controls>div{flex:1;min-width:130px}#weekly .wk-controls input{width:100%}}',
'@media print{#weekly .two{display:grid;grid-template-columns:1fr 1fr}#weekly .card{break-inside:avoid}#weekly .wk-badge,#weekly .bar{print-color-adjust:exact;-webkit-print-color-adjust:exact}}'
].join('');
document.head.appendChild(style);

function delta(cur,prev){
 if(cur===null||prev===null)return '<span class="small">No previous period data to compare</span>';
 const d=pct(cur)-pct(prev),r=Math.round(d);
 return `<span class="${d>=0?'wk-up':'wk-down'}">${r>0?'▲ +':r<0?'▼ ':'● '}${r}%</span> <span class="small">vs previous ${spanDays(from,to)} days</span>`;
}
function render(){
 if(!db.classes[cls]){sec.innerHTML='<div class="card empty">Select a class to view the weekly analysis.</div>';return}
 const len=spanDays(from,to),w=collect(cls,from,to),prev=collect(cls,addDays(from,-len),addDays(from,-1)),
  final=today>=to,ranked=w.students.filter(s=>s.mean!==null).sort((a,b)=>b.mean-a.mean||a.name.localeCompare(b.name)),
  unassessed=w.students.filter(s=>s.mean===null),
  strengths=skills.filter((_,i)=>w.skillMeans[i]!==null&&w.skillMeans[i]>=4),
  improve=skills.filter((_,i)=>w.skillMeans[i]!==null&&w.skillMeans[i]<3),
  top=ranked.slice(0,3),support=ranked.filter(s=>s.mean<3).slice().reverse(),
  radarOK=w.skillMeans.every(v=>v!==null);
 let h=`<div class="card"><div class="row"><div><span class="eyebrow">التحليلي الأسبوعي · WEEKLY ANALYSIS</span><h2 style="margin-top:6px">Weekly statistical analysis · Class ${esc(label())}</h2><p class="small" style="margin:0">Based on all recorded ratings between the two dates. Missing ratings are not counted as zero. Reports use Sunday → Thursday by default.</p></div><span class="wk-badge ${final?'wk-final':'wk-prov'}">${final?'✓ Final weekly report':'● Provisional — week in progress'}</span></div>`;
 h+=`<div class="wk-controls no-print"><div><label for="wkFrom">From date</label><input id="wkFrom" type="date" value="${from}"></div><div><label for="wkTo">To date</label><input id="wkTo" type="date" value="${to}"></div><button data-wk="prev">← Previous week</button><button data-wk="now">This week</button><button data-wk="next">Next week →</button><button data-wk="print" class="primary">Print / Save as PDF</button></div>`;
 h+=`<p class="small">${fmtDate(from)} → ${fmtDate(to)} · ${w.days.length} assessed day${w.days.length===1?'':'s'}${w.days.length?' ('+w.days.map(d=>shortDay(d.day)).join(', ')+')':''}</p></div>`;
 if(!w.n){h+='<div class="card empty">No ratings were recorded for this class between these dates.<br>Choose another date range or record ratings in “Quick rating”.</div>';sec.innerHTML=h;return}

 /* overall */
 h+=`<div class="stats"><div class="stat"><span class="small">Overall weekly percentage</span><b class="wk-big">${pctText(w.overall)}</b><div>${delta(w.overall,prev.overall)}</div></div><div class="stat"><span class="small">Weekly average rating</span><b>${fmt(w.overall)} <small>/ 5</small></b><div class="small" style="margin-top:8px;color:${levelColor(w.overall)};font-weight:bold">Overall evaluation: ${level(w.overall)}</div></div><div class="stat"><span class="small">Students assessed</span><b>${ranked.length} <small>/ ${w.students.length}</small></b><div class="small" style="margin-top:8px">${w.n} recorded ratings</div></div></div>`;

 /* charts */
 h+=`<div class="card"><h2>Charts · Final evaluation</h2><div class="two"><div><h3>Radar / web graph — final weekly evaluation</h3>${radarOK?chartSVG(w.skillMeans,'radar'):'<div class="empty">The radar needs ratings for all eight skills in this range.</div>'}</div><div><h3>Bar chart — weekly skill averages</h3>${chartSVG(w.skillMeans,'bar')}</div></div><div style="margin-top:14px"><h3>Daily class percentage across the week</h3>${lineSVG(w.days)}</div></div>`;

 /* skills */
 h+=`<div class="card"><h2>Skill percentages</h2>${skills.map((s,i)=>`<div class="row"><span>${s}</span><b>${fmt(w.skillMeans[i])} <small>/ 5 · ${pctText(w.skillMeans[i])}</small></b></div><div class="bar"><i style="width:${pct(w.skillMeans[i])||0}%"></i></div>`).join('')}</div>`;

 /* detailed report */
 h+=`<div class="card report"><h2>Detailed ${final?'Thursday ':''}report</h2><p>During ${fmtDate(from)} → ${fmtDate(to)}, class ${esc(label())} reached an overall performance of <b>${pctText(w.overall)}</b> (${fmt(w.overall)} / 5 · ${level(w.overall)}) across ${w.days.length} assessed day${w.days.length===1?'':'s'}. ${ranked.length} of ${w.students.length} students were assessed${prev.overall!==null?`; the previous ${len} days averaged ${pctText(prev.overall)}`:''}.</p>`;
 h+=`<div class="two"><div><h3 style="color:var(--green)">Strengths (average 4 or higher)</h3><p>${strengths.join(', ')||'No skills have a weekly average of 4 or higher yet.'}</p></div><div><h3 style="color:var(--pink)">Areas for improvement (below 3)</h3><p>${improve.join(', ')||'No recorded skills are below 3.'}</p></div></div>`;
 h+=`<div class="two"><div><h3 style="color:var(--green)">Top performers</h3><p>${top.length?top.map((s,i)=>`${i+1}. <span style="unicode-bidi:plaintext">${esc(s.name)}</span> — ${pctText(s.mean)}`).join('<br>'):'—'}</p></div><div><h3 style="color:var(--pink)">Students who need support (below 60%)</h3><p>${support.length?support.map(s=>`<span style="unicode-bidi:plaintext">${esc(s.name)}</span> — ${pctText(s.mean)}`).join('<br>'):'No assessed student is below 60%.'}</p></div></div>`;
 if(unassessed.length)h+=`<p class="small"><b>Not assessed in this range:</b> ${unassessed.map(s=>esc(s.name)).join('، ')}</p>`;
 h+=`<small>Insights use recorded ratings only. Missing ratings do not indicate poor performance.</small></div>`;

 /* statistics + daily table */
 const sm=w.summary;
 h+=`<div class="card"><h2>Statistical summary</h2><div class="analytic-metrics"><span>Rating count <b>${sm.n}</b></span><span>Mean <b>${fmt(sm.mean)}</b></span><span>Median <b>${fmt(sm.median)}</b></span><span>Standard deviation <b>${fmt(sm.sd)}</b></span><span>Rated 4+ <b>${sm.mastery===null?'—':sm.mastery.toFixed(0)+'%'}</b></span></div><div class="table-wrap"><table><thead><tr><th>Day</th><th>Ratings</th><th>Average</th><th>Percentage</th></tr></thead><tbody>${w.days.map(d=>`<tr><td>${fmtDate(d.day)}</td><td>${d.n}</td><td>${fmt(d.mean)}</td><td>${pctText(d.mean)}</td></tr>`).join('')}</tbody></table></div></div>`;

 /* students */
 h+=`<div class="card"><h2>Student ranking</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Student</th><th>Days</th>${graphNames.map(n=>`<th>${n}</th>`).join('')}<th>Average</th><th>%</th><th>Level</th></tr></thead><tbody>${ranked.map((s,i)=>`<tr><td>${i+1}</td><td class="nm">${esc(s.name)}</td><td>${s.days}</td>${s.skillMeans.map(v=>`<td>${fmt(v)}</td>`).join('')}<td><b>${fmt(s.mean)}</b></td><td><b>${pctText(s.mean)}</b></td><td style="color:${levelColor(s.mean)};font-weight:bold">${level(s.mean)}</td></tr>`).join('')}</tbody></table></div><p class="small">Level: Excellent 90%+ · Very good 70%+ · Good 50%+ · Fair 30%+ · Poor below 30%. Students with no ratings in the range are listed above, not as zero.</p></div>`;

 /* notes */
 if(w.notes.length)h+=`<div class="card wk-notes"><h2>Teacher notes this week</h2>${w.notes.map(n=>`<p><b style="unicode-bidi:plaintext">${esc(n.name)}</b> · <span class="small">${fmtDate(n.day)}</span><br>${esc(n.note)}</p>`).join('')}</div>`;
 sec.innerHTML=h;
}

/* ---------- actions ---------- */
function setRange(f,t){from=f;to=t;render()}
sec.onclick=e=>{
 const b=e.target.closest('[data-wk]');if(!b)return;
 const a=b.dataset.wk;
 if(a==='prev')setRange(addDays(from,-7),addDays(to,-7));
 else if(a==='next')setRange(addDays(from,7),addDays(to,7));
 else if(a==='now'){const s=startOf(today);setRange(s,addDays(s,4))}
 else if(a==='print')window.print();
};
sec.onchange=e=>{
 if(e.target.id!=='wkFrom'&&e.target.id!=='wkTo')return;
 let f=document.getElementById('wkFrom').value,t=document.getElementById('wkTo').value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(f)||!/^\d{4}-\d{2}-\d{2}$/.test(t)){notify('Choose both dates');render();return}
 if(t<f){if(e.target.id==='wkFrom')t=addDays(f,4);else f=t}
 setRange(f,t);
};
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
 const on=b.dataset.tab==='weekly';
 sec.classList.toggle('hidden',!on);
 if(on)render();
}));
$('classSelect').addEventListener('change',()=>{if(!sec.classList.contains('hidden'))render()});
window.addEventListener('ajyal-cloud-ready',()=>{if(!sec.classList.contains('hidden'))render()});
window.WeeklyAnalysis={collect,render};
})();
