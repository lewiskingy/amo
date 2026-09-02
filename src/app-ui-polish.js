/* Page-title hierarchy, navigation taxonomy and organisational scope polish. */
(function initUiPolish(){
  const css=document.createElement('link');css.rel='stylesheet';css.href='app-ui-polish.css';document.head.appendChild(css);
  const shellStyle=document.createElement('style');shellStyle.id='amo-sidebar-order-styles';shellStyle.textContent=`
    .sidebar .amo-sidebar-identity{margin-bottom:0!important;border-bottom:0!important;padding-bottom:8px!important}
    .sidebar .amo-drawer-utilities{margin:0 0 10px!important;padding:0 10px 14px!important;border-top:0!important;border-bottom:1px solid rgba(255,255,255,.14)!important}
    .sidebar nav>[data-amo-nav-section="work"]{margin-top:12px!important;padding-top:12px;border-top:1px solid rgba(255,255,255,.14)}
  `;document.head.appendChild(shellStyle);
  const scopedViews=new Set(['dashboard','demand','allocations','resource','roadmap','status-report','status-history','team']);
  const pageTitles={dashboard:'Portfolio overview',demand:'Demand',allocations:'Allocations',resource:'Resource plan',roadmap:'Roadmap','status-report':'Status report','status-history':'Status report history',team:'People'};
  const navSections=[
    {id:'work',label:'Work',views:['demand','allocations','team']},
    {id:'planning',label:'Planning & Reporting',views:['resource','roadmap','status-report','status-history']},
    {id:'administration',label:'Administration',views:['users','config','actuals','data','restore']},
    {id:'help',label:'Help',views:['ideas','process-overview','readme']}
  ];
  const mobileQuery=window.matchMedia('(max-width:760px)');
  let navigationInitialised=false;

  function setButtonLabel(button,label){if(!button)return;const dot=button.querySelector('.nav-dot');button.textContent='';if(dot)button.appendChild(dot);button.appendChild(document.createTextNode(label))}
  function ensureNavSection(nav,section){let group=nav.querySelector(`[data-amo-nav-section="${section.id}"]`);if(!group){group=document.createElement('details');group.className='nav-group';group.dataset.amoNavSection=section.id;group.innerHTML=`<summary>${section.label}</summary><div class="nav-group-items"></div>`;nav.appendChild(group)}group.querySelector('summary').textContent=section.label;return group.querySelector('.nav-group-items')}
  function activeViewId(){return document.querySelector('.view.active')?.id||'dashboard'}
  function openActiveNavGroup(){const active=document.querySelector('.sidebar .nav-btn.active')||document.querySelector(`.sidebar .nav-btn[data-view="${activeViewId()}"]`);const group=active?.closest('details.nav-group');if(group)group.open=true}

  function arrangeNavigation(){
    const nav=document.querySelector('.sidebar nav');if(!nav)return;const buttons=[...nav.querySelectorAll('.nav-btn')];const byView=view=>buttons.find(b=>b.dataset.view===view)||nav.querySelector(`[data-view="${view}"]`);
    const dashboard=byView('dashboard');
    setButtonLabel(byView('config'),'Settings');setButtonLabel(byView('process-overview'),'Process Guide');setButtonLabel(byView('ideas'),'Improvement Ideas');
    navSections.forEach(section=>{const host=ensureNavSection(nav,section);section.views.forEach(view=>{const button=byView(view);if(button&&button.parentElement!==host)host.appendChild(button)})});
    [...nav.querySelectorAll('details.nav-group')].filter(g=>!g.dataset.amoNavSection).forEach(g=>{if(!g.querySelector('.nav-btn'))g.remove()});
    const anchor=document.getElementById('primaryNavAnchor');let cursor=anchor;
    if(dashboard){cursor?.after(dashboard);cursor=dashboard}
    const assistant=nav.querySelector('[data-amo-assistant]');if(assistant){cursor?.after(assistant);cursor=assistant}
    navSections.forEach(section=>{const group=nav.querySelector(`[data-amo-nav-section="${section.id}"]`);if(group){cursor?.after(group);cursor=group}});
    if(!navigationInitialised){nav.querySelectorAll('details.nav-group').forEach(group=>{group.open=false});navigationInitialised=true}else openActiveNavGroup()
  }

  function scopeLabel(){try{return typeof window.scopeLabel==='function'?window.scopeLabel():'Whole organisation'}catch{return'Whole organisation'}}
  function ensureScopeShell(context){let toggle=document.getElementById('amoMobileScopeToggle');if(!toggle){toggle=document.createElement('button');toggle.id='amoMobileScopeToggle';toggle.className='amo-mobile-scope-toggle';toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.addEventListener('click',()=>{const open=context.classList.toggle('amo-scope-open');toggle.setAttribute('aria-expanded',String(open))});context.appendChild(toggle)}toggle.innerHTML=`<span class="amo-mobile-scope-caption">Scope</span><strong>${scopeLabel()}</strong><span aria-hidden="true">⌄</span>`;return toggle}
  function placeScopeSelector(){const selector=document.getElementById('scopeSelector'),topbar=document.querySelector('.topbar');if(!selector||!topbar)return;let context=document.getElementById('amoPageContext');if(!context){context=document.createElement('div');context.id='amoPageContext';context.className='amo-page-context';topbar.after(context)}let label=context.querySelector('.amo-page-context-label');if(!label){label=document.createElement('span');label.className='amo-page-context-label';label.textContent='Scope';context.prepend(label)}if(selector.parentElement!==context)context.appendChild(selector);context.dataset.scope=scopeLabel();ensureScopeShell(context)}

  function closeMobileNav(){document.body.classList.remove('amo-mobile-nav-open');document.getElementById('amoMobileNavToggle')?.setAttribute('aria-expanded','false')}
  function ensureMobileNavigation(){
    const topbar=document.querySelector('.topbar'),sidebar=document.querySelector('.sidebar');if(!topbar||!sidebar)return;let toggle=document.getElementById('amoMobileNavToggle');
    if(!toggle){toggle=document.createElement('button');toggle.id='amoMobileNavToggle';toggle.className='amo-mobile-nav-toggle';toggle.type='button';toggle.setAttribute('aria-label','Open navigation');toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<span aria-hidden="true">☰</span>';topbar.prepend(toggle);toggle.addEventListener('click',()=>{const open=!document.body.classList.contains('amo-mobile-nav-open');document.body.classList.toggle('amo-mobile-nav-open',open);toggle.setAttribute('aria-expanded',String(open));if(open)openActiveNavGroup()})}
    let scrim=document.getElementById('amoMobileNavScrim');if(!scrim){scrim=document.createElement('button');scrim.id='amoMobileNavScrim';scrim.className='amo-mobile-nav-scrim';scrim.type='button';scrim.setAttribute('aria-label','Close navigation');document.body.appendChild(scrim);scrim.addEventListener('click',closeMobileNav)}
    if(!sidebar.dataset.amoMobileNavBound){sidebar.dataset.amoMobileNavBound='true';sidebar.addEventListener('click',e=>{if(mobileQuery.matches&&e.target.closest('.nav-btn'))closeMobileNav()})}
  }

  function ensureWorkspaceControl(){
    let shell=document.getElementById('amoMobileWorkspaceShell');
    if(!shell){shell=document.createElement('div');shell.id='amoMobileWorkspaceShell';shell.className='amo-mobile-workspace-shell';shell.innerHTML='<button class="amo-mobile-workspace-toggle" id="amoMobileWorkspaceToggle" type="button" aria-expanded="false"><span>Workspace</span><span aria-hidden="true">⌄</span></button><div class="amo-mobile-workspace-menu" id="amoMobileWorkspaceMenu"><button type="button" data-workspace-source="openWorkspaceBtn">Local workspace</button><button type="button" data-workspace-source="remoteWorkspaceBtn">Remote workspace</button></div>';shell.querySelector('#amoMobileWorkspaceToggle').addEventListener('click',e=>{e.stopPropagation();const open=shell.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open))});shell.querySelectorAll('[data-workspace-source]').forEach(btn=>btn.addEventListener('click',()=>{const source=document.getElementById(btn.dataset.workspaceSource);shell.classList.remove('open');shell.querySelector('#amoMobileWorkspaceToggle')?.setAttribute('aria-expanded','false');if(source&&!source.disabled)source.click()}))}
    const local=shell.querySelector('[data-workspace-source="openWorkspaceBtn"]'),remote=shell.querySelector('[data-workspace-source="remoteWorkspaceBtn"]');if(local){const source=document.getElementById('openWorkspaceBtn');local.disabled=!source||source.disabled;local.textContent=source?.textContent?.replace(/\s+/g,' ').trim()||'Local workspace'}if(remote){const source=document.getElementById('remoteWorkspaceBtn');remote.disabled=!source||source.disabled;remote.textContent=source?.textContent?.replace(/\s+/g,' ').trim()||'Remote workspace'}return shell
  }

  function ensureSidebarWorkspace(){const sidebar=document.querySelector('.sidebar');if(!sidebar)return null;let host=document.getElementById('amoDrawerUtilities');if(!host){host=document.createElement('div');host.id='amoDrawerUtilities';host.className='amo-drawer-utilities';host.innerHTML='<div class="amo-drawer-section-label">Workspace</div><div id="amoDrawerWorkspace"></div>'}const identity=document.getElementById('amoSidebarIdentity'),brandSub=sidebar.querySelector('.brand-sub');if(identity){if(identity.nextElementSibling!==host)identity.after(host)}else if(brandSub&&brandSub.nextElementSibling!==host)brandSub.after(host);else if(!host.parentElement)sidebar.prepend(host);return host}
  function placeShellControls(){const host=ensureSidebarWorkspace(),workspace=ensureWorkspaceControl();if(!host||!workspace)return;const workspaceHost=host.querySelector('#amoDrawerWorkspace');if(workspace.parentElement!==workspaceHost)workspaceHost.appendChild(workspace);document.getElementById('commandMenuShell')?.remove()}
  function applyMobileMode(){if(!mobileQuery.matches){closeMobileNav();document.getElementById('amoPageContext')?.classList.remove('amo-scope-open');document.getElementById('amoMobileScopeToggle')?.setAttribute('aria-expanded','false')}placeShellControls()}

  function applyPageHierarchy(){
    const active=document.querySelector('.view.active');if(!active)return;const heroTitle=active.querySelector(':scope > .hero h1');if(heroTitle&&scopedViews.has(active.id))heroTitle.textContent=pageTitles[active.id]||heroTitle.textContent;const heroText=active.querySelector(':scope > .hero p');if(active.id==='dashboard'&&heroText)heroText.textContent='Portfolio demand, capacity, financial position and delivery health.';
    const configTitle=document.querySelector('#config > .hero h1');if(configTitle)configTitle.textContent='Settings';const configText=document.querySelector('#config > .hero p');if(configText)configText.textContent='Maintain system, process and organisation settings.';document.querySelectorAll('#allocations .notice,#resource .notice').forEach(n=>n.innerHTML=n.innerHTML.replace(/from Config/g,'from Settings'));
    document.getElementById('datasetPill')?.classList.add('amo-redundant-dataset-pill');document.querySelector('.sidebar-foot')?.classList.add('amo-secondary-sidebar-foot');document.getElementById('pageTitle')?.classList.add('page-title-primary');placeScopeSelector();arrangeNavigation();ensureMobileNavigation();ensureWorkspaceControl();applyMobileMode()
  }

  function applyRoadmapThemeVars(){const months=typeof planningMonths==='function'?planningMonths():[];const step=months.length?`${100/months.length}%`:'8.333%';document.querySelectorAll('[data-roadmap-track]').forEach(el=>el.style.setProperty('--roadmap-step',step))}
  const baseSwitchViewPolish=switchView;switchView=function(id){baseSwitchViewPolish(id);applyPageHierarchy();applyRoadmapThemeVars();if(mobileQuery.matches)closeMobileNav()};
  const baseRefreshAllPolish=refreshAll;refreshAll=function(){baseRefreshAllPolish();applyPageHierarchy();applyRoadmapThemeVars()};
  const baseRenderScopePolish=renderScopeSelector;renderScopeSelector=function(){baseRenderScopePolish();applyPageHierarchy()};
  const baseRenderRoadmapPolish=renderRoadmap;renderRoadmap=function(){const result=baseRenderRoadmapPolish();applyRoadmapThemeVars();return result};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMobileNav();document.getElementById('amoPageContext')?.classList.remove('amo-scope-open')}});mobileQuery.addEventListener?.('change',applyMobileMode);window.refreshAmoInformationArchitecture=applyPageHierarchy;applyPageHierarchy();applyRoadmapThemeVars();[50,250,750,1500].forEach(delay=>setTimeout(applyPageHierarchy,delay))
})();
