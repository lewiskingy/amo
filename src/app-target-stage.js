/* Application versioning, target-stage identity and workspace data-stage safety controls.
   Data Stage editing is owned by the canonical System Settings transaction. */
(function initTargetStageSafety(){
  const APP_VERSION='1.2.2';
  const normalizeStage=value=>{const v=String(value||'').trim().toLowerCase();if(v==='test'||v==='testing')return'test';if(v==='production'||v==='prod')return'production';return null};
  const targetStage=normalizeStage(window.AMO_CONFIG?.targetStage||window.AMO_CONFIG?.environment)||'test';
  const schemaVersion=Number(typeof CURRENT_SCHEMA_VERSION!=='undefined'?CURRENT_SCHEMA_VERSION:0)||0;
  const buildId=String(window.AMO_CONFIG?.buildId||'local').trim();
  const originalTitle=document.title.replace(/^\[(?:TEST|TEST DATA|STAGE\?)\]\s*/,'').replace(/\s+—\s+MVP v\d+$/,'');

  window.AMO_TARGET_STAGE=targetStage;window.AMO_APP_VERSION=APP_VERSION;window.AMO_BUILD_ID=buildId;window.amoNormalizeDataStage=normalizeStage;

  function workspaceDataStage(){if(typeof workspaceHandle==='undefined'||!workspaceHandle||!db?.settings)return null;return normalizeStage(db.settings.dataStage)}
  function ensureBanner(){
    let banner=document.getElementById('amoTargetStageBanner');if(banner)return banner;
    banner=document.createElement('div');banner.id='amoTargetStageBanner';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');document.body.prepend(banner);
    if(!document.getElementById('amoTargetStageStyles')){const style=document.createElement('style');style.id='amoTargetStageStyles';style.textContent=`#amoTargetStageBanner{display:none;position:sticky;top:0;z-index:10000;width:100%;box-sizing:border-box;background:#e00000;color:#fff;text-align:center;font-weight:900;font-size:14px;line-height:18px;letter-spacing:.055em;padding:7px 12px;text-transform:uppercase;box-shadow:0 2px 6px rgba(0,0,0,.28)}#amoTargetStageBanner.amo-stage-visible{display:block}#amoTargetStageBanner .amo-stage-detail{font-weight:700;letter-spacing:.025em;margin-left:8px;opacity:.96}`;document.head.appendChild(style)}
    return banner
  }
  function renderVersionIdentity(){const sub=document.querySelector('.brand-sub');if(sub){sub.textContent=`Version ${APP_VERSION} · Schema ${schemaVersion||'—'}`;sub.title=`AMO ${APP_VERSION} · Application schema ${schemaVersion||'unknown'} · Build ${buildId} · ${targetStage}`}}
  function renderStageIndicator(){
    const banner=ensureBanner(),dataStage=workspaceDataStage(),loaded=typeof workspaceHandle!=='undefined'&&!!workspaceHandle;let message='',detail='';
    if(targetStage==='test'){
      if(!loaded){message='TEST APP';detail='No workspace loaded'}else if(dataStage==='test')message='TEST APP — TEST DATA';else if(dataStage==null){message='TEST APP — WORKSPACE STAGE NOT SET';detail='Set Workspace Data Stage in Settings to avoid this warning in future'}else message='TEST APP';document.title=`[TEST] ${originalTitle}`
    }else if(loaded&&dataStage==='test'){message='TEST DATA ONLY';detail='Production application using a Test workspace';document.title=`[TEST DATA] ${originalTitle}`}
    else if(loaded&&dataStage==null){message='WORKSPACE STAGE NOT SET';detail='Set Workspace Data Stage in Settings to Production or Test';document.title=`[STAGE?] ${originalTitle}`}
    else document.title=originalTitle;
    banner.innerHTML=message?`<span>${message}</span>${detail?`<span class="amo-stage-detail">${detail}</span>`:''}`:'';banner.classList.toggle('amo-stage-visible',!!message);renderVersionIdentity()
  }
  window.renderAmoStageIndicator=renderStageIndicator;

  function assertCompatible(settings){const dataStage=normalizeStage(settings?.dataStage);if(targetStage==='test'&&dataStage==='production')throw new Error('Loading Production data in a Test AMO application instance is not supported. This application version may contain schema or write-behaviour changes. Open this workspace in Production, or explicitly classify non-production data as Test from an allowed instance.');return dataStage}
  window.assertAmoWorkspaceStage=assertCompatible;

  /* Guard explicitly classified Production data. Legacy workspaces with no Data Stage are allowed
     during transition and remain unclassified until changed through System Settings. */
  if(typeof prepareLoadedWorkspace==='function'){
    const basePrepareLoadedWorkspace=prepareLoadedWorkspace;
    prepareLoadedWorkspace=function(rawBundle){const rawStage=normalizeStage(rawBundle?.configFiles?.['settings.json']?.dataStage);if(targetStage==='test'&&rawStage==='production')assertCompatible({dataStage:rawStage});const prepared=basePrepareLoadedWorkspace(rawBundle);if(rawStage)prepared.loadedSettings.dataStage=rawStage;else delete prepared.loadedSettings.dataStage;if(prepared.configFiles?.['settings.json']){if(rawStage)prepared.configFiles['settings.json'].dataStage=rawStage;else delete prepared.configFiles['settings.json'].dataStage}return prepared}
  }
  if(typeof updateBanner==='function'){
    const baseUpdateBanner=updateBanner;updateBanner=function(...args){const result=baseUpdateBanner.apply(this,args);renderStageIndicator();return result}
  }
  window.addEventListener('amo-settings-updated',event=>{if(event.detail?.keys?.includes('dataStage'))renderStageIndicator()});
  window.addEventListener('amo-workspace-connected',renderStageIndicator);
  renderVersionIdentity();renderStageIndicator()
})();
