/* Persistent identity surface shared by desktop sidebar and mobile navigation drawer. */
(function initAuthProfile(){
  let authPromise=null;
  let renderPromise=null;

  function ensureAuth(){
    if(window.amoAuth)return Promise.resolve(window.amoAuth);
    if(authPromise)return authPromise;
    authPromise=new Promise(resolve=>{
      let s=document.querySelector('script[data-amo-auth]');
      if(s){s.addEventListener('load',()=>resolve(window.amoAuth||null),{once:true});s.addEventListener('error',()=>resolve(null),{once:true});return}
      s=document.createElement('script');s.src=typeof amoAsset==='function'?amoAsset('app-auth.js'):'app-auth.js';s.dataset.amoAuth='true';s.async=false;s.onload=()=>resolve(window.amoAuth||null);s.onerror=()=>resolve(null);document.head.appendChild(s)
    });
    return authPromise
  }

  const esc=value=>typeof escHtml==='function'?escHtml(value):String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function ensureHost(){
    const sidebar=document.querySelector('.sidebar');if(!sidebar)return null;
    let host=document.getElementById('amoSidebarIdentity');
    if(!host){
      host=document.createElement('div');host.id='amoSidebarIdentity';host.className='amo-sidebar-identity';
      const brandSub=sidebar.querySelector('.brand-sub');
      if(brandSub)brandSub.after(host);else sidebar.prepend(host)
    }
    return host
  }

  async function renderIdentity(){
    if(renderPromise)return renderPromise;
    renderPromise=(async()=>{
      const host=ensureHost(),auth=await ensureAuth();if(!host||!auth)return;
      const identity=auth.currentIdentity?.();host.replaceChildren();
      if(identity){
        const initial=(identity.name||identity.email||'?').trim().charAt(0).toUpperCase();
        host.innerHTML=`<div class="amo-sidebar-profile"><div class="amo-auth-avatar" aria-hidden="true">${esc(initial)}</div><div class="amo-auth-copy"><strong>${esc(identity.name||'Google user')}</strong><span>${esc(identity.email||'Signed in with Google')}</span></div><button type="button" class="amo-sidebar-signout" aria-label="Sign out" title="Sign out">↪</button></div>`;
        host.querySelector('.amo-sidebar-signout')?.addEventListener('click',async()=>{try{await auth.signOut()}catch(e){alert(`Could not sign out: ${e.message}`)}})
      }else{
        host.innerHTML='<div class="amo-sidebar-signin"><span class="amo-sidebar-account-label">Account</span><div class="amo-google-signin"></div></div>';
        const target=host.querySelector('.amo-google-signin');
        try{await auth.renderSignInButton?.(target,{width:180})}catch(err){target.innerHTML=`<div class="amo-sidebar-auth-error">${esc(err.message||'Google sign-in unavailable')}</div>`}
      }
    })();
    try{return await renderPromise}finally{renderPromise=null}
  }

  ensureAuth().then(auth=>auth?.onChange?.(()=>renderIdentity()));
  window.addEventListener('amo-auth-changed',()=>renderIdentity());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>renderIdentity(),{once:true});else renderIdentity();
  [100,500].forEach(delay=>setTimeout(renderIdentity,delay));

  const style=document.createElement('style');style.id='amo-sidebar-identity-styles';style.textContent=`
    .amo-sidebar-identity{margin:12px 0 14px;padding:10px;border-top:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12)}
    .amo-sidebar-profile{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px}.amo-auth-avatar{display:grid;place-items:center;width:30px;height:30px;min-width:30px;border-radius:50%;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);color:#fff;font-size:.78rem;font-weight:900}.amo-auth-copy{display:flex;flex-direction:column;min-width:0;line-height:1.2}.amo-auth-copy strong{color:#fff;font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.amo-auth-copy span{margin-top:2px;color:#b7c4ef;font-size:.64rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.amo-sidebar-signout{display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:#b7c4ef;font-size:.95rem;cursor:pointer}.amo-sidebar-signout:hover{background:rgba(255,255,255,.08);color:#fff}
    .amo-sidebar-signin{display:flex;flex-direction:column;align-items:flex-start;gap:7px}.amo-sidebar-account-label{color:#aebde9;font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em}.amo-google-signin{min-height:32px;max-width:190px;overflow:hidden;border-radius:5px}.amo-sidebar-auth-error{color:#b7c4ef;font-size:.68rem;line-height:1.3}
    @media(max-width:760px){.amo-sidebar-identity{margin-top:10px;margin-bottom:10px;padding:10px 6px}.amo-google-signin{max-width:190px}}
  `;document.head.appendChild(style)
})();
