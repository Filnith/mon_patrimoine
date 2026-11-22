/* Séquence d'ouverture : nom de l'appli, verrou (Face ID / code), puis animation d'entrée.
   Le verrou est local : il cache l'appli, il ne chiffre pas les données. */
(function(){
"use strict";
const LKEY="mon-patrimoine-lock-v1";
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const readLock=()=>{ try{ return JSON.parse(localStorage.getItem(LKEY))||{} }catch(e){ return {} } };
const writeLock=v=>{ try{ localStorage.setItem(LKEY,JSON.stringify(v)) }catch(e){} };
const b64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
async function hash(pin,salt){ const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(salt+":"+pin)); return b64(d) }

const css=`
#intro{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;
  background:#1D5C50;color:#fff;font-family:"IBM Plex Sans",system-ui,-apple-system,sans-serif;
  padding:env(safe-area-inset-top,0) 16px env(safe-area-inset-bottom,0);transition:opacity .5s ease, transform .6s cubic-bezier(.2,.7,.2,1)}
#intro.out{opacity:0;transform:scale(1.06);pointer-events:none}
#intro .mark{width:84px;height:84px}
#intro .mark rect{transform-box:fill-box;transform-origin:bottom;transform:scaleY(0);animation:barUp .55s cubic-bezier(.2,.8,.2,1) forwards}
#intro .mark rect:nth-child(2){animation-delay:.12s} #intro .mark rect:nth-child(3){animation-delay:.24s}
#intro .mark path{stroke-dasharray:120;stroke-dashoffset:120;animation:draw .6s .45s ease-out forwards}
#intro .name{font-size:26px;font-weight:700;letter-spacing:-.01em;display:flex;overflow:hidden}
#intro .name span{display:inline-block;transform:translateY(110%);animation:rise .5s cubic-bezier(.2,.8,.2,1) forwards;white-space:pre}
#intro .sub{font-size:14px;opacity:.75;min-height:20px;text-align:center}
#intro .lock{display:flex;flex-direction:column;align-items:center;gap:14px;opacity:0;transform:translateY(12px);transition:opacity .35s, transform .35s}
#intro .lock.show{opacity:1;transform:none}
#intro button{font:inherit;color:inherit;cursor:pointer}
#intro .fid{display:flex;align-items:center;gap:10px;background:#fff;color:#1D5C50;border:0;border-radius:999px;padding:12px 22px;font-weight:600;font-size:16px}
#intro .link{background:none;border:0;text-decoration:underline;opacity:.85;font-size:14px;padding:6px}
#intro .dots{display:flex;gap:14px;height:16px}
#intro .dots i{width:14px;height:14px;border-radius:50%;border:2px solid #fff;transition:background .15s}
#intro .dots i.on{background:#fff}
#intro .dots.shake{animation:shake .4s}
#intro .pad{display:grid;grid-template-columns:repeat(3,72px);gap:12px}
#intro .pad button{height:72px;border-radius:50%;border:0;background:rgba(255,255,255,.14);font-size:26px;font-family:"IBM Plex Mono",ui-monospace,monospace}
#intro .pad button:active{background:rgba(255,255,255,.3)}
#intro .pad .ghost{background:none;font-size:15px;font-family:inherit}
@keyframes barUp{to{transform:scaleY(1)}}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes rise{to{transform:none}}
@keyframes shake{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
body.intro-wait main > *{opacity:0}
body.intro-in main > *{animation:cardIn .5s cubic-bezier(.2,.8,.2,1) both}
body.intro-in main > *:nth-child(2){animation-delay:.07s} body.intro-in main > *:nth-child(3){animation-delay:.14s}
body.intro-in main > *:nth-child(4){animation-delay:.21s} body.intro-in main > *:nth-child(n+5){animation-delay:.28s}
@keyframes cardIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#intro *,body.intro-in main > *{animation-duration:.01s!important;animation-delay:0s!important}}
`;
const st=document.createElement("style"); st.textContent=css; document.head.appendChild(st);

const word="Mon Patrimoine";
const el=document.createElement("div"); el.id="intro"; el.setAttribute("role","dialog"); el.setAttribute("aria-label","Ouverture de Mon Patrimoine");
el.innerHTML=`<svg class="mark" viewBox="0 0 84 84" aria-hidden="true">
    <rect x="14" y="44" width="14" height="26" rx="3" fill="#fff" opacity=".55"/>
    <rect x="35" y="32" width="14" height="38" rx="3" fill="#fff" opacity=".8"/>
    <rect x="56" y="18" width="14" height="52" rx="3" fill="#fff"/>
    <path d="M10 40 L30 28 L44 34 L74 10" fill="none" stroke="#E0BA4C" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <div class="name" aria-label="${word}">${[...word].map((c,i)=>`<span style="animation-delay:${.15+i*.035}s">${c}</span>`).join("")}</div>
  <div class="sub" id="introSub"></div>
  <div class="lock" id="introLock"></div>`;
document.body.classList.add("intro-wait");
document.body.prepend(el);

let unlocked=false;
function reveal(){
  if(unlocked) return; unlocked=true;
  el.classList.add("out");
  document.body.classList.remove("intro-wait"); document.body.classList.add("intro-in");
  setTimeout(()=>{ el.hidden=true; document.body.classList.remove("intro-in") }, reduce?50:900);
}

let pending=null, lastErr="";
const errText=e=>{
  const n=e&&e.name||"", m=e&&e.message||String(e);
  if(n==="NotAllowedError") return "Face ID annulé ou refusé ("+m+")";
  if(n==="SecurityError") return "Le site n'est pas accepté pour Face ID ("+m+")";
  if(n==="InvalidStateError") return "Une clé existe déjà pour ce site ("+m+")";
  if(n==="NotSupportedError") return "Face ID n'est pas pris en charge ici ("+m+")";
  return (n?n+" : ":"")+m;
};
async function tryFaceId(){
  const L=readLock(); if(!L.cred) return false;
  if(pending) pending.abort(); // une seule demande à la fois, sinon iPhone refuse la suivante
  const ac=new AbortController(); pending=ac;
  try{
    await navigator.credentials.get({signal:ac.signal, publicKey:{challenge:rnd(32), rpId:location.hostname, timeout:60000, userVerification:"required",
      allowCredentials:[{type:"public-key", id:unb64(L.cred), transports:["internal"]}]}});
    return true;
  }catch(e){ if(e&&e.name!=="AbortError") lastErr=errText(e); return false }
  finally{ if(pending===ac) pending=null }
}

function showLock(){
  const L=readLock(), box=document.getElementById("introLock"), sub=document.getElementById("introSub");
  let pin="";
  const pinView=()=>{
    sub.textContent="Entre ton code";
    box.innerHTML=`<div class="dots" id="pDots">${"<i></i>".repeat(4)}</div>
      <div class="pad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-k="${n}">${n}</button>`).join("")}
      ${L.cred?`<button class="ghost" data-k="fid">Face ID</button>`:"<span></span>"}<button data-k="0">0</button><button class="ghost" data-k="del" aria-label="Effacer">⌫</button></div>`;
    box.onclick=async e=>{
      const k=e.target.closest("button")&&e.target.closest("button").dataset.k; if(!k) return;
      if(k==="fid"){ if(await tryFaceId()) return reveal(); return }
      if(k==="del"){ pin=pin.slice(0,-1) } else if(pin.length<4){ pin+=k }
      [...document.querySelectorAll("#pDots i")].forEach((d,i)=>d.classList.toggle("on",i<pin.length));
      if(pin.length===4){
        if(await hash(pin,L.salt)===L.pin){ reveal() }
        else { const d=document.getElementById("pDots"); d.classList.add("shake"); sub.textContent="Code incorrect"; setTimeout(()=>{ d.classList.remove("shake"); pin=""; [...d.children].forEach(x=>x.classList.remove("on")) },400) }
      }
    };
  };
  const faceView=()=>{
    sub.textContent="Déverrouille pour voir ton patrimoine";
    box.innerHTML=`<button class="fid" id="fidBtn"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1M15 9v1M12 9v4h-1M9 16c1.5 1 4.5 1 6 0"/></svg>Face ID</button>
      <button class="link" id="pinBtn">Utiliser mon code</button>`;
    sub.textContent="Touche l'écran pour Face ID";
    const go=async()=>{ if(await tryFaceId()) reveal(); else sub.textContent="Face ID n'a pas abouti"+(lastErr?" : "+lastErr:"")+". Touche l'écran pour réessayer, ou utilise ton code." };
    document.getElementById("pinBtn").onclick=e=>{ e.stopPropagation(); el.onclick=null; pinView() };
    el.onclick=e=>{ if(!unlocked && !e.target.closest("#pinBtn")) go() }; // un seul appui n'importe où sur l'écran
  };
  L.cred ? faceView() : pinView();
  requestAnimationFrame(()=>box.classList.add("show"));
}

function start(){
  const L=readLock();
  if(L.pin) setTimeout(showLock, reduce?0:1100);
  else { setTimeout(reveal, reduce?0:1400); el.addEventListener("click",reveal) }
}
start();

// Reverrouille si l'appli est restée en arrière-plan plus d'une minute
let hiddenAt=0;
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="hidden"){ hiddenAt=Date.now(); return }
  const L=readLock();
  if(L.pin && unlocked && L.delay!==-1 && Date.now()-hiddenAt>(L.delay||60000)){
    unlocked=false; el.hidden=false; el.classList.remove("out"); document.body.classList.add("intro-wait");
    document.getElementById("introLock").classList.remove("show"); showLock();
  }
});

// API utilisée par les réglages
window.PatriLock={
  status(){ const L=readLock(); return {on:!!L.pin, faceId:!!L.cred, delay:L.delay||60000} },
  setDelay(ms){ const L=readLock(); L.delay=ms; writeLock(L) },
  async faceIdPossible(){ try{ return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) }catch(e){ return false } },
  // À appeler directement depuis un appui sur un bouton (iPhone l'exige pour Face ID)
  async enable(pin, withFaceId){
    let cred=null, error="";
    if(withFaceId){
      if(pending) pending.abort();
      try{
        const c=await navigator.credentials.create({publicKey:{challenge:rnd(32), rp:{name:"Mon Patrimoine", id:location.hostname},
          user:{id:rnd(16), name:"Mon Patrimoine", displayName:"Mon Patrimoine"},
          pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],
          authenticatorSelection:{authenticatorAttachment:"platform", userVerification:"required", residentKey:"discouraged"}, timeout:60000}});
        cred=b64(c.rawId);
      }catch(e){ cred=null; error=errText(e) }
    }
    const salt=b64(rnd(16));
    writeLock({pin:await hash(pin,salt), salt, cred});
    return {faceId:!!cred, error};
  },
  // Essai de Face ID depuis les réglages, pour vérifier que ça marche
  async test(){ const ok=await tryFaceId(); return {ok, error:ok?"":lastErr} },
  disable(){ try{ localStorage.removeItem(LKEY) }catch(e){} }
};
})();
