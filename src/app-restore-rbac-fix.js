/* Restore activation + RBAC compatibility.
   Recovery modules are normally loaded by the compatibility bundle before this file. If that
   ordering is ever disrupted, never leave Restore behind an unresolved script-load promise. */
(function initRestoreRbacFix(){
  const RESTORE_CAPABILITY='system.restore';
  const LOAD_TIMEOUT_MS=4000;
  let renderQueued=false;
  const moduleLoads=new Map();

  function activeRepo(){return window.workspaceRepository||null}
  function restoreSectionActive(){return document.getElementById('restore')?.classList.contains('active')===true}
  function host(){return document.getElementById('restoreContent')}
  function asset(src){return typeof window.amoAsset==='function'?window.amoAsset(src):src}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  function tagRestoreControls(){
    const nav=document.querySelector('.sidebar nav [data-view="restore"]');if(nav)nav.dataset.amoReadonlyAllow='true';
    const section=document.getElementById('restore');if(!section)return;
    section.querySelectorAll('button').forEach(button=>{
      const text=String(button.textContent||'').replace(/\s+/g,' ').trim();
      if(/^Restore\b/i.test(text)||button.id==='applyPointRestore'||button.id==='applyRemoteRestore')button.dataset.amoCapability=RESTORE_CAPABILITY
    })
  }

  function loadRecoveryScript(src,test){
    if(test())return Promise.resolve(true);
    if(moduleLoads.has(src))return moduleLoads.get(src);
    const promise=new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(error=null)=>{if(settled)return;settled=true;clearTimeout(timeout);if(error)reject(error);else resolve(true)};
      const timeout=setTimeout(()=>finish(new Error(`${src} did not initialise its recovery API within ${LOAD_TIMEOUT_MS/1000} seconds.`)),LOAD_TIMEOUT_MS);
      const existing=[...document.scripts].find(s=>String(s.src||'').includes(`/${src}`)||String(s.getAttribute('src')||'').split('?')[0]===src);
      const check=()=>{if(test())finish()};

      if(existing){
        /* The script may already have completed before Restore attached handlers. Poll the actual
           API rather than waiting forever for a load event that can never fire again. */
        existing.addEventListener('load',check,{once:true});
        existing.addEventListener('error',()=>finish(new Error(`Could not load ${src}.`)),{once:true});
        let attempts=0;const poll=setInterval(()=>{if(settled){clearInterval(poll);return}if(test()){clearInterval(poll);finish();return}if(++attempts>=20)clearInterval(poll)},100);
        check();return
      }

      const script=document.createElement('script');const base=asset(src);script.src=`${base}${String(base).includes('?')?'&':'?'}restore=${Date.now()}`;script.async=false;script.dataset.amoRestoreModule='true';
      script.onload=()=>{if(test())finish();else finish(new Error(`${src} loaded but did not initialise its recovery API.`))};
      script.onerror=()=>finish(new Error(`Could not load ${src}.`));document.body.appendChild(script)
    }).catch(error=>{moduleLoads.delete(src);throw error});
    moduleLoads.set(src,promise);return promise
  }

  async function ensureRecoveryModule(repo){
    if(repo?.mode==='remote'){
      await loadRecoveryScript('app-remote-recovery.js',()=>typeof window.AmoRemoteRecovery?.render==='function');
      return window.AmoRemoteRecovery
    }
    await loadRecoveryScript('app-backup-recovery.js',()=>typeof window.AmoRecovery?.renderRestore==='function');
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
      /* A renderer must replace the loader. Treat a silent no-op as an error so Restore can never
         appear to load forever again. */
      if(output&&/Loading recovery tools/i.test(output.textContent||''))throw new Error(`The ${repo.mode} recovery module loaded but did not render recovery information.`)
    }catch(error){
      if(output)output.innerHTML=`<div class="notice bad">Could not initialise Restore: ${esc(error?.message||error)}</div>`;
      console.error('AMO Restore initialisation failed.',error)
    }finally{tagRestoreControls();window.amoAccess?.refresh?.()}
  }

  function queueRender(){if(renderQueued)return;renderQueued=true;setTimeout(renderRestoreBody,0)}
  function bindRestoreNavigation(){
    const button=document.querySelector('.sidebar nav [data-view="restore"]');if(!button)return;
    button.dataset.amoReadonlyAllow='true';if(button.dataset.amoRestoreRenderBound==='true')return;
    button.dataset.amoRestoreRenderBound='true';button.addEventListener('click',queueRender)
  }

  /* Observe only long enough to bind a Restore button that may be created by a recovery module. */
  bindRestoreNavigation();
  if(!document.querySelector('.sidebar nav [data-view="restore"]')){
    const startupObserver=new MutationObserver(()=>{bindRestoreNavigation();if(document.querySelector('.sidebar nav [data-view="restore"]'))startupObserver.disconnect()});
    startupObserver.observe(document.body,{childList:true,subtree:true});setTimeout(()=>startupObserver.disconnect(),5000)
  }
  tagRestoreControls();
  window.addEventListener('amo-access-changed',()=>tagRestoreControls());
  window.addEventListener('amo-workspace-connected',()=>{window.amoAccess?.refresh?.();if(restoreSectionActive())queueRender()});
  if(restoreSectionActive())queueRender()
})();
