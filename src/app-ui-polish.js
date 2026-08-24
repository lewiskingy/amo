/* Page-title hierarchy and organisational scope heading polish. */
(function initUiPolish(){
  const css=document.createElement('link');css.rel='stylesheet';css.href='app-ui-polish.css';document.head.appendChild(css);
  const scopedViews=new Set(['dashboard','demand','allocations','resource','roadmap','status-report','status-history','team']);

  function scopeHeadingForView(viewId){
    if(typeof departmentScope==='undefined'||departmentScope==='department')return'Department View';
    const team=typeof teamById==='function'?teamById(departmentScope):null;
    return`Team: ${team?.name||departmentScope}`;
  }

  function applyPageHierarchy(){
    const active=document.querySelector('.view.active');
    if(!active)return;
    const heroTitle=active.querySelector(':scope > .hero h1');
    if(heroTitle&&scopedViews.has(active.id))heroTitle.textContent=scopeHeadingForView(active.id);
    const top=document.getElementById('pageTitle');
    top?.classList.add('page-title-primary');
  }

  function applyRoadmapThemeVars(){
    const months=typeof planningMonths==='function'?planningMonths():[];
    const step=months.length?`${100/months.length}%`:'8.333%';
    document.querySelectorAll('[data-roadmap-track]').forEach(el=>el.style.setProperty('--roadmap-step',step));
  }

  const baseSwitchViewPolish=switchView;
  switchView=function(id){baseSwitchViewPolish(id);applyPageHierarchy();applyRoadmapThemeVars()};

  const baseRefreshAllPolish=refreshAll;
  refreshAll=function(){baseRefreshAllPolish();applyPageHierarchy();applyRoadmapThemeVars()};

  const baseRenderScopePolish=renderScopeSelector;
  renderScopeSelector=function(){baseRenderScopePolish();applyPageHierarchy()};

  const baseRenderRoadmapPolish=renderRoadmap;
  renderRoadmap=function(){const result=baseRenderRoadmapPolish();applyRoadmapThemeVars();return result};

  applyPageHierarchy();
  applyRoadmapThemeVars();
})();
