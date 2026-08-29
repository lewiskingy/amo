/* Restore activation + RBAC compatibility.
   Recovery modules historically populate the Restore body by wrapping switchView(). The RBAC
   layer exposed a timing/load-order weakness where the Restore shell could open without invoking
   either Local or Remote renderer. Keep navigation independent of those wrapper chains and mark
   destructive Restore actions with the explicit system.restore capability. */
(function initRestoreRbacFix(){
  const RESTORE_CAPABILITY='system.restore';
  let renderQueued=false;

  function activeRepo(){return window.workspaceRepository||null}
  function restoreSectionActive(){return document.getElementById('restore')?.classList.contains('active')===true}

  function tagRestoreControls(){
    const nav=document.querySelector('.sidebar nav [data-view="restore"]');
    if(nav)nav.dataset.amoReadonlyAllow='true';
    const section=document.getElementById('restore');if(!section)return;
    section.querySelectorAll('button').forEach(button=>{
      const text=String(button.textContent||'').replace(/\s+/g,' ').trim();
      if(/^Restore\b/i.test(text)||button.id==='applyPointRestore'||button.id==='applyRemoteRestore')button.dataset.amoCapability=RESTORE_CAPABILITY
    })
  }

  async function renderRestoreBody(){
    renderQueued=false;if(!restoreSectionActive())return;
    const repo=activeRepo();
    try{
      if(repo?.mode==='remote'&&typeof window.AmoRemoteRecovery?.render==='function')await window.AmoRemoteRecovery.render();
      else if(typeof window.AmoRecovery?.renderRestore==='function')await window.AmoRecovery.renderRestore();
      else{
        const host=document.getElementById('restoreContent');
        if(host)host.innerHTML='<div class="notice">Recovery tools are still loading. Re-open Restore in a moment.</div>'
      }
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
    if(restoreSectionActive()&&!document.getElementById('restoreContent')?.children.length)queueRender()
  });
  observer.observe(document.body,{childList:true,subtree:true});

  bindRestoreNavigation();tagRestoreControls();
  window.addEventListener('amo-access-changed',()=>{tagRestoreControls();if(restoreSectionActive())queueRender()});
  window.addEventListener('amo-workspace-connected',()=>{if(restoreSectionActive())queueRender()});
  if(restoreSectionActive())queueRender()
})();
