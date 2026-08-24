/* Focused UX fixes for configuration editing, modal keyboard handling and personal theme restore. */
(function initAmoUxFixes(){
  /* Config editing includes structured Teams added by app-department.js. Ensure the draft owns
     a Teams collection before the wrapped renderer runs, otherwise Edit Lists can acquire the
     workspace lock without producing a complete editable configuration model. */
  if(typeof renderConfig==='function'){
    const baseRenderConfig=renderConfig;
    renderConfig=function(...args){
      if(typeof configState!=='undefined'&&configState.editing&&configState.draft&&!Array.isArray(configState.draft.teams)){
        const teams=typeof configuredTeams==='function'?configuredTeams():(db.settings?.teams||[]);
        configState.draft.teams=typeof clone==='function'?clone(teams):structuredClone(teams)
      }
      return baseRenderConfig.apply(this,args)
    }
  }

  /* Escape mirrors the visible modal action: Cancel while editing/new, Close while viewing.
     Triggering the actual button preserves edit-lock release and any modal-specific cleanup. */
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const backdrop=document.getElementById('recordModalBackdrop');
    if(!backdrop?.classList.contains('open'))return;
    const action=backdrop.querySelector('[data-modal-cancel]')||backdrop.querySelector('[data-modal-close]');
    if(!action)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    action.click()
  },true);

  /* Theme is explicitly a browser preference. Re-assert the saved preference after page restore
     and workspace/UI refreshes so workspace configuration or BFCache timing cannot override it. */
  const THEME_KEY='amo.theme';
  const LEGACY_THEME_KEY='amo.appearance';
  function savedTheme(){
    try{
      const current=localStorage.getItem(THEME_KEY);
      if(current==='dark'||current==='light')return current;
      const legacy=localStorage.getItem(LEGACY_THEME_KEY);
      if(legacy==='dark'||legacy==='light'){
        localStorage.setItem(THEME_KEY,legacy);
        localStorage.removeItem(LEGACY_THEME_KEY);
        return legacy
      }
    }catch(_e){}
    return null
  }
  function restoreTheme(){
    const theme=savedTheme();
    if(!theme)return;
    if(typeof applyTheme==='function')applyTheme(theme,false);
    else document.documentElement.dataset.theme=theme
  }

  if(typeof updateBanner==='function'){
    const baseUpdateBanner=updateBanner;
    updateBanner=function(...args){const result=baseUpdateBanner.apply(this,args);restoreTheme();return result}
  }
  window.addEventListener('pageshow',restoreTheme);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)restoreTheme()});
  setTimeout(restoreTheme,0);
  setTimeout(restoreTheme,150);
  setTimeout(restoreTheme,600);
})();
