/* Page-title hierarchy, navigation taxonomy and organisational scope polish. */
(function initUiPolish(){
  const css=document.createElement('link');css.rel='stylesheet';css.href='app-ui-polish.css';document.head.appendChild(css);
  const scopedViews=new Set(['dashboard','demand','allocations','resource','roadmap','status-report','status-history','team']);
  const pageTitles={dashboard:'Portfolio overview',demand:'Demand',allocations:'Allocations',resource:'Resource plan',roadmap:'Roadmap','status-report':'Status report','status-history':'Status report history',team:'People'};
  const navSections=[
    {id:'overview',label:'Overview',open:true,views:['dashboard']},
    {id:'work',label:'Work',views:['demand','allocations','team','ideas']},
    {id:'planning',label:'Planning & Reporting',open:true,views:['resource','roadmap','status-report','status-history']},
    {id:'administration',label:'Administration',views:['config','data','restore']},
    {id:'help',label:'Help',views:['process-overview','readme']}
  ];

  function setButtonLabel(button,label){
    if(!button)return;
    const dot=button.querySelector('.nav-dot');button.textContent='';if(dot)button.appendChild(dot);button.appendChild(document.createTextNode(label))
  }

  function ensureNavSection(nav,section){
    let group=nav.querySelector(`[data-amo-nav-section="${section.id}"]`);
    if(!group){group=document.createElement('details');group.className='nav-group';group.dataset.amoNavSection=section.id;group.innerHTML=`<summary>${section.label}</summary><div class="nav-group-items"></div>`;nav.appendChild(group)}
    group.querySelector('summary').textContent=section.label;
    if(section.open)group.open=true;
    return group.querySelector('.nav-group-items')
  }

  function arrangeNavigation(){
    const nav=document.querySelector('.sidebar nav');if(!nav)return;
    const buttons=[...nav.querySelectorAll('.nav-btn')];
    const byView=view=>buttons.find(b=>b.dataset.view===view)||nav.querySelector(`[data-view="${view}"]`);
    setButtonLabel(byView('config'),'Settings');
    setButtonLabel(byView('process-overview'),'Process Guide');
    navSections.forEach(section=>{const host=ensureNavSection(nav,section);section.views.forEach(view=>{const button=byView(view);if(button&&button.parentElement!==host)host.appendChild(button)})});
    [...nav.querySelectorAll('details.nav-group')].filter(g=>!g.dataset.amoNavSection).forEach(g=>{if(!g.querySelector('.nav-btn'))g.remove()});
    const anchor=document.getElementById('primaryNavAnchor');let cursor=anchor;
    navSections.forEach(section=>{const group=nav.querySelector(`[data-amo-nav-section="${section.id}"]`);if(group){cursor?.after(group);cursor=group}})
  }

  function scopeLabel(){
    try{return typeof window.scopeLabel==='function'?window.scopeLabel():'Whole organisation'}catch{return'Whole organisation'}
  }

  function placeScopeSelector(){
    const selector=document.getElementById('scopeSelector'),topbar=document.querySelector('.topbar');if(!selector||!topbar)return;
    let context=document.getElementById('amoPageContext');
    if(!context){context=document.createElement('div');context.id='amoPageContext';context.className='amo-page-context';topbar.after(context)}
    if(selector.parentElement!==context){context.textContent='';const label=document.createElement('span');label.className='amo-page-context-label';label.textContent='Scope';context.append(label,selector)}
    context.dataset.scope=scopeLabel()
  }

  function applyPageHierarchy(){
    const active=document.querySelector('.view.active');if(!active)return;
    const heroTitle=active.querySelector(':scope > .hero h1');
    if(heroTitle&&scopedViews.has(active.id))heroTitle.textContent=pageTitles[active.id]||heroTitle.textContent;
    const heroText=active.querySelector(':scope > .hero p');
    if(active.id==='dashboard'&&heroText)heroText.textContent='Portfolio demand, capacity, financial position and delivery health.';
    const configTitle=document.querySelector('#config > .hero h1');if(configTitle)configTitle.textContent='Settings';
    const configText=document.querySelector('#config > .hero p');if(configText)configText.textContent='Maintain system, process and organisation settings.';
    document.querySelectorAll('#allocations .notice,#resource .notice').forEach(n=>n.innerHTML=n.innerHTML.replace(/from Config/g,'from Settings'));
    document.getElementById('datasetPill')?.classList.add('amo-redundant-dataset-pill');
    document.querySelector('.sidebar-foot')?.classList.add('amo-secondary-sidebar-foot');
    const top=document.getElementById('pageTitle');top?.classList.add('page-title-primary');
    placeScopeSelector();arrangeNavigation()
  }

  function applyRoadmapThemeVars(){
    const months=typeof planningMonths==='function'?planningMonths():[];
    const step=months.length?`${100/months.length}%`:'8.333%';
    document.querySelectorAll('[data-roadmap-track]').forEach(el=>el.style.setProperty('--roadmap-step',step))
  }

  const baseSwitchViewPolish=switchView;
  switchView=function(id){baseSwitchViewPolish(id);applyPageHierarchy();applyRoadmapThemeVars()};

  const baseRefreshAllPolish=refreshAll;
  refreshAll=function(){baseRefreshAllPolish();applyPageHierarchy();applyRoadmapThemeVars()};

  const baseRenderScopePolish=renderScopeSelector;
  renderScopeSelector=function(){baseRenderScopePolish();applyPageHierarchy()};

  const baseRenderRoadmapPolish=renderRoadmap;
  renderRoadmap=function(){const result=baseRenderRoadmapPolish();applyRoadmapThemeVars();return result};

  window.refreshAmoInformationArchitecture=applyPageHierarchy;
  applyPageHierarchy();applyRoadmapThemeVars();
  [50,250,750,1500].forEach(delay=>setTimeout(applyPageHierarchy,delay));
})();
