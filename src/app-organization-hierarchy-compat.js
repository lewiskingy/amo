/* Compatibility edges for the first-class organization hierarchy. */
(function initOrganizationHierarchyCompat(){
  if(window.__amoOrganizationHierarchyCompatLoaded)return;window.__amoOrganizationHierarchyCompatLoaded=true;
  const ALL='department',ORG='organization';
  const hierarchy=()=>window.amoOrganizationHierarchy;
  const selectedDepartment=()=>hierarchy()?.selectedDepartment?.()||ORG;
  const selectedTeam=()=>hierarchy()?.selectedTeam?.()||ALL;
  const baseTeams=typeof configuredTeams==='function'?configuredTeams:null;
  const copy=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));

  configuredTeams=function(){
    const rows=baseTeams?baseTeams():[];if(rows.length)return rows;
    const dep=hierarchy()?.configuredDepartments?.()[0]?.id||'DEPT-ARCH';
    return[
      {id:'TEAM-EA',name:'Enterprise Architecture',departmentId:dep},
      {id:'TEAM-BA',name:'Business Architecture',departmentId:dep},
      {id:'TEAM-DOM',name:'Domain Architecture',departmentId:dep}
    ]
  };
  teamById=function(id){return configuredTeams().find(t=>t.id===id)||null};
  function entryDepartmentId(entry){return entry?.departmentId||teamById(entry?.teamId)?.departmentId||''}
  function demandMatches(d,dep,teamScope){
    const team=teamById(d?.teamId);
    if(!team)return dep===ORG&&teamScope===ALL&&typeof demandIsTriage==='function'&&demandIsTriage(d);
    if(dep!==ORG&&team.departmentId!==dep)return false;
    return teamScope===ALL||team.id===teamScope
  }
  function personMatches(p,dep,teamScope){
    const team=teamById(p?.teamId);if(!team)return false;
    if(dep!==ORG&&team.departmentId!==dep)return false;
    return teamScope===ALL||team.id===teamScope
  }

  demandInScope=function(d){return demandMatches(d,selectedDepartment(),selectedTeam())};
  scopedDemand=function(){return Array.isArray(db?.demand)?db.demand.filter(demandInScope):[]};
  scopedAllocations=function(){const ids=new Set(scopedDemand().map(d=>d.id));return(Array.isArray(db?.allocations)?db.allocations:[]).filter(a=>ids.has(a.demandId))};

  /* Older Roadmap wrapper bypasses scoping whenever Team is Whole Department. Always supply the
     already-scoped Demand set so a selected Department cannot leak Whole-Org rows. */
  if(typeof renderRoadmap==='function'){
    const base=renderRoadmap;renderRoadmap=function(){const all=db.demand;db.demand=scopedDemand();try{return base.apply(this,arguments)}finally{db.demand=all}}
  }

  /* Persist Department alongside Team in new report entries. Historical reports without the field
     remain filterable through the current Team -> Department relationship. */
  if(typeof snapshotStatusEntry==='function'){
    const base=snapshotStatusEntry;snapshotStatusEntry=function(d,e){const row=base.apply(this,arguments),team=teamById(d?.teamId),dep=hierarchy()?.departmentById?.(team?.departmentId);return{...row,departmentId:dep?.id||team?.departmentId||'',departmentName:dep?.name||''}}
  }
  reportEntriesForScope=function(report){
    const entries=report?.entries||[],dep=selectedDepartment(),teamScope=selectedTeam();
    if(dep===ORG&&teamScope===ALL)return entries;
    return entries.filter(entry=>teamScope!==ALL?entry.teamId===teamScope:entryDepartmentId(entry)===dep)
  };

  function dashboardSnapshotFor(dep=ORG,teamScope=ALL){
    if(typeof planningMonths!=='function'||typeof isOpenDemand!=='function')return null;
    const months=planningMonths(),active=(db.demand||[]).filter(d=>demandMatches(d,dep,teamScope)).filter(isOpenDemand),ids=new Set(active.map(d=>d.id)),allocs=(db.allocations||[]).filter(a=>ids.has(a.demandId)),people=(db.team||[]).filter(p=>personMatches(p,dep,teamScope)).filter(p=>p.active!==false);
    const unallocated=active.filter(d=>!allocs.some(a=>a.demandId===d.id&&a.teamMemberId)).length,socialisation=active.filter(d=>/(socialisation|socialization)/i.test(d.status||'')).length,governance=active.filter(d=>/(approval|governance)/i.test(d.status||'')).length;
    const conflicts=people.reduce((n,p)=>n+months.filter(m=>allocs.filter(a=>a.teamMemberId===p.id).reduce((x,a)=>x+(Number(a.forecast?.[m])||0),0)>(Number(p.fte)||0)).length,0),capacity=people.reduce((n,p)=>n+(Number(p.fte)||0),0);
    const capacityOutlook=months.map(m=>{const allocated=allocs.reduce((n,a)=>n+(Number(a.forecast?.[m])||0),0);return{month:m,label:typeof monthLabel==='function'?monthLabel(m):m,capacityFte:capacity,allocatedFte:allocated,utilisationPct:capacity?Math.round(allocated/capacity*100):0}}),attentionRequired=active.filter(d=>!allocs.some(a=>a.demandId===d.id&&a.teamMemberId)).map(d=>({demandId:d.id,title:d.title,reason:'No resource allocation'}));
    const depName=dep===ORG?'Whole Org':(hierarchy()?.departmentById?.(dep)?.name||dep),teamName=teamScope===ALL?(dep===ORG?'All Teams':'Whole Department'):(teamById(teamScope)?.name||teamScope);
    return{capturedAt:new Date().toISOString(),scopeId:teamScope,scopeName:teamScope===ALL?depName:`${depName} · ${teamName}`,departmentScopeId:dep,teamScopeId:teamScope,activeDemand:active.length,unallocated,inSocialisation:socialisation,inGovernance:governance,capacityConflicts:conflicts,capacityOutlook,attentionRequired}
  }

  if(typeof dashboardHeadlineSnapshot==='function'){
    dashboardHeadlineSnapshot=function(){return dashboardSnapshotFor(selectedDepartment(),selectedTeam())}
  }
  if(typeof buildPreviewReport==='function'){
    const base=buildPreviewReport;buildPreviewReport=function(){
      const report=base.apply(this,arguments),dep=selectedDepartment(),teamScope=selectedTeam();
      report.departmentScopeId=dep;report.teamScopeId=teamScope;report.scopeName=typeof scopeLabel==='function'?scopeLabel():report.scopeName;
      if(report.dashboardSnapshots&&dep===ORG&&teamScope===ALL){
        report.dashboardSnapshots.departments=Object.fromEntries((hierarchy()?.configuredDepartments?.()||[]).map(d=>[d.id,dashboardSnapshotFor(d.id,ALL)]))
      }
      return report
    }
  }
  if(typeof reportNarrativeHtml==='function'){
    const base=reportNarrativeHtml;reportNarrativeHtml=function(report){
      const dep=selectedDepartment(),teamScope=selectedTeam();
      if(dep===ORG||teamScope!==ALL||!report?.dashboardSnapshots?.departments?.[dep])return base.apply(this,arguments);
      const adjusted=copy(report);adjusted.dashboardSnapshots=adjusted.dashboardSnapshots||{};adjusted.dashboardSnapshots.department=copy(report.dashboardSnapshots.departments[dep]);return base.call(this,adjusted)
    }
  }

  /* Publishing remains tenant-wide. Viewing and Preview can be scoped, but an immutable published
     report must not silently omit other Departments because of the current page filter. */
  if(typeof publishStatusReport==='function'){
    const base=publishStatusReport;publishStatusReport=function(){
      const api=hierarchy(),previousDepartment=selectedDepartment(),previousTeam=selectedTeam();
      if(api&&(previousDepartment!==ORG||previousTeam!==ALL))api.setScope(ORG,ALL);
      const restore=()=>{if(api&&(previousDepartment!==ORG||previousTeam!==ALL))api.setScope(previousDepartment,previousTeam)};
      try{const result=base.apply(this,arguments);if(result&&typeof result.finally==='function')return result.finally(restore);restore();return result}catch(e){restore();throw e}
    }
  }
})();
