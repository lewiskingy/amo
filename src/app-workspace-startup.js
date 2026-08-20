/* Prominent startup workspace action for browsers that require a user gesture to re-authorise a remembered folder. */
(function initWorkspaceStartupAction(){
  function renderWorkspaceStartupAction(){
    const dashboard=document.getElementById('dashboard');if(!dashboard)return;
    let host=document.getElementById('workspaceStartupAction');
    if(workspaceHandle){host?.remove();return}
    if(!host){
      host=document.createElement('div');host.id='workspaceStartupAction';host.className='workspace-startup-action card';
      const hero=dashboard.querySelector('.hero');hero?.after(host)
    }
    if(workspaceLoading){
      host.innerHTML='<div class="workspace-startup-copy"><strong>Loading workspace…</strong><span class="muted">Reading workspace data and preparing AMO.</span></div><span class="workspace-spinner" aria-hidden="true"></span>';
      return
    }
    const remembered=typeof rememberedWorkspaceHandle!=='undefined'&&rememberedWorkspaceHandle;
    const name=remembered?.name||'';
    host.innerHTML=`<div class="workspace-startup-copy"><strong>${remembered?'Reconnect your workspace':'Open a workspace to begin'}</strong><span class="muted">${remembered?`AMO remembers ${escHtml(name)}. Click once to grant browser access and load it.`:'Select the AMO workspace folder containing your data.'}</span></div><button class="btn primary workspace-startup-button" id="workspaceStartupOpen">${remembered?`Reconnect ${escHtml(name)}`:'Open Workspace'}</button>`;
    document.getElementById('workspaceStartupOpen')?.addEventListener('click',async e=>{
      const button=e.currentTarget;button.disabled=true;
      try{await openWorkspace()}finally{renderWorkspaceStartupAction()}
    })
  }

  /* Remembered handle discovery is asynchronous, so hook both workspace render paths. */
  if(typeof renderRememberedWorkspace==='function'){
    const baseRememberedRender=renderRememberedWorkspace;
    renderRememberedWorkspace=function(){const r=baseRememberedRender();renderWorkspaceStartupAction();return r}
  }
  if(typeof updateBanner==='function'){
    const baseStartupBanner=updateBanner;
    updateBanner=function(){const r=baseStartupBanner();renderWorkspaceStartupAction();return r}
  }

  const style=document.createElement('style');style.id='workspace-startup-action-styles';style.textContent=`
    .workspace-startup-action{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:0 0 18px;padding:16px 18px;border-color:var(--accent);background:linear-gradient(135deg,var(--panel),var(--soft))}
    .workspace-startup-copy{display:flex;flex-direction:column;gap:4px;min-width:0}.workspace-startup-copy strong{font-size:1rem;color:var(--ink)}
    .workspace-startup-button{white-space:nowrap;flex:0 0 auto}
    html[data-theme="dark"] .workspace-startup-action{background:linear-gradient(135deg,var(--panel),var(--soft));border-color:var(--accent)}
    @media(max-width:700px){.workspace-startup-action{align-items:stretch;flex-direction:column}.workspace-startup-button{width:100%}}
  `;document.head.appendChild(style);
  renderWorkspaceStartupAction();
  setTimeout(renderWorkspaceStartupAction,100);
})();