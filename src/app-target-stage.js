/* Application target stage and workspace data-stage safety controls. */
(function initTargetStageSafety(){
  const normalizeStage=(value,fallback='production')=>{
    const v=String(value||'').trim().toLowerCase();
    if(v==='test'||v==='testing')return'test';
    if(v==='production'||v==='prod')return'production';
    return fallback
  };
  const targetStage=normalizeStage(window.AMO_CONFIG?.targetStage||window.AMO_CONFIG?.environment,'test');
  const originalTitle=document.title.replace(/^\[(?:TEST|TEST DATA)\]\s*/,'');

  window.AMO_TARGET_STAGE=targetStage;
  window.amoNormalizeDataStage=value=>normalizeStage(value,'production');

  /* New in-browser settings start as Production unless explicitly changed. */
  if(typeof DEFAULT_SETTINGS==='object'&&DEFAULT_SETTINGS)DEFAULT_SETTINGS.dataStage=DEFAULT_SETTINGS.dataStage||'production';
  if(typeof db==='object'&&db?.settings&&!db.settings.dataStage)db.settings.dataStage='production';

  function workspaceDataStage(){
    if(typeof workspaceHandle==='undefined'||!workspaceHandle||!db?.settings)return null;
    return normalizeStage(db.settings.dataStage,'production')
  }

  function ensureBanner(){
    let banner=document.getElementById('amoTargetStageBanner');
    if(banner)return banner;
    banner=document.createElement('div');
    banner.id='amoTargetStageBanner';
    banner.setAttribute('role','status');
    banner.setAttribute('aria-live','polite');
    document.body.prepend(banner);
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

  function renderStageIndicator(){
    const banner=ensureBanner(),dataStage=workspaceDataStage();let message='',detail='';
    if(targetStage==='test'){
      message=dataStage==='test'?'TEST APP — TEST DATA':'TEST APP';
      detail=dataStage==null?'No workspace loaded':'';
      document.title=`[TEST] ${originalTitle}`
    }else if(dataStage==='test'){
      message='TEST DATA ONLY';detail='Production application using a Test workspace';
      document.title=`[TEST DATA] ${originalTitle}`
    }else document.title=originalTitle;
    banner.innerHTML=message?`<span>${message}</span>${detail?`<span class="amo-stage-detail">${detail}</span>`:''}`:'';
    banner.classList.toggle('amo-stage-visible',!!message)
  }

  window.renderAmoStageIndicator=renderStageIndicator;

  function incompatibleProductionData(){
    return new Error('Loading production data in a Test AMO application instance is not supported. This application version may contain schema or write-behaviour changes. Set the workspace Data Stage to test before opening it in Test.')
  }

  function classifyWorkspaceStage(settings){
    const raw=String(settings?.dataStage||'').trim();
    if(raw){
      const dataStage=normalizeStage(raw,'production');
      if(targetStage==='test'&&dataStage==='production')throw incompatibleProductionData();
      return {dataStage,classified:false}
    }
    if(targetStage==='test'){
      const answer=prompt('This workspace predates the Data Stage control and is therefore treated as Production by default.\n\nIf this is definitely Test data, type TEST to classify it as Test and continue. Otherwise cancel or leave blank.','');
      if(String(answer||'').trim().toLowerCase()==='test')return{dataStage:'test',classified:true};
      throw incompatibleProductionData()
    }
    return {dataStage:'production',classified:true}
  }

  function assertCompatible(settings){
    const {dataStage}=classifyWorkspaceStage(settings);
    return dataStage
  }
  window.assertAmoWorkspaceStage=assertCompatible;

  /* Apply the guard before either local or remote workspace state is committed to the UI. */
  if(typeof prepareLoadedWorkspace==='function'){
    const basePrepareLoadedWorkspace=prepareLoadedWorkspace;
    prepareLoadedWorkspace=function(rawBundle){
      const prepared=basePrepareLoadedWorkspace(rawBundle),classification=classifyWorkspaceStage(prepared.loadedSettings);
      prepared.loadedSettings.dataStage=classification.dataStage;
      if(prepared.configFiles?.['settings.json'])prepared.configFiles['settings.json'].dataStage=classification.dataStage;
      prepared.dataStageClassified=classification.classified;
      return prepared
    }
  }

  /* Persist a one-time classification of a legacy/unlabelled workspace after it has safely loaded. */
  if(typeof applyMigrationDirtyState==='function'){
    const baseApplyMigrationDirtyState=applyMigrationDirtyState;
    applyMigrationDirtyState=function(prepared){
      const result=baseApplyMigrationDirtyState(prepared);
      if(prepared?.dataStageClassified){
        configDirty=true;updateBanner();log?.(`Workspace Data Stage classified as ${prepared.loadedSettings.dataStage}.`);if(typeof requestAutosave==='function')requestAutosave()
      }
      return result
    }
  }

  /* Keep the global indicator in sync with workspace load/unload and configuration changes. */
  if(typeof updateBanner==='function'){
    const baseUpdateBanner=updateBanner;
    updateBanner=function(...args){const result=baseUpdateBanner.apply(this,args);renderStageIndicator();return result}
  }

  function dataStageCard(){
    const value=normalizeStage(configState.editing?configState.draft?.dataStage:db.settings?.dataStage,'production');
    return `<div class="card config-card amo-data-stage-config"><div class="section-title" style="margin-top:0"><div><h2>Workspace Data Stage</h2><p class="muted config-description">Identifies whether this workspace contains Production or Test data. AMO uses this independently from the deployed application stage.</p></div></div><div class="config-list"><div class="config-row"><label style="width:100%"><strong>Data Stage</strong><br>${configState.editing?`<select class="cell-input" id="workspaceDataStage"><option value="production" ${value==='production'?'selected':''}>Production</option><option value="test" ${value==='test'?'selected':''}>Test</option></select>`:`<span>${value==='test'?'Test':'Production'}</span>`}</label></div><div class="muted">Test application instances cannot load Production workspaces. Production AMO may load Test data, but the application will display a prominent TEST DATA ONLY warning.</div></div></div>`
  }

  if(typeof renderConfig==='function'){
    const baseRenderConfigStage=renderConfig;
    renderConfig=function(...args){
      if(configState.editing&&configState.draft&&!configState.draft.dataStage)configState.draft.dataStage=normalizeStage(db.settings?.dataStage,'production');
      const result=baseRenderConfigStage.apply(this,args),grid=document.querySelector('#configContent .config-grid');
      if(grid&&typeof workspaceHandle!=='undefined'&&workspaceHandle){grid.querySelector('.amo-data-stage-config')?.remove();grid.insertAdjacentHTML('afterbegin',dataStageCard());document.getElementById('workspaceDataStage')?.addEventListener('change',e=>{configState.draft.dataStage=normalizeStage(e.target.value,'production')})}
      return result
    }
  }

  if(typeof saveConfigChanges==='function'){
    const baseSaveConfigStage=saveConfigChanges;
    saveConfigChanges=function(...args){
      const wasEditing=!!configState.editing;
      const requested=normalizeStage(configState.draft?.dataStage||db.settings?.dataStage,'production');
      const previous=normalizeStage(db.settings?.dataStage,'production');
      if(wasEditing&&targetStage==='test'&&requested==='production'){
        alert('A Production workspace cannot be configured while running the Test AMO application. Set Data Stage to Test, or make the change from Production.');return
      }
      const result=baseSaveConfigStage.apply(this,args);
      if(wasEditing&&!configState.editing){
        db.settings.dataStage=requested;db.configFiles=db.configFiles||{};db.configFiles['settings.json']=clone(db.settings);configDirty=true;
        if(previous!==requested)log?.(`Workspace Data Stage changed from ${previous} to ${requested}.`);
        renderStageIndicator();if(typeof requestAutosave==='function')requestAutosave();
      }
      return result
    }
  }

  renderStageIndicator()
})();
