/* Application versioning, target-stage identity and workspace data-stage safety controls. */
(function initTargetStageSafety(){
  const APP_VERSION='1.0.0';
  const normalizeStage=value=>{
    const v=String(value||'').trim().toLowerCase();
    if(v==='test'||v==='testing')return'test';
    if(v==='production'||v==='prod')return'production';
    return null
  };
  const targetStage=normalizeStage(window.AMO_CONFIG?.targetStage||window.AMO_CONFIG?.environment)||'test';
  const schemaVersion=Number(typeof CURRENT_SCHEMA_VERSION!=='undefined'?CURRENT_SCHEMA_VERSION:0)||0;
  const buildId=String(window.AMO_CONFIG?.buildId||'local').trim();
  const shortBuild=buildId==='local'?'local':buildId.slice(0,12);
  const originalTitle=document.title.replace(/^\[(?:TEST|TEST DATA|STAGE\?)\]\s*/,'').replace(/\s+—\s+MVP v\d+$/,'');

  window.AMO_TARGET_STAGE=targetStage;
  window.AMO_APP_VERSION=APP_VERSION;
  window.AMO_BUILD_ID=buildId;
  window.amoNormalizeDataStage=normalizeStage;

  function workspaceDataStage(){
    if(typeof workspaceHandle==='undefined'||!workspaceHandle||!db?.settings)return null;
    return normalizeStage(db.settings.dataStage)
  }

  function workspaceSchemaVersion(){
    if(typeof workspaceHandle==='undefined'||!workspaceHandle)return null;
    const v=Number(db?.workspace?.schemaVersion||db?.settings?.schemaVersion||0);
    return Number.isFinite(v)&&v>0?v:null
  }

  function ensureBanner(){
    let banner=document.getElementById('amoTargetStageBanner');
    if(banner)return banner;
    banner=document.createElement('div');banner.id='amoTargetStageBanner';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');document.body.prepend(banner);
    if(!document.getElementById('amoTargetStageStyles')){
      const style=document.createElement('style');style.id='amoTargetStageStyles';style.textContent=`
#amoTargetStageBanner{display:none;position:sticky;top:0;z-index:10000;width:100%;box-sizing:border-box;background:#e00000;color:#fff;text-align:center;font-weight:900;font-size:14px;line-height:18px;letter-spacing:.055em;padding:7px 12px;text-transform:uppercase;box-shadow:0 2px 6px rgba(0,0,0,.28)}
#amoTargetStageBanner.amo-stage-visible{display:block}
#amoTargetStageBanner .amo-stage-detail{font-weight:700;letter-spacing:.025em;margin-left:8px;opacity:.96}
`;
      document.head.appendChild(style)
    }
    return banner
  }

  function renderVersionIdentity(){
    const sub=document.querySelector('.brand-sub');
    if(sub){sub.textContent=`Version ${APP_VERSION} · Schema ${schemaVersion||'—'}`;sub.title=`AMO ${APP_VERSION} · Application schema ${schemaVersion||'unknown'} · Build ${buildId} · ${targetStage}`}
  }

  function renderStageIndicator(){
    const banner=ensureBanner(),dataStage=workspaceDataStage(),loaded=typeof workspaceHandle!=='undefined'&&!!workspaceHandle;let message='',detail='';
    if(targetStage==='test'){
      if(!loaded){message='TEST APP';detail='No workspace loaded'}
      else if(dataStage==='test')message='TEST APP — TEST DATA';
      else if(dataStage==null){message='TEST APP — WORKSPACE STAGE NOT SET';detail='Set Workspace Data Stage in Config to avoid this warning in future'}
      else message='TEST APP';
      document.title=`[TEST] ${originalTitle}`
    }else if(loaded&&dataStage==='test'){
      message='TEST DATA ONLY';detail='Production application using a Test workspace';document.title=`[TEST DATA] ${originalTitle}`
    }else if(loaded&&dataStage==null){
      message='WORKSPACE STAGE NOT SET';detail='Set Workspace Data Stage in Config to Production or Test';document.title=`[STAGE?] ${originalTitle}`
    }else document.title=originalTitle;
    banner.innerHTML=message?`<span>${message}</span>${detail?`<span class="amo-stage-detail">${detail}</span>`:''}`:'';
    banner.classList.toggle('amo-stage-visible',!!message);renderVersionIdentity()
  }

  window.renderAmoStageIndicator=renderStageIndicator;

  function assertCompatible(settings){
    const dataStage=normalizeStage(settings?.dataStage);
    if(targetStage==='test'&&dataStage==='production')throw new Error('Loading Production data in a Test AMO application instance is not supported. This application version may contain schema or write-behaviour changes. Open this workspace in Production, or explicitly classify non-production data as Test from an allowed instance.');
    return dataStage
  }
  window.assertAmoWorkspaceStage=assertCompatible;

  /* Guard explicitly classified Production data. Legacy workspaces with no Data Stage are allowed to load
     during the transition and remain unclassified until the user chooses a value in Config. */
  if(typeof prepareLoadedWorkspace==='function'){
    const basePrepareLoadedWorkspace=prepareLoadedWorkspace;
    prepareLoadedWorkspace=function(rawBundle){
      const rawStage=normalizeStage(rawBundle?.configFiles?.['settings.json']?.dataStage);
      if(targetStage==='test'&&rawStage==='production')assertCompatible({dataStage:rawStage});
      const prepared=basePrepareLoadedWorkspace(rawBundle);
      if(rawStage)prepared.loadedSettings.dataStage=rawStage;else delete prepared.loadedSettings.dataStage;
      if(prepared.configFiles?.['settings.json']){if(rawStage)prepared.configFiles['settings.json'].dataStage=rawStage;else delete prepared.configFiles['settings.json'].dataStage}
      return prepared
    }
  }

  if(typeof updateBanner==='function'){
    const baseUpdateBanner=updateBanner;
    updateBanner=function(...args){const result=baseUpdateBanner.apply(this,args);renderStageIndicator();return result}
  }

  function dataStageCard(){
    const raw=configState.editing?configState.draft?.dataStage:db.settings?.dataStage,value=normalizeStage(raw)||'';
    return `<div class="card config-card amo-data-stage-config"><div class="section-title" style="margin-top:0"><div><h2>Workspace Data Stage</h2><p class="muted config-description">Identifies whether this workspace contains Production or Test data. It is independent of the deployed application stage.</p></div></div><div class="config-list"><div class="config-row"><label style="width:100%"><strong>Data Stage</strong><br>${configState.editing?`<select class="cell-input" id="workspaceDataStage"><option value="" ${!value?'selected':''}>Not set</option><option value="production" ${value==='production'?'selected':''}>Production</option><option value="test" ${value==='test'?'selected':''}>Test</option></select>`:`<span>${value==='test'?'Test':value==='production'?'Production':'Not set'}</span>`}</label></div><div class="muted">Legacy workspaces may be unclassified during transition. Set this explicitly to remove the warning. Test AMO cannot open a workspace explicitly classified as Production.</div></div></div>`
  }

  function versionCard(){
    const wsSchema=workspaceSchemaVersion();
    return `<div class="card config-card amo-version-config"><div class="section-title" style="margin-top:0"><div><h2>Version & Compatibility</h2><p class="muted config-description">Application release, exact deployed build and workspace schema compatibility.</p></div></div><div class="config-list"><div class="mini-stat"><span>Application version</span><strong>${APP_VERSION}</strong></div><div class="mini-stat"><span>Build</span><strong title="${buildId}">${shortBuild}</strong></div><div class="mini-stat"><span>Application schema</span><strong>${schemaVersion||'—'}</strong></div><div class="mini-stat"><span>Workspace schema</span><strong>${wsSchema||'—'}</strong></div><div class="muted">Schema version is system-managed. AMO migrates supported older schemas and refuses workspaces newer than this application supports.</div></div></div>`
  }

  if(typeof renderConfig==='function'){
    const baseRenderConfigStage=renderConfig;
    renderConfig=function(...args){
      if(configState.editing&&configState.draft&&!Object.prototype.hasOwnProperty.call(configState.draft,'dataStage'))configState.draft.dataStage=db.settings?.dataStage||'';
      const result=baseRenderConfigStage.apply(this,args),grid=document.querySelector('#configContent .config-grid');
      if(grid&&typeof workspaceHandle!=='undefined'&&workspaceHandle){
        grid.querySelector('.amo-data-stage-config')?.remove();grid.querySelector('.amo-version-config')?.remove();
        grid.insertAdjacentHTML('afterbegin',versionCard());grid.insertAdjacentHTML('afterbegin',dataStageCard());
        document.getElementById('workspaceDataStage')?.addEventListener('change',e=>{configState.draft.dataStage=e.target.value})
      }
      return result
    }
  }

  if(typeof saveConfigChanges==='function'){
    const baseSaveConfigStage=saveConfigChanges;
    saveConfigChanges=function(...args){
      const wasEditing=!!configState.editing,requested=normalizeStage(configState.draft?.dataStage),previous=normalizeStage(db.settings?.dataStage);
      if(wasEditing&&targetStage==='test'&&requested==='production'){alert('A Production workspace cannot be configured while running the Test AMO application. Set Data Stage to Test, leave it unclassified during transition, or make the change from Production.');return}
      const result=baseSaveConfigStage.apply(this,args);
      if(wasEditing&&!configState.editing){
        if(requested)db.settings.dataStage=requested;else delete db.settings.dataStage;
        db.configFiles=db.configFiles||{};db.configFiles['settings.json']=clone(db.settings);configDirty=true;
        if(previous!==requested)log?.(`Workspace Data Stage changed from ${previous||'not set'} to ${requested||'not set'}.`);
        renderStageIndicator();if(typeof requestAutosave==='function')requestAutosave()
      }
      return result
    }
  }

  renderVersionIdentity();renderStageIndicator()
})();
