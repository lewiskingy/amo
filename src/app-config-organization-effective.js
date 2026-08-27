/* Ensure the authoritative Config page works from the same effective Organization model as the rest of AMO.
   Older workspaces may rely on default Teams or in-memory Initiative migration without those values yet
   being materialized in config/settings.json. Config must never interpret those implicit values as removals. */
(function initEffectiveOrganizationConfig(){
  if(window.__amoEffectiveOrganizationConfigLoaded)return;
  window.__amoEffectiveOrganizationConfigLoaded=true;

  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

  function ensureEffectiveOrganizationSettings(){
    if(!workspaceHandle||!db?.settings)return false;
    let changed=false;

    const explicitTeams=typeof normalizeTeams==='function'?normalizeTeams(db.settings.teams||[]):[];
    if(!explicitTeams.length&&typeof configuredTeams==='function'){
      db.settings.teams=clone(configuredTeams());
      changed=true;
    }else if(explicitTeams.length&&!equal(db.settings.teams,explicitTeams)){
      db.settings.teams=clone(explicitTeams);
      changed=true;
    }

    if(typeof migrateInitiatives==='function'){
      const effectiveInitiatives=migrateInitiatives(db.settings,db.demand||[]);
      if(!equal(db.settings.initiatives||[],effectiveInitiatives)){
        db.settings.initiatives=clone(effectiveInitiatives);
        changed=true;
      }
    }

    if(changed){
      db.configFiles=db.configFiles||{};
      db.configFiles['settings.json']=clone(db.settings);
      configDirty=true;
      if(typeof updateBanner==='function')updateBanner();
      if(typeof requestAutosave==='function')requestAutosave();
      if(typeof log==='function')log('Materialized effective Organization settings (Teams / Initiatives) into config/settings.json.');
    }
    return changed;
  }

  const priorRenderConfig=renderConfig;
  renderConfig=function(){ensureEffectiveOrganizationSettings();return priorRenderConfig()};

  window.ensureEffectiveOrganizationSettings=ensureEffectiveOrganizationSettings;
  if(workspaceHandle){ensureEffectiveOrganizationSettings();renderConfig()}
})();