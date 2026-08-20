/* Optional AMO Assistant external navigation link driven by workspace configuration. */
(function initAmoAssistantLink(){
  const SETTING_KEY='assistantUrl';
  const normalizedUrl=v=>String(v||'').trim();

  function placeAssistantLink(nav,link){
    const readme=nav.querySelector('[data-view="readme"]');
    const anchor=document.getElementById('primaryNavAnchor');
    if(readme){nav.insertBefore(link,readme.nextSibling);return}
    if(anchor){nav.insertBefore(link,anchor.nextSibling);return}
    nav.prepend(link)
  }

  function renderAssistantNav(){
    const nav=document.querySelector('.sidebar nav');if(!nav)return;
    nav.querySelector('[data-amo-assistant]')?.remove();
    const url=normalizedUrl(db.settings?.[SETTING_KEY]);if(!url)return;
    const link=document.createElement('a');
    link.className='nav-btn amo-assistant-link';
    link.dataset.amoAssistant='true';
    link.href=url;link.target='_blank';link.rel='noopener noreferrer';
    link.title='Open AMO Assistant in a new window';
    link.innerHTML='<span class="amo-assistant-launch" aria-hidden="true">↗</span><span>AMO Assistant</span>';
    placeAssistantLink(nav,link)
  }

  function appendAssistantConfigCard(){
    if(!workspaceHandle)return;
    const grid=document.querySelector('#configContent .config-grid');if(!grid)return;
    grid.querySelector('.amo-assistant-config')?.remove();
    if(configState.editing&&configState.draft&&!Object.prototype.hasOwnProperty.call(configState.draft,SETTING_KEY))configState.draft[SETTING_KEY]=normalizedUrl(db.settings?.[SETTING_KEY]);
    const value=configState.editing?normalizedUrl(configState.draft?.[SETTING_KEY]):normalizedUrl(db.settings?.[SETTING_KEY]);
    const card=document.createElement('div');card.className='card config-card amo-assistant-config';
    card.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>AMO Assistant</h2><p class="muted config-description">Optional external link shown immediately below README in the navigation. Leave blank to hide the menu item.</p></div></div><div class="config-list"><div class="config-row">${configState.editing?`<input class="cell-input" id="configAmoAssistantUrl" type="url" value="${escHtml(value)}" placeholder="https://…">`:(value?`<a href="${escHtml(value)}" target="_blank" rel="noopener noreferrer">${escHtml(value)}</a>`:'<span class="muted">Not configured — menu item hidden.</span>')}</div></div>`;
    grid.appendChild(card);
    document.getElementById('configAmoAssistantUrl')?.addEventListener('input',e=>{configState.draft[SETTING_KEY]=e.target.value})
  }

  const baseRenderConfigAssistant=renderConfig;
  renderConfig=function(){const r=baseRenderConfigAssistant();appendAssistantConfigCard();return r};

  const baseSaveConfigAssistant=saveConfigChanges;
  saveConfigChanges=function(){
    const wasEditing=configState.editing;
    const wanted=wasEditing?normalizedUrl(configState.draft?.[SETTING_KEY]):normalizedUrl(db.settings?.[SETTING_KEY]);
    if(wanted){try{const u=new URL(wanted);if(!/^https?:$/.test(u.protocol)){alert('AMO Assistant must use an http:// or https:// URL.');return}}catch(e){alert('AMO Assistant URL is not valid.');return}}
    const result=baseSaveConfigAssistant();
    if(wasEditing&&!configState.editing){
      db.settings[SETTING_KEY]=wanted;
      db.configFiles['settings.json']=clone(db.settings);
      configDirty=true;updateBanner();requestAutosave();renderAssistantNav()
    }
    return result
  };

  const baseUpdateBannerAssistant=updateBanner;
  updateBanner=function(){const r=baseUpdateBannerAssistant();renderAssistantNav();return r};

  const style=document.createElement('style');style.id='amo-assistant-link-styles';style.textContent=`
    .sidebar nav .amo-assistant-link{display:flex;align-items:center;gap:10px;text-decoration:none;width:100%;box-sizing:border-box}
    .amo-assistant-launch{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;font-size:17px;line-height:1;font-weight:800;flex:0 0 18px}
    .amo-assistant-link:hover .amo-assistant-launch{transform:translate(1px,-1px)}
  `;document.head.appendChild(style);
  renderAssistantNav()
})();
