/* Compatibility edges for the first-class organization hierarchy. */
(function initOrganizationHierarchyCompat(){
  if(window.__amoOrganizationHierarchyCompatLoaded)return;window.__amoOrganizationHierarchyCompatLoaded=true;
  const ALL='department',ORG='organization';
  const hierarchy=()=>window.amoOrganizationHierarchy;
  const selectedDepartment=()=>hierarchy()?.selectedDepartment?.()||ORG;
  const selectedTeam=()=>hierarchy()?.selectedTeam?.()||ALL;
  const baseTeams=typeof configuredTeams==='function'?configuredTeams:null;
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

  if(typeof renderRoadmap==='function'){
    const base=renderRoadmap;renderRoadmap=function(){const all=db.demand;db.demand=scopedDemand();try{return base.apply(this,arguments)}finally{db.demand=all}}
  }

  /* Persist hierarchy identifiers and display names in each report snapshot. This lets the
     standalone viewer scope immutable historical reports without loading today's organisation config. */
  if(typeof snapshotStatusEntry==='function'){
    const base=snapshotStatusEntry;snapshotStatusEntry=function(d,e){
      const row=base.apply(this,arguments),team=teamById(d?.teamId),dep=hierarchy()?.departmentById?.(team?.departmentId);
      return{...row,teamId:team?.id||d?.teamId||row.teamId||'',teamName:team?.name||row.teamName||'',departmentId:dep?.id||team?.departmentId||row.departmentId||'',departmentName:dep?.name||row.departmentName||''}
    }
  }
  reportEntriesForScope=function(report){
    const entries=report?.entries||[],dep=selectedDepartment(),teamScope=selectedTeam();
    if(dep===ORG&&teamScope===ALL)return entries;
    return entries.filter(entry=>teamScope!==ALL?entry.teamId===teamScope:entryDepartmentId(entry)===dep)
  };

  function dashboardSnapshotFor(dep=ORG,teamScope=ALL){
    if(typeof planningMonths!=='function'||typeof isOpenDemand!=='function')return null;
    const months=planningMonths(),active=(db.demand||[]).filter(d=>demandMatches(d,dep,teamScope)).filter(isOpenDemand),ids=new Set(active.map(d=>d.id)),allocs=(db.allocations||[]).filter(a=>ids.has(a.demandId)),people=(db.team||[]).filter(p=>personMatches(p,dep,teamScope)).filter(p=>p.active!==false),personIds=new Set(people.map(p=>p.id)),rm=window.ReportingModel,reportingReady=!!rm?.ensureLoaded?.();
    const unallocated=active.filter(d=>!allocs.some(a=>a.demandId===d.id&&a.teamMemberId)).length,socialisation=active.filter(d=>/(socialisation|socialization)/i.test(d.status||'')).length,governance=active.filter(d=>/(approval|governance)/i.test(d.status||'')).length,capacity=people.reduce((n,p)=>n+(Number(p.fte)||0),0);
    const scopedActualPerson=(personId,m)=>active.reduce((sum,d)=>sum+(rm?.actualFte?.(personId,d.id,m)||0),0),scopedForecastPerson=(personId,m)=>allocs.filter(a=>a.teamMemberId===personId).reduce((sum,a)=>sum+(Number(a.forecast?.[m])||0),0),scopedPersonEffort=(personId,m)=>reportingReady&&rm.actualsAvailable(m)?scopedActualPerson(personId,m):scopedForecastPerson(personId,m);
    const conflicts=people.reduce((n,p)=>n+months.filter(m=>scopedPersonEffort(p.id,m)>(Number(p.fte)||0)).length,0);
    const capacityOutlook=months.map(m=>{const basis=reportingReady?rm.periodBasis(m):'forecast',reported=basis==='actual'?active.reduce((sum,d)=>sum+(rm.actualFte(null,d.id,m)||0),0):allocs.reduce((n,a)=>n+(Number(a.forecast?.[m])||0),0);return{month:m,label:typeof monthLabel==='function'?monthLabel(m):m,basis,capacityFte:capacity,reportedFte:reported,allocatedFte:reported,utilisationPct:capacity?Math.round(reported/capacity*100):0}});
    const attentionRequired=active.filter(d=>!allocs.some(a=>a.demandId===d.id&&a.teamMemberId)).map(d=>({kind:'planning',demandId:d.id,title:d.title,reason:'No resource allocation'}));
    if(reportingReady){
      const latest=rm.latestActualMonth?.();if(latest){const signals=rm.managementSignals(latest),label=typeof monthLabel==='function'?monthLabel(`${latest}-01`):latest,personCount=(rows)=>rows.filter(x=>personIds.has(x.personId)).length,demandCount=(rows)=>rows.filter(x=>ids.has(x.demand?.id)).length;
        const noActual=personCount(signals.noActualPeople),low=personCount(signals.lowOverallPeople),redirected=personCount(signals.redirectedPeople),unplanned=personCount(signals.unplannedPeople),over=personCount(signals.overCapacityPeople),demandOver=demandCount(signals.demandOverPlan),unmapped=signals.unmappedProjectFacts.filter(f=>personIds.has(f.teamMemberId)).length;
        if(noActual)attentionRequired.push({kind:'planning',code:'no-actual',reason:`${noActual} ${noActual===1?'person had':'people had'} planned allocation in ${label} but no Actual effort recorded.`});
        if(low)attentionRequired.push({kind:'planning',code:'low-overall',reason:`${low} ${low===1?'person recorded':'people recorded'} materially less total effort than planned in ${label}.`});
        if(redirected)attentionRequired.push({kind:'planning',code:'redirected',reason:`${redirected} ${redirected===1?'person had':'people had'} material effort redirected between Demand in ${label}.`});
        if(unplanned)attentionRequired.push({kind:'planning',code:'unplanned',reason:`${unplanned} ${unplanned===1?'person recorded':'people recorded'} material effort against Demand without a corresponding allocation in ${label}.`});
        if(over)attentionRequired.push({kind:'capacity',code:'over-capacity',reason:`${over} ${over===1?'person exceeded':'people exceeded'} 110% of available capacity in ${label}.`});
        if(demandOver)attentionRequired.push({kind:'delivery',code:'demand-over-plan',reason:`${demandOver} Demand item${demandOver===1?'':'s'} have consumed more than 20% above planned effort to date.`});
        if(unmapped)attentionRequired.push({kind:'data',code:'unmapped-project',reason:`${unmapped} Actual fact${unmapped===1?'':'s'} for known People in ${label} are not mapped to Demand.`})
      }
    }
    const depName=dep===ORG?'Whole Org':(hierarchy()?.departmentById?.(dep)?.name||dep),teamName=teamScope===ALL?(dep===ORG?'All Teams':'Whole Department'):(teamById(teamScope)?.name||teamScope);
    return{capturedAt:new Date().toISOString(),actualsCoverage:reportingReady?rm.coverageLabel():'No Actuals loaded',scopeId:teamScope,scopeName:teamScope===ALL?depName:`${depName} · ${teamName}`,departmentScopeId:dep,teamScopeId:teamScope,activeDemand:active.length,unallocated,inSocialisation:socialisation,inGovernance:governance,capacityConflicts:conflicts,capacityOutlook,attentionRequired}
  }

  if(typeof dashboardHeadlineSnapshot==='function')dashboardHeadlineSnapshot=function(){return dashboardSnapshotFor(selectedDepartment(),selectedTeam())};
  if(typeof buildPreviewReport==='function'){
    const base=buildPreviewReport;buildPreviewReport=function(){
      const report=base.apply(this,arguments),dep=selectedDepartment(),teamScope=selectedTeam();
      report.departmentScopeId=dep;report.teamScopeId=teamScope;report.scopeName=typeof scopeLabel==='function'?scopeLabel():report.scopeName;
      if(report.dashboardSnapshots&&dep===ORG&&teamScope===ALL){
        report.dashboardSnapshots.organization=report.dashboardSnapshot||report.dashboardSnapshots.department||null;
        report.dashboardSnapshots.departments=Object.fromEntries((hierarchy()?.configuredDepartments?.()||[]).map(d=>[d.id,dashboardSnapshotFor(d.id,ALL)]));
        report.dashboardSnapshots.teams=Object.fromEntries(configuredTeams().map(t=>[t.id,dashboardSnapshotFor(t.departmentId||ORG,t.id)]))
      }
      return report
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
