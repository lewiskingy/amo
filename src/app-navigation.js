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

  /* Replace the older insertion routine, which assumed Workspace was a direct nav child. */
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

    /* Primary ordering is README, optional AMO Assistant, then collapsible sections. */
    if(readmeBtn)nav.insertBefore(readmeBtn,anchor.nextSibling);
    if(assistant){
      const afterReadme=readmeBtn?.nextSibling||anchor.nextSibling;
      nav.insertBefore(assistant,afterReadme)
    }
    if(firstGroup){
      const reference=(assistant||readmeBtn)?.nextSibling||anchor.nextSibling;
      if(firstGroup!==reference)nav.insertBefore(firstGroup,reference)
    }

    /* Process Overview is a normal in-app view after all collapsible navigation groups. */
    ensureProcessOverviewNav();
  }

  setDefaultGroupState();
  arrangeNavigation();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setDefaultGroupState();arrangeNavigation()},{once:true});
  /* Optional links and README presentation are added by later compatibility layers. */
  setTimeout(arrangeNavigation,0);
  setTimeout(arrangeNavigation,50);
})();

/* Load planning/funding controls after all core AMO modules, then apply bulk-edit guards. */
(function loadEstimateFunding(){if(document.querySelector('script[data-amo-estimates-funding]'))return;const s=document.createElement('script');s.src='app-estimates-funding.js';s.dataset.amoEstimatesFunding='true';s.onload=()=>{if(document.querySelector('script[data-amo-estimates-guard]'))return;const g=document.createElement('script');g.src='app-estimates-funding-guard.js';g.dataset.amoEstimatesGuard='true';document.head.appendChild(g)};document.head.appendChild(s)})();
