/* Signed-in identity surface for the compact command menu. */
(function initAuthProfile(){
  let authPromise=null;
  let profilePromise=null;
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
  const closeMenu=()=>{const shell=document.getElementById('commandMenuShell');shell?.classList.remove('open');shell?.querySelector('#commandMenuToggle')?.setAttribute('aria-expanded','false')};

  async function ensureProfile(){
    const menu=document.getElementById('commandMenu');if(!menu||menu.querySelector('[data-amo-auth-profile]'))return;
    if(profilePromise)return profilePromise;
    profilePromise=(async()=>{
      const auth=await ensureAuth();if(!auth)return;
      const currentMenu=document.getElementById('commandMenu');if(!currentMenu||currentMenu.querySelector('[data-amo-auth-profile]'))return;
      const identity=auth.currentIdentity?.();
      const block=document.createElement('div');block.dataset.amoAuthProfile='true';block.className='amo-auth-profile';
      if(identity){
        const initial=(identity.name||identity.email||'?').trim().charAt(0).toUpperCase();
        block.innerHTML=`<div class="amo-auth-profile-card"><div class="amo-auth-avatar" aria-hidden="true">${esc(initial)}</div><div class="amo-auth-copy"><strong>${esc(identity.name||'Google user')}</strong><span>${esc(identity.email||'Signed in with Google')}</span></div></div><button type="button" class="command-menu-item amo-auth-signout"><span class="command-menu-icon">↪</span><span>Sign out</span></button>`;
        block.querySelector('.amo-auth-signout')?.addEventListener('click',async()=>{closeMenu();try{await auth.signOut()}catch(e){alert(`Could not sign out: ${e.message}`)}})
      }else{
        block.innerHTML='<div class="amo-auth-signin-wrap"><div class="amo-auth-signin-label">Sign in with Google</div><div class="amo-google-signin"></div></div>';
        const target=block.querySelector('.amo-google-signin');
        try{await auth.renderSignInButton?.(target,{width:220})}catch(err){target.innerHTML=`<div class="muted" style="padding:6px 9px">${esc(err.message||'Google sign-in unavailable')}</div>`}
      }
      if(!currentMenu.querySelector('[data-amo-auth-profile]'))currentMenu.prepend(block)
    })();
    try{return await profilePromise}finally{profilePromise=null}
  }

  function refreshProfile(){document.querySelectorAll('[data-amo-auth-profile]').forEach(el=>el.remove());ensureProfile()}
  const observer=new MutationObserver(()=>ensureProfile());
  function observe(){const menu=document.getElementById('commandMenu');if(!menu){setTimeout(observe,50);return}observer.observe(menu,{childList:true});ensureProfile()}
  ensureAuth().then(auth=>auth?.onChange?.(()=>refreshProfile()));
  window.addEventListener('amo-auth-changed',refreshProfile);
  observe();

  const style=document.createElement('style');style.textContent=`
    .amo-auth-profile{border-bottom:1px solid var(--line);margin:0 0 5px;padding:0 0 5px}
    .amo-auth-profile-card{display:flex;align-items:center;gap:9px;padding:7px 9px 6px}
    .amo-auth-avatar{display:grid;place-items:center;width:30px;height:30px;min-width:30px;border-radius:50%;background:var(--soft);border:1px solid var(--line);color:var(--accent);font-size:.78rem;font-weight:900}
    .amo-auth-copy{display:flex;flex-direction:column;min-width:0;line-height:1.2}.amo-auth-copy strong{font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.amo-auth-copy span{margin-top:2px;color:var(--muted);font-size:.65rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .amo-auth-signin-wrap{padding:7px 9px 9px}.amo-auth-signin-label{font-size:.68rem;font-weight:800;color:var(--muted);margin:0 0 6px}.amo-google-signin{min-height:32px;display:flex;align-items:center}
    html[data-theme="dark"] .amo-auth-avatar{background:#182237;border-color:var(--line)}
  `;document.head.appendChild(style)
})();
