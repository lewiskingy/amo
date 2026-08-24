/* Sidebar navigation structure and dynamic item placement. */
(function initNavigationLayout(){
  function ensureReadmeNav(){
    const nav=document.querySelector('.sidebar nav');
    const anchor=document.getElementById('primaryNavAnchor');
    if(!nav||!anchor)return null;

    let btn=nav.querySelector('[data-view="readme"]');
    if(!btn){
      btn=document.createElement('button');
      btn.className='nav-btn';
      btn.dataset.view='readme';
      btn.innerHTML='<span class="nav-dot"></span>README';
      btn.addEventListener('click',()=>switchView('readme'));
    }
    nav.insertBefore(btn,anchor.nextSibling);

    if(!document.getElementById('readme')){
      const section=document.createElement('section');
      section.id='readme';section.className='view';
      section.innerHTML='<div class="hero"><div><h1>README</h1><p>Application usage and operating notes bundled with AMO.</p></div></div><div class="card"><article id="readmeContent" class="readme-markdown"></article></div>';
      document.querySelector('.content')?.appendChild(section)
    }
    return btn
  }

  function ensureProcessOverviewNav(){
    const nav=document.querySelector('.sidebar nav');
    if(!nav)return null;
    let btn=nav.querySelector('[data-view="process-overview"]');
    const old=nav.querySelector('[data-process-overview]');
    if(old&&!btn){old.remove()}
    if(!btn){
      btn=document.createElement('button');
      btn.className='nav-btn';
      btn.dataset.view='process-overview';
      btn.innerHTML='<span class="nav-dot"></span>Process Overview';
      btn.addEventListener('click',()=>switchView('process-overview'));
    }
    nav.appendChild(btn);
    return btn
  }

  ensureReadmeTab=function(){return ensureReadmeNav()};

  function setDefaultGroupState(){
    document.querySelectorAll('.sidebar nav details.nav-group').forEach(group=>{
      const label=group.querySelector(':scope > summary')?.textContent?.trim();
      group.open=label==='Reporting';
    })
  }

  function arrangeNavigation(){
    const nav=document.querySelector('.sidebar nav');
    const anchor=document.getElementById('primaryNavAnchor');
    if(!nav||!anchor)return;

    const readmeBtn=ensureReadmeNav();
    const assistant=nav.querySelector('[data-amo-assistant]');
    const firstGroup=nav.querySelector('details.nav-group');

    if(readmeBtn)nav.insertBefore(readmeBtn,anchor.nextSibling);
    if(assistant){
      const afterReadme=readmeBtn?.nextSibling||anchor.nextSibling;
      nav.insertBefore(assistant,afterReadme)
    }
    if(firstGroup){
      const reference=(assistant||readmeBtn)?.nextSibling||anchor.nextSibling;
      if(firstGroup!==reference)nav.insertBefore(firstGroup,reference)
    }
    ensureProcessOverviewNav();
  }

  setDefaultGroupState();
  arrangeNavigation();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setDefaultGroupState();arrangeNavigation()},{once:true});
  setTimeout(arrangeNavigation,0);
  setTimeout(arrangeNavigation,50);
})();

/* Hosted AMO can run in browsers or managed environments where a showDirectoryPicker
   property exists but is not callable. Older core code tests for property presence, so
   normalise that case to a callable compatibility function which produces a useful error
   instead of "showDirectoryPicker is not a function". Native support is left untouched. */
(function normaliseDirectoryPicker(){
  if(typeof window.showDirectoryPicker==='function')return;
  const message=()=>window.isSecureContext!==false
    ?'Local Workspace folder access is not available in this browser or has been disabled by browser policy. Use a current desktop Chromium browser such as Edge or Chrome, or use Remote Workspace when available.'
    :'Local Workspace folder access requires a secure HTTPS context and a supported desktop Chromium browser.';
  const unavailable=async()=>{throw new Error(message())};
  try{window.showDirectoryPicker=unavailable}catch(e){
    try{Object.defineProperty(window,'showDirectoryPicker',{configurable:true,value:unavailable})}catch(_e){}
  }
})();

(function loadWorkspaceRepositoryBridge(){if(document.querySelector('script[data-amo-repository-bridge]'))return;const s=document.createElement('script');s.src='app-workspace-repository-bridge.js';s.dataset.amoRepositoryBridge='true';document.head.appendChild(s)})();

(function loadEstimateFunding(){if(document.querySelector('script[data-amo-estimates-funding]'))return;const s=document.createElement('script');s.src='app-estimates-funding.js';s.dataset.amoEstimatesFunding='true';s.onload=()=>{if(document.querySelector('script[data-amo-estimates-guard]'))return;const g=document.createElement('script');g.src='app-estimates-funding-guard.js';g.dataset.amoEstimatesGuard='true';document.head.appendChild(g)};document.head.appendChild(s)})();

/* Remote mode is layered on after the local implementation. The HTTP repository implements
   the same WorkspaceRepository contract and the UX then exposes Local/Remote connection choices. */
(function loadRemoteWorkspace(){
  if(document.querySelector('script[data-amo-remote-repository]'))return;
  const repo=document.createElement('script');repo.src='app-workspace-remote-repository.js';repo.dataset.amoRemoteRepository='true';repo.onload=()=>{
    if(document.querySelector('script[data-amo-remote-workspace]'))return;
    const ux=document.createElement('script');ux.src='app-remote-workspace.js';ux.dataset.amoRemoteWorkspace='true';document.head.appendChild(ux)
  };document.head.appendChild(repo)
})();

(function loadUxFixes(){if(document.querySelector('script[data-amo-ux-fixes]'))return;const s=document.createElement('script');s.src='app-ux-fixes.js';s.dataset.amoUxFixes='true';document.head.appendChild(s)})();

(function loadAllocationInteractions(){
  if(document.querySelector('script[data-amo-allocation-interactions]'))return;
  const s=document.createElement('script');s.src='app-allocation-interactions.js';s.dataset.amoAllocationInteractions='true';
  s.onload=()=>{
    if(!document.querySelector('script[data-amo-allocation-fill-polish]')){const p=document.createElement('script');p.src='app-allocation-fill-polish.js';p.dataset.amoAllocationFillPolish='true';document.head.appendChild(p)}
    if(!document.querySelector('script[data-amo-allocation-drag-wins]')){const d=document.createElement('script');d.src='app-allocation-drag-wins.js';d.dataset.amoAllocationDragWins='true';document.head.appendChild(d)}
    if(!document.querySelector('script[data-amo-allocation-filter-toolbar]')){const f=document.createElement('script');f.src='app-allocation-filter-toolbar.js';f.dataset.amoAllocationFilterToolbar='true';document.head.appendChild(f)}
  };
  document.head.appendChild(s)
})();

(function loadLockAllocationGuards(){if(document.querySelector('script[data-amo-lock-allocation-guards]'))return;const s=document.createElement('script');s.src='app-lock-allocation-guards.js';s.dataset.amoLockAllocationGuards='true';document.head.appendChild(s)})();
