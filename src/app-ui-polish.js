/* Page-title hierarchy and organisational scope heading polish. */
(function initUiPolish(){
  const scopedViews=new Set(['dashboard','demand','allocations','resource','roadmap','status-report','status-history','team']);

  function scopeHeadingForView(viewId){
    if(!scopedViews.has(viewId)||typeof departmentScope==='undefined'||departmentScope==='department')return'Department View';
    const team=typeof teamById==='function'?teamById(departmentScope):null;
    return`Team: ${team?.name||departmentScope}`;
  }

  function applyPageHierarchy(){
    const active=document.querySelector('.view.active');
    if(!active)return;
    const heroTitle=active.querySelector(':scope > .hero h1');
    if(heroTitle)heroTitle.textContent=scopeHeadingForView(active.id);
    const top=document.getElementById('pageTitle');
    top?.classList.add('page-title-primary');
  }

  const baseSwitchViewPolish=switchView;
  switchView=function(id){
    baseSwitchViewPolish(id);
    applyPageHierarchy();
  };

  const baseRefreshAllPolish=refreshAll;
  refreshAll=function(){
    baseRefreshAllPolish();
    applyPageHierarchy();
  };

  /* The Team View selector changes scope without necessarily switching page. */
  const baseRenderScopePolish=renderScopeSelector;
  renderScopeSelector=function(){
    baseRenderScopePolish();
    applyPageHierarchy();
  };

  applyPageHierarchy();
})();
