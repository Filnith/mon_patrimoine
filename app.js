(function(){
'use strict';
const CLASSES = {
  liq:{label:"Liquidités", vol:0, color:"--c1"},
  reg:{label:"Épargne réglementée", vol:0, color:"--c2"},
  etf:{label:"ETF", vol:.16, color:"--c3"},
  act:{label:"Actions", vol:.25, color:"--c4"},
  cry:{label:"Crypto", vol:.65, color:"--c5"}
};

const EXAMPLE = {
  accounts:[
    {id:"ce-cc", inst:"Caisse d'Épargne", name:"Compte courant", env:"Compte"},
    {id:"ce-la", inst:"Caisse d'Épargne", name:"Livret A", env:"Livret"},
    {id:"ce-pea", inst:"Caisse d'Épargne", name:"PEA", env:"PEA"},
    {id:"tr-cto", inst:"Trade Republic", name:"Compte-titres", env:"CTO"},
    {id:"rv", inst:"Revolut", name:"Compte et crypto", env:"Compte"}
  ],
  positions:[
    {id:"p1", acc:"ce-cc", name:"Solde", cls:"liq", qty:1, pru:2450, price:2450, ccy:"EUR"},
    {id:"p2", acc:"ce-la", name:"Solde", cls:"reg", qty:1, pru:12000, price:12000, ccy:"EUR"},
    {id:"p3", acc:"ce-pea", name:"ETF MSCI World", cls:"etf", qty:85, pru:480, price:540, ccy:"Monde"},
    {id:"p4", acc:"ce-pea", name:"Air Liquide", cls:"act", qty:20, pru:160, price:175, ccy:"EUR"},
    {id:"p5", acc:"tr-cto", name:"ETF S&P 500", cls:"etf", qty:40, pru:95, price:110, ccy:"USD"},
    {id:"p6", acc:"tr-cto", name:"Apple", cls:"act", qty:15, pru:165, price:205, ccy:"USD"},
    {id:"p7", acc:"tr-cto", name:"Espèces", cls:"liq", qty:1, pru:1500, price:1500, ccy:"EUR"},
    {id:"p8", acc:"rv", name:"Solde", cls:"liq", qty:1, pru:850, price:850, ccy:"EUR"},
    {id:"p9", acc:"rv", name:"Bitcoin", cls:"cry", qty:.08, pru:45000, price:80000, ccy:"Crypto"},
    {id:"p10", acc:"rv", name:"Ethereum", cls:"cry", qty:1.2, pru:2500, price:3000, ccy:"Crypto"}
  ]
};
const KEY = "mon-patrimoine-app-v1";
const clone = o => JSON.parse(JSON.stringify(o));
const DEFAULT = () => ({accounts:[], positions:[], settings:{provider:"none", key:"", fx:null, fxAt:0, fxManual:false, expenses:2000}, snaps:[], series:{}, calls:{day:"", n:0}, lastCrypto:0, isExample:false});
let state;
function load(){
  let s=null;
  try { s = JSON.parse(localStorage.getItem(KEY)) } catch(e) {}
  const d = DEFAULT();
  if(!s || !Array.isArray(s.positions)) return d;
  s.settings = Object.assign(d.settings, s.settings||{});
  for(const k of ["snaps","series","calls"]) if(!s[k]) s[k]=d[k];
  if(!Array.isArray(s.accounts)) s.accounts=[];
  return s;
}
state = load();
// Lignes cotées en dollars (pruUsd, priceUsd) : converties en euros avec le taux des réglages
function applyFx(){
  const fx=parseFloat(state.settings.fx);
  state.positions.forEach(p=>{
    ["qty","pru","price","pruUsd","priceUsd"].forEach(k=>{ if(typeof p[k]==="string") p[k]=parseFloat(String(p[k]).replace(",",".")) });
    if(p.pruUsd==null && p.priceUsd==null) return;
    if(!(fx>0)){ p.fxMissing=true; if(!isFinite(p.pru)) p.pru=0; if(!isFinite(p.price)) p.price=0; return }
    p.fxMissing=false;
    if(p.pruUsd!=null) p.pru=p.pruUsd*fx;
    if(p.priceUsd!=null && p.src!=="auto") p.price=p.priceUsd*fx;
  });
}
applyFx();
function save(){ try { localStorage.setItem(KEY, JSON.stringify(state)) } catch(e){ toast("Impossible d'enregistrer sur cet appareil (stockage plein ou bloqué).") } }
function loadExample(){
  state = Object.assign(DEFAULT(), {accounts:clone(EXAMPLE.accounts), positions:clone(EXAMPLE.positions), isExample:true, settings:state.settings});
  state.positions.forEach(p=>{ if(p.cls==="cry") p.sym=guessCoin(p.name); p.priceAt=Date.now(); p.src="exemple" });
  snapshot(); save();
}
function guessCoin(name){
  const n=String(name).toLowerCase();
  const known={bitcoin:"bitcoin",btc:"bitcoin",ethereum:"ethereum",eth:"ethereum",solana:"solana",sol:"solana",cardano:"cardano",ada:"cardano",ripple:"ripple",xrp:"ripple",polkadot:"polkadot",dot:"polkadot",dogecoin:"dogecoin",doge:"dogecoin",litecoin:"litecoin",ltc:"litecoin",bnb:"binancecoin"};
  for(const k in known) if(n===k || n.split(/\W+/).includes(k)) return known[k];
  return "";
}

const eur0 = new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const eur2 = new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2});
const pctF = new Intl.NumberFormat("fr-FR",{style:"percent",minimumFractionDigits:1,maximumFractionDigits:1});
const nbF = new Intl.NumberFormat("fr-FR",{maximumFractionDigits:6});
const sign = v => (v>0?"+":v<0?"−":"");
const money = (v,d) => sign(v)+(d?eur2:eur0).format(Math.abs(v));
const pct = v => sign(v)+pctF.format(Math.abs(v));
const cl = v => v>0?"up":v<0?"down":"";
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isMarket = p => CLASSES[p.cls] && CLASSES[p.cls].vol > 0;
const num = v => (typeof v==="number" && isFinite(v)) ? v : 0;
const val = p => num(p.qty)*num(p.price);
function byClass(){ const m={}; state.positions.forEach(p=>{ m[p.cls]=(m[p.cls]||0)+val(p) }); return m }
function byInst(){ const m={}; state.positions.forEach(p=>{ const a=state.accounts.find(a=>a.id===p.acc); const k=a?a.inst:"Autre"; m[k]=(m[k]||0)+val(p) }); return m }
const accById = id => state.accounts.find(a=>a.id===id) || {inst:"Autre", name:"Compte", env:""};
// ---------- Historique réel : un relevé du total à chaque ouverture ou actualisation ----------
function prevClose(p){ return isMarket(p) ? (p.prev||null) : p.price }
function totals(){
  let total=0, prev=0, dayKnown=false, gain=0, cost=0;
  state.positions.forEach(p=>{
    total+=val(p);
    if(isMarket(p)){ gain+=num(p.qty)*(num(p.price)-num(p.pru)); cost+=num(p.qty)*num(p.pru);
      if(p.prev && p.priceAt && sameDay(p.priceAt,Date.now())){ prev+=p.qty*p.prev; dayKnown=true } else prev+=val(p) }
    else prev+=val(p);
  });
  return {total, day:total-prev, dayPct:prev?(total-prev)/prev:0, dayKnown, gain, gainPct:cost?gain/cost:0};
}
function sameDay(a,b){ const x=new Date(a), y=new Date(b); return x.toDateString()===y.toDateString() }
function snapshot(){
  if(!state.positions.length) return;
  const v=Math.round(totals().total*100)/100, now=Date.now(), S=state.snaps, last=S[S.length-1];
  if(last && now-last.t<10*60*1000) { last.v=v; last.t=now } else S.push({t:now, v});
  // au-delà de 2 jours, on ne garde qu'un relevé par jour (le dernier)
  const cut=now-2*86400000, out=[], seen={};
  for(let i=S.length-1;i>=0;i--){ const s=S[i]; if(s.t>=cut){ out.push(s); continue } const k=new Date(s.t).toDateString(); if(!seen[k]){ seen[k]=1; out.push(s) } }
  state.snaps=out.reverse().slice(-1200);
}
const RANGES = [
  {k:"1J", label:"1 J", days:1, name:"aujourd'hui"},
  {k:"1S", label:"1 S", days:7, name:"sur 1 semaine"},
  {k:"1M", label:"1 M", days:30, name:"sur 1 mois"},
  {k:"3M", label:"3 M", days:91, name:"sur 3 mois"},
  {k:"6M", label:"6 M", days:182, name:"sur 6 mois"},
  {k:"1A", label:"1 A", days:365, name:"sur 1 an"}
];
function seriesFor(R){
  const now=Date.now(), S=state.snaps;
  if(R.k==="1J"){
    const start=new Date(); start.setHours(0,0,0,0);
    const before=S.filter(s=>s.t<start.getTime()).pop();
    return (before?[before]:[]).concat(S.filter(s=>s.t>=start.getTime()));
  }
  return S.filter(s=>s.t>=now-R.days*86400000);
}
const fmtDate = t => new Date(t).toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
const fmtTime = t => new Date(t).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
function ago(t){ if(!t) return "jamais"; const m=Math.round((Date.now()-t)/60000); if(m<1) return "à l'instant"; if(m<60) return `il y a ${m} min`; const h=Math.round(m/60); if(h<24) return `il y a ${h} h`; return `le ${fmtDate(t)}` }
function priceInfo(p){
  const src = p.src==="auto" ? "cours auto" : p.src==="fichier" ? "cours du fichier" : p.src==="exemple" ? "cours d'exemple" : "cours saisi à la main";
  const old = Date.now()-(p.priceAt||0) > 3*86400000;
  return `<span class="${old?"stale":""}">${src}, ${ago(p.priceAt)}${!p.sym&&p.cls!=="liq"?" · pas de symbole":""}</span>`;
}

// ---------- Vues ----------
let tab = "global", range = "1M", confirmDel = null;
const view = document.getElementById("view");

function lineChart(series, fromLabel, toLabel){
  const W=340,H=160,pl=4,pr=4,pt=12,pb=30;
  const min=Math.min(...series), max=Math.max(...series), span=(max-min)||1;
  const x=i=>pl+i*(W-pl-pr)/(series.length-1), y=v=>pt+(1-(v-min)/span)*(H-pt-pb);
  const pts=series.map((v,i)=>x(i).toFixed(1)+","+y(v).toFixed(1));
  const up=series[series.length-1]>=series[0];
  const col=up?"var(--up)":"var(--down)";
  const lx=x(series.length-1), ly=y(series[series.length-1]);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Évolution simulée du patrimoine depuis ${fromLabel}">
    <line x1="${pl}" x2="${W-pr}" y1="${y(max)}" y2="${y(max)}" stroke="var(--line)" stroke-dasharray="3 3"/>
    <line x1="${pl}" x2="${W-pr}" y1="${y(min)}" y2="${y(min)}" stroke="var(--line)" stroke-dasharray="3 3"/>
    <polygon points="${pl},${H-pb} ${pts.join(" ")} ${W-pr},${H-pb}" fill="${col}" fill-opacity=".1"/>
    <polyline points="${pts.join(" ")}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${lx}" cy="${ly}" r="4" fill="${col}"/>
    <text x="${pl}" y="${y(max)-3}">${eur0.format(max)}</text>
    <text x="${pl}" y="${y(min)+12}">${eur0.format(min)}</text>
    <text x="${pl}" y="${H-3}">${fromLabel}</text>
    <text x="${W-pr}" y="${H-3}" text-anchor="end">${toLabel}</text>
  </svg>`;
}
function donut(m,total){
  const r=52,C=2*Math.PI*r; let off=0, segs="";
  Object.keys(CLASSES).forEach(k=>{ if(!m[k]) return; const len=C*m[k]/total;
    segs+=`<circle r="${r}" cx="65" cy="65" fill="none" stroke="var(${CLASSES[k].color})" stroke-width="20" stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 65 65)"/>`; off+=len });
  return `<svg viewBox="0 0 130 130" width="130" role="img" aria-label="Répartition par classe d'actifs">${segs}</svg>`;
}

function emptyState(){
  return `<section class="panel empty">
    <h2 style="margin:0">Bienvenue</h2>
    <p style="margin:0">Ajoute tes comptes et tes placements pour voir ton patrimoine ici. Tout reste sur ce téléphone.</p>
    <div class="actions"><button class="btn" data-act="add">Ajouter une position</button><button class="btn ghost" data-act="import">Importer un fichier</button></div>
    <p class="note" style="margin:0">Tu veux d'abord voir à quoi ça ressemble ? <button class="btn small ghost" data-act="example">Charger un exemple</button></p>
  </section>`;
}
function renderGlobal(){
  if(!state.positions.length) return emptyState();
  const t=totals(), m=byClass(), inst=byInst();
  const R=RANGES.find(x=>x.k===range);
  const S=seriesFor(R), series=S.map(s=>s.v);
  const enough=series.length>=2;
  const first=state.snaps[0], histDays=first?(Date.now()-first.t)/86400000:0;
  const shortHist = R.k!=="1J" && histDays < R.days-0.5;
  const chg=enough?series[series.length-1]-series[0]:0, chgPct=enough&&series[0]?chg/series[0]:0;
  const movers=state.positions.filter(p=>isMarket(p)&&p.prev&&sameDay(p.priceAt,Date.now())).map(p=>({p, d:p.qty*(p.price-p.prev), dp:(p.price-p.prev)/p.prev})).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)).slice(0,3);
  const instMax=Math.max(...Object.values(inst));
  return `
  ${state.positions.some(p=>p.fxMissing)?`<section class="panel point warn"><p style="margin:0">Certaines lignes sont en dollars et le taux dollar → euro n'est pas encore connu. Elles comptent pour 0 € en attendant. Touche ↻ en haut, ou indique le taux dans les réglages.</p></section>`:""}
  ${state.isExample?`<section class="panel" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span class="note">Tu regardes des <b>données d'exemple</b>.</span><button class="btn small" data-act="clear-example">Effacer et commencer</button></section>`:""}
  <section class="hero">
    <span class="label">Patrimoine total</span>
    <span class="total num">${eur0.format(t.total)}</span>
    <div class="chips">
      ${t.dayKnown?`<span class="chip num ${cl(t.day)}">${money(t.day)} (${pct(t.dayPct)}) aujourd'hui</span>`:""}
      <span class="chip num ${cl(t.gain)}">${money(t.gain)} de plus-value latente</span>
    </div>
  </section>
  <section class="panel">
    <div class="row-head"><h2>Évolution</h2>${enough?`<span class="num ${cl(chg)}" style="font-size:13.5px">${money(chg)} (${pct(chgPct)}) ${shortHist?"depuis le "+fmtDate(first.t):R.name}</span>`:""}</div>
    <div class="seg" role="group" aria-label="Période" style="display:flex;margin-bottom:10px">
      ${RANGES.map(x=>`<button style="flex:1" data-range="${x.k}" aria-pressed="${range===x.k}">${x.label}</button>`).join("")}
    </div>
    ${enough && shortHist ? `<p class="note" style="margin:0 0 8px">Ton historique commence le ${fmtDate(first.t)} à ${fmtTime(first.t)}. Pour l'instant, cette période montre donc la même chose que les périodes plus courtes. Elle se remplira jour après jour.</p>`:""}
    ${enough ? lineChart(series, R.k==="1J"?fmtTime(S[0].t):fmtDate(S[0].t), "maintenant")
      : `<p class="note" style="margin:0">L'historique se construit au fil du temps : l'appli note la valeur de ton patrimoine à chaque ouverture et à chaque actualisation des cours. Reviens plus tard pour voir la courbe ${R.name}.</p>`}
  </section>
  <section class="panel">
    <h2>Répartition par classe d'actifs</h2>
    <div class="alloc">${donut(m,t.total)}
      <div class="legend">${Object.keys(CLASSES).filter(k=>m[k]).map(k=>`<div><span class="sw" style="background:var(${CLASSES[k].color})"></span><span>${CLASSES[k].label}</span><span class="num">${eur0.format(m[k])}</span><span class="num pct">${pctF.format(m[k]/t.total)}</span></div>`).join("")}</div>
    </div>
  </section>
  <section class="panel">
    <h2>Par établissement</h2>
    <div class="bars">${Object.entries(inst).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div><div class="bar-label"><span>${esc(k)}</span><span class="num">${eur0.format(v)} · ${pctF.format(v/t.total)}</span></div><div class="track"><i style="width:${(v/instMax*100).toFixed(1)}%"></i></div></div>`).join("")}</div>
  </section>
  ${movers.length?`<section class="panel">
    <h2>Plus gros mouvements du jour</h2>
    <div class="list">${movers.map(o=>`<div class="line"><span class="name">${esc(o.p.name)}</span><span class="val num ${cl(o.d)}">${money(o.d)}</span><span class="sub">${esc(accById(o.p.acc).inst)} · ${esc(accById(o.p.acc).env)}</span><span class="r num ${cl(o.dp)}">${pct(o.dp)}</span></div>`).join("")}</div>
  </section>`:""}`;
}

function posLine(p){
  if(!isMarket(p)) return `<div class="line"><span class="name">${esc(p.name)}</span><span class="val num">${eur2.format(val(p))}</span><span class="sub">${CLASSES[p.cls].label}</span><span></span></div>`;
  const pc=prevClose(p), dp=pc?(p.price-pc)/pc:null;
  return `<div class="line"><span class="name">${esc(p.name)}</span><span class="val num">${eur0.format(val(p))}</span><span class="sub num">${nbF.format(p.qty)} × ${eur2.format(p.price)}</span><span class="r num ${cl(dp)}">${dp==null?"":pct(dp)}</span></div>`;
}
function renderComptes(){
  const insts=[...new Set(state.accounts.map(a=>a.inst))];
  return insts.map(inst=>{
    const accs=state.accounts.filter(a=>a.inst===inst);
    return `<div class="inst">${esc(inst)}</div>`+accs.map(a=>{
      const ps=state.positions.filter(p=>p.acc===a.id); if(!ps.length) return "";
      const tot=ps.reduce((s,p)=>s+val(p),0);
      return `<section class="panel"><div class="acc-head"><span><span class="t">${esc(a.name)}</span>${a.env?`<span class="env">${esc(a.env)}</span>`:""}</span><span class="num t">${eur0.format(tot)}</span></div><div class="list">${ps.map(posLine).join("")}</div></section>`;
    }).join("");
  }).join("");
}
function renderPositions(){
  const ps=state.positions.slice().sort((a,b)=>val(b)-val(a));
  if(!ps.length) return emptyState();
  return `
  <div class="actions"><button class="btn" data-act="add">Ajouter une position</button><button class="btn ghost" data-act="import">Importer un fichier</button></div>
  <section class="panel"><h2>Toutes les lignes</h2><div class="list">${ps.map(p=>{
    const a=accById(p.acc); const g=isMarket(p)?p.qty*(p.price-p.pru):0; const gp=isMarket(p)&&p.pru?(p.price-p.pru)/p.pru:0;
    const del = confirmDel===p.id
      ? `<span class="actions"><button class="btn small danger" data-del="${p.id}">Supprimer</button><button class="btn small ghost" data-cancel="1">Annuler</button></span>`
      : `<span class="actions"><button class="btn small ghost" data-edit="${p.id}">Modifier</button><button class="btn small ghost" data-ask="${p.id}">Retirer</button></span>`;
    return `<div class="line"><span class="name">${esc(p.name)}</span><span class="val num">${eur0.format(val(p))}</span>
      <span class="sub">${esc(a.inst)} · ${esc(a.name)} · ${CLASSES[p.cls].label}${isMarket(p)?` · PRU ${eur2.format(p.pru)} · cours ${eur2.format(p.price)}`:""}${isMarket(p)?`<br>${priceInfo(p)}`:""}</span>
      <span class="r num ${cl(g)}">${isMarket(p)?`${money(g)} (${pct(gp)})`:""}</span>
      <span style="grid-column:1/-1;margin-top:6px">${del}</span></div>`;
  }).join("")}</div></section>
  <p class="note">Tes données restent sur cet appareil. Pense à les sauvegarder de temps en temps depuis les réglages (roue dentée en haut).</p>`;
}

let dropEq = 20, dropCry = 50;
let expenses = state.settings.expenses || 2000;
function risk(){
  const t=totals(), m=byClass(), total=t.total;
  const w=k=>(m[k]||0)/total;
  const vol=Object.keys(CLASSES).reduce((s,k)=>s+w(k)*CLASSES[k].vol,0);
  const levels=[[.04,"Prudent"],[.08,"Modéré"],[.14,"Dynamique"],[9,"Offensif"]];
  const li=levels.findIndex(l=>vol<l[0]);
  const market=state.positions.filter(isMarket);
  const marketTot=market.reduce((s,p)=>s+val(p),0);
  const big=market.slice().sort((a,b)=>val(b)-val(a))[0];
  const bigPct=big?val(big)/total:0;
  const usd=market.filter(p=>p.ccy==="USD").reduce((s,p)=>s+val(p),0);
  const safe=(m.liq||0)+(m.reg||0);
  const envOf=p=>accById(p.acc).env;
  const pea=market.filter(p=>envOf(p)==="PEA").reduce((s,p)=>s+val(p),0);
  const cto=market.filter(p=>envOf(p)==="CTO").reduce((s,p)=>s+val(p),0);
  const stocks=market.filter(p=>p.cls==="act");
  return {t,m,total,vol,li,level:levels[li][1],big,bigPct,cry:w("cry"),usdPct:marketTot?usd/marketTot:0,usd,safe,eq:(m.etf||0)+(m.act||0),cryV:m.cry||0,market,marketTot,pea,cto,stocks,etfPct:marketTot?(m.etf||0)/marketTot:0};
}
function riskPoints(r){
  const P=[], f1=v=>nbF.format(Math.round(v*10)/10);
  const months=r.safe/expenses;
  // 1. Concentration
  P.push(r.bigPct>.2 ? {lvl:"warn", t:"Concentration sur une ligne",
      c:`${esc(r.big.name)} représente ${pctF.format(r.bigPct)} de ton patrimoine (${eur0.format(val(r.big))}).`,
      w:"Plus une ligne pèse lourd, plus une mauvaise nouvelle sur ce titre ou ce fonds touche l'ensemble de ton patrimoine. Pour un ETF très diversifié, ce risque est plus faible que pour une action seule.",
      a:[r.big.cls==="etf"?"Vérifie ce que contient cet ETF : un ETF monde reste très investi dans les grandes valeurs américaines.":"Fixe-toi un poids maximum pour une action seule, et allège si elle le dépasse.","Plutôt que de vendre, tu peux diriger tes prochains versements vers les autres lignes."]}
    : {lvl:"ok", t:"Concentration sur une ligne", c:`Ta plus grosse ligne pèse ${pctF.format(r.bigPct)} du patrimoine, sous le seuil de 20 % du prototype.`, w:"Aucune ligne ne domine ton patrimoine.", a:[]});
  // 2. Crypto
  P.push(r.cry>.1 ? {lvl:"warn", t:"Poids de la crypto",
      c:`La crypto représente ${pctF.format(r.cry)} du total (${eur0.format(r.cryV)}). Une baisse de 50 % te coûterait ${eur0.format(r.cryV/2)}.`,
      w:"Les cryptos ont connu plusieurs baisses de plus de 50 % par le passé. Elles ne versent ni dividende ni intérêt, leur prix dépend surtout de l'offre et de la demande.",
      a:["Décide à l'avance la part maximum que tu acceptes, et rééquilibre quand elle est dépassée.","Garde seulement ce que tu accepterais de voir fortement baisser sans devoir vendre."]}
    : {lvl:r.cry>0?"info":"ok", t:"Poids de la crypto", c:`La crypto représente ${pctF.format(r.cry)} du total.`, w:"Cette part reste sous le seuil de 10 % du prototype.", a:[]});
  // 3. Épargne de précaution
  P.push(months<3 ? {lvl:"warn", t:"Épargne de précaution",
      c:`Tes liquidités et livrets (${eur0.format(r.safe)}) couvrent ${f1(months)} mois de dépenses à ${eur0.format(expenses)} par mois.`,
      w:"Sans réserve suffisante, une dépense imprévue peut t'obliger à vendre des placements au mauvais moment. Un repère souvent cité est de 3 à 6 mois de dépenses.",
      a:["Renforce d'abord tes livrets avant d'investir davantage en bourse."]}
    : months>12 ? {lvl:"info", t:"Épargne de précaution",
      c:`Tes liquidités et livrets (${eur0.format(r.safe)}) couvrent ${f1(months)} mois de dépenses.`,
      w:"C'est une réserve confortable. Au-delà de tes besoins et de tes projets proches, l'argent qui dort peut perdre du pouvoir d'achat avec l'inflation.",
      a:["Liste tes projets des 2 à 3 prochaines années, garde l'argent nécessaire, et envisage de placer à long terme une partie du reste."]}
    : {lvl:"ok", t:"Épargne de précaution", c:`Tes liquidités et livrets couvrent ${f1(months)} mois de dépenses.`, w:"Tu es dans le repère courant de 3 à 12 mois.", a:[]});
  // 4. Devise
  P.push(r.usdPct>.4 ? {lvl:"warn", t:"Exposition au dollar",
      c:`${pctF.format(r.usdPct)} de tes placements de marché (${eur0.format(r.usd)}) sont en titres américains, sans compter la part américaine de l'ETF monde.`,
      w:"Si le dollar baisse face à l'euro, ces placements perdent de la valeur en euros, même si leur cours en dollars ne bouge pas.",
      a:["Certains ETF existent en version « couverte » contre le risque de change, avec des frais en général un peu plus élevés."]}
    : {lvl:"info", t:"Exposition au dollar", c:`${pctF.format(r.usdPct)} de tes placements de marché sont explicitement en titres américains.`, w:"L'ETF monde ajoute une part de dollar qui n'est pas comptée ici.", a:[]});
  // 5. Enveloppes
  if(r.cto>0) P.push({lvl:"info", t:"Répartition PEA et compte-titres",
      c:`${eur0.format(r.pea)} sont sur un PEA et ${eur0.format(r.cto)} sur un compte-titres.`,
      w:"Le PEA offre une fiscalité plus douce sur les gains après 5 ans de détention, mais n'accepte que certains titres (européens, et des ETF éligibles). Le compte-titres accepte tout, avec une fiscalité moins favorable.",
      a:["Vérifie si certaines lignes du compte-titres ont un équivalent éligible au PEA, avant de nouveaux achats."]});
  // 6. Actions en direct
  if(r.stocks.length) P.push({lvl:r.stocks.length<5?"info":"ok", t:"Actions en direct",
      c:`Tu détiens ${r.stocks.length} action${r.stocks.length>1?"s":""} en direct (${r.stocks.map(p=>esc(p.name)).join(", ")}) et ${pctF.format(r.etfPct)} de tes placements de marché sont en ETF.`,
      w:"Une action seule peut chuter fortement sur une mauvaise nouvelle propre à l'entreprise. Les ETF répartissent ce risque sur des centaines de sociétés.",
      a:r.stocks.length<5?["Garde les actions en direct comme une poche limitée à côté d'un cœur de portefeuille en ETF."]:[]});
  return P;
}
function stressHTML(r){
  const loss=r.eq*dropEq/100+r.cryV*dropCry/100;
  return `<span class="num down">−${eur0.format(loss)}</span> soit ${pctF.format(loss/r.total)} du patrimoine, qui passerait à <span class="num">${eur0.format(r.total-loss)}</span>.`;
}
function renderRisque(){
  const r=risk(); const months=r.safe/expenses;
  const pts=riskPoints(r).sort((a,b)=>({warn:0,info:1,ok:2}[a.lvl])-({warn:0,info:1,ok:2}[b.lvl]));
  const LV={warn:"À surveiller",info:"À savoir",ok:"Correct"};
  return `
  <section class="panel">
    <h2>Profil de risque estimé</h2>
    <div class="row-head" style="margin:0"><span style="font-size:22px;font-weight:600">${r.level}</span><span class="num note">volatilité ≈ ${pctF.format(r.vol)} / an</span></div>
    <div class="gauge" aria-hidden="true">${[0,1,2,3].map(i=>`<span class="${i<=r.li?"on":""}"></span>`).join("")}</div>
    <p class="note" style="margin:10px 0 0">Calcul simplifié : moyenne des volatilités typiques de chaque classe (ETF 16 %, actions 25 %, crypto 65 %, liquidités 0 %), pondérée par ton allocation. La diversification est ignorée, donc c'est plutôt une borne haute.</p>
  </section>
  <div class="kpis">
    <div class="kpi ${r.bigPct>.2?"alert":""}"><span class="k">Plus grosse ligne</span><span class="v num">${pctF.format(r.bigPct)}</span><span class="note">${r.big?esc(r.big.name):"Aucune"}</span>${r.bigPct>.2?`<span class="flag">Au-dessus de 20 %</span>`:""}</div>
    <div class="kpi ${r.cry>.1?"alert":""}"><span class="k">Part crypto</span><span class="v num">${pctF.format(r.cry)}</span><span class="note">${eur0.format(r.cryV)}</span>${r.cry>.1?`<span class="flag">Au-dessus de 10 %</span>`:""}</div>
    <div class="kpi ${months<3?"alert":""}"><span class="k">Épargne disponible</span><span class="v num" id="months">${nbF.format(Math.round(months*10)/10)} mois</span><span class="note">${eur0.format(r.safe)} de liquidités et livrets</span></div>
    <div class="kpi ${r.usdPct>.4?"alert":""}"><span class="k">Exposition dollar</span><span class="v num">${pctF.format(r.usdPct)}</span><span class="note">des placements de marché</span></div>
  </div>
  <section class="panel">
    <label class="f" for="exp">Tes dépenses mensuelles (pour calculer l'épargne disponible)
      <input id="exp" type="number" inputmode="numeric" min="100" step="100" value="${expenses}"></label>
  </section>
  <section class="panel">
    <h2>Et si les marchés baissaient ?</h2>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="slider"><div class="lab"><label for="sEq">Baisse des actions et ETF</label><span class="num" id="vEq">−${dropEq} %</span></div><input id="sEq" type="range" min="0" max="60" step="5" value="${dropEq}"></div>
      <div class="slider"><div class="lab"><label for="sCry">Baisse des cryptos</label><span class="num" id="vCry">−${dropCry} %</span></div><input id="sCry" type="range" min="0" max="90" step="5" value="${dropCry}"></div>
      <p style="margin:0" id="stress">${stressHTML(r)}</p>
    </div>
  </section>
  <h2 style="margin:4px 0 -6px">Points à examiner</h2>
  ${pts.map(p=>`<section class="panel point ${p.lvl}">
    <div class="row-head" style="margin-bottom:6px"><strong>${p.t}</strong><span class="tag ${p.lvl}">${LV[p.lvl]}</span></div>
    <p style="margin:0 0 8px">${p.c}</p>
    <p class="note" style="margin:0"><b>Pourquoi c'est important.</b> ${p.w}</p>
    ${p.a.length?`<ul class="ideas" style="margin-top:8px">${p.a.map(x=>`<li>${x}</li>`).join("")}</ul>`:""}
  </section>`).join("")}
  <p class="disclaimer">Ces indications sont calculées automatiquement à partir de tes saisies et de seuils indicatifs choisis pour le prototype. Elles ne constituent pas un conseil en investissement. Pour un conseil personnalisé, adresse-toi à un conseiller en investissements financiers (CIF) enregistré à l'ORIAS.</p>`;
}


function toast(msg){ const d=document.createElement("div"); d.className="toast"; d.textContent=msg; document.body.appendChild(d); setTimeout(()=>d.remove(),2200) }

const sheetRoot=document.getElementById("sheetRoot");
function openSheet(editId){
  const ed=editId?state.positions.find(p=>p.id===editId):null;
  sheetRoot.innerHTML=`<div class="sheet-bg" id="sbg"><form class="sheet" id="form" novalidate>
    <h3>${ed?"Modifier la position":"Ajouter une position"}</h3>
    <label class="f" for="fAcc">Compte<select id="fAcc">${state.accounts.map(a=>`<option value="${a.id}">${esc(a.inst)} · ${esc(a.name)}</option>`).join("")}<option value="__new">Nouveau compte…</option></select></label>
    <div class="grid2" id="newAcc" hidden><label class="f" for="fInst">Établissement<input id="fInst" placeholder="Boursorama"></label><label class="f" for="fEnv">Type<select id="fEnv"><option>PEA</option><option>CTO</option><option>Assurance vie</option><option>Livret</option><option>Compte</option><option>Crypto</option></select></label></div>
    <label class="f" for="fName">Nom<input id="fName" placeholder="ETF MSCI World, Bitcoin, Livret A…"></label>
    <label class="f" for="fCls">Classe d'actif<select id="fCls">${Object.entries(CLASSES).map(([k,c])=>`<option value="${k}">${c.label}</option>`).join("")}</select></label>
    <div id="mkt" class="grid2"><label class="f" for="fQty">Quantité<input id="fQty" type="number" inputmode="decimal" step="any" min="0"></label><label class="f" for="fPru">Prix de revient unitaire (€)<input id="fPru" type="number" inputmode="decimal" step="any" min="0"></label>
      <label class="f" for="fPrice">Cours actuel (€)<input id="fPrice" type="number" inputmode="decimal" step="any" min="0"></label><label class="f" for="fCcy">Exposition<select id="fCcy"><option>EUR</option><option>USD</option><option>Monde</option><option>Crypto</option></select></label>
      <label class="f" for="fSym">Symbole pour les cours auto<input id="fSym" autocapitalize="off" autocomplete="off" placeholder="ex. bitcoin, AIR.PA"></label>
      <label class="f" for="fQc">Devise du cours<select id="fQc"><option>EUR</option><option>USD</option></select></label></div>
    <p class="note" id="symHelp" style="margin:-4px 0 0"></p>
    <label class="f" for="fAmt" id="amtWrap" hidden>Montant (€)<input id="fAmt" type="number" inputmode="decimal" step="any" min="0"></label>
    <p class="err" id="fErr" hidden></p>
    <div class="actions"><button class="btn" type="submit">Enregistrer</button><button class="btn ghost" type="button" id="fCancel">Annuler</button></div>
  </form></div>`;
  const $=id=>document.getElementById(id);
  if(ed){ $("fAcc").value=ed.acc; $("fName").value=ed.name; $("fCls").value=ed.cls; $("fCcy").value=ed.ccy||"EUR"; $("fSym").value=ed.sym||""; $("fQc").value=ed.qccy||"EUR";
    if(isMarket(ed)){ $("fQty").value=ed.qty; $("fPru").value=ed.pru; $("fPrice").value=+ed.price.toFixed(4) } else $("fAmt").value=+val(ed).toFixed(2) }
  const sync=()=>{ const m=CLASSES[$("fCls").value].vol>0; $("mkt").hidden=!m; $("symHelp").hidden=!m; $("amtWrap").hidden=m; $("newAcc").hidden=$("fAcc").value!=="__new";
    $("symHelp").textContent = $("fCls").value==="cry" ? "Crypto : identifiant CoinGecko (bitcoin, ethereum, solana…). Le cours se met à jour tout seul." : symbolHelp(); };
  $("fCls").addEventListener("change",sync); $("fAcc").addEventListener("change",sync); sync();
  $("fCancel").onclick=closeSheet; $("sbg").addEventListener("click",e=>{ if(e.target.id==="sbg") closeSheet() });
  $("form").addEventListener("submit",e=>{
    e.preventDefault();
    const cls=$("fCls").value, name=$("fName").value.trim(), m=CLASSES[cls].vol>0;
    const err=msg=>{ $("fErr").textContent=msg; $("fErr").hidden=false };
    if(!name) return err("Indique un nom pour cette ligne.");
    let acc=$("fAcc").value;
    if(acc==="__new"){ const inst=$("fInst").value.trim(); if(!inst) return err("Indique l'établissement du nouveau compte."); acc=findOrCreateAccount(inst,$("fEnv").value) }
    let p;
    if(m){ const qty=+$("fQty").value, pru=+$("fPru").value, price=+$("fPrice").value||pru;
      if(!(qty>0)||!(pru>0)) return err("Indique une quantité et un prix de revient supérieurs à zéro.");
      const sym=$("fSym").value.trim()||(cls==="cry"?guessCoin(name):"");
      p={id:"p"+Date.now(),acc,name,cls,qty,pru,price,ccy:$("fCcy").value,sym,qccy:$("fQc").value};
      if(ed && Math.abs(ed.price-price)<1e-6){ p.prev=ed.prev; p.priceAt=ed.priceAt; p.src=ed.src; p.pruUsd=Math.abs(ed.pru-pru)<1e-6?ed.pruUsd:undefined; p.priceUsd=ed.priceUsd } else { p.priceAt=Date.now(); p.src="manuel"; if(ed && Math.abs(ed.pru-pru)<1e-6) p.pruUsd=ed.pruUsd }
    } else { const amt=+$("fAmt").value; if(!(amt>=0)||$("fAmt").value==="") return err("Indique le montant en euros."); p={id:"p"+Date.now(),acc,name,cls,qty:1,pru:amt,price:amt,ccy:"EUR"} }
    if(ed){ p.id=ed.id; state.positions[state.positions.indexOf(ed)]=p } else state.positions.push(p);
    if(ed && ed.sym!==p.sym) delete state.series[p.id];
    snapshot(); save(); closeSheet(); render(); toast(ed?"Position modifiée":"Position enregistrée");
  });
  $("fName").focus();
}
function closeSheet(){ sheetRoot.innerHTML="" }

// ---------- Import CSV ----------
function parseNum(s){
  if(s==null) return NaN; s=String(s).trim().replace(/[\s  €$£]|EUR|USD/gi,"");
  if(!s) return NaN;
  const c=s.lastIndexOf(","), d=s.lastIndexOf(".");
  if(c>-1 && d>-1){ s = c>d ? s.replace(/\./g,"").replace(",",".") : s.replace(/,/g,"") }
  else if(c>-1) s=s.replace(",",".");
  return parseFloat(s);
}
function parseCSV(text){
  text=text.replace(/^﻿/,"");
  const first=text.split(/\r?\n/).find(l=>l.trim())||"";
  const delim=[";",",","\t","|"].map(d=>[d,first.split(d).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[]; let row=[], cell="", q=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){ cell+='"'; i++ } else q=false } else cell+=ch }
    else if(ch==='"') q=true;
    else if(ch===delim){ row.push(cell.trim()); cell="" }
    else if(ch==="\n"||ch==="\r"){ if(ch==="\r"&&text[i+1]==="\n") i++; row.push(cell.trim()); cell=""; if(row.some(x=>x)) rows.push(row); row=[] }
    else cell+=ch;
  }
  row.push(cell.trim()); if(row.some(x=>x)) rows.push(row);
  // l'en-tête est la première ligne qui a autant de colonnes que la plupart des lignes
  const counts={}; rows.forEach(r=>counts[r.length]=(counts[r.length]||0)+1);
  const n=+Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
  const hi=rows.findIndex(r=>r.length===n);
  return {header:rows[hi]||[], rows:rows.slice(hi+1).filter(r=>r.length>=n-1)};
}
const IMPORT_FIELDS = {
  positions:[
    {k:"name", label:"Nom du titre", req:true, re:/nom|libell|name|titre|instrument|produit|valeur|actif|asset/i},
    {k:"isin", label:"ISIN (facultatif)", re:/isin|code/i},
    {k:"qty", label:"Quantité", req:true, re:/quantit|qty|nombre|shares|parts|nb/i},
    {k:"pru", label:"Prix de revient unitaire", req:true, re:/pru|revient|moyen|average|cost|achat/i},
    {k:"price", label:"Cours actuel (facultatif)", re:/cours|price|dernier|last|actuel/i}
  ],
  transactions:[
    {k:"date", label:"Date (facultatif)", re:/date/i},
    {k:"type", label:"Type d'opération (facultatif)", re:/type|sens|op[ée]ration|transaction|action/i},
    {k:"name", label:"Nom du titre", req:true, re:/nom|libell|name|titre|instrument|produit|valeur|actif|asset|description/i},
    {k:"isin", label:"ISIN (facultatif)", re:/isin/i},
    {k:"qty", label:"Quantité", req:true, re:/quantit|qty|nombre|shares|parts|nb/i},
    {k:"price", label:"Prix unitaire", req:true, re:/prix|price|cours|unit/i},
    {k:"fees", label:"Frais (facultatif)", re:/frais|fee|commission/i}
  ]
};
function guessMap(header, kind){
  const map={}, used=new Set();
  IMPORT_FIELDS[kind].forEach(f=>{ const i=header.findIndex((h,j)=>!used.has(j) && f.re.test(h)); if(i>-1){ map[f.k]=i; used.add(i) } else map[f.k]=-1 });
  return map;
}
function buildFromCSV(data, kind, map, cls, acc){
  const out=[], skipped=[];
  const get=(r,k)=>map[k]>-1?r[map[k]]:"";
  if(kind==="positions"){
    data.rows.forEach((r,i)=>{
      const name=get(r,"name"), qty=parseNum(get(r,"qty")), pru=parseNum(get(r,"pru")), price=parseNum(get(r,"price"));
      if(!name||!(qty>0)||!(pru>0)){ skipped.push(i+1); return }
      out.push({name, isin:get(r,"isin"), qty, pru, price:price>0?price:pru});
    });
  } else {
    const groups={};
    data.rows.forEach((r,i)=>{
      const name=get(r,"name"), isin=get(r,"isin"), type=get(r,"type").toLowerCase();
      let qty=parseNum(get(r,"qty")); const price=Math.abs(parseNum(get(r,"price"))), fees=Math.abs(parseNum(get(r,"fees")))||0;
      if(!name||!(Math.abs(qty)>0)||!(price>0)){ skipped.push(i+1); return }
      let sell = /vente|sell|verkauf|cession/.test(type) || qty<0;
      if(type && !sell && !/achat|buy|kauf|purchase|savings|épargne|epargne|invest|souscription/.test(type)){ skipped.push(i+1); return }
      qty=Math.abs(qty);
      const key=isin||name.toLowerCase();
      const g=groups[key]||(groups[key]={name, isin, qty:0, cost:0, last:price, d:""});
      const d0=String(get(r,"date")), m=d0.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
      const d=m?`${m[3].length===2?"20"+m[3]:m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:d0;
      if(sell){ const avg=g.qty?g.cost/g.qty:0; g.qty=Math.max(0,g.qty-qty); g.cost=avg*g.qty }
      else { g.qty+=qty; g.cost+=qty*price+fees }
      if(!g.d || d>=g.d){ g.last=price; g.d=d }
    });
    Object.values(groups).forEach(g=>{ if(g.qty>1e-9) out.push({name:g.name, isin:g.isin, qty:+g.qty.toFixed(8), pru:g.cost/g.qty, price:g.last}) });
  }
  return {pos:out.map((p,i)=>({id:"p"+Date.now()+"_"+i, acc, name:p.name, isin:p.isin||undefined, cls, qty:p.qty, pru:+p.pru.toFixed(4), price:p.price, ccy:cls==="cry"?"Crypto":"EUR"})), skipped};
}
// Évite les comptes en double : même établissement et même type = même compte
function findOrCreateAccount(inst, env){
  const ex=state.accounts.find(a=>a.inst.trim().toLowerCase()===inst.trim().toLowerCase() && a.env===env);
  if(ex) return ex.id;
  const id="a"+Date.now(); state.accounts.push({id,inst:inst.trim(),name:env,env}); return id;
}
// ---------- Lecture des relevés PDF ----------
const PDFJS="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
function loadPdfLib(){
  if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((ok,ko)=>{ const sc=document.createElement("script"); sc.src=PDFJS+"pdf.min.js";
    sc.onload=()=>{ window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS+"pdf.worker.min.js"; ok(window.pdfjsLib) };
    sc.onerror=()=>ko(new Error("lib")); document.head.appendChild(sc) });
}
async function pdfLines(file){
  const lib=await loadPdfLib();
  const doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const lines=[];
  for(let n=1;n<=doc.numPages;n++){
    const tc=await (await doc.getPage(n)).getTextContent();
    const rows=[];
    tc.items.forEach(it=>{ if(!it.str.trim()) return; const y=it.transform[5], x=it.transform[4];
      let r=rows.find(r=>Math.abs(r.y-y)<3); if(!r){ r={y,items:[]}; rows.push(r) } r.items.push({x,s:it.str.trim()}) });
    rows.sort((a,b)=>b.y-a.y).forEach(r=>lines.push(r.items.sort((a,b)=>a.x-b.x).map(i=>i.s).join("  ")));
  }
  return lines;
}
const ISIN_RE=/\b([A-Z]{2}[A-Z0-9]{9}\d)\b/;
const NUM_RE=/[-−]?\d{1,3}(?:[ \u00a0\u202f.]\d{3})+(?:,\d+)?|[-−]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[-−]?\d+(?:[.,]\d+)?/g;
function lineNumbers(t){
  t=t.replace(ISIN_RE," ").replace(/\b\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}\b/g," ").replace(/\b\d{4}-\d{2}-\d{2}\b/g," ");
  return (t.match(NUM_RE)||[]).map(x=>x.replace("−","-"));
}
// Relevé de compte Revolut : on lit le dernier tableau « Résumé du solde » (solde de clôture de chaque produit)
function parseRevolutBalances(lines){
  const txt=lines.map(l=>l.replace(/[ \t\u00a0\u202f]+/g," ").trim()).join("\n");
  if(!/Revolut/i.test(txt) || !/Résumé du solde/i.test(txt)) return null;
  const start=txt.lastIndexOf("Résumé du solde");
  const end=txt.indexOf("Total",start);
  if(end<0) return null;
  let block=txt.slice(start,end).replace(/Résumé du solde|Produit|Solde d'ouverture|Argent sortant|Argent entrant|Solde de|clôture|Lieu d[’']émission de vos transactions/g," ").replace(/\s+/g," ");
  const AMT="(-?(?:\\d{1,3}(?: \\d{3})+|\\d+),\\d{2}) ?€";
  const re=new RegExp("([A-Za-zÀ-ÿ()'’ -]+?)\\s+"+AMT+"\\s+"+AMT+"\\s+"+AMT+"\\s+"+AMT,"g");
  const out=[]; let m;
  while((m=re.exec(block))) out.push({name:m[1].trim(), balance:parseNum(m[5])});
  const gen=(txt.match(/Généré le ([^\n]+)/)||[])[1]||"";
  return out.length?{products:out, date:gen.trim()}:null;
}
async function readPdfRows(file){
  const lines=await pdfLines(file), rows=[];
  const rv=parseRevolutBalances(lines);
  if(rv) return {revolut:rv, header:[], rows:[]};
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(ISIN_RE); if(!m) continue;
    // la ligne de l'ISIN, plus les lignes suivantes jusqu'au prochain ISIN (au plus 2), car certains relevés coupent une position sur plusieurs lignes
    let block=[lines[i]];
    for(let j=i+1;j<Math.min(lines.length,i+3);j++){ if(ISIN_RE.test(lines[j])) break; block.push(lines[j]) }
    let nums=lineNumbers(block.join("  "));
    let name=lines[i].replace(ISIN_RE,"").replace(NUM_RE,"").replace(/[|:;]+/g," ").replace(/\s+/g," ").trim();
    if(name.length<3 && i>0 && !ISIN_RE.test(lines[i-1])) name=lines[i-1].replace(NUM_RE,"").replace(/\s+/g," ").trim();
    rows.push([name||m[1], m[1], ...nums]);
  }
  const width=Math.max(2,...rows.map(r=>r.length));
  const header=["Nom","ISIN",...Array.from({length:width-2},(_,k)=>"Nombre "+(k+1))];
  return {header, rows:rows.map(r=>r.concat(Array(width-r.length).fill("")))};
}
function openImport(){
  let data=null, kind="transactions", map={}, cash=null;
  sheetRoot.innerHTML=`<div class="sheet-bg" id="sbg"><form class="sheet" id="iform" novalidate>
    <h3>Importer un fichier (CSV ou PDF)</h3>
    <p class="note" style="margin:0">Le fichier est lu dans ton navigateur. Il n'est envoyé nulle part.</p>
    <label class="f" for="iFile">Fichier CSV ou relevé PDF<input id="iFile" type="file" accept=".csv,.txt,text/csv,.pdf,application/pdf"></label>
    <label class="f" for="iKind">Contenu du fichier<select id="iKind">
      <option value="transactions">Historique d'achats et de ventes (ex. export Trade Republic)</option>
      <option value="positions">Liste de positions (une ligne par titre)</option></select></label>
    <div class="grid2">
      <label class="f" for="iAcc">Compte<select id="iAcc">${state.accounts.map(a=>`<option value="${a.id}">${esc(a.inst)} · ${esc(a.name)}</option>`).join("")}<option value="__new">Nouveau compte…</option></select></label>
      <label class="f" for="iCls">Classe d'actif<select id="iCls"><option value="etf">ETF</option><option value="act">Actions</option><option value="cry">Crypto</option></select></label>
    </div>
    <div class="grid2" id="iNew" hidden><label class="f" for="iInst">Établissement<input id="iInst" placeholder="Trade Republic"></label><label class="f" for="iEnv">Type<select id="iEnv"><option>CTO</option><option>PEA</option><option>Assurance vie</option><option>Crypto</option></select></label></div>
    <div id="iMap"></div>
    <div id="iPrev"></div>
    <label class="f" for="iMode">Lignes déjà présentes sur ce compte<select id="iMode"><option value="replace">Les remplacer par l'import</option><option value="add">Les garder et ajouter l'import</option></select></label>
    <p class="err" id="iErr" hidden></p>
    <div class="actions"><button class="btn" type="submit">Importer</button><button class="btn ghost" type="button" id="iCancel">Annuler</button></div>
  </form></div>`;
  const $=id=>document.getElementById(id);
  const err=m=>{ $("iErr").textContent=m; $("iErr").hidden=!m };
  const result=()=> data ? buildFromCSV(data, kind, map, $("iCls").value, $("iAcc").value) : null;
  const drawPreview=()=>{
    const r=result(); if(!r){ $("iPrev").innerHTML=""; return }
    $("iPrev").innerHTML=`<div class="panel" style="padding:12px"><h2>Aperçu : ${r.pos.length} position${r.pos.length>1?"s":""}</h2>
      <div class="list">${r.pos.slice(0,12).map(p=>`<div class="line"><span class="name">${esc(p.name)}</span><span class="val num">${nbF.format(p.qty)}</span><span class="sub num">PRU ${eur2.format(p.pru)} · cours ${eur2.format(p.price)}</span><span></span></div>`).join("")}</div>
      ${r.pos.length>12?`<p class="note">… et ${r.pos.length-12} autres.</p>`:""}
      ${r.skipped.length?`<p class="note">${r.skipped.length} ligne${r.skipped.length>1?"s":""} ignorée${r.skipped.length>1?"s":""} (dividendes, dépôts, ou valeurs manquantes).</p>`:""}
      ${kind==="transactions"?`<p class="note">Le cours affiché est le dernier prix trouvé dans le fichier. Tu pourras le corriger avec « Modifier ».</p>`:""}</div>`;
  };
  const drawMap=()=>{
    if(!data){ $("iMap").innerHTML=""; return }
    $("iMap").innerHTML=`<div class="panel" style="padding:12px;display:flex;flex-direction:column;gap:10px"><h2 style="margin:0">Colonnes du fichier</h2>
      <p class="note" style="margin:0">J'ai deviné les colonnes d'après leurs titres. Corrige si besoin.</p>
      ${IMPORT_FIELDS[kind].map(f=>`<label class="f" for="m_${f.k}">${f.label}<select id="m_${f.k}" data-map="${f.k}"><option value="-1">(aucune)</option>${data.header.map((h,i)=>`<option value="${i}" ${map[f.k]===i?"selected":""}>${esc(h||"Colonne "+(i+1))}${data.rows[0]&&data.rows[0][i]?` · ex. ${esc(String(data.rows[0][i]).slice(0,24))}`:""}</option>`).join("")}</select></label>`).join("")}</div>`;
  };
  const refresh=()=>{ drawMap(); drawPreview() };
  const drawCash=()=>{
    $("iPrev").innerHTML=`<div class="panel" style="padding:12px"><h2>Relevé Revolut : soldes de clôture</h2>
      <div class="list">${cash.products.map(p=>`<div class="line"><span class="name">${esc(p.name)}</span><span class="val num">${eur2.format(p.balance)}</span></div>`).join("")}</div>
      <p class="note">${cash.date?`Relevé généré le ${esc(cash.date)}. `:""}Ces soldes seront ajoutés comme liquidités. Ils ne tiennent pas compte des opérations en attente.</p></div>`;
    $("iKind").closest("label").hidden=true; $("iCls").closest("label").hidden=true;
  };
  $("iFile").addEventListener("change",e=>{
    const f=e.target.files[0]; if(!f) return; err("");
    if(/\.pdf$/i.test(f.name) || f.type==="application/pdf"){
      $("iPrev").innerHTML=`<p class="note">Lecture du PDF…</p>`;
      readPdfRows(f).then(d=>{
        if(d.revolut){ cash=d.revolut; data=null; $("iMap").innerHTML="";
          const ex=state.accounts.find(a=>/revolut/i.test(a.inst));
          if(ex){ $("iAcc").value=ex.id; $("iNew").hidden=true } else { $("iAcc").value="__new"; $("iNew").hidden=false; $("iInst").value="Revolut" }
          $("iMode").value="replace"; drawCash(); return }
        cash=null;
        if(!d.rows.length) throw new Error("vide");
        data=d; kind="positions"; $("iKind").value="positions";
        map={name:0, isin:1, qty:d.header.length>2?2:-1, pru:d.header.length>3?3:-1, price:d.header.length>4?4:-1};
        refresh();
        $("iMap").insertAdjacentHTML("afterbegin",`<p class="note" style="margin:0 0 8px">PDF lu : ${d.rows.length} ligne${d.rows.length>1?"s":""} avec un code ISIN. Les nombres sont numérotés dans leur ordre d'apparition sur la ligne. Choisis lequel est la quantité, le prix de revient et le cours, en t'aidant des exemples.</p>`);
      }).catch(x=>{ data=null; refresh(); err(x.message==="vide"
        ? "Je n'ai trouvé aucune ligne avec un code ISIN dans ce PDF. Si c'est un relevé scanné (une image), il ne contient pas de texte lisible."
        : x.message==="lib" ? "Impossible de charger le lecteur de PDF. Vérifie ta connexion et réessaie."
        : "Je n'arrive pas à lire ce PDF.") });
      return;
    }
    const rd=new FileReader();
    rd.onload=()=>{ let txt=rd.result;
      if(txt.includes(String.fromCharCode(0xFFFD))){ const r2=new FileReader(); r2.onload=()=>go(r2.result); r2.readAsText(f,"windows-1252") } else go(txt) };
    const go=txt=>{ try{ data=parseCSV(txt); if(!data.rows.length) throw 0; map=guessMap(data.header,kind); refresh() } catch(x){ data=null; refresh(); err("Je n'arrive pas à lire ce fichier. Vérifie que c'est bien un CSV.") } };
    rd.readAsText(f,"utf-8");
  });
  $("iKind").addEventListener("change",()=>{ kind=$("iKind").value; if(data) map=guessMap(data.header,kind); refresh() });
  $("iAcc").addEventListener("change",()=>{ $("iNew").hidden=$("iAcc").value!=="__new" });
  $("iCls").addEventListener("change",drawPreview);
  $("iMap").addEventListener("change",e=>{ const k=e.target.dataset.map; if(k){ map[k]=+e.target.value; drawPreview() } });
  $("iCancel").onclick=closeSheet; $("sbg").addEventListener("click",e=>{ if(e.target.id==="sbg") closeSheet() });
  $("iform").addEventListener("submit",e=>{
    e.preventDefault();
    if(cash){
      let acc=$("iAcc").value;
      if(acc==="__new"){ const inst=$("iInst").value.trim()||"Revolut"; acc=findOrCreateAccount(inst,"Compte") }
      if($("iMode").value==="replace") state.positions=state.positions.filter(p=>!(p.acc===acc && !isMarket(p)));
      cash.products.filter(p=>p.balance!==0).forEach((p,i)=>state.positions.push({id:"p"+Date.now()+"_"+i, acc, name:p.name, cls:"liq", qty:1, pru:p.balance, price:p.balance, ccy:"EUR", priceAt:Date.now(), src:"fichier"}));
      snapshot(); save(); closeSheet(); render(); toast("Soldes Revolut importés"); return;
    }
    if(!data) return err("Choisis d'abord un fichier.");
    const missing=IMPORT_FIELDS[kind].filter(f=>f.req && map[f.k]<0).map(f=>f.label);
    if(missing.length) return err("Indique la colonne pour : "+missing.join(", ")+".");
    let acc=$("iAcc").value;
    if(acc==="__new"){ const inst=$("iInst").value.trim(); if(!inst) return err("Indique l'établissement du nouveau compte."); acc=findOrCreateAccount(inst,$("iEnv").value) }
    const r=buildFromCSV(data, kind, map, $("iCls").value, acc);
    if(!r.pos.length) return err("Aucune position trouvée avec ces colonnes.");
    if($("iMode").value==="replace") state.positions=state.positions.filter(p=>!(p.acc===acc && isMarket(p)));
    r.pos.forEach(p=>{ p.priceAt=Date.now(); p.src="fichier"; if(p.cls==="cry") p.sym=guessCoin(p.name) });
    state.positions.push(...r.pos); snapshot(); save(); closeSheet(); render();
    toast(`${r.pos.length} position${r.pos.length>1?"s":""} importée${r.pos.length>1?"s":""}`);
  });
}

// Cours simulés : petite variation aléatoire toutes les 4 secondes.
// ---------- Sources de cours ----------
const PROVIDERS = {
  none:{label:"Aucune (cours saisis à la main)", limit:0},
  av:{label:"Alpha Vantage (clé gratuite, 25 requêtes par jour)", limit:25},
  eodhd:{label:"EODHD (clé gratuite, 20 requêtes par jour)", limit:20}
};
function symbolHelp(){
  const pv=state.settings.provider;
  if(pv==="av") return "Actions/ETF : symbole Alpha Vantage. Leur doc donne par exemple MBG.DEX (bourse allemande) ou TSCO.LON (Londres). Pour Paris, à tester.";
  if(pv==="eodhd") return "Actions/ETF : symbole EODHD, au format CODE.BOURSE (par exemple AAPL.US). Vérifie le code de la bourse sur leur site.";
  return "Actions/ETF : choisis d'abord une source de cours dans les réglages, sinon mets le cours à jour à la main.";
}
function callsLeft(){
  const today=new Date().toISOString().slice(0,10);
  if(state.calls.day!==today) state.calls={day:today,n:0};
  return PROVIDERS[state.settings.provider].limit - state.calls.n;
}
async function getJSON(url){
  let r;
  try{ r=await fetch(url,{cache:"no-store"}) }catch(e){ throw new Error("source injoignable (pas de connexion, ou accès refusé par la source)") }
  if(!r.ok) throw new Error(r.status===429?"trop de requêtes, réessaie dans quelques minutes":"erreur "+r.status+" de la source");
  return r.json();
}
async function fetchQuote(sym){
  const {provider, key}=state.settings;
  if(callsLeft()<=0) throw new Error("quota du jour atteint");
  state.calls.n++;
  if(provider==="av"){
    const j=await getJSON(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(key)}`);
    const q=j["Global Quote"];
    if(!q || !q["05. price"]) throw new Error(j.Note||j.Information||j["Error Message"]||"symbole inconnu");
    return {price:parseFloat(q["05. price"]), prev:parseFloat(q["08. previous close"])||null};
  }
  if(provider==="eodhd"){
    const j=await getJSON(`https://eodhd.com/api/real-time/${encodeURIComponent(sym)}?api_token=${encodeURIComponent(key)}&fmt=json`);
    const price=parseFloat(j.close);
    if(!(price>0)) throw new Error("symbole inconnu ou cours indisponible");
    return {price, prev:parseFloat(j.previousClose)||null};
  }
  throw new Error("aucune source choisie");
}
async function fetchHistory(p){
  if(p.cls==="cry"){
    const j=await getJSON(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(p.sym)}/market_chart?vs_currency=eur&days=365&interval=daily`);
    if(!j.prices) throw new Error("historique indisponible");
    return j.prices.map(x=>x[1]);
  }
  const {provider, key}=state.settings;
  if(callsLeft()<=0) throw new Error("quota du jour atteint");
  state.calls.n++;
  let c;
  if(provider==="av"){
    const j=await getJSON(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(p.sym)}&apikey=${encodeURIComponent(key)}`);
    const ts=j["Time Series (Daily)"]; if(!ts) throw new Error(j.Note||j.Information||j["Error Message"]||"historique indisponible");
    c=Object.keys(ts).sort().map(d=>parseFloat(ts[d]["4. close"]));
  } else if(provider==="eodhd"){
    const from=new Date(Date.now()-370*86400000).toISOString().slice(0,10);
    const j=await getJSON(`https://eodhd.com/api/eod/${encodeURIComponent(p.sym)}?api_token=${encodeURIComponent(key)}&fmt=json&from=${from}`);
    if(!Array.isArray(j)) throw new Error("historique indisponible");
    c=j.map(x=>parseFloat(x.adjusted_close??x.close));
  } else throw new Error("aucune source choisie");
  const fx=p.qccy==="USD"?state.settings.fx:1;
  if(!fx) throw new Error("taux dollar/euro inconnu");
  return c.filter(v=>v>0).map(v=>v*fx);
}
async function refreshFx(force){
  const s=state.settings;
  if(s.fxManual || !state.positions.some(p=>p.qccy==="USD")) return;
  if(!force && s.fx && Date.now()-s.fxAt<12*3600000) return;
  const j=await getJSON("https://api.frankfurter.app/latest?from=USD&to=EUR");
  if(j.rates && j.rates.EUR){ s.fx=j.rates.EUR; s.fxAt=Date.now() }
}
let refreshing=false, lastErrors=[];
async function refreshPrices(force){
  if(refreshing || !navigator.onLine) return;
  refreshing=true; lastErrors=[]; setPill();
  try{ await refreshFx(force) }catch(e){ lastErrors.push("Taux dollar/euro : "+e.message) }
  applyFx();
  // Cryptos : CoinGecko sans clé, en une seule requête
  const cry=state.positions.filter(p=>p.cls==="cry"&&p.sym);
  if(cry.length && (force || Date.now()-state.lastCrypto>2*60000)){
    try{
      const ids=[...new Set(cry.map(p=>p.sym))].join(",");
      const j=await getJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=eur&include_24hr_change=true`);
      cry.forEach(p=>{ const q=j[p.sym]; if(q&&q.eur){ p.price=q.eur; p.prev=q.eur_24h_change!=null?q.eur/(1+q.eur_24h_change/100):null; p.priceAt=Date.now(); p.src="auto" } else lastErrors.push(`${p.name} : identifiant CoinGecko « ${p.sym} » inconnu`) });
      state.lastCrypto=Date.now();
    }catch(e){ lastErrors.push("Cryptos : "+e.message) }
  }
  // Actions et ETF : clé gratuite, quota limité, donc au plus une fois toutes les 3 heures par ligne
  const {provider,key}=state.settings;
  if(provider!=="none" && key){
    const due=state.positions.filter(p=>isMarket(p)&&p.cls!=="cry"&&p.sym&&(force||p.src!=="auto"||Date.now()-(p.priceAt||0)>3*3600000));
    for(const p of due){
      if(callsLeft()<=0){ lastErrors.push(`Quota du jour atteint (${PROVIDERS[provider].limit} requêtes). Les autres lignes seront mises à jour demain.`); break }
      try{
        const q=await fetchQuote(p.sym);
        const fx=p.qccy==="USD"?state.settings.fx:1;
        if(!fx) throw new Error("taux dollar/euro inconnu, renseigne-le dans les réglages");
        p.price=q.price*fx; p.prev=q.prev?q.prev*fx:null; p.priceAt=Date.now(); p.src="auto";
      }catch(e){ lastErrors.push(`${p.name} (${p.sym}) : ${e.message}`) }
    }
  }
  state.isExample=state.isExample&&true;
  snapshot(); save(); refreshing=false; setPill();
  if(!sheetRoot.innerHTML && tab!=="risque") render();
  if(lastErrors.length && force) toast(lastErrors.length===1?lastErrors[0]:`${lastErrors.length} cours non mis à jour (détails dans les réglages)`);
}
function setPill(){
  const el=document.getElementById("pricePill");
  const autos=state.positions.filter(p=>p.src==="auto");
  if(refreshing){ el.textContent="Mise à jour…"; el.className="pill live"; return }
  if(!navigator.onLine){ el.textContent="Hors ligne"; el.className="pill"; return }
  if(!autos.length){ el.textContent="Cours manuels"; el.className="pill"; return }
  const t=Math.max(...autos.map(p=>p.priceAt||0));
  el.textContent="Cours "+(sameDay(t,Date.now())?"à "+fmtTime(t):"du "+fmtDate(t)); el.className="pill live";
}

// ---------- Conseils du trader ----------
function signals(p, total){
  const c=(state.series[p.id]&&state.series[p.id].c||[]).slice();
  const w=val(p)/total, gain=(p.price-p.pru)/p.pru;
  const out={w,gain,n:c.length,m50:null,m200:null,rsi:null,dd:null,perf1m:null,perf1a:null,trend:{t:"Historique à charger",c:"warn"},notes:[]};
  if(c.length) c[c.length-1]=p.price;
  const sma=n=>c.length>=n?c.slice(-n).reduce((s,v)=>s+v,0)/n:null;
  if(c.length>=20){
    out.m50=sma(50); out.m200=sma(200);
    let g=0,l=0; for(let i=c.length-14;i<c.length;i++){ const d=c[i]-c[i-1]; if(d>0) g+=d; else l-=d }
    out.rsi=l===0?100:100-100/(1+g/l);
    const hi=Math.max(...c); out.dd=p.price/hi-1;
    out.perf1m=c.length>21?p.price/c[c.length-22]-1:null;
    out.perf1a=c.length>=250?p.price/c[0]-1:null;
    if(out.m50&&out.m200) out.trend = p.price>out.m50&&out.m50>out.m200 ? {t:"Tendance haussière",c:""} : p.price<out.m50&&out.m50<out.m200 ? {t:"Tendance baissière",c:"down"} : {t:"Sans tendance nette",c:"warn"};
    else if(out.m50) out.trend = p.price>out.m50 ? {t:"Au-dessus de sa moyenne 50 j",c:""} : {t:"Sous sa moyenne 50 j",c:"down"};
    else out.trend={t:"Historique court",c:"warn"};
    if(out.trend.c===""&&out.m200) out.notes.push("Le cours est au-dessus de ses moyennes à 50 et 200 jours : les traders qui suivent la tendance resteraient investis tant que ce schéma tient.");
    if(out.trend.c==="down"&&out.m200) out.notes.push("Le cours est sous ses moyennes à 50 et 200 jours : un trader attendrait en général un retour au-dessus de la moyenne à 50 jours avant de renforcer.");
    if(out.rsi>70) out.notes.push(`RSI à ${Math.round(out.rsi)} : zone de « surachat ». Renforcer après une forte hausse expose à un repli à court terme.`);
    if(out.rsi<30) out.notes.push(`RSI à ${Math.round(out.rsi)} : zone de « survente ». Un rebond est possible, mais ce signal seul ne suffit pas.`);
    if(out.dd<-.2) out.notes.push(`À ${pctF.format(-out.dd)} sous son plus haut de la période : fixe-toi un niveau de sortie (stop) si tu ne l'as pas déjà fait.`);
    if(!out.m200) out.notes.push(`Seulement ${c.length} jours d'historique : la moyenne à 200 jours n'est pas calculable.`);
  }
  if(gain>.4 && w>.1) out.notes.push(`Plus-value de ${pctF.format(gain)} sur une ligne qui pèse ${pctF.format(w)} : certains traders prennent une partie des gains pour sécuriser le reste.`);
  if(gain<-.15) out.notes.push(`Moins-value de ${pctF.format(-gain)} : demande-toi si tu achèterais ce titre aujourd'hui. Si la réponse est non, garder la ligne revient à parier sur un retour au prix d'achat.`);
  if(c.length>=20 && !out.notes.length) out.notes.push("Aucun signal particulier : rien ne pousse à agir sur cette ligne pour l'instant.");
  return out;
}
const fp = v => v==null ? "–" : pct(v);
function renderConseils(){
  const t=totals();
  const ps=state.positions.filter(isMarket).sort((a,b)=>val(b)-val(a));
  if(!ps.length) return emptyState();
  const canLoad=ps.some(p=>p.sym && (p.cls==="cry" || (state.settings.provider!=="none"&&state.settings.key)));
  return `
  <section class="panel">
    <h2>Historique des cours</h2>
    <p class="note" style="margin:0 0 10px">Les signaux ont besoin de l'historique de chaque ligne. Le charger coûte une requête par action ou ETF (il t'en reste ${Math.max(0,callsLeft())} aujourd'hui).</p>
    ${canLoad?`<button class="btn" data-act="load-hist">Charger l'historique</button>`:`<p class="note" style="margin:0">Ajoute un symbole à tes lignes et choisis une source de cours dans les réglages pour activer les signaux.</p>`}
  </section>
  <h2 style="margin:4px 0 -6px">Signaux par ligne</h2>
  ${ps.map(p=>{ const s=signals(p,t.total); return `<section class="panel">
    <div class="row-head" style="margin-bottom:2px"><strong>${esc(p.name)}</strong><span class="tag ${s.trend.c}">${s.trend.t}</span></div>
    <span class="note">${esc(accById(p.acc).inst)} · ${esc(accById(p.acc).env)} · ${pctF.format(s.w)} du patrimoine${state.series[p.id]?` · historique du ${fmtDate(state.series[p.id].at)}`:""}</span>
    ${s.n>=20?`<div class="sig">
      <div>1 mois<b class="${cl(s.perf1m)}">${fp(s.perf1m)}</b></div>
      <div>1 an<b class="${cl(s.perf1a)}">${fp(s.perf1a)}</b></div>
      <div>RSI 14 j<b>${Math.round(s.rsi)}</b></div>
      <div>Moy. 50 j<b>${s.m50?eur2.format(s.m50):"–"}</b></div>
      <div>Moy. 200 j<b>${s.m200?eur2.format(s.m200):"–"}</b></div>
      <div>Vs plus haut<b class="${cl(s.dd)}">${fp(s.dd)}</b></div>
    </div>`:""}
    ${s.notes.length?`<ul class="ideas">${s.notes.map(n=>`<li>${n}</li>`).join("")}</ul>`:""}
  </section>`}).join("")}
  <p class="disclaimer">Les indicateurs techniques (moyennes mobiles, RSI) décrivent le passé et ne prédisent pas l'avenir. Ces orientations ne constituent pas un conseil en investissement.</p>`;
}
async function loadHistories(){
  const ps=state.positions.filter(p=>isMarket(p)&&p.sym&&(p.cls==="cry"||(state.settings.provider!=="none"&&state.settings.key)));
  let ok=0; const errs=[];
  toast("Chargement de l'historique…");
  for(const p of ps){
    if(state.series[p.id] && Date.now()-state.series[p.id].at<20*3600000){ ok++; continue }
    try{ const c=await fetchHistory(p); state.series[p.id]={c:c.slice(-260),at:Date.now()}; ok++ }
    catch(e){ errs.push(`${p.name} : ${e.message}`) }
  }
  save(); if(tab==="conseils") render();
  toast(errs.length?`${ok} historique(s) chargé(s), ${errs.length} en échec : ${errs[0]}`:`${ok} historique(s) chargé(s)`);
}

// ---------- Réglages ----------
function openSettings(){
  const s=state.settings;
  sheetRoot.innerHTML=`<div class="sheet-bg" id="sbg"><form class="sheet" id="sform" novalidate>
    <h3>Réglages</h3>
    <h2 style="margin:4px 0 0">Cours des actions et ETF</h2>
    <label class="f" for="sProv">Source<select id="sProv">${Object.entries(PROVIDERS).map(([k,v])=>`<option value="${k}" ${s.provider===k?"selected":""}>${v.label}</option>`).join("")}</select></label>
    <label class="f" for="sKey">Clé d'API (gratuite, à créer sur le site du fournisseur)<input id="sKey" autocomplete="off" autocapitalize="off" value="${esc(s.key)}"></label>
    <p class="note" style="margin:0">La clé reste sur ce téléphone. Les cryptos passent par CoinGecko, sans clé.</p>
    <h2 style="margin:8px 0 0">Dollar</h2>
    <label class="f" for="sFx">Valeur de 1 $ en euros ${s.fx?`(${s.fxManual?"saisie à la main":"mise à jour "+ago(s.fxAt)})`:""}<input id="sFx" type="number" inputmode="decimal" step="any" min="0" value="${s.fx||""}" placeholder="récupérée automatiquement"></label>
    <h2 style="margin:8px 0 0">Mes données</h2>
    <div class="actions"><button class="btn ghost" type="button" id="sExport">Sauvegarder (fichier)</button><label class="btn ghost" for="sImport" style="display:inline-flex">Restaurer<input id="sImport" type="file" accept=".json,application/json" hidden></label></div>
    <p class="note" style="margin:0">Tes données ne sont que sur ce téléphone. Une sauvegarde te permet de les retrouver si tu changes d'appareil ou si le navigateur efface ses données.</p>
    ${lastErrors.length?`<h2 style="margin:8px 0 0">Dernière actualisation</h2><ul class="ideas note">${lastErrors.map(e=>`<li>${esc(e)}</li>`).join("")}</ul>`:""}
    <div id="dangerZone"><button class="btn small ghost" type="button" id="sWipe">Tout effacer</button></div>
    <p class="err" id="sErr" hidden></p>
    <div class="actions"><button class="btn" type="submit">Enregistrer</button><button class="btn ghost" type="button" id="sCancel">Fermer</button></div>
  </form></div>`;
  const $=id=>document.getElementById(id);
  $("sCancel").onclick=closeSheet; $("sbg").addEventListener("click",e=>{ if(e.target.id==="sbg") closeSheet() });
  $("sExport").onclick=()=>{
    const blob=new Blob([JSON.stringify(state,null,1)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`patrimoine-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove() },1000);
  };
  $("sImport").onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const d=JSON.parse(r.result); if(!Array.isArray(d.positions)) throw 0; localStorage.setItem(KEY,JSON.stringify(d)); state=load(); applyFx(); expenses=state.settings.expenses||2000; closeSheet(); render(); toast("Données restaurées"); refreshPrices(true) }catch(x){ $("sErr").textContent="Ce fichier n'est pas une sauvegarde de l'appli."; $("sErr").hidden=false } }; r.readAsText(f) };
  $("sWipe").onclick=()=>{ $("dangerZone").innerHTML=`<span class="actions"><span class="note">Effacer toutes tes données de ce téléphone ?</span><button class="btn small danger" type="button" id="sWipeOk">Tout effacer</button></span>`;
    $("sWipeOk").onclick=()=>{ state=DEFAULT(); save(); closeSheet(); render(); toast("Données effacées") } };
  $("sform").addEventListener("submit",e=>{
    e.preventDefault();
    s.provider=$("sProv").value; s.key=$("sKey").value.trim();
    const fx=parseFloat($("sFx").value);
    if(fx>0 && fx!==s.fx){ s.fx=fx; s.fxManual=true; s.fxAt=Date.now() } else if(!$("sFx").value){ s.fxManual=false }
    if(s.provider!=="none" && !s.key){ $("sErr").textContent="Colle ta clé d'API, ou choisis « Aucune »."; $("sErr").hidden=false; return }
    applyFx(); save(); closeSheet(); render(); toast("Réglages enregistrés"); refreshPrices(true);
  });
}

// ---------- Rendu et interactions ----------
function render(){
  view.innerHTML = tab==="global"?renderGlobal():tab==="comptes"?(state.positions.length?renderComptes():emptyState()):tab==="positions"?renderPositions():tab==="conseils"?renderConseils():(state.positions.length?renderRisque():emptyState());
  setPill();
}
document.querySelector(".tabs").addEventListener("click",e=>{
  const b=e.target.closest("button[data-tab]"); if(!b) return;
  tab=b.dataset.tab; confirmDel=null;
  document.querySelectorAll(".tabs button").forEach(x=>x.removeAttribute("aria-current")); b.setAttribute("aria-current","page");
  render(); window.scrollTo(0,0);
});
document.getElementById("settingsBtn").onclick=openSettings;
document.getElementById("refreshBtn").onclick=()=>refreshPrices(true);
view.addEventListener("click",e=>{
  const t=e.target.closest("button"); if(!t) return;
  const a=t.dataset.act;
  if(t.dataset.range){ range=t.dataset.range; render() }
  else if(a==="add") openSheet();
  else if(a==="import") openImport();
  else if(a==="example"){ loadExample(); render(); refreshPrices(true) }
  else if(a==="clear-example"){ state=Object.assign(DEFAULT(),{settings:state.settings}); save(); render() }
  else if(a==="load-hist") loadHistories();
  else if(t.dataset.edit) openSheet(t.dataset.edit);
  else if(t.dataset.ask){ confirmDel=t.dataset.ask; render() }
  else if(t.dataset.cancel){ confirmDel=null; render() }
  else if(t.dataset.del){ state.positions=state.positions.filter(p=>p.id!==t.dataset.del); delete state.series[t.dataset.del]; confirmDel=null; snapshot(); save(); render(); toast("Ligne retirée") }
});
view.addEventListener("input",e=>{
  const id=e.target.id;
  if(id==="sEq"){ dropEq=+e.target.value; document.getElementById("vEq").textContent=`−${dropEq} %` }
  else if(id==="sCry"){ dropCry=+e.target.value; document.getElementById("vCry").textContent=`−${dropCry} %` }
  else if(id==="exp"){ const v=+e.target.value; if(v>0){ expenses=v; state.settings.expenses=v; save(); const r=risk(); document.getElementById("months").textContent=nbF.format(Math.round(r.safe/expenses*10)/10)+" mois" } return }
  else return;
  document.getElementById("stress").innerHTML=stressHTML(risk());
});
view.addEventListener("change",e=>{ if(e.target.id==="exp") render() });
window.addEventListener("online",()=>refreshPrices(false));
window.addEventListener("offline",setPill);
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") refreshPrices(false) });
setInterval(()=>{ if(document.visibilityState==="visible") refreshPrices(false) }, 5*60000);

snapshot(); save(); render(); refreshPrices(false);
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});

})();
