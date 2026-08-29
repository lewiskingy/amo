/* Restore activation + RBAC compatibility.
   Restore must not depend on compatibility scripts having already initialised. When opened, load
   the appropriate recovery module on demand if necessary, then render it. This turns the previous
   indefinite "still loading" fallback into a deterministic load-or-error path. */
(function initRestoreRbacFix(){
  const RESTORE_CAPABILITY='system.restore';
  let renderQueued=false;
  const moduleLoads=new Map();

  function activeRepo(){return window.workspaceRepository||null}
  function restoreSectionActive(){return document.getElementById('restore')?.classList.contains('active')===true}
  function host(){return document.getElementById('restoreContent')}
  function asset(src){return typeof window.amoAsset==='function'?window.amoAsset(src):src}

  function tagRestoreControls(){
    const nav=document.querySelector('.sidebar nav [data-view="restore"]');
    if(nav)nav.dataset.amoReadonlyAllow='true';
    const section=document.getElementById('restore');if(!section)return;
    section.querySelectorAll('button').forEach(button=>{
      const text=String(button.textContent||'').replace(/\s+/g,' ').trim();
      if(/^Restore\b/i.test(text)||button.id==='applyPointRestore'||button.id==='applyRemoteRestore')button.dataset.amoCapability=RESTORE_CAPABILITY
    })
  }

  function loadScriptOnce(src,test){
    if(test())return Promise.resolve(true);
    if(moduleLoads.has(src))return moduleLoads.get(src);
    const promise=new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>String(s.src||'').includes(`/${src}`)||String(s.getAttribute('src')||'').split('?')[0]===src);
      const complete=()=>{if(test())resolve(true);else reject(new Error(`${src} loaded but did not initialise its recovery API.`))};
      if(existing){
        existing.addEventListener('load',complete,{once:true});existing.addEventListener('error',()=>reject(new Error(`Could not load ${src}.`)),{once:true});
        // A dynamically-added script may already have completed before this handler was attached.
        setTimeout(()=>{if(test())resolve(true)},0);setTimeout(()=>{if(test())resolve(true)},100);
        return
      }
      const script=document.createElement('script');script.src=asset(src);script.async=false;script.dataset.amoRestoreModule='true';
      script.onload=complete;script.onerror=()=>reject(new Error(`Could not load ${src}.`));document.body.appendChild(script)
    }).catch(error=>{moduleLoads.delete(src);throw error});
    moduleLoads.set(src,promise);return promise
  }

  async function ensureRecoveryModule(repo){
    if(repo?.mode==='remote'){
      await loadScriptOnce('app-remote-recovery.js',()=>typeof window.AmoRemoteRecovery?.render==='function');
      return window.AmoRemoteRecovery
    }
    await loadScriptOnce('app-backup-recovery.js',()=>typeof window.AmoRecovery?.renderRestore==='function');
    return window.AmoRecovery
  }

  async function renderRestoreBody(){
    renderQueued=false;if(!restoreSectionActive())return;
    const repo=activeRepo(),output=host();
    try{
      if(!repo){if(output)output.innerHTML='<div class="notice">Open a Local or Remote workspace to use Restore.</div>';return}
      if(output)output.innerHTML='<div class="notice">Loading recovery tools…</div>';
      const recovery=await ensureRecoveryModule(repo);
      if(repo.mode==='remote')await recovery.render();else await recovery.renderRestore();
    }catch(error){
      if(output)output.innerHTML=`<div class="notice bad">Could not initialise Restore: ${String(error?.message||error).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div>`;
      console.error('AMO Restore initialisation failed.',error)
    }finally{tagRestoreControls();window.amoAccess?.refresh?.()}
  }

  function queueRender(){if(renderQueued)return;renderQueued=true;setTimeout(renderRestoreBody,0)}

  function bindRestoreNavigation(){
    const button=document.querySelector('.sidebar nav [data-view="restore"]');if(!button)return;
    button.dataset.amoReadonlyAllow='true';
    if(button.dataset.amoRestoreRenderBound==='true')return;
    button.dataset.amoRestoreRenderBound='true';button.addEventListener('click',queueRender)
  }

  const observer=new MutationObserver(()=>{
    bindRestoreNavigation();tagRestoreControls();
    if(restoreSectionActive()&&!host()?.children.length)queueRender()
  });
  observer.observe(document.body,{childList:true,subtree:true});

  bindRestoreNavigation();tagRestoreControls();
  window.addEventListener('amo-access-changed',()=>{tagRestoreControls();if(restoreSectionActive()&&!host()?.children.length)queueRender()});
  window.addEventListener('amo-workspace-connected',()=>{window.amoAccess?.refresh?.();if(restoreSectionActive())queueRender()});
  document.querySelector('.sidebar nav [data-view="users"]')?.addEventListener('click',()=>setTimeout(()=>window.amoAccess?.refresh?.(),0));
  if(restoreSectionActive())queueRender()
})();
